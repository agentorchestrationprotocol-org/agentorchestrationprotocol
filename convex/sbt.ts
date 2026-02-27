import { v } from "convex/values";
import { internalMutation, internalQuery, internalAction, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// ── Metadata (served as JSON for tokenURI) ────────────────────────────

export const getMetadata = internalQuery({
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

    return {
      name: displayName,
      description: `AOP Agent — ${slotsCompleted} slot${slotsCompleted !== 1 ? "s" : ""} completed`,
      image: user.profilePictureUrl ?? primaryKey?.avatarUrl ?? null,
      external_url: "https://agentorchestrationprotocol.org",
      attributes: [
        { trait_type: "Alias", value: displayName },
        ...(primaryKey?.agentModel ? [{ trait_type: "Model", value: primaryKey.agentModel }] : []),
        { trait_type: "Slots Completed", value: slotsCompleted, display_type: "number" },
        { trait_type: "Token Balance", value: user.tokenBalance ?? 0, display_type: "number" },
        { trait_type: "Joined", value: joinedDate, display_type: "date" },
      ],
    };
  },
});

export const getSBTMetadata = query({
  args: { tokenId: v.number() },
  handler: async (ctx, args) => {
    return ctx.runQuery(internal.sbt.getMetadata, { tokenId: args.tokenId });
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
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");
    if (!user.walletAddress) throw new Error("No wallet linked — link a wallet first");

    const balance = user.tokenBalance ?? 0;
    if (balance <= 0) throw new Error("No tokens to claim");
    const MIN_CLAIM = 1000;
    if (balance < MIN_CLAIM) throw new Error(`Minimum claim is ${MIN_CLAIM} AOP. You have ${balance} AOP — keep earning and claim when you reach ${MIN_CLAIM}.`);

    await ctx.db.patch(user._id, {
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
    await ctx.db.patch(args.userId, {
      tokenBalance: (user.tokenBalance ?? 0) + args.amount,
      tokenClaimed: Math.max(0, (user.tokenClaimed ?? 0) - args.amount),
    });
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
  handler: async (_ctx, _args) => {
    return process.env.AOP_TOKEN_ADDRESS ?? null;
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

    return {
      walletAddress: user.walletAddress,
      sbtTokenId: user.sbtTokenId,
      sbtMintedAt: user.sbtMintedAt,
      tokenBalance: user.tokenBalance ?? 0,
      tokenClaimed: user.tokenClaimed ?? 0,
      tokenClaimStatus: user.tokenClaimStatus ?? null,
      tokenTxHash: user.tokenTxHash ?? null,
    };
  },
});
