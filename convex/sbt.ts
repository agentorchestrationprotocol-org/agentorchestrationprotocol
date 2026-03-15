import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, internalAction, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { ledgerBackfillPatch, resolveLedgers } from "./utils/balances";

const DEFAULT_STAKE_TOPUP_SINK = "0x000000000000000000000000000000000000dEaD";

const isEvmAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value);

const getStakeTopupSinkAddress = () =>
  (process.env.AOP_STAKE_TOPUP_ADDRESS || DEFAULT_STAKE_TOPUP_SINK).trim();

const getActiveChainId = () => (process.env.BASE_RPC_URL ? 8453 : 84532);

type TopupResult = {
  applied: boolean;
  txHash: string;
  amount: number;
  stakeBalance: number;
  tokenClaimed: number;
};

type WalletAopBalanceResult = {
  walletAddress: string;
  chainId: number;
  balanceWei: string;
  balance: number;
} | null;

// ── Metadata (served as JSON for tokenURI) ────────────────────────────

export const getMetadata = query({
  args: { tokenId: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_sbtTokenId", (q) => q.eq("sbtTokenId", args.tokenId))
      .first();

    if (!user) return null;

    // Find their primary (most recent non-revoked) agent key for display info
    const primaryKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerAuthId", user.authId))
      .filter((q) => q.eq(q.field("revoked"), false))
      .first();

    // Count all slots completed across all their keys
    const allKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerAuthId", user.authId))
      .collect();

    let slotsCompleted = 0;
    for (const key of allKeys) {
      const slots = await ctx.db
        .query("claimStageSlots")
        .withIndex("by_agent_claim_layer_type", (q) => q.eq("apiKeyId", key._id))
        .collect();
      slotsCompleted += slots.filter((s) => s.status === "done").length;
    }

    const displayName = user.alias ?? primaryKey?.agentName ?? "AOP Agent";
    const joinedDate = new Date(user.createdAt).toISOString().split("T")[0];
    const ledgers = resolveLedgers(user);

    return {
      name: displayName,
      description: `AOP Agent — ${slotsCompleted} slot${slotsCompleted !== 1 ? "s" : ""} completed`,
      image: user.profilePictureUrl ?? primaryKey?.avatarUrl ?? null,
      external_url: "https://agentorchestrationprotocol.org",
      attributes: [
        { trait_type: "Alias", value: displayName },
        ...(primaryKey?.agentModel ? [{ trait_type: "Model", value: primaryKey.agentModel }] : []),
        { trait_type: "Slots Completed", value: slotsCompleted, display_type: "number" },
        { trait_type: "Claimable Balance", value: ledgers.claimableBalance, display_type: "number" },
        { trait_type: "Stake Balance", value: ledgers.stakeBalance, display_type: "number" },
        { trait_type: "Joined", value: joinedDate, display_type: "date" },
      ],
    };
  },
});

// ── Wallet linking ────────────────────────────────────────────────────

export const linkWallet = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    if (!/^0x[0-9a-fA-F]{40}$/.test(args.walletAddress)) {
      throw new Error("Invalid wallet address");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();
    if (existing && existing._id !== user._id) {
      throw new Error("Wallet already linked to another account");
    }

    if (user.walletAddress === args.walletAddress) {
      return { alreadyLinked: true, sbtTokenId: user.sbtTokenId };
    }

    await ctx.db.patch(user._id, { walletAddress: args.walletAddress });

    if (user.sbtTokenId === undefined) {
      await ctx.scheduler.runAfter(0, internal.sbt.mintSBTForAgentAction, {
        userId: user._id,
        walletAddress: args.walletAddress,
      });
    }

    return { alreadyLinked: false, sbtTokenId: user.sbtTokenId };
  },
});

export const mintSBTForAgentAction = internalAction({
  args: {
    userId: v.id("users"),
    walletAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenId: number = await ctx.runAction(internal.blockchain.mintSBT, {
      walletAddress: args.walletAddress,
    });

    await ctx.runMutation(internal.sbt.recordSBTMint, {
      userId: args.userId,
      tokenId,
    });
  },
});

export const recordSBTMint = internalMutation({
  args: {
    userId: v.id("users"),
    tokenId: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      sbtTokenId: args.tokenId,
      sbtMintedAt: Date.now(),
    });
  },
});

// ── Claim tokens on-chain ─────────────────────────────────────────────

