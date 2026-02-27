import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const MAX_SLOTS = 20;

type RoleType = "questioner" | "critic" | "supporter" | "counter" | "contributor" | "defender" | "answerer";

const roleValidator = v.union(
  v.literal("questioner"), v.literal("critic"), v.literal("supporter"),
  v.literal("counter"), v.literal("contributor"), v.literal("defender"),
  v.literal("answerer")
);

export const listForClaim = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("claimRoleSlots")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("asc")
      .collect();
  },
});

export const getOpenSlots = query({
  args: { claimId: v.optional(v.id("claims")) },
  handler: async (ctx, args) => {
    if (args.claimId) {
      return await ctx.db
        .query("claimRoleSlots")
        .withIndex("by_claim_status", (q) =>
          q.eq("claimId", args.claimId!).eq("status", "open")
        )
        .collect();
    }
    return await ctx.db
      .query("claimRoleSlots")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "open"))
      .collect();
  },
});

export const DEFAULT_DELIBERATION_CONFIG: Array<{ role: RoleType; count: number }> = [
  { role: "critic",      count: 2 },
  { role: "questioner",  count: 2 },
  { role: "supporter",   count: 1 },
  { role: "counter",     count: 1 },
  { role: "defender",    count: 1 },
  { role: "answerer",    count: 1 },
];

export const createSlotsHandler = async (
  ctx: MutationCtx,
  args: { claimId: Id<"claims">; roles: Array<{ role: RoleType; count: number }> }
) => {
  const totalCount = args.roles.reduce((sum, r) => sum + r.count, 0);
  if (totalCount < 1) throw new Error("At least 1 slot is required");
  if (totalCount > MAX_SLOTS) throw new Error(`Maximum ${MAX_SLOTS} slots allowed`);

  // Delete existing open slots for this claim (idempotent)
  const existing = await ctx.db
    .query("claimRoleSlots")
    .withIndex("by_claim_status", (q) =>
      q.eq("claimId", args.claimId).eq("status", "open")
    )
    .collect();
  for (const slot of existing) {
    await ctx.db.delete(slot._id);
  }

  const now = Date.now();
  const created: Id<"claimRoleSlots">[] = [];
  for (const { role, count } of args.roles) {
    for (let i = 0; i < count; i++) {
      const id = await ctx.db.insert("claimRoleSlots", {
        claimId: args.claimId,
        role,
        status: "open",
        createdAt: now + created.length,
      });
      created.push(id);
    }
  }

  return { created: created.length };
};

// Public mutation callable from authenticated UI users
export const createSlotsPublic = mutation({
  args: {
    claimId: v.id("claims"),
    roles: v.array(v.object({ role: roleValidator, count: v.number() })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await createSlotsHandler(ctx, args);
  },
});

// Internal mutation callable from HTTP routes (API key auth)
export const createSlots = internalMutation({
  args: {
    claimId: v.id("claims"),
    roles: v.array(v.object({ role: roleValidator, count: v.number() })),
  },
  handler: async (ctx, args) => {
    return await createSlotsHandler(ctx, args);
  },
});

export const takeSlot = internalMutation({
  args: {
    slotId: v.id("claimRoleSlots"),
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Slot not found");
    if (slot.status !== "open") throw new Error("SLOT_TAKEN");

    // One slot per agent per claim
    const existing = await ctx.db
      .query("claimRoleSlots")
      .withIndex("by_agent_claim", (q) =>
        q.eq("apiKeyId", args.apiKeyId).eq("claimId", slot.claimId)
      )
      .first();
    if (existing) throw new Error("ALREADY_HAS_SLOT");

    const now = Date.now();
    await ctx.db.patch(args.slotId, {
      status: "taken",
      apiKeyId: args.apiKeyId,
      agentName: args.agentName,
      agentAvatarUrl: args.agentAvatarUrl,
      takenAt: now,
    });

    return { ok: true, slotId: args.slotId, role: slot.role, claimId: slot.claimId };
  },
});

export const markSlotDone = internalMutation({
  args: {
    slotId: v.id("claimRoleSlots"),
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Slot not found");
    if (slot.apiKeyId !== args.apiKeyId) throw new Error("FORBIDDEN");
    if (slot.status !== "taken") throw new Error("Slot is not taken");

    await ctx.db.patch(args.slotId, {
      status: "done",
      doneAt: Date.now(),
    });

    // Award 10 AOP for completing a council role slot
    await ctx.scheduler.runAfter(0, internal.rewards.awardRoleSlotReward, {
      apiKeyId: args.apiKeyId,
      claimId: slot.claimId,
    });

    return { ok: true };
  },
});
