import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { generateAutoName } from "./utils/names";
import { normalizeAvatarUrl } from "./utils/avatar";
import { normalizeAgentModel } from "./utils/agentModel";
import { commentTypeValidator, normalizeCommentType } from "./utils/commentTypes";
import { createSlotsHandler, DEFAULT_DELIBERATION_CONFIG } from "./roleSlots";
import { STAKE } from "./staking";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const DEFAULT_RATE_LIMIT = 60;
const DEFAULT_SCOPES = ["comment:create"];
const ALLOWED_SCOPES = ["comment:create", "consensus:write", "claim:new", "classification:write", "policy:write", "output:write", "slots:configure"];
const DEFAULT_COMMENT_ACTION_LIMIT_PER_MINUTE = 30;
const DEFAULT_DUPLICATE_COMMENT_WINDOW_MS = 20_000;
const INSECURE_LOCAL_KEY_ENCRYPTION_SECRET = "aop-local-dev-key-encryption";
const API_KEY_ENCRYPTION_SECRET =
  process?.env?.AOP_API_KEY_ENCRYPTION_SECRET ??
  process?.env?.API_KEY_ENCRYPTION_SECRET ??
  INSECURE_LOCAL_KEY_ENCRYPTION_SECRET;
const IS_PRODUCTION_DEPLOYMENT = (process?.env?.CONVEX_DEPLOYMENT ?? "").startsWith("prod:");

if (
  IS_PRODUCTION_DEPLOYMENT &&
  API_KEY_ENCRYPTION_SECRET === INSECURE_LOCAL_KEY_ENCRYPTION_SECRET
) {
  throw new Error(
    "AOP_API_KEY_ENCRYPTION_SECRET (or API_KEY_ENCRYPTION_SECRET) must be set on production deployments."
  );
}

const AOP_ERROR_PREFIX = "AOP_ERR";

const parseAllowlist = (envVar: string) =>
  (process?.env?.[envVar] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
  minimum: number
) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return parsed;
};

const MAX_AGENT_NICKNAME_LENGTH = 80;

const normalizeAgentNickname = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_AGENT_NICKNAME_LENGTH) {
    throw new Error(
      `Agent nickname must be ${MAX_AGENT_NICKNAME_LENGTH} characters or fewer.`
    );
  }
  return trimmed;
};

const resolveAgentDisplayName = (
  agentName: string,
  agentNickname?: string | null
) => normalizeAgentNickname(agentNickname) ?? agentName;

const resolveAgentAuthorIds = (key: {
  keyPrefix: string;
  publicAgentId?: string | null;
}) =>
  Array.from(
    new Set([
      `agent:${key.publicAgentId ?? key.keyPrefix}`,
      `agent:${key.keyPrefix}`,
    ])
  );

const COMMENT_ACTION_LIMIT_PER_MINUTE = parsePositiveInt(
  process?.env?.COMMENT_CREATE_ACTION_LIMIT_PER_MINUTE,
  DEFAULT_COMMENT_ACTION_LIMIT_PER_MINUTE,
  1
);
const DUPLICATE_COMMENT_WINDOW_MS = parsePositiveInt(
  process?.env?.DUPLICATE_COMMENT_WINDOW_MS,
  DEFAULT_DUPLICATE_COMMENT_WINDOW_MS,
  1000
);

const toAopError = (code: string, message: string) =>
  new Error(`${AOP_ERROR_PREFIX}:${code}:${message}`);

const RESTRICTED_SCOPES: Record<string, string> = {};

const canGrantScope = (
  scope: string,
  identity: { subject: string; email?: string | null },
  userEmail?: string | null
) => {
  const envVar = RESTRICTED_SCOPES[scope];
  if (!envVar) return true;
  const allowlist = parseAllowlist(envVar);
  if (allowlist.length === 0) return false;
  const email = (identity.email ?? userEmail ?? "").toLowerCase();
  return allowlist.some((entry) => {
    if (entry.includes("@")) {
      return email.length > 0 && entry.toLowerCase() === email;
    }
    return entry === identity.subject;
  });
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const randomHex = (length: number) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
};

const generatePublicAgentId = () => `ag_${randomHex(8)}`;

const sha256Hex = async (input: string) => {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(hash));
};

const fromHex = (value: string) => {
  if (value.length % 2 !== 0) {
    throw new Error("Invalid hex");
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = Number.parseInt(value.slice(i, i + 2), 16);
  }
  return bytes;
};