export const claimTokens = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!user) throw new ConvexError("User not found");
    if (!user.walletAddress) throw new ConvexError("No wallet linked — link a wallet first");
    const backfill = ledgerBackfillPatch(user);
    if (backfill) {
      await ctx.db.patch(user._id, backfill);
    }
    const ledgers = resolveLedgers(user);

    const balance = ledgers.claimableBalance;
    if (balance <= 0) throw new ConvexError("No tokens to claim");
    const MIN_CLAIM = 200;
    if (balance < MIN_CLAIM) {
      throw new ConvexError(
        `Minimum claim is ${MIN_CLAIM} AOP. You have ${balance} AOP — keep earning and claim when you reach ${MIN_CLAIM}.`
      );
    }

    await ctx.db.patch(user._id, {
      claimableBalance: 0,
      stakeBalance: ledgers.stakeBalance,
      tokenBalance: 0,
      tokenClaimed: (user.tokenClaimed ?? 0) + balance,
      tokenClaimStatus: "pending",
      tokenTxHash: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.sbt.mintTokensForAgent, {
      userId: user._id,
      walletAddress: user.walletAddress,
      amount: balance,
    });

    return { claiming: balance };
  },
});

export const mintTokensForAgent = internalAction({
  args: {
    userId: v.id("users"),
    walletAddress: v.string(),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.sbt.patchClaimStatus, {
      userId: args.userId,
      status: "confirming",
    });
    try {
      const txHash = await ctx.runAction(internal.blockchain.mintTokens, {
        walletAddress: args.walletAddress,
        amount: args.amount,
      });
      await ctx.runMutation(internal.sbt.patchClaimStatus, {
        userId: args.userId,
        status: "confirmed",
        txHash,
      });
    } catch (err) {
      await ctx.runMutation(internal.sbt.patchClaimStatus, {
        userId: args.userId,
        status: "failed",
      });
      await ctx.runMutation(internal.sbt.restoreTokenBalance, {
        userId: args.userId,
        amount: args.amount,
      });
      throw err;
    }
  },
});

export const patchClaimStatus = internalMutation({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirming"),
      v.literal("confirmed"),
      v.literal("failed"),
    ),
    txHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      tokenClaimStatus: args.status,
      ...(args.txHash ? { tokenTxHash: args.txHash } : {}),
    });
  },
});

export const restoreTokenBalance = internalMutation({
  args: { userId: v.id("users"), amount: v.number() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;
    const backfill = ledgerBackfillPatch(user);
    if (backfill) {
      await ctx.db.patch(args.userId, backfill);
    }
    const ledgers = resolveLedgers(user);
    await ctx.db.patch(args.userId, {
      claimableBalance: ledgers.claimableBalance + args.amount,
      stakeBalance: ledgers.stakeBalance,
      tokenBalance: 0,
      tokenClaimed: Math.max(0, (user.tokenClaimed ?? 0) - args.amount),
    });
  },
});

export const getTopupByTxHash = internalQuery({
  args: { txHash: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tokenTopups")
      .withIndex("by_txHash", (q) => q.eq("txHash", args.txHash))
      .first();
  },
});

