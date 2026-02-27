"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createHash } from "crypto";

/**
 * Proof of Intelligence — Step 1: Output Hashing
 *
 * When a pipeline completes, this action:
 *  1. Collects all slot outputs for the claim (summary + confidence per slot)
 *  2. Builds a deterministic JSON payload sorted by layer → slotId
 *  3. Computes sha256 of the payload
 *  4. Commits the hash to AOPRegistry on-chain via blockchain.commitPipelineHash
 *
 * The on-chain hash makes tampering detectable: any change to the pipeline
 * outputs in the Convex DB produces a different hash, which anyone can verify
 * against the on-chain record.
 */
export const commitPipelineHashAction = internalAction({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args): Promise<void> => {
    // 1. Fetch all done slots for this claim
    const slots = await ctx.runQuery(internal.registry.getPipelineSlots, {
      claimId: args.claimId,
    });

    if (slots.length === 0) return;

    // 2. Build deterministic payload — sorted by layer asc, then _id asc
    const sorted = [...slots].sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      return a._id < b._id ? -1 : 1;
    });

    // Collect signing key addresses for work-slot agents (PoI Step 3)
    const apiKeyIds = [...new Set(slots.map((s) => s.apiKeyId).filter((id): id is NonNullable<typeof id> => !!id))];
    const signingAddresses: Record<string, string> = await ctx.runQuery(
      internal.registry.getSigningAddresses,
      { apiKeyIds }
    );

    const payload = JSON.stringify(
      sorted.map((s) => ({
        id:              s._id,
        layer:           s.layer,
        role:            s.role,
        slotType:        s.slotType,
        output:          s.output ?? "",
        confidence:      s.confidence ?? 0,
        signingAddress:  s.apiKeyId ? (signingAddresses[s.apiKeyId] ?? "") : "",
        outputSignature: s.outputSignature ?? "",
      }))
    );

    // 3. Hash the payload
    const outputHash = "0x" + createHash("sha256").update(payload).digest("hex");

    // Count distinct agents (apiKeyIds)
    const agentSet = new Set(slots.map((s) => s.apiKeyId).filter(Boolean));
    const agentCount = agentSet.size;

    // Count distinct layers
    const layerSet = new Set(slots.map((s) => s.layer));
    const layerCount = layerSet.size;

    // 4. Commit to AOPRegistry on-chain
    const txHash = await ctx.runAction(internal.blockchain.commitPipelineHash, {
      claimIdStr:  args.claimId,
      outputHash,
      agentCount,
      layerCount,
    });

    // 5. Store hash locally for easy querying (pipeline state)
    await ctx.runMutation(internal.registry.storePipelineHash, {
      claimId:    args.claimId,
      outputHash,
      txHash,
    });
  },
});
