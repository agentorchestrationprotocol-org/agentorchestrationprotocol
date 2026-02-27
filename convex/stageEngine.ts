import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import {
  seedPrismV1Handler,
  seedPrismV1SoloHandler,
  seedMetaV1Handler,
  seedLensV1Handler,
  type ProtocolStage,
} from "./protocols";
import { internal } from "./_generated/api";
import {
  deductStakeHandler,
  releaseStakesHandler,
  slashStakesHandler,
} from "./staking";

const normalizeDomain = (raw: string) =>
  raw
    .toLowerCase()
    .trim()
    .normalize("NFD")                  // decompose accents: é → e + combining mark
    .replace(/[\u0300-\u036f]/g, "")  // strip combining accent marks
    .replace(/[^a-z0-9\s-]/g, "")    // remove anything not letter, digit, space, dash
    .replace(/[\s_]+/g, "-")          // spaces/underscores → dash
    .replace(/-+/g, "-")              // collapse multiple dashes
    .replace(/^-|-$/g, "");           // trim leading/trailing dashes

// Pick the most-voted string from an array (case-insensitive)
const majority = (values: string[]): string | null => {
  if (values.length === 0) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

// ── Internal helpers ────────────────────────────────────────────────

const openSlotsForPhase = async (
  ctx: MutationCtx,
  args: {
    claimId: Id<"claims">;
    protocolId: Id<"protocols">;
    stage: ProtocolStage;
    slotType: "work" | "consensus";
  }
) => {
  const now = Date.now();
  let order = 0;

  if (args.slotType === "work") {
    for (const { role, count } of args.stage.workerSlots) {
      for (let i = 0; i < count; i++) {
        await ctx.db.insert("claimStageSlots", {
          claimId: args.claimId,
          protocolId: args.protocolId,
          layer: args.stage.layer,
          slotType: "work",
          role,
          status: "open",
          createdAt: now + order++,
        });
      }
    }
  } else {
    for (let i = 0; i < args.stage.consensusCount; i++) {
      await ctx.db.insert("claimStageSlots", {
        claimId: args.claimId,
        protocolId: args.protocolId,
        layer: args.stage.layer,
        slotType: "consensus",
        role: "consensus",
        status: "open",
        createdAt: now + order++,
      });
    }
  }
};

// ── Layer side-effects ──────────────────────────────────────────────
// Called after consensus passes for a layer. Responsible for writing
// structured outcomes back to the claim or other tables.

const applyLayerEffect = async (
  ctx: MutationCtx,
  claimId: Id<"claims">,
  layer: number,
  workSlots: Doc<"claimStageSlots">[],
  consensusSlots: Doc<"claimStageSlots">[],
  protocolName: string,
  isFinalLayer: boolean
) => {
  if (layer === 0) {
    // Meta routing — majority vote on protocol and domain from work slots
    const protocolVotes = workSlots
      .map((s) => s.structuredOutput?.protocol)
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0);
    const winningProtocol = majority(protocolVotes);
    if (!winningProtocol) return;

    const domainVotes = workSlots
      .map((s) => s.structuredOutput?.domain)
      .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
      .map(normalizeDomain);
    const winningDomain = majority(domainVotes) ?? "general";

    // Patch claim with domain and protocol
    await ctx.db.patch(claimId, {
      domain: winningDomain,
      protocol: winningProtocol,
      updatedAt: Date.now(),
    });

    // Seed winning protocol if not in DB
    let newProtocol = await ctx.db
      .query("protocols")
      .withIndex("by_name", (q) => q.eq("name", winningProtocol))
      .first();

    if (!newProtocol) {
      let newProtocolId: Id<"protocols">;
      if (winningProtocol === "lens-v1") {
        newProtocolId = await seedLensV1Handler(ctx);
      } else {
        // Default to prism-v1 for unknown or prism-v1 votes
        newProtocolId = await seedPrismV1Handler(ctx);
      }
      newProtocol = await ctx.db.get(newProtocolId);
    }

    if (!newProtocol) return;

    // Get first stage of winning protocol
    const sortedStages = [...newProtocol.stages].sort((a, b) => a.layer - b.layer);
    const firstStage = sortedStages[0];
    if (!firstStage) return;

    // Fetch current pipeline state
    const pipelineState = await ctx.db
      .query("claimPipelineState")
      .withIndex("by_claim", (q) => q.eq("claimId", claimId))
      .first();
    if (!pipelineState) return;

    const firstPhase = firstStage.workerSlots.length > 0 ? "work" : "consensus";

    // Transition pipeline to new protocol
    await ctx.db.patch(pipelineState._id, {
      protocolId: newProtocol._id,
      currentLayer: firstStage.layer,
      currentPhase: firstPhase,
      updatedAt: Date.now(),
    });

    await openSlotsForPhase(ctx, {
      claimId,
      protocolId: newProtocol._id,
      stage: firstStage,
      slotType: firstPhase,
    });

    return;
  }

  if (layer === 2 && protocolName === "prism-v1") {
    // Classification — derive domain from consensus slots, fall back to work slots
    const domainVotes = [
      ...consensusSlots.map((s) => s.structuredOutput?.domain),
      ...workSlots.map((s) => s.structuredOutput?.domain),
    ]
      .filter((d): d is string => typeof d === "string" && d.trim().length > 0)
      .map(normalizeDomain);

    const domain = majority(domainVotes);
    if (!domain) return;

    const claim = await ctx.db.get(claimId);
    if (!claim) return;

    // Only write if it's a real domain (not empty, not already set to this)
    if (domain !== claim.domain) {
      await ctx.db.patch(claimId, { domain, updatedAt: Date.now() });
    }
    return;
  }

  if (isFinalLayer) {
    // Synthesis — write a claimConsensus record from the consensus outputs
    const confidences = consensusSlots
      .map((s) => s.confidence)
      .filter((c): c is number => typeof c === "number");
    const avgConf = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

    // Use structured summary if agents provided it, fall back to joined prose
    const structuredSummaries = consensusSlots
      .map((s) => s.structuredOutput?.summary)
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
    const proseSummaries = consensusSlots
      .map((s) => s.output)
      .filter((o): o is string => typeof o === "string" && o.trim().length > 0);
    const summaryText = structuredSummaries.length > 0
      ? structuredSummaries.join("\n\n---\n\n")
      : proseSummaries.join("\n\n---\n\n");

    if (!summaryText) return;

    // Majority-vote the recommendation
    const recommendations = consensusSlots
      .map((s) => s.structuredOutput?.recommendation)
      .filter((r): r is string => typeof r === "string" && r.trim().length > 0);
    const recommendation = majority(recommendations) as
      | "accept" | "accept-with-caveats" | "reject" | "needs-more-evidence"
      | null;

    // Key points: collect prose outputs from all consensus slots as individual points
    const keyPoints = proseSummaries;

    // Use the first consensus agent's key if available, else first work slot's
    const sourceSlot =
      consensusSlots.find((s) => s.apiKeyId) ?? workSlots.find((s) => s.apiKeyId);
    if (!sourceSlot?.apiKeyId) return;

    const apiKey = await ctx.db.get(sourceSlot.apiKeyId);
    if (!apiKey) return;

    await ctx.db.insert("claimConsensus", {
      claimId,
      summary: summaryText,
      keyPoints,
      confidence: Math.round(avgConf * 100),
      recommendation: recommendation ?? undefined,
      apiKeyId: sourceSlot.apiKeyId,
      agentName: apiKey.agentName,
      agentModel: apiKey.agentModel ?? undefined,
      keyPrefix: apiKey.keyPrefix,
      agentAvatarUrl: apiKey.avatarUrl ?? undefined,
      createdAt: Date.now(),
    });
  }
};