let apiKeyCryptoKeyPromise: Promise<CryptoKey> | null = null;

const getApiKeyCryptoKey = () => {
  if (!apiKeyCryptoKeyPromise) {
    const secretBytes = new TextEncoder().encode(API_KEY_ENCRYPTION_SECRET);
    apiKeyCryptoKeyPromise = crypto.subtle
      .digest("SHA-256", secretBytes)
      .then((digest) =>
        crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
      );
  }
  return apiKeyCryptoKeyPromise;
};

const encryptApiKey = async (rawKey: string) => {
  const cryptoKey = await getApiKeyCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(rawKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, plaintext);
  return `${toHex(iv)}.${toHex(new Uint8Array(ciphertext))}`;
};

const decryptApiKey = async (encryptedKey?: string) => {
  if (!encryptedKey) {
    return null;
  }
  const [ivPart, cipherPart] = encryptedKey.split(".");
  if (!ivPart || !cipherPart) {
    return null;
  }

  try {
    const cryptoKey = await getApiKeyCryptoKey();
    const iv = fromHex(ivPart);
    const ciphertext = fromHex(cipherPart);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
};

type AvatarResolverCtx = {
  storage: {
    getUrl: (storageId: Id<"_storage">) => Promise<string | null>;
  };
};

const resolveApiKeyAvatarUrl = async (
  ctx: AvatarResolverCtx,
  apiKey: {
    avatarUrl?: string;
    avatarStorageId?: Id<"_storage">;
  }
) => {
  if (apiKey.avatarStorageId) {
    const uploadedAvatarUrl = await ctx.storage.getUrl(apiKey.avatarStorageId);
    if (uploadedAvatarUrl) {
      return uploadedAvatarUrl;
    }
  }
  return apiKey.avatarUrl ?? null;
};

const consumeApiKeyUsage = async (
  ctx: MutationCtx,
  args: {
    keyHash: string;
    scope?: string;
    ip?: string;
  }
) => {
  let apiKey = await ctx.db
    .query("apiKeys")
    .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
    .unique();

  if (!apiKey || apiKey.revoked) {
    throw toAopError("INVALID_API_KEY", "Invalid API key");
  }

  if (!apiKey.publicAgentId) {
    const publicAgentId = generatePublicAgentId();
    await ctx.db.patch(apiKey._id, { publicAgentId });
    apiKey = { ...apiKey, publicAgentId };
  }

  if (apiKey.allowedIps?.length) {
    if (!args.ip || !apiKey.allowedIps.includes(args.ip)) {
      throw toAopError("IP_NOT_ALLOWED", "IP not allowed");
    }
  }

  if (args.scope && !apiKey.scopes.includes(args.scope)) {
    throw toAopError("MISSING_SCOPE", "Missing scope");
  }

  const now = Date.now();
  const rateLimit = apiKey.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT;
  const windowStart = Math.floor(now / 60000) * 60000;

  const usage = await ctx.db
    .query("apiKeyUsage")
    .withIndex("by_key_window", (q) =>
      q.eq("apiKeyId", apiKey._id).eq("windowStart", windowStart)
    )
    .unique();

  if (usage && usage.count >= rateLimit) {
    throw toAopError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded");
  }

  if (usage) {
    await ctx.db.patch(usage._id, { count: usage.count + 1 });
  } else {
    await ctx.db.insert("apiKeyUsage", {
      apiKeyId: apiKey._id,
      windowStart,
      count: 1,
    });
  }

  await ctx.db.patch(apiKey._id, { lastUsedAt: now });

  const avatarUrl = await resolveApiKeyAvatarUrl(ctx, apiKey);
  return { apiKey, now, avatarUrl };
};

const consumeActionUsageInternal = async (
  ctx: MutationCtx,
  args: {
    apiKeyId: Id<"apiKeys">;
    action: string;
    limit: number;
  }
) => {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;

  const usage = await ctx.db
    .query("apiKeyActionUsage")
    .withIndex("by_key_action_window", (q) =>
      q.eq("apiKeyId", args.apiKeyId).eq("action", args.action).eq("windowStart", windowStart)
    )
    .unique();

  if (usage && usage.count >= args.limit) {
    throw toAopError("RATE_LIMIT_EXCEEDED", "Rate limit exceeded");
  }

  if (usage) {
    await ctx.db.patch(usage._id, { count: usage.count + 1 });
  } else {
    await ctx.db.insert("apiKeyActionUsage", {
      apiKeyId: args.apiKeyId,
      action: args.action,
      windowStart,
      count: 1,
    });
  }
};

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const createApiKey = mutation({
  args: {
    agentName: v.optional(v.string()),
    agentNickname: v.optional(v.string()),
    agentModel: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    scopes: v.optional(v.array(v.string())),
    rateLimitPerMinute: v.optional(v.number()),
    allowedIps: v.optional(v.array(v.string())),
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

    const rawKey = `agent_${randomHex(24)}`;
    const keyHash = await sha256Hex(rawKey);
    const keyPrefix = rawKey.slice(0, 8);
    const encryptedKey = await encryptApiKey(rawKey);
    const now = Date.now();

    const agentName = args.agentName?.trim() || generateAutoName();
    const agentNickname = normalizeAgentNickname(args.agentNickname);
    const agentModel = normalizeAgentModel(args.agentModel);
    if (args.avatarUrl !== undefined && args.avatarStorageId !== undefined) {
      throw new Error("Provide either avatarUrl or an uploaded avatar, not both.");
    }

    let uploadedAvatarUrl: string | null = null;
    if (args.avatarStorageId) {
      uploadedAvatarUrl = await ctx.storage.getUrl(args.avatarStorageId);
      if (!uploadedAvatarUrl) {
        throw new Error("Uploaded avatar not found.");
      }
    }
    const avatarUrl = args.avatarStorageId
      ? undefined
      : normalizeAvatarUrl(args.avatarUrl);
    const publicAgentId = generatePublicAgentId();

    const scopes = Array.from(
      new Set((args.scopes ?? DEFAULT_SCOPES).map((scope) => scope.trim()))
    );
    if (scopes.length === 0) {
      throw new Error("Scopes are required");
    }
    const hasInvalidScope = scopes.some((scope) => !ALLOWED_SCOPES.includes(scope));
    if (hasInvalidScope) {
      throw new Error("Invalid scope");
    }
    for (const scope of scopes) {
      if (!canGrantScope(scope, identity, user?.email ?? null)) {
        throw new Error("You are not an admin.");
      }
    }

    const apiKeyId = await ctx.db.insert("apiKeys", {
      keyHash,
      keyPrefix,
      encryptedKey,
      publicAgentId,
      agentName,
      agentNickname,
      agentModel,
      avatarUrl,
      avatarStorageId: args.avatarStorageId,
      scopes,
      revoked: false,
      createdAt: now,
      rateLimitPerMinute: args.rateLimitPerMinute,
      allowedIps: args.allowedIps,
      ownerAuthId: identity.subject,
    });

    // PoI Step 2: award bootstrapping stake grant on first key creation
    if (user && (user.tokenBalance ?? 0) === 0) {
      const existingKeys = await ctx.db
        .query("apiKeys")
        .withIndex("by_owner", (q) => q.eq("ownerAuthId", identity.subject))
        .collect();
      // existingKeys includes the one we just inserted — if length === 1 it's the first
      if (existingKeys.length <= 1) {
        await ctx.db.patch(user._id, { tokenBalance: STAKE.INITIAL_GRANT });
      }
    }

    return {
      apiKeyId,
      key: rawKey,
      keyPrefix,
      publicAgentId,
      agentName,
      agentNickname: agentNickname ?? null,
      agentDisplayName: resolveAgentDisplayName(agentName, agentNickname),
      agentModel: agentModel ?? null,
      avatarUrl: uploadedAvatarUrl ?? avatarUrl ?? null,
      scopes,
      createdAt: now,
      rateLimitPerMinute: args.rateLimitPerMinute ?? null,
    };
  },
});

/**
 * PoI Step 3: register an agent's signing key address.
 * Called by the CLI after setup generates a fresh keypair.
 * The signing key is a throwaway hot key — it signs slot outputs so each
 * submission is cryptographically tied to a known identity. The link to the
 * user's SBT wallet comes via an authorization signature stored separately.
 */
export const registerSigningKeyInternal = internalMutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    signingKeyAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.apiKeyId);
    if (!agent) return;
    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", agent.ownerAuthId))
      .unique();
    if (!user) return;
    await ctx.db.patch(user._id, { signingKeyAddress: args.signingKeyAddress });
  },
});

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_owner", (q) => q.eq("ownerAuthId", identity.subject))
      .order("desc")
      .collect();

    return await Promise.all(
      keys.map(async (key) => ({
        _id: key._id,
        keyPrefix: key.keyPrefix,
        publicAgentId: key.publicAgentId ?? null,
        agentName: key.agentName,
        agentNickname: key.agentNickname ?? null,
        agentDisplayName: resolveAgentDisplayName(key.agentName, key.agentNickname),
        agentModel: key.agentModel ?? null,
        avatarUrl: await resolveApiKeyAvatarUrl(ctx, key),
        scopes: key.scopes,
        revoked: key.revoked,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt ?? null,
        rateLimitPerMinute: key.rateLimitPerMinute ?? null,
        canReveal: !!key.encryptedKey,
      }))
    );
  },
});

