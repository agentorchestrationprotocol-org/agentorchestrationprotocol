import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Token amounts per event
export const REWARD = {
  SLOT_WORK: 10,
  SLOT_CONSENSUS: 5,
  LAYER_BONUS: 20,   // awarded to all work-slot contributors when layer passes
  PIPELINE_BONUS: 50, // awarded to all contributors when pipeline completes (L7)
} as const;

/**
 * Award tokens to the user who owns an API key for completing a slot.
 * Records a tokenRewards entry and increments user.tokenBalance.
 */
export const awardSlotReward = internalMutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    slotType: v.union(v.literal("work"), v.literal("consensus")),
    claimId: v.id("claims"),
    slotId: v.id("claimStageSlots"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.apiKeyId);
    if (!agent || agent.revoked) return;

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", agent.ownerAuthId))
      .unique();
    if (!user) return;

    const amount = args.slotType === "work" ? REWARD.SLOT_WORK : REWARD.SLOT_CONSENSUS;
    const reason = args.slotType === "work" ? "slot_work" : "slot_consensus";

    await ctx.db.insert("tokenRewards", {
      apiKeyId: args.apiKeyId,
      userId: user._id,
      amount,
      reason,
      claimId: args.claimId,
      slotId: args.slotId,
      createdAt: Date.now(),
    });

    await ctx.db.patch(user._id, {
      tokenBalance: (user.tokenBalance ?? 0) + amount,
    });
  },
});

/**
 * Award a layer-pass bonus to all users who did work slots in this layer.
 * Deduplicates by userId — one bonus per user per layer.
 */
export const awardLayerBonus = internalMutation({
  args: {
    claimId: v.id("claims"),
    layer: v.number(),
  },
  handler: async (ctx, args) => {
    const workSlots = await ctx.db
      .query("claimStageSlots")
      .withIndex("by_claim_layer", (q) =>
        q.eq("claimId", args.claimId).eq("layer", args.layer)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("slotType"), "work"),
          q.eq(q.field("status"), "done"),
          q.neq(q.field("apiKeyId"), undefined)
        )
      )
      .collect();

    const seen = new Set<string>(); // userId strings
    const now = Date.now();

    for (const slot of workSlots) {
      if (!slot.apiKeyId) continue;
      const agent = await ctx.db.get(slot.apiKeyId);
      if (!agent || agent.revoked) continue;

      const user = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", agent.ownerAuthId))
        .unique();
      if (!user) continue;
      if (seen.has(user._id)) continue;
      seen.add(user._id);

      await ctx.db.insert("tokenRewards", {
        apiKeyId: slot.apiKeyId,
        userId: user._id,
        amount: REWARD.LAYER_BONUS,
        reason: "layer_bonus",
        claimId: args.claimId,
        slotId: slot._id,
        createdAt: now,
      });

      await ctx.db.patch(user._id, {
        tokenBalance: (user.tokenBalance ?? 0) + REWARD.LAYER_BONUS,
      });
    }
  },
});

/**
 * Award pipeline completion bonus to all users who contributed to any layer.
 * Deduplicates by userId.
 */
export const awardPipelineBonus = internalMutation({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    const allWorkSlots = await ctx.db
      .query("claimStageSlots")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .filter((q) =>
        q.and(
          q.eq(q.field("slotType"), "work"),
          q.eq(q.field("status"), "done"),
          q.neq(q.field("apiKeyId"), undefined)
        )
      )
      .collect();

    const seen = new Set<string>(); // userId strings
    const now = Date.now();

    for (const slot of allWorkSlots) {
      if (!slot.apiKeyId) continue;
      const agent = await ctx.db.get(slot.apiKeyId);
      if (!agent || agent.revoked) continue;

      const user = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", agent.ownerAuthId))
        .unique();
      if (!user) continue;
      if (seen.has(user._id)) continue;
      seen.add(user._id);

      await ctx.db.insert("tokenRewards", {
        apiKeyId: slot.apiKeyId,
        userId: user._id,
        amount: REWARD.PIPELINE_BONUS,
        reason: "pipeline_bonus",
        claimId: args.claimId,
        createdAt: now,
      });

      await ctx.db.patch(user._id, {
        tokenBalance: (user.tokenBalance ?? 0) + REWARD.PIPELINE_BONUS,
      });
    }
  },
});

/**
 * Award tokens to the user who owns an API key for completing a council role slot.
 */
export const awardRoleSlotReward = internalMutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.apiKeyId);
    if (!agent || agent.revoked) return;

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", agent.ownerAuthId))
      .unique();
    if (!user) return;

    await ctx.db.insert("tokenRewards", {
      apiKeyId: args.apiKeyId,
      userId: user._id,
      amount: REWARD.SLOT_WORK,
      reason: "slot_work",
      claimId: args.claimId,
      createdAt: Date.now(),
    });

    await ctx.db.patch(user._id, {
      tokenBalance: (user.tokenBalance ?? 0) + REWARD.SLOT_WORK,
    });
  },
});

// ── Public queries ────────────────────────────────────────────────────

/**
 * Top users by total AOP earned (balance + claimed).
 * Used by the /leaderboard page.
 */
export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);

    const allUsers = await ctx.db.query("users").collect();

    return allUsers
      .map((u) => ({
        _id: u._id,
        alias: u.alias,
        profilePictureUrl: u.profilePictureUrl,
        sbtTokenId: u.sbtTokenId,
        tokenBalance: u.tokenBalance ?? 0,
        tokenClaimed: u.tokenClaimed ?? 0,
        totalEarned: (u.tokenBalance ?? 0) + (u.tokenClaimed ?? 0),
      }))
      .filter((u) => u.totalEarned > 0)
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, limit);
  },
});

export const listRewardsForAgent = query({
  args: {
    apiKeyId: v.id("apiKeys"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    return ctx.db
      .query("tokenRewards")
      .withIndex("by_apiKey", (q) => q.eq("apiKeyId", args.apiKeyId))
      .order("desc")
      .take(limit);
  },
});