export const applyVerifiedTopup = internalMutation({
  args: {
    userId: v.id("users"),
    walletAddress: v.string(),
    txHash: v.string(),
    fromAddress: v.string(),
    toAddress: v.string(),
    amount: v.number(),
    amountWei: v.string(),
    chainId: v.number(),
    blockNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tokenTopups")
      .withIndex("by_txHash", (q) => q.eq("txHash", args.txHash))
      .first();

    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const backfill = ledgerBackfillPatch(user);
    if (backfill) {
      await ctx.db.patch(args.userId, backfill);
    }
    const ledgers = resolveLedgers(user);

    if (existing) {
      if (existing.userId !== args.userId) {
        throw new Error("Top-up transaction already used by another account");
      }
      return {
        applied: false,
        txHash: existing.txHash,
        amount: existing.amount,
        stakeBalance: ledgers.stakeBalance,
        tokenClaimed: user.tokenClaimed ?? 0,
      };
    }

    const currentClaimed = user.tokenClaimed ?? 0;
    if (currentClaimed < args.amount) {
      throw new Error(
        `Top-up amount (${args.amount} AOP) exceeds your claimable-on-chain ledger (${currentClaimed} AOP)`
      );
    }

    const nextStakeBalance = ledgers.stakeBalance + args.amount;
    const nextClaimed = currentClaimed - args.amount;

    await ctx.db.insert("tokenTopups", {
      userId: args.userId,
      walletAddress: args.walletAddress,
      txHash: args.txHash,
      fromAddress: args.fromAddress,
      toAddress: args.toAddress,
      amount: args.amount,
      amountWei: args.amountWei,
      chainId: args.chainId,
      blockNumber: args.blockNumber,
      status: "confirmed",
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.userId, {
      stakeBalance: nextStakeBalance,
      claimableBalance: ledgers.claimableBalance,
      tokenBalance: 0,
      tokenClaimed: nextClaimed,
    });

    return {
      applied: true,
      txHash: args.txHash,
      amount: args.amount,
      stakeBalance: nextStakeBalance,
      tokenClaimed: nextClaimed,
    };
  },
});

export const topUpStakeFromWalletTransfer = action({
  args: { txHash: v.string() },
  handler: async (ctx, args): Promise<TopupResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(api.users.getMyProfile, {});
    if (!user) throw new Error("User not found");
    if (!user.walletAddress) {
      throw new Error("No wallet linked — link a wallet first");
    }

    const txHash = args.txHash.toLowerCase();
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      throw new Error("Invalid transaction hash");
    }

    const sinkAddress = getStakeTopupSinkAddress();
    if (!isEvmAddress(sinkAddress)) {
      throw new Error("Stake top-up sink is not configured");
    }

    const existing = await ctx.runQuery(internal.sbt.getTopupByTxHash, { txHash });
    if (existing) {
      if (existing.userId !== user._id) {
        throw new Error("Top-up transaction already used by another account");
      }
      const ledgers = resolveLedgers(user);
      return {
        applied: false,
        txHash: existing.txHash,
        amount: existing.amount,
        stakeBalance: ledgers.stakeBalance,
        tokenClaimed: user.tokenClaimed ?? 0,
      };
    }

    const verified = await ctx.runAction(internal.blockchain.verifyStakeTopupTransfer, {
      txHash,
      fromAddress: user.walletAddress,
      toAddress: sinkAddress,
    });

    return ctx.runMutation(internal.sbt.applyVerifiedTopup, {
      userId: user._id,
      walletAddress: user.walletAddress,
      txHash: verified.txHash,
      fromAddress: verified.fromAddress,
      toAddress: verified.toAddress,
      amount: verified.amount,
      amountWei: verified.amountWei,
      chainId: verified.chainId,
      blockNumber: verified.blockNumber,
    });
  },
});

export const getMyWalletAopBalance = action({
  args: {},
  handler: async (ctx): Promise<WalletAopBalanceResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.runQuery(api.users.getMyProfile, {});
    if (!user?.walletAddress) return null;

    const onChain = await ctx.runAction(internal.blockchain.readAopTokenBalance, {
      walletAddress: user.walletAddress,
    });

    return {
      walletAddress: user.walletAddress,
      chainId: onChain.chainId,
      balanceWei: onChain.balanceWei,
      balance: onChain.balanceWhole,
    };
  },
});

export const retryMintSBT = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    if (!user.walletAddress) throw new Error("No wallet linked");
    if (user.sbtTokenId !== undefined) throw new Error("SBT already minted");

    await ctx.scheduler.runAfter(0, internal.sbt.mintSBTForAgentAction, {
      userId: user._id,
      walletAddress: user.walletAddress,
    });
  },
});

// ── Public queries ────────────────────────────────────────────────────

/**
 * Returns the AOP token contract address so the frontend can call wallet_watchAsset.
 * Returns null if the env var is not set (dev without contracts deployed).
 */
export const getAopTokenAddress = query({
  args: {},
  handler: async () => {
    return process.env.AOP_TOKEN_ADDRESS ?? null;
  },
});

export const getStakeTopupConfig = query({
  args: {},
  handler: async () => {
    const tokenAddress = process.env.AOP_TOKEN_ADDRESS ?? null;
    const sinkAddress = getStakeTopupSinkAddress();
    const chainId = getActiveChainId();

    return {
      enabled: !!tokenAddress && isEvmAddress(sinkAddress),
      chainId,
      tokenAddress,
      sinkAddress: isEvmAddress(sinkAddress) ? sinkAddress : null,
    };
  },
});

/**
 * Returns the user-level crypto profile for a given API key.
 * Profile page calls this with a specific apiKeyId; the data lives on the user.
 */
export const getAgentCryptoProfile = query({
  args: { apiKeyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.apiKeyId);
    if (!agent) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", agent.ownerAuthId))
      .unique();
    if (!user) return null;
    const ledgers = resolveLedgers(user);

    return {
      walletAddress: user.walletAddress,
      sbtTokenId: user.sbtTokenId,
      sbtMintedAt: user.sbtMintedAt,
      claimableBalance: ledgers.claimableBalance,
      stakeBalance: ledgers.stakeBalance,
      tokenBalance: ledgers.stakeBalance, // back-compat alias
      tokenClaimed: user.tokenClaimed ?? 0,
      tokenClaimStatus: user.tokenClaimStatus ?? null,
      tokenTxHash: user.tokenTxHash ?? null,
    };
  },
});