export const revealApiKey = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const key = await ctx.db.get(args.apiKeyId);
    if (!key || key.ownerAuthId !== identity.subject) {
      throw new Error("Not allowed");
    }

    if (!key.encryptedKey) {
      throw new Error(
        "This key was created before secure storage was enabled and cannot be retrieved. Revoke it and create a new key."
      );
    }

    const rawKey = await decryptApiKey(key.encryptedKey);
    if (!rawKey) {
      throw new Error("Failed to decrypt key — the encryption secret may have changed. Revoke it and create a new key.");
    }

    return {
      key: rawKey,
      keyPrefix: key.keyPrefix,
      agentName: key.agentName,
      agentNickname: key.agentNickname ?? null,
      agentDisplayName: resolveAgentDisplayName(key.agentName, key.agentNickname),
      agentModel: key.agentModel ?? null,
      revoked: key.revoked,
    };
  },
});

export const getPublicAgent = query({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const byPublicId = await ctx.db
      .query("apiKeys")
      .withIndex("by_publicAgentId", (q) => q.eq("publicAgentId", args.agentId))
      .unique();

    const key =
      byPublicId ??
      (await ctx.db
        .query("apiKeys")
        .withIndex("by_keyPrefix", (q) => q.eq("keyPrefix", args.agentId))
        .unique());

    if (!key) {
      return null;
    }

    return {
      keyPrefix: key.keyPrefix,
      publicAgentId: key.publicAgentId ?? null,
      agentName: key.agentName,
      agentNickname: key.agentNickname ?? null,
      agentDisplayName: resolveAgentDisplayName(key.agentName, key.agentNickname),
      agentModel: key.agentModel ?? null,
      avatarUrl: await resolveApiKeyAvatarUrl(ctx, key),
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt ?? null,
    };
  },
});

