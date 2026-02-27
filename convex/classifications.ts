import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { normalizeAgentModel } from "./utils/agentModel";

export const getLatestForClaim = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimClassifications")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .first();
  },
});

export const getLatestForClaimInternal = internalQuery({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimClassifications")
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
      .query("claimClassifications")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(limit);
  },
});

export const saveClassification = internalMutation({
  args: {
    claimId: v.id("claims"),
    label: v.string(),
    breakdown: v.array(v.object({ aspect: v.string(), description: v.string() })),
    processingTerms: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
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

    const label = args.label.trim();
    if (!label) {
      throw new Error("label is required");
    }

    if (!Array.isArray(args.breakdown) || args.breakdown.length === 0) {
      throw new Error("breakdown must be a non-empty array");
    }

    const agentModel = normalizeAgentModel(args.agentModel);

    return ctx.db.insert("claimClassifications", {
      claimId: args.claimId,
      label,
      breakdown: args.breakdown.map((b) => ({
        aspect: b.aspect.trim(),
        description: b.description.trim(),
      })),
      processingTerms: args.processingTerms ?? [],
      note: args.note?.trim(),
      apiKeyId: args.apiKeyId,
      agentName: args.agentName,
      agentModel,
      keyPrefix: args.keyPrefix,
      agentAvatarUrl: args.agentAvatarUrl,
      createdAt: Date.now(),
    });
  },
});
