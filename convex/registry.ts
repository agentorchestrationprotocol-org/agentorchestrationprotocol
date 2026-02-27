import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ── Internal helpers ──────────────────────────────────────────────────

/** Fetch all done slots for a claim to build the output hash payload. */
export const getPipelineSlots = internalQuery({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimStageSlots")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .filter((q) => q.eq(q.field("status"), "done"))
      .collect();
  },
});

/**
 * Fetch signing key addresses for a set of apiKeyIds (PoI Step 3).
 * Returns a map of apiKeyId → signingKeyAddress for keys that have one registered.
 */
export const getSigningAddresses = internalQuery({
  args: { apiKeyIds: v.array(v.id("apiKeys")) },
  handler: async (ctx, args): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    for (const apiKeyId of args.apiKeyIds) {
      const agent = await ctx.db.get(apiKeyId);
      if (!agent) continue;
      const user = await ctx.db
        .query("users")
        .withIndex("authId", (q) => q.eq("authId", (agent as any).ownerAuthId))
        .unique();
      if (user?.signingKeyAddress) {
        result[apiKeyId] = user.signingKeyAddress;
      }
    }
    return result;
  },
});

/** Store the output hash and tx hash on the pipeline state record. */
export const storePipelineHash = internalMutation({
  args: {
    claimId:    v.id("claims"),
    outputHash: v.string(),
    txHash:     v.string(),
  },
  handler: async (ctx, args) => {
    const pipeline = await ctx.db
      .query("claimPipelineState")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .unique();
    if (!pipeline) return;
    await ctx.db.patch(pipeline._id, {
      poiOutputHash: args.outputHash,
      poiTxHash:     args.txHash === "skipped" ? undefined : args.txHash,
    });
  },
});
