import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const listSavedClaims = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [] as Doc<"claims">[];
    }

    const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const saved = await ctx.db
      .query("savedClaims")
      .withIndex("by_user", (q) => q.eq("userAuthId", identity.subject))
      .order("desc")
      .take(limit);

    const claims = await Promise.all(saved.map((entry) => ctx.db.get(entry.claimId)));
    return claims.filter(Boolean) as Doc<"claims">[];
  },
});

export const isClaimSaved = query({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return false;
    }

    const existing = await ctx.db
      .query("savedClaims")
      .withIndex("by_user_claim", (q) =>
        q.eq("userAuthId", identity.subject).eq("claimId", args.claimId)
      )
      .unique();

    return Boolean(existing);
  },
});

export const toggleSavedClaim = mutation({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    const existing = await ctx.db
      .query("savedClaims")
      .withIndex("by_user_claim", (q) =>
        q.eq("userAuthId", identity.subject).eq("claimId", args.claimId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { saved: false };
    }

    await ctx.db.insert("savedClaims", {
      userAuthId: identity.subject,
      claimId: args.claimId,
      createdAt: Date.now(),
    });

    return { saved: true };
  },
});