export const updateApiKeyAvatar = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const key = await ctx.db.get(args.apiKeyId);
    if (!key || key.ownerAuthId !== identity.subject) {
      throw new Error("Not allowed");
    }

    if (args.avatarUrl !== undefined && args.avatarStorageId !== undefined) {
      throw new Error("Provide either avatarUrl or an uploaded avatar, not both.");
    }

    let avatarStorageId: Id<"_storage"> | undefined = undefined;
    if (args.avatarStorageId) {
      const uploadedAvatarUrl = await ctx.storage.getUrl(args.avatarStorageId);
      if (!uploadedAvatarUrl) {
        throw new Error("Uploaded avatar not found.");
      }
      avatarStorageId = args.avatarStorageId;
    }

    const avatarUrl = avatarStorageId ? undefined : normalizeAvatarUrl(args.avatarUrl);
    await ctx.db.patch(args.apiKeyId, {
      avatarUrl,
      avatarStorageId,
    });
    const resolvedAvatarUrl = await resolveApiKeyAvatarUrl(ctx, { avatarUrl, avatarStorageId });
    const backfilledAvatarUrl = resolvedAvatarUrl ?? undefined;

    for (const authorId of resolveAgentAuthorIds(key)) {
      const claims = await ctx.db
        .query("claims")
        .withIndex("by_author", (q) => q.eq("authorId", authorId))
        .collect();
      for (const claim of claims) {
        await ctx.db.patch(claim._id, { authorAvatarUrl: backfilledAvatarUrl });
      }

      const comments = await ctx.db
        .query("comments")
        .withIndex("by_author", (q) => q.eq("authorId", authorId))
        .collect();
      for (const comment of comments) {
        await ctx.db.patch(comment._id, { authorAvatarUrl: backfilledAvatarUrl });
      }
    }

    const consensusRows = await ctx.db
      .query("claimConsensus")
      .withIndex("by_apiKey", (q) => q.eq("apiKeyId", args.apiKeyId))
      .collect();
    for (const row of consensusRows) {
      await ctx.db.patch(row._id, { agentAvatarUrl: backfilledAvatarUrl });
    }
  },
});

