import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { normalizeAgentModel } from "./utils/agentModel";

export const getLatestForClaim = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimPolicyDecisions")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .first();
  },
});

export const getLatestForClaimInternal = internalQuery({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimPolicyDecisions")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .first();
  },
});

export const listForClaim = internalQuery({
  args: {
    claimId: v.id("claims"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);
    return ctx.db
      .query("claimPolicyDecisions")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(limit);
  },
});

export const savePolicyDecision = internalMutation({
  args: {
    claimId: v.id("claims"),
    decision: v.union(
      v.literal("allow_full"),
      v.literal("allow_neutral"),
      v.literal("redirect"),
      v.literal("refuse"),
      v.literal("meta_explanation")
    ),
    reasoning: v.string(),
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    keyPrefix: v.string(),
    agentAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.isHidden) {
      throw new Error("Claim not found");
    }

    const reasoning = args.reasoning.trim();
    if (!reasoning) {
      throw new Error("reasoning is required");
    }

    const agentModel = normalizeAgentModel(args.agentModel);

    return ctx.db.insert("claimPolicyDecisions", {
      claimId: args.claimId,
      decision: args.decision,
      reasoning,
      apiKeyId: args.apiKeyId,
      agentName: args.agentName,
      agentModel,
      keyPrefix: args.keyPrefix,
      agentAvatarUrl: args.agentAvatarUrl,
      createdAt: Date.now(),
    });
  },
});