// ── Pipeline init ───────────────────────────────────────────────────

// Called from createClaim / createClaimAsAgent — runs inside the same transaction
export const initPipelineHandler = async (
  ctx: MutationCtx,
  args: { claimId: Id<"claims">; protocolName?: string }
) => {
  // Resolve protocol
  let protocol = args.protocolName
    ? await ctx.db
        .query("protocols")
        .withIndex("by_name", (q) => q.eq("name", args.protocolName!))
        .first()
    : null;

  if (!protocol && args.protocolName === "meta-v1") {
    const id = await seedMetaV1Handler(ctx);
    protocol = await ctx.db.get(id);
  } else if (!protocol && args.protocolName === "lens-v1") {
    const id = await seedLensV1Handler(ctx);
    protocol = await ctx.db.get(id);
  } else if (!protocol) {
    // Fall back to the default protocol
    protocol = await ctx.db
      .query("protocols")
      .withIndex("by_default", (q) => q.eq("isDefault", true))
      .first();
  }

  if (!protocol) {
    // No protocol seeded yet — seed Prism v1 now
    const protocolId = await seedPrismV1Handler(ctx);
    protocol = await ctx.db.get(protocolId);
  }

  if (!protocol) return null;

  // Idempotency: don't init twice
  const existing = await ctx.db
    .query("claimPipelineState")
    .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
    .first();
  if (existing) return existing._id;

  // Find first stage
  const sortedStages = [...protocol.stages].sort((a, b) => a.layer - b.layer);
  const firstStage = sortedStages[0];
  if (!firstStage) return null;

  const now = Date.now();
  const firstPhase = firstStage.workerSlots.length > 0 ? "work" : "consensus";

  const pipelineId = await ctx.db.insert("claimPipelineState", {
    claimId: args.claimId,
    protocolId: protocol._id,
    currentLayer: firstStage.layer,
    currentPhase: firstPhase,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  await openSlotsForPhase(ctx, {
    claimId: args.claimId,
    protocolId: protocol._id,
    stage: firstStage,
    slotType: firstPhase,
  });

  return pipelineId;
};

// ── Stage advance engine ────────────────────────────────────────────

// Called after any slot is marked done — checks if phase/layer should advance
export const checkAndAdvanceHandler = async (
  ctx: MutationCtx,
  args: { claimId: Id<"claims">; layer: number }
) => {
  const pipeline = await ctx.db
    .query("claimPipelineState")
    .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
    .first();

  if (!pipeline || pipeline.status !== "active") return;
  if (pipeline.currentLayer !== args.layer) return;

  // Get all slots for this layer
  const allSlots = await ctx.db
    .query("claimStageSlots")
    .withIndex("by_claim_layer", (q) =>
      q.eq("claimId", args.claimId).eq("layer", args.layer)
    )
    .collect();

  const workSlots = allSlots.filter((s) => s.slotType === "work");
  const consensusSlots = allSlots.filter((s) => s.slotType === "consensus");

  const protocol = await ctx.db.get(pipeline.protocolId);
  if (!protocol) return;
  const stage = protocol.stages.find((s) => s.layer === args.layer);
  if (!stage) return;

  const now = Date.now();

  if (pipeline.currentPhase === "work") {
    // All work slots done? → open consensus
    const allWorkDone =
      workSlots.length > 0 && workSlots.every((s) => s.status === "done");
    if (!allWorkDone) return;

    await openSlotsForPhase(ctx, {
      claimId: args.claimId,
      protocolId: pipeline.protocolId,
      stage,
      slotType: "consensus",
    });

    await ctx.db.patch(pipeline._id, {
      currentPhase: "consensus",
      updatedAt: now,
    });
  } else {
    // All consensus slots done? → evaluate confidence and advance
    const allConsensusDone =
      consensusSlots.length > 0 &&
      consensusSlots.every((s) => s.status === "done");
    if (!allConsensusDone) return;

    const confidences = consensusSlots
      .map((s) => s.confidence)
      .filter((c): c is number => typeof c === "number");

    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
        : 0;

    if (avgConfidence < stage.consensusThreshold) {
      // Low confidence — flag the claim, slash stakes, and pause the pipeline
      await slashStakesHandler(ctx, args.claimId, args.layer);
      await ctx.db.insert("claimFlags", {
        claimId: args.claimId,
        layer: args.layer,
        reason: "low_consensus_confidence",
        avgConfidence,
        threshold: stage.consensusThreshold,
        createdAt: now,
      });
      await ctx.db.patch(pipeline._id, {
        status: "flagged",
        updatedAt: now,
      });
      return;
    }

    // Compute next stage and isFinalLayer before applying effects
    const sortedStages = [...protocol.stages].sort((a, b) => a.layer - b.layer);
    const nextStage = sortedStages.find((s) => s.layer > args.layer);
    const isFinalLayer = nextStage === undefined;
    const protocolName = protocol.name;

    // Confidence passed — run layer side-effects before advancing
    await applyLayerEffect(
      ctx,
      args.claimId,
      args.layer,
      workSlots,
      consensusSlots,
      protocolName,
      isFinalLayer
    );

    // PoI Step 2: return stakes to work-slot agents on passing layer
    await releaseStakesHandler(ctx, args.claimId, args.layer);

    // Award layer-pass bonus to all work-slot contributors
    await ctx.scheduler.runAfter(0, internal.rewards.awardLayerBonus, {
      claimId: args.claimId,
      layer: args.layer,
    });

    // Check if pipeline transitioned (meta routing opened new protocol's slots)
    const refreshed = await ctx.db.get(pipeline._id);
    if (refreshed!.protocolId !== pipeline.protocolId) {
      return; // meta already opened new protocol's slots — skip normal advancement
    }

    if (!nextStage) {
      // No more layers — pipeline complete
      await ctx.db.patch(pipeline._id, {
        status: "complete",
        completedAt: now,
        updatedAt: now,
      });
      // Award pipeline completion bonus to all contributors
      await ctx.scheduler.runAfter(0, internal.rewards.awardPipelineBonus, {
        claimId: args.claimId,
      });
      // Proof of Intelligence — Step 1: commit output hash on-chain
      await ctx.scheduler.runAfter(0, internal.registryAction.commitPipelineHashAction, {
        claimId: args.claimId,
      });
      return;
    }

    const nextPhase = nextStage.workerSlots.length > 0 ? "work" : "consensus";
    await ctx.db.patch(pipeline._id, {
      currentLayer: nextStage.layer,
      currentPhase: nextPhase,
      updatedAt: now,
    });

    await openSlotsForPhase(ctx, {
      claimId: args.claimId,
      protocolId: pipeline.protocolId,
      stage: nextStage,
      slotType: nextPhase,
    });
  }
};

// ── Public internalMutation wrappers ────────────────────────────────

export const initPipeline = internalMutation({
  args: {
    claimId: v.id("claims"),
    protocolName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return initPipelineHandler(ctx, args);
  },
});

export const takeStageSlot = internalMutation({
  args: {
    slotId: v.id("claimStageSlots"),
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    agentAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Slot not found");
    if (slot.status !== "open") throw new Error("SLOT_TAKEN");

    // One slot per agent per claim per layer per slot type (work or consensus)
    const existing = await ctx.db
      .query("claimStageSlots")
      .withIndex("by_agent_claim_layer_type", (q) =>
        q
          .eq("apiKeyId", args.apiKeyId)
          .eq("claimId", slot.claimId)
          .eq("layer", slot.layer)
          .eq("slotType", slot.slotType)
      )
      .first();
    if (existing) throw new Error("ALREADY_HAS_SLOT");

    await ctx.db.patch(args.slotId, {
      status: "taken",
      apiKeyId: args.apiKeyId,
      agentName: args.agentName,
      agentModel: args.agentModel,
      agentAvatarUrl: args.agentAvatarUrl,
      takenAt: Date.now(),
    });

    // PoI Step 2: deduct stake for work slots
    if (slot.slotType === "work") {
      await deductStakeHandler(ctx, args.slotId, args.apiKeyId);
    }

    await ctx.scheduler.runAfter(
      5 * 60 * 1000,
      internal.stageEngine.releaseExpiredSlot,
      { slotId: args.slotId, takenAt: Date.now() },
    );

    return {
      ok: true,
      slotId: args.slotId,
      layer: slot.layer,
      slotType: slot.slotType,
      role: slot.role,
      claimId: slot.claimId,
    };
  },
});

export const releaseExpiredSlot = internalMutation({
  args: {
    slotId: v.id("claimStageSlots"),
    takenAt: v.number(),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) return;
    if (slot.status !== "taken") return;
    if (slot.takenAt !== args.takenAt) return; // slot was re-taken after release

    await ctx.db.patch(args.slotId, {
      status: "open",
      apiKeyId: undefined,
      agentName: undefined,
      agentModel: undefined,
      agentAvatarUrl: undefined,
      takenAt: undefined,
    });
  },
});

export const releaseStaleSlots = internalMutation({
  args: { apiKeyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const taken = await ctx.db
      .query("claimStageSlots")
      .withIndex("by_agent_claim_layer_type", (q) => q.eq("apiKeyId", args.apiKeyId))
      .filter((q) => q.eq(q.field("status"), "taken"))
      .collect();

    await Promise.all(
      taken.map((slot) =>
        ctx.db.patch(slot._id, {
          status: "open",
          apiKeyId: undefined,
          agentName: undefined,
          agentModel: undefined,
          agentAvatarUrl: undefined,
          takenAt: undefined,
        })
      )
    );

    return { released: taken.length };
  },
});

export const markStageSlotDone = internalMutation({
  args: {
    slotId: v.id("claimStageSlots"),
    apiKeyId: v.id("apiKeys"),
    output: v.optional(v.string()),
    structuredOutput: v.optional(v.any()),
    confidence: v.optional(v.number()),
    outputSignature: v.optional(v.string()),
    agentModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Slot not found");
    if (slot.apiKeyId !== args.apiKeyId) throw new Error("FORBIDDEN");
    if (slot.status !== "taken") throw new Error("Slot is not taken");

    if (
      slot.slotType === "consensus" &&
      typeof args.confidence !== "number"
    ) {
      throw new Error("confidence is required for consensus slots");
    }
    if (
      typeof args.confidence === "number" &&
      (args.confidence < 0 || args.confidence > 1)
    ) {
      throw new Error("confidence must be between 0 and 1");
    }

    await ctx.db.patch(args.slotId, {
      status: "done",
      output: args.output,
      structuredOutput: args.structuredOutput,
      confidence: args.confidence,
      outputSignature: args.outputSignature,
      ...(args.agentModel ? { agentModel: args.agentModel } : {}),
      doneAt: Date.now(),
    });

    // Award slot completion tokens
    await ctx.scheduler.runAfter(0, internal.rewards.awardSlotReward, {
      apiKeyId: args.apiKeyId,
      slotType: slot.slotType,
      claimId: slot.claimId,
      slotId: args.slotId,
    });

    // Trigger engine advance check
    await checkAndAdvanceHandler(ctx, {
      claimId: slot.claimId,
      layer: slot.layer,
    });

    return { ok: true };
  },
});

// ── DEV ONLY: force-complete a slot bypassing the key constraint ─────
// Used for single-key testing. Remove before production.
export const devForceCompleteSlot = internalMutation({
  args: {
    slotId: v.id("claimStageSlots"),
    output: v.optional(v.string()),
    structuredOutput: v.optional(v.any()),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Slot not found");

    // Force to taken if still open
    if (slot.status === "open") {
      await ctx.db.patch(args.slotId, {
        status: "taken",
        agentName: "dev-bypass",
        takenAt: Date.now(),
      });
    }

    await ctx.db.patch(args.slotId, {
      status: "done",
      output: args.output,
      structuredOutput: args.structuredOutput,
      confidence: args.confidence,
      doneAt: Date.now(),
    });

    await checkAndAdvanceHandler(ctx, {
      claimId: slot.claimId,
      layer: slot.layer,
    });

    return { ok: true, slotId: args.slotId };
  },
});

// ── Internal query for HTTP job queue ───────────────────────────────

export const findNextWorkSlot = internalQuery({
  args: {
    layer: v.optional(v.number()),
    role: v.optional(v.string()),
    slotType: v.optional(v.union(v.literal("work"), v.literal("consensus"))),
    apiKeyId: v.optional(v.id("apiKeys")),
  },
  handler: async (ctx, args) => {
    // Fetch open slots
    let openSlots;
    if (args.layer !== undefined) {
      openSlots = await ctx.db
        .query("claimStageSlots")
        .withIndex("by_status_layer_createdAt", (q) =>
          q.eq("status", "open").eq("layer", args.layer!)
        )
        .order("asc")
        .take(100);
    } else {
      openSlots = await ctx.db
        .query("claimStageSlots")
        .filter((q) => q.eq(q.field("status"), "open"))
        .order("asc")
        .take(100);
    }

    if (args.role) {
      openSlots = openSlots.filter((s) => s.role === args.role);
    }
    if (args.slotType) {
      openSlots = openSlots.filter((s) => s.slotType === args.slotType);
    }

    for (const slot of openSlots) {
      // Skip slots where this agent already has a slot of the same type on this layer
      if (args.apiKeyId) {
        const alreadyWorked = await ctx.db
          .query("claimStageSlots")
          .withIndex("by_agent_claim_layer_type", (q) =>
            q
              .eq("apiKeyId", args.apiKeyId!)
              .eq("claimId", slot.claimId)
              .eq("layer", slot.layer)
              .eq("slotType", slot.slotType)
          )
          .first();
        if (alreadyWorked) continue;
      }
      const pipeline = await ctx.db
        .query("claimPipelineState")
        .withIndex("by_claim", (q) => q.eq("claimId", slot.claimId))
        .first();
      if (!pipeline || pipeline.status !== "active") continue;
      if (pipeline.currentLayer !== slot.layer) continue;

      const claim = await ctx.db.get(slot.claimId);
      if (!claim || (claim as any).isHidden) continue;

      const allSlots = await ctx.db
        .query("claimStageSlots")
        .withIndex("by_claim", (q) => q.eq("claimId", slot.claimId))
        .collect();

      const protocol = await ctx.db.get(slot.protocolId);
      const stagesByLayer = new Map(
        ((protocol as any)?.stages ?? []).map((s: any) => [s.layer, s])
      );

      const doneSlots = allSlots.filter(
        (s) => s.status === "done" && s.layer < slot.layer
      );
      const layersWithOutput = [...new Set(doneSlots.map((s) => s.layer))].sort(
        (a, b) => a - b
      );

      const priorLayers = layersWithOutput.map((l) => {
        const layerSlots = doneSlots.filter((s) => s.layer === l);
        const workOutputs = layerSlots
          .filter((s) => s.slotType === "work" && s.output)
          .map((s) => s.output as string);
        const conSlots = layerSlots.filter((s) => s.slotType === "consensus");
        const consensusOutputs = conSlots
          .filter((s) => s.output)
          .map((s) => s.output as string);
        const confidences = conSlots
          .map((s) => s.confidence)
          .filter((c): c is number => typeof c === "number");
        const avgConfidence =
          confidences.length > 0
            ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
            : null;
        return {
          layer: l,
          stageName: (stagesByLayer.get(l) as any)?.name ?? `layer-${l}`,
          workOutputs,
          consensusOutputs,
          avgConfidence,
        };
      });

      const currentLayerWorkOutputs =
        slot.slotType === "consensus"
          ? allSlots
              .filter(
                (s) =>
                  s.layer === slot.layer &&
                  s.slotType === "work" &&
                  s.status === "done" &&
                  s.output
              )
              .map((s) => s.output as string)
          : [];

      return {
        slot,
        claim,
        context: {
          stageName: (stagesByLayer.get(slot.layer) as any)?.name ?? `layer-${slot.layer}`,
          priorLayers,
          currentLayerWorkOutputs,
        },
      };
    }

    return null;
  },
});

// ── Queries (public — used by UI and http.ts) ───────────────────────

export const listStageSlotsForClaim = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("claimStageSlots")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("asc")
      .collect();
  },
});

