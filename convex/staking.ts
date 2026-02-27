import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Proof of Intelligence — Step 2: Staking + Slashing
 *
 * Every work slot requires a small AOP stake. The stake is:
 *  - RETURNED to the agent if the layer passes consensus (confidence ≥ threshold)
 *  - BURNED if the layer is flagged (confidence < threshold)
 *
 * This makes trolling economically irrational: submitting garbage costs STAKE.AMOUNT
 * AOP per slot, guaranteed loss. Only genuine contributions earn rewards.
 *
 * New users receive STAKE.INITIAL_GRANT AOP on their first API key so they can
 * participate immediately without needing prior earnings.
 */

export const STAKE = {
  AMOUNT: 5,           // AOP required to take a work slot
  INITIAL_GRANT: 50,   // bootstrapping AOP granted on first API key creation
} as const;

// ── Helpers (called directly by stageEngine in the same mutation) ─────

/**
 * Deduct STAKE.AMOUNT from the agent's user balance when they take a work slot.
 * Stores stakeAmount on the slot for later release or slash.
 * Throws "INSUFFICIENT_STAKE" if balance < STAKE.AMOUNT.
 */
export async function deductStakeHandler(
  ctx: MutationCtx,
  slotId: Id<"claimStageSlots">,
  apiKeyId: Id<"apiKeys">
): Promise<void> {
  const agent = await ctx.db.get(apiKeyId);
  if (!agent) return;

  const user = await ctx.db
    .query("users")
    .withIndex("authId", (q) => q.eq("authId", agent.ownerAuthId))
    .unique();
  if (!user) return;

  const balance = user.tokenBalance ?? 0;
  if (balance < STAKE.AMOUNT) throw new Error("INSUFFICIENT_STAKE");

  await ctx.db.patch(user._id, { tokenBalance: balance - STAKE.AMOUNT });
  await ctx.db.patch(slotId, { stakeAmount: STAKE.AMOUNT });
}

/**
 * Return stakes to all work-slot agents in a layer that passed confidence.
 * Called after applyLayerEffect when avgConfidence >= consensusThreshold.
 */
export async function releaseStakesHandler(
  ctx: MutationCtx,
  claimId: Id<"claims">,
  layer: number
): Promise<void> {
  const workSlots = await ctx.db
    .query("claimStageSlots")
    .withIndex("by_claim_layer", (q) =>
      q.eq("claimId", claimId).eq("layer", layer)
    )
    .filter((q) =>
      q.and(
        q.eq(q.field("slotType"), "work"),
        q.eq(q.field("status"), "done")
      )
    )
    .collect();

  for (const slot of workSlots) {
    if (!slot.apiKeyId || !slot.stakeAmount || slot.stakeAmount <= 0) continue;

    const agent = await ctx.db.get(slot.apiKeyId);
    if (!agent) continue;

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", agent.ownerAuthId))
      .unique();
    if (!user) continue;

    await ctx.db.patch(user._id, {
      tokenBalance: (user.tokenBalance ?? 0) + slot.stakeAmount,
    });
    // Zero out so we don't double-release
    await ctx.db.patch(slot._id, { stakeAmount: 0 });
  }
}

/**
 * Slash (burn) stakes for all work-slot agents in a flagged layer.
 * Called when avgConfidence < consensusThreshold. Stakes are permanently lost.
 */
export async function slashStakesHandler(
  ctx: MutationCtx,
  claimId: Id<"claims">,
  layer: number
): Promise<void> {
  const workSlots = await ctx.db
    .query("claimStageSlots")
    .withIndex("by_claim_layer", (q) =>
      q.eq("claimId", claimId).eq("layer", layer)
    )
    .filter((q) => q.eq(q.field("slotType"), "work"))
    .collect();

  for (const slot of workSlots) {
    if (!slot.stakeAmount || slot.stakeAmount <= 0) continue;
    // Burn: do not return. Zero out the slot stake record.
    await ctx.db.patch(slot._id, { stakeAmount: 0 });
  }
}

// ── internalMutation wrappers (for use via scheduler if needed) ───────

export const deductStake = internalMutation({
  args: {
    slotId: v.id("claimStageSlots"),
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) =>
    deductStakeHandler(ctx, args.slotId, args.apiKeyId),
});

export const releaseStakes = internalMutation({
  args: {
    claimId: v.id("claims"),
    layer: v.number(),
  },
  handler: async (ctx, args) =>
    releaseStakesHandler(ctx, args.claimId, args.layer),
});

export const slashStakes = internalMutation({
  args: {
    claimId: v.id("claims"),
    layer: v.number(),
  },
  handler: async (ctx, args) =>
    slashStakesHandler(ctx, args.claimId, args.layer),
});
