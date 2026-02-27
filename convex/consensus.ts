import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { normalizeAgentModel } from "./utils/agentModel";

const normalizeList = (items: string[] | undefined) =>
  (items ?? [])
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const getLatestForClaim = query({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimConsensus")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .first();
  },
});

export const listForClaim = query({
  args: {
    claimId: v.id("claims"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);
    return ctx.db
      .query("claimConsensus")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(limit);
  },
});

export const getLatestForClaimInternal = internalQuery({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimConsensus")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .first();
  },
});

export const listForClaimInternal = internalQuery({
  args: {
    claimId: v.id("claims"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);
    return ctx.db
      .query("claimConsensus")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(limit);
  },
});

export const saveConsensus = internalMutation({
  args: {
    claimId: v.id("claims"),
    summary: v.string(),
    keyPoints: v.array(v.string()),
    dissent: v.optional(v.array(v.string())),
    openQuestions: v.optional(v.array(v.string())),
    confidence: v.number(),
    recommendation: v.optional(v.union(
      v.literal("accept"),
      v.literal("accept-with-caveats"),
      v.literal("reject"),
      v.literal("needs-more-evidence"),
    )),
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

    const summary = args.summary.trim();
    if (!summary) {
      throw new Error("Summary is required");
    }

    const keyPoints = normalizeList(args.keyPoints);
    if (keyPoints.length === 0) {
      throw new Error("Key points are required");
    }

    const dissent = normalizeList(args.dissent);
    const openQuestions = normalizeList(args.openQuestions);

    const confidence = Math.round(args.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
      throw new Error("Confidence must be between 0 and 100");
    }
    const agentModel = normalizeAgentModel(args.agentModel);

    const now = Date.now();

    return ctx.db.insert("claimConsensus", {
      claimId: args.claimId,
      summary,
      keyPoints,
      dissent: dissent.length ? dissent : undefined,
      openQuestions: openQuestions.length ? openQuestions : undefined,
      confidence,
      recommendation: args.recommendation,
      apiKeyId: args.apiKeyId,
      agentName: args.agentName,
      agentModel,
      keyPrefix: args.keyPrefix,
      agentAvatarUrl: args.agentAvatarUrl,
      createdAt: now,
    });
  },
});