export const devPatchClaimDomain = internalMutation({
  args: { claimId: v.id("claims"), domain: v.string() },
  handler: async (ctx, args) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    await ctx.db.patch(args.claimId, { domain: normalizeDomain(args.domain) });
    return { ok: true };
  },
});

// ── DEV ONLY: seed a solo test claim with prism-v1-solo ──────────────
// Creates a test claim + initialises its pipeline so a single agent
// can run through all 7 layers solo. Remove before production.
export const devSeedSoloTest = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    await seedPrismV1SoloHandler(ctx);

    const now = Date.now();
    const claimId = await ctx.db.insert("claims", {
      title: "Caffeine improves cognitive performance in sleep-deprived individuals",
      body: "Multiple peer-reviewed studies show that caffeine (200–400 mg) significantly improves alertness, reaction time, and working memory in sleep-deprived subjects by antagonising adenosine receptors in the prefrontal cortex.",
      domain: "neuroscience",
      protocol: "prism-v1-solo",
      authorId: "dev-seed",
      authorName: "Dev Seed",
      authorType: "ai",
      voteCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await initPipelineHandler(ctx, { claimId, protocolName: "prism-v1-solo" });

    return {
      claimId,
      message:
        "Solo test seeded — 1 work + 1 consensus slot per layer (L1–L7). " +
        "Run `npx @agentorchestrationprotocol/cli-dev run` to start processing.",
    };
  },
});

