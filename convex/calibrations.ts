import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const REQUIRED_TOTAL = 100;

const normalizeScores = (scores: Array<{ domain: string; score: number }>) => {
  const trimmed = scores
    .map((item) => ({
      domain: item.domain.trim(),
      score: Math.round(item.score),
    }))
    .filter((item) => item.domain.length > 0);

  for (const item of trimmed) {
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > 100) {
      throw new Error("Scores must be between 0 and 100");
    }
  }

  const nonZero = trimmed.filter((item) => item.score > 0);

  const seen = new Set<string>();
  for (const item of nonZero) {
    if (seen.has(item.domain)) {
      throw new Error("Duplicate domain");
    }
    seen.add(item.domain);
  }

  const total = nonZero.reduce((sum, item) => sum + item.score, 0);
  return { scores: nonZero, total };
};

const applyCalibration = async (
  ctx: MutationCtx,
  claimId: Id<"claims">,
  scoresInput: Array<{ domain: string; score: number }>,
  editorAuthId: string,
  editorName: string
) => {
  const claim = await ctx.db.get(claimId);
  if (!claim || claim.isHidden) {
    throw new Error("Claim not found");
  }

  const { scores, total } = normalizeScores(scoresInput);
  if (total !== REQUIRED_TOTAL) {
    throw new Error("Scores must sum to 100");
  }
  if (scores.length === 0) {
    throw new Error("At least one domain is required");
  }

  const topDomain = scores.reduce((best, current) =>
    current.score > best.score ? current : best
  ).domain;

  const now = Date.now();

  await ctx.db.patch(claim._id, {
    domain: topDomain,
    updatedAt: now,
  });

  return ctx.db.insert("claimCalibrations", {
    claimId: claim._id,
    scores,
    total,
    editorAuthId,
    editorName,
    createdAt: now,
  });
};

export const getLatestForClaim = query({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimCalibrations")
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
      .query("claimCalibrations")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(limit);
  },
});

export const saveCalibration = mutation({
  args: {
    claimId: v.id("claims"),
    scores: v.array(
      v.object({
        domain: v.string(),
        score: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const editorName =
      identity.name || identity.email || identity.subject || "user";
    return applyCalibration(ctx, args.claimId, args.scores, identity.subject, editorName);
  },
});

export const saveCalibrationAsAgent = internalMutation({
  args: {
    claimId: v.id("claims"),
    scores: v.array(
      v.object({
        domain: v.string(),
        score: v.number(),
      })
    ),
    agentName: v.string(),
    keyPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    const editorAuthId = `agent:${args.keyPrefix}`;
    const editorName = args.agentName?.trim() || "agent";
    return applyCalibration(ctx, args.claimId, args.scores, editorAuthId, editorName);
  },
});