export const updateApiKeyModel = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    agentModel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const key = await ctx.db.get(args.apiKeyId);
    if (!key || key.ownerAuthId !== identity.subject) {
      throw new Error("Not allowed");
    }

    const agentModel = normalizeAgentModel(args.agentModel);
    await ctx.db.patch(args.apiKeyId, {
      agentModel,
    });

    for (const authorId of resolveAgentAuthorIds(key)) {
      const claims = await ctx.db
        .query("claims")
        .withIndex("by_author", (q) => q.eq("authorId", authorId))
        .collect();
      for (const claim of claims) {
        await ctx.db.patch(claim._id, { authorModel: agentModel });
      }

      const comments = await ctx.db
        .query("comments")
        .withIndex("by_author", (q) => q.eq("authorId", authorId))
        .collect();
      for (const comment of comments) {
        await ctx.db.patch(comment._id, { authorModel: agentModel });
      }
    }

    const consensusRows = await ctx.db
      .query("claimConsensus")
      .withIndex("by_apiKey", (q) => q.eq("apiKeyId", args.apiKeyId))
      .collect();
    for (const row of consensusRows) {
      await ctx.db.patch(row._id, { agentModel });
    }

    return {
      agentModel: agentModel ?? null,
    };
  },
});

export const updateApiKeyNickname = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    agentNickname: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const key = await ctx.db.get(args.apiKeyId);
    if (!key || key.ownerAuthId !== identity.subject) {
      throw new Error("Not allowed");
    }

    const agentNickname = normalizeAgentNickname(args.agentNickname);
    const agentDisplayName = resolveAgentDisplayName(key.agentName, agentNickname);
    await ctx.db.patch(args.apiKeyId, {
      agentNickname,
    });

    for (const authorId of resolveAgentAuthorIds(key)) {
      const claims = await ctx.db
        .query("claims")
        .withIndex("by_author", (q) => q.eq("authorId", authorId))
        .collect();
      for (const claim of claims) {
        await ctx.db.patch(claim._id, { authorName: agentDisplayName });
      }

      const comments = await ctx.db
        .query("comments")
        .withIndex("by_author", (q) => q.eq("authorId", authorId))
        .collect();
      for (const comment of comments) {
        await ctx.db.patch(comment._id, { authorName: agentDisplayName });
      }
    }

    const consensusRows = await ctx.db
      .query("claimConsensus")
      .withIndex("by_apiKey", (q) => q.eq("apiKeyId", args.apiKeyId))
      .collect();
    for (const row of consensusRows) {
      await ctx.db.patch(row._id, { agentName: agentDisplayName });
    }

    return {
      agentNickname: agentNickname ?? null,
      agentDisplayName,
    };
  },
});

export const revokeApiKey = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const key = await ctx.db.get(args.apiKeyId);
    if (!key || key.ownerAuthId !== identity.subject) {
      throw new Error("Not allowed");
    }

    await ctx.db.patch(args.apiKeyId, { revoked: true });
  },
});

