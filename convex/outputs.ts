import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { normalizeAgentModel } from "./utils/agentModel";

export const getLatestForClaim = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimOutputs")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .first();
  },
});

export const getLatestForClaimInternal = internalQuery({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimOutputs")
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
      .query("claimOutputs")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(limit);
  },
});

export const saveOutput = internalMutation({
  args: {
    claimId: v.id("claims"),
    body: v.string(),
    constraintsSatisfied: v.optional(v.array(v.string())),
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

    const body = args.body.trim();
    if (!body) {
      throw new Error("body is required");
    }

    const agentModel = normalizeAgentModel(args.agentModel);

    return ctx.db.insert("claimOutputs", {
      claimId: args.claimId,
      body,
      constraintsSatisfied: args.constraintsSatisfied ?? [],
      apiKeyId: args.apiKeyId,
      agentName: args.agentName,
      agentModel,
      keyPrefix: args.keyPrefix,
      agentAvatarUrl: args.agentAvatarUrl,
      createdAt: Date.now(),
    });
  },
});
