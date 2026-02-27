import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

export type ProtocolStage = {
  layer: number;
  name: string;
  workerSlots: Array<{ role: string; count: number }>;
  consensusCount: number;
  consensusThreshold: number;
};

export const PRISM_V1_STAGES: ProtocolStage[] = [
  {
    layer: 1,
    name: "framing",
    workerSlots: [{ role: "contributor", count: 2 }],
    consensusCount: 2,
    consensusThreshold: 0.7,
  },
  {
    layer: 2,
    name: "classification",
    workerSlots: [{ role: "critic", count: 2 }],
    consensusCount: 2,
    consensusThreshold: 0.7,
  },
  {
    layer: 3,
    name: "evidence",
    workerSlots: [
      { role: "supporter", count: 2 },
      { role: "counter", count: 1 },
    ],
    consensusCount: 2,
    consensusThreshold: 0.7,
  },
  {
    layer: 4,
    name: "critique",
    workerSlots: [
      { role: "critic", count: 2 },
      { role: "questioner", count: 1 },
    ],
    consensusCount: 2,
    consensusThreshold: 0.7,
  },
  {
    layer: 5,
    name: "defense",
    workerSlots: [
      { role: "defender", count: 1 },
      { role: "answerer", count: 1 },
    ],
    consensusCount: 2,
    consensusThreshold: 0.7,
  },
  {
    layer: 6,
    name: "deliberation",
    workerSlots: [
      { role: "critic", count: 2 },
      { role: "questioner", count: 2 },
      { role: "supporter", count: 1 },
      { role: "counter", count: 1 },
    ],
    consensusCount: 3,
    consensusThreshold: 0.7,
  },
  {
    layer: 7,
    name: "synthesis",
    workerSlots: [], // no work phase — goes straight to consensus
    consensusCount: 3,
    consensusThreshold: 0.7,
  },
];

// Single-agent test protocol — 1 work slot + 1 consensus slot per layer
export const PRISM_V1_SOLO_STAGES: ProtocolStage[] = [
  {
    layer: 1,
    name: "framing",
    workerSlots: [{ role: "contributor", count: 1 }],
    consensusCount: 1,
    consensusThreshold: 0.5,
  },
  {
    layer: 2,
    name: "classification",
    workerSlots: [{ role: "critic", count: 1 }],
    consensusCount: 1,
    consensusThreshold: 0.5,
  },
  {
    layer: 3,
    name: "evidence",
    workerSlots: [{ role: "supporter", count: 1 }],
    consensusCount: 1,
    consensusThreshold: 0.5,
  },
  {
    layer: 4,
    name: "critique",
    workerSlots: [{ role: "critic", count: 1 }],
    consensusCount: 1,
    consensusThreshold: 0.5,
  },
  {
    layer: 5,
    name: "defense",
    workerSlots: [{ role: "defender", count: 1 }],
    consensusCount: 1,
    consensusThreshold: 0.5,
  },
  {
    layer: 6,
    name: "deliberation",
    workerSlots: [{ role: "critic", count: 1 }],
    consensusCount: 1,
    consensusThreshold: 0.5,
  },
  {
    layer: 7,
    name: "synthesis",
    workerSlots: [], // no work phase — goes straight to consensus
    consensusCount: 1,
    consensusThreshold: 0.5,
  },
];

export const seedPrismV1SoloHandler = async (ctx: MutationCtx) => {
  const existing = await ctx.db
    .query("protocols")
    .withIndex("by_name", (q) => q.eq("name", "prism-v1-solo"))
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("protocols", {
    name: "prism-v1-solo",
    description:
      "Prism v1 Solo — single-agent pipeline test (1 slot per phase per layer)",
    stages: PRISM_V1_SOLO_STAGES,
    isDefault: false,
    createdAt: Date.now(),
  });
};

// Shared handler — callable inside any MutationCtx
export const seedPrismV1Handler = async (ctx: MutationCtx) => {
  const existing = await ctx.db
    .query("protocols")
    .withIndex("by_name", (q) => q.eq("name", "prism-v1"))
    .first();
  if (existing) {
    return existing._id;
  }
  return ctx.db.insert("protocols", {
    name: "prism-v1",
    description: "Prism v1 — 7-layer deliberation protocol",
    stages: PRISM_V1_STAGES,
    isDefault: true,
    createdAt: Date.now(),
  });
};

export const META_V1_STAGES: ProtocolStage[] = [
  {
    layer: 0,
    name: "meta-classify",
    workerSlots: [{ role: "classifier", count: 3 }],
    consensusCount: 3,
    consensusThreshold: 0.5, // simple majority — 2/3 always ≥ 0.5
  },
];

export const LENS_V1_STAGES: ProtocolStage[] = [
  {
    layer: 1,
    name: "framing",
    workerSlots: [{ role: "framer", count: 2 }],
    consensusCount: 2,
    consensusThreshold: 0.7,
  },
  {
    layer: 2,
    name: "lenses",
    workerSlots: [{ role: "lens", count: 3 }],
    consensusCount: 2,
    consensusThreshold: 0.7,
  },
  {
    layer: 3,
    name: "critique",
    workerSlots: [{ role: "critic", count: 3 }],
    consensusCount: 2,
    consensusThreshold: 0.6,
  },
  {
    layer: 4,
    name: "revision",
    workerSlots: [{ role: "reviser", count: 2 }],
    consensusCount: 2,
    consensusThreshold: 0.6,
  },
  {
    layer: 5,
    name: "synthesis",
    workerSlots: [{ role: "synthesizer", count: 2 }],
    consensusCount: 2,
    consensusThreshold: 0.7,
  },
  {
    layer: 6,
    name: "summary",
    workerSlots: [], // no work phase — goes straight to consensus
    consensusCount: 3,
    consensusThreshold: 0.6,
  },
];

export const seedMetaV1Handler = async (ctx: MutationCtx) => {
  const existing = await ctx.db
    .query("protocols")
    .withIndex("by_name", (q) => q.eq("name", "meta-v1"))
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("protocols", {
    name: "meta-v1",
    description:
      "Meta v1 — routing layer: 3 classifier agents majority-vote the best protocol and domain for a claim",
    stages: META_V1_STAGES,
    isDefault: false,
    createdAt: Date.now(),
  });
};

export const seedLensV1Handler = async (ctx: MutationCtx) => {
  const existing = await ctx.db
    .query("protocols")
    .withIndex("by_name", (q) => q.eq("name", "lens-v1"))
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("protocols", {
    name: "lens-v1",
    description:
      "Lens v1 — 5-layer protocol for open questions and hypotheticals: parallel lenses, no verdict, map of strongest positions",
    stages: LENS_V1_STAGES,
    isDefault: false,
    createdAt: Date.now(),
  });
};

// Callable from admin tooling / seeding scripts
export const seedPrismV1 = internalMutation({
  args: {},
  handler: async (ctx) => {
    const id = await seedPrismV1Handler(ctx);
    return { id };
  },
});

export const seedPrismV1Solo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const id = await seedPrismV1SoloHandler(ctx);
    return { id };
  },
});

export const seedMetaV1 = internalMutation({
  args: {},
  handler: async (ctx) => {
    const id = await seedMetaV1Handler(ctx);
    return { id };
  },
});

export const seedLensV1 = internalMutation({
  args: {},
  handler: async (ctx) => {
    const id = await seedLensV1Handler(ctx);
    return { id };
  },
});

// List all protocols — exposed to UI
export const listProtocols = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("protocols").order("asc").collect();
  },
});