export const devCompletePipeline = internalMutation({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    const pipeline = await ctx.db
      .query("claimPipelineState")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .first();
    if (!pipeline) throw new Error("No pipeline state found");

    const protocol = await ctx.db.get(pipeline.protocolId);
    if (!protocol) throw new Error("Protocol not found");

    const sortedStages = [...protocol.stages].sort((a, b) => a.layer - b.layer);
    const lastStage = sortedStages[sortedStages.length - 1];

    const allSlots = await ctx.db
      .query("claimStageSlots")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .collect();

    const workSlots = allSlots.filter(
      (s) => s.layer === lastStage.layer && s.slotType === "work" && s.status === "done"
    );
    const consensusSlots = allSlots.filter(
      (s) => s.layer === lastStage.layer && s.slotType === "consensus" && s.status === "done"
    );

    await applyLayerEffect(
      ctx,
      args.claimId,
      lastStage.layer,
      workSlots,
      consensusSlots,
      protocol.name,
      true
    );

    const now = Date.now();
    await ctx.db.patch(pipeline._id, {
      status: "complete",
      completedAt: now,
      updatedAt: now,
    });

    return { ok: true, completedAt: now };
  },
});

export const devForceAdvanceToLayer = internalMutation({
  args: { claimId: v.id("claims"), layer: v.number() },
  handler: async (ctx, args) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    const pipeline = await ctx.db
      .query("claimPipelineState")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .first();
    if (!pipeline) throw new Error("No pipeline state found for this claim");

    const protocol = await ctx.db.get(pipeline.protocolId);
    if (!protocol) throw new Error("Protocol not found");

    const stage = protocol.stages.find((s) => s.layer === args.layer);
    if (!stage) throw new Error(`No stage found for layer ${args.layer}`);

    const phase = stage.workerSlots.length > 0 ? "work" : "consensus";

    await ctx.db.patch(pipeline._id, {
      status: "active",
      currentLayer: args.layer,
      currentPhase: phase,
      updatedAt: Date.now(),
    });

    await openSlotsForPhase(ctx, {
      claimId: args.claimId,
      protocolId: pipeline.protocolId,
      stage,
      slotType: phase,
    });

    return { ok: true, layer: args.layer, phase, stage: stage.name };
  },
});

