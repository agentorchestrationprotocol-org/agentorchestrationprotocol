import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { WorkOS } from "@workos-inc/node";
import { generateAutoName } from "./utils/names";
import { isModerationAdmin } from "./utils/moderation";

/**
 * Fetches the current user from the WorkOS API and upserts them into the
 * users table. Useful when the webhook hasn't fired yet (e.g. local dev).
 */
export const syncMyUser = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    const u = await workos.userManagement.getUser(identity.subject);

    await ctx.runMutation(internal.users.upsertUser, {
      authId: u.id,
      email: u.email,
      emailVerified: u.emailVerified,
      firstName: u.firstName ?? null,
      lastName: (u as { lastName?: string | null }).lastName ?? null,
      profilePictureUrl: (u as { profilePictureUrl?: string | null }).profilePictureUrl ?? null,
      lastSignInAt: (u as { lastSignInAt?: string | null }).lastSignInAt ?? null,
      externalId: (u as { externalId?: string | null }).externalId ?? null,
      createdAt: u.createdAt,
      updatedAt: (u as { updatedAt?: string }).updatedAt ?? u.createdAt,
    });
  },
});

export const upsertUser = internalMutation({
  args: {
    authId: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    firstName: v.union(v.string(), v.null()),
    lastName: v.union(v.string(), v.null()),
    profilePictureUrl: v.union(v.string(), v.null()),
    lastSignInAt: v.union(v.string(), v.null()),
    externalId: v.union(v.string(), v.null()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", args.authId))
      .unique();

    if (!existing) {
      await ctx.db.insert("users", {
        authId: args.authId,
        email: args.email,
        emailVerified: args.emailVerified,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePictureUrl: args.profilePictureUrl,
        lastSignInAt: args.lastSignInAt,
        locale: null,
        externalId: args.externalId,
        metadata: {},
        alias: generateAutoName(),
        prefersAnonymous: false,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
      });
    } else {
      await ctx.db.patch(existing._id, {
        email: args.email,
        emailVerified: args.emailVerified,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePictureUrl: args.profilePictureUrl,
        lastSignInAt: args.lastSignInAt,
        externalId: args.externalId,
        updatedAt: args.updatedAt,
      });
    }
  },
});

export const getMyIdentity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return identity as Record<string, unknown>;
  },
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();

    return user ?? null;
  },
});

export const updateMyProfile = mutation({
  args: {
    alias: v.optional(v.string()),
    prefersAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const patch: { alias?: string; prefersAnonymous?: boolean } = {};

    if (args.alias !== undefined) {
      const alias = args.alias.trim();
      if (alias && (alias.length < 2 || alias.length > 40)) {
        throw new Error("Username must be 2-40 characters");
      }
      patch.alias = alias || generateAutoName();
    }

    if (args.prefersAnonymous !== undefined) {
      patch.prefersAnonymous = args.prefersAnonymous;
    }

    if (Object.keys(patch).length === 0) {
      return user;
    }

    await ctx.db.patch(user._id, patch);
    return { ...user, ...patch };
  },
});

export const ensureMyAlias = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const existingAlias = user.alias?.trim();
    if (existingAlias) {
      return { alias: existingAlias };
    }

    const alias = generateAutoName();
    await ctx.db.patch(user._id, { alias });
    return { alias };
  },
});

export const getMyAccess = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        isModerationAdmin: false,
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();

    return {
      isModerationAdmin: isModerationAdmin(identity, user?.email ?? null),
    };
  },
});