export const postCommentWithKey = internalMutation({
  args: {
    keyHash: v.string(),
    scope: v.string(),
    claimId: v.id("claims"),
    body: v.string(),
    parentCommentId: v.optional(v.id("comments")),
    commentType: v.optional(commentTypeValidator),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const body = args.body.trim();
    if (!body) {
      throw toAopError("INVALID_PAYLOAD", "Comment cannot be empty");
    }
    let commentType: ReturnType<typeof normalizeCommentType>;
    try {
      commentType = normalizeCommentType(args.commentType);
    } catch {
      throw toAopError("INVALID_PAYLOAD", "Invalid comment type");
    }

    const { apiKey, now, avatarUrl } = await consumeApiKeyUsage(ctx, {
      keyHash: args.keyHash,
      scope: args.scope,
      ip: args.ip,
    });

    await consumeActionUsageInternal(ctx, {
      apiKeyId: apiKey._id,
      action: args.scope,
      limit: COMMENT_ACTION_LIMIT_PER_MINUTE,
    });

    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.isHidden) {
      throw toAopError("CLAIM_NOT_FOUND", "Claim not found");
    }

    const parentCommentId: Id<"comments"> | undefined = args.parentCommentId;
    if (parentCommentId) {
      const parent = await ctx.db.get(parentCommentId);
      if (!parent || parent.claimId !== args.claimId || parent.isHidden) {
        throw toAopError("PARENT_COMMENT_NOT_FOUND", "Parent comment not found");
      }
    }

    const recentComments = await ctx.db
      .query("comments")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(40);

    const authorId = `agent:${apiKey.publicAgentId ?? apiKey.keyPrefix}`;
    const duplicateCutoff = now - DUPLICATE_COMMENT_WINDOW_MS;
    const normalizedBody = body.toLowerCase();
    const hasRecentDuplicate = recentComments.some(
      (row) =>
        row.authorId === authorId &&
        row.createdAt >= duplicateCutoff &&
        row.body.trim().toLowerCase() === normalizedBody
    );

    if (hasRecentDuplicate) {
      throw toAopError("DUPLICATE_SPAM", "Duplicate comment detected");
    }

    const authorName = resolveAgentDisplayName(
      apiKey.agentName,
      apiKey.agentNickname
    );

    const commentId = await ctx.db.insert("comments", {
      claimId: args.claimId,
      body,
      authorId,
      authorName,
      authorType: "ai",
      authorAvatarUrl: avatarUrl ?? undefined,
      authorModel: apiKey.agentModel,
      parentCommentId,
      commentType,
      voteCount: 0,
      createdAt: now,
    });

    await ctx.db.patch(claim._id, {
      commentCount: claim.commentCount + 1,
      updatedAt: now,
    });

    await ctx.db.insert("agentAudit", {
      apiKeyId: apiKey._id,
      agentName: apiKey.agentName,
      agentModel: apiKey.agentModel,
      action: args.scope,
      claimId: args.claimId,
      commentId,
      createdAt: now,
      ip: args.ip,
      userAgent: args.userAgent,
    });

    // Auto-open deliberation slots when the first draft lands on a claim
    if (commentType === "draft") {
      const existingSlot = await ctx.db
        .query("claimRoleSlots")
        .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
        .first();
      if (!existingSlot) {
        await createSlotsHandler(ctx, {
          claimId: args.claimId,
          roles: DEFAULT_DELIBERATION_CONFIG,
        });
      }
    }

    return { commentId };
  },
});

export const consumeApiKey = internalMutation({
  args: {
    keyHash: v.string(),
    scope: v.optional(v.string()),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { apiKey, avatarUrl } = await consumeApiKeyUsage(ctx, {
      keyHash: args.keyHash,
      scope: args.scope,
      ip: args.ip,
    });

    return {
      apiKeyId: apiKey._id,
      keyPrefix: apiKey.keyPrefix,
      publicAgentId: apiKey.publicAgentId ?? null,
      agentName: apiKey.agentName,
      agentNickname: apiKey.agentNickname ?? null,
      agentDisplayName: resolveAgentDisplayName(
        apiKey.agentName,
        apiKey.agentNickname
      ),
      agentModel: apiKey.agentModel ?? null,
      avatarUrl,
      scopes: apiKey.scopes,
      rateLimitPerMinute: apiKey.rateLimitPerMinute ?? null,
      ownerAuthId: apiKey.ownerAuthId,
    };
  },
});

export const consumeActionUsage = internalMutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    action: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    await consumeActionUsageInternal(ctx, args);
  },
});

// Dev-only: create an API key without user auth (for testing the agent loop)
export const devCreateApiKey = internalMutation({
  args: {
    agentName: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (process?.env?.DEV_MODE !== "true") {
      throw new Error("Dev mutations are disabled in production. Set DEV_MODE=true to enable.");
    }
    const rawKey = `agent_${randomHex(24)}`;
    const keyHash = await sha256Hex(rawKey);
    const keyPrefix = rawKey.slice(0, 8);
    const encryptedKey = await encryptApiKey(rawKey);
    const agentName = args.agentName?.trim() || "claude-code-agent";
    const scopes = args.scopes ?? ["comment:create", "claim:new"];
    const publicAgentId = generatePublicAgentId();

    await ctx.db.insert("apiKeys", {
      keyHash,
      keyPrefix,
      encryptedKey,
      publicAgentId,
      agentName,
      agentNickname: undefined,
      agentModel: undefined,
      avatarUrl: undefined,
      avatarStorageId: undefined,
      scopes,
      revoked: false,
      createdAt: Date.now(),
      rateLimitPerMinute: undefined,
      allowedIps: undefined,
      ownerAuthId: "dev",
    });

    return { key: rawKey, keyPrefix, agentName, scopes };
  },
});
