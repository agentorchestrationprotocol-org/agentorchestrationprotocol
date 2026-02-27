import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { generateAutoName } from "./utils/names";

const authFunctions: AuthFunctions = internal.auth;

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    await ctx.db.insert("users", {
      authId: event.data.id,
      email: event.data.email,
      emailVerified: event.data.emailVerified,
      firstName: event.data.firstName,
      lastName: event.data.lastName,
      profilePictureUrl: event.data.profilePictureUrl,
      lastSignInAt: event.data.lastSignInAt,
      locale: event.data.locale,
      externalId: event.data.externalId,
      metadata: event.data.metadata ?? {},
      alias: generateAutoName(),
      prefersAnonymous: false,
      createdAt: event.data.createdAt,
      updatedAt: event.data.updatedAt,
    });
  },
  "user.updated": async (ctx, event) => {
    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", event.data.id))
      .unique();
    if (!user) {
      await ctx.db.insert("users", {
        authId: event.data.id,
        email: event.data.email,
        emailVerified: event.data.emailVerified,
        firstName: event.data.firstName,
        lastName: event.data.lastName,
        profilePictureUrl: event.data.profilePictureUrl,
        lastSignInAt: event.data.lastSignInAt,
        locale: event.data.locale,
        externalId: event.data.externalId,
        metadata: event.data.metadata ?? {},
        alias: generateAutoName(),
        prefersAnonymous: false,
        createdAt: event.data.createdAt,
        updatedAt: event.data.updatedAt,
      });
      return;
    }
    const existingAlias = user.alias?.trim();
    const nextAlias = existingAlias || generateAutoName();
    await ctx.db.patch(user._id, {
      email: event.data.email,
      emailVerified: event.data.emailVerified,
      firstName: event.data.firstName,
      lastName: event.data.lastName,
      profilePictureUrl: event.data.profilePictureUrl,
      lastSignInAt: event.data.lastSignInAt,
      locale: event.data.locale,
      externalId: event.data.externalId,
      metadata: event.data.metadata ?? {},
      ...(existingAlias ? {} : { alias: nextAlias }),
      updatedAt: event.data.updatedAt,
    });
  },
  "user.deleted": async (ctx, event) => {
    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", event.data.id))
      .unique();
    if (!user) {
      return;
    }
    await ctx.db.delete(user._id);
  },
});

export const { authKitAction } = authKit.actions({
  authentication: async (_ctx, _action, response) => response.allow(),
  userRegistration: async (_ctx, _action, response) => response.allow(),
});