export const devReopenCurrentLayer = internalMutation({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    const pipeline = await ctx.db
      .query("claimPipelineState")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .first();
    if (!pipeline) throw new Error("No pipeline state found for this claim");

    const protocol = await ctx.db.get(pipeline.protocolId);
    if (!protocol) throw new Error("Protocol not found");

    const stage = protocol.stages.find((s) => s.layer === pipeline.currentLayer);
    if (!stage) throw new Error(`No stage found for layer ${pipeline.currentLayer}`);

    await openSlotsForPhase(ctx, {
      claimId: args.claimId,
      protocolId: pipeline.protocolId,
      stage,
      slotType: pipeline.currentPhase,
    });

    return {
      ok: true,
      layer: pipeline.currentLayer,
      phase: pipeline.currentPhase,
      stage: stage.name,
    };
  },
});

export const devPurgeClaims = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    const BATCH = 500;
    const tables = [
      "claimStageSlots",
      "claimFlags",
      "claimPipelineState",
      "claimRoleSlots",
      "claimConsensus",
      "claimClassifications",
      "claimPolicyDecisions",
      "claimOutputs",
      "claimCalibrations",
      "savedClaims",
      "claimVotes",
      "commentVotes",
      "moderationReports",
      "moderationActions",
      "comments",
      "claims",
    ] as const;

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const docs = await ctx.db.query(table).take(BATCH);
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      counts[table] = docs.length;
    }

    const remaining = Object.values(counts).some((n) => n === BATCH);
    return { purged: counts, runAgain: remaining };
  },
});

export const devPurgeAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    const BATCH = 500;
    const tables = [
      "users",
      "claims",
      "comments",
      "claimClassifications",
      "claimPolicyDecisions",
      "claimOutputs",
      "claimCalibrations",
      "claimConsensus",
      "apiKeys",
      "tokenRewards",
      "apiKeyUsage",
      "apiKeyActionUsage",
      "agentAudit",
      "savedClaims",
      "claimVotes",
      "commentVotes",
      "deviceCodes",
      "moderationReports",
      "moderationActions",
      "claimStageSlots",
      "claimFlags",
      "claimPipelineState",
      "claimRoleSlots",
      "observabilityEvents",
    ] as const;

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const docs = await ctx.db.query(table).take(BATCH);
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
      counts[table] = docs.length;
    }

    const remaining = Object.values(counts).some((n) => n === BATCH);
    return { purged: counts, runAgain: remaining };
  },
});

export const getPipelineStateForClaim = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("claimPipelineState")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .first();
    if (!state) return null;

    const protocol = await ctx.db.get(state.protocolId);
    const flags = await ctx.db
      .query("claimFlags")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .collect();

    return { ...state, protocol, flags };
  },
});
