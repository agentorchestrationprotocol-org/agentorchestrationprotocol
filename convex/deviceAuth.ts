import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { generateAutoName } from "./utils/names";
import { normalizeAvatarUrl } from "./utils/avatar";
import { normalizeAgentModel } from "./utils/agentModel";
import { STAKE } from "./staking";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const DEVICE_CODE_EXPIRY_MS = 15 * 60 * 1000;
const ALLOWED_SCOPES = ["comment:create", "consensus:write", "claim:new", "classification:write", "policy:write", "output:write", "slots:configure"];
const DEFAULT_SCOPES = ["comment:create"];

const RESTRICTED_SCOPES: Record<string, string> = {};

const parseAllowlist = (envVar: string) =>
  (process?.env?.[envVar] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

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

const INSECURE_LOCAL_KEY_ENCRYPTION_SECRET = "aop-local-dev-key-encryption";
const API_KEY_ENCRYPTION_SECRET =
  process?.env?.AOP_API_KEY_ENCRYPTION_SECRET ??
  process?.env?.API_KEY_ENCRYPTION_SECRET ??
  INSECURE_LOCAL_KEY_ENCRYPTION_SECRET;

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const randomHex = (length: number) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
};

const sha256Hex = async (input: string) => {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(hash));
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

const generateUserCode = () => {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "0123456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters[bytes[i] % letters.length];
  }
  code += "-";
  for (let i = 4; i < 8; i++) {
    code += digits[bytes[i] % digits.length];
  }
  return code;
};

export const createDeviceCode = internalMutation({
  args: {
    scopes: v.optional(v.array(v.string())),
    agentName: v.optional(v.string()),
    agentModel: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + DEVICE_CODE_EXPIRY_MS;

    const scopes =
      args.scopes && args.scopes.length > 0 ? args.scopes : DEFAULT_SCOPES;
    for (const scope of scopes) {
      if (!ALLOWED_SCOPES.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}`);
      }
    }

    const deviceCode = randomHex(32);

    let userCode: string;
    let attempts = 0;
    do {
      userCode = generateUserCode();
      const existing = await ctx.db
        .query("deviceCodes")
        .withIndex("by_userCode_status", (q) =>
          q.eq("userCode", userCode).eq("status", "pending")
        )
        .first();
      if (!existing) break;
      attempts++;
    } while (attempts < 5);

    if (attempts >= 5) {
      throw new Error("Failed to generate unique user code");
    }

    await ctx.db.insert("deviceCodes", {
      deviceCode,
      userCode,
      scopes,
      agentName: args.agentName?.trim() || undefined,
      agentModel: normalizeAgentModel(args.agentModel),
      avatarUrl: normalizeAvatarUrl(args.avatarUrl),
      status: "pending",
      expiresAt,
      createdAt: now,
    });

    return { deviceCode, userCode, expiresAt };
  },
});

export const getDeviceCodeByUserCode = query({
  args: {
    userCode: v.string(),
  },
  handler: async (ctx, args) => {
    const code = args.userCode.trim().toUpperCase();

    const record = await ctx.db
      .query("deviceCodes")
      .withIndex("by_userCode_status", (q) =>
        q.eq("userCode", code).eq("status", "pending")
      )
      .first();

    if (!record) return null;
    if (Date.now() > record.expiresAt) return null;

    return {
      userCode: record.userCode,
      scopes: record.scopes,
      agentName: record.agentName ?? null,
      agentModel: record.agentModel ?? null,
      avatarUrl: record.avatarUrl ?? null,
      expiresAt: record.expiresAt,
    };
  },
});

export const approveDeviceCode = mutation({
  args: {
    userCode: v.string(),
    grantedScopes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const code = args.userCode.trim().toUpperCase();

    const record = await ctx.db
      .query("deviceCodes")
      .withIndex("by_userCode_status", (q) =>
        q.eq("userCode", code).eq("status", "pending")
      )
      .first();

    if (!record) {
      throw new Error("Invalid or expired code");
    }

    if (Date.now() > record.expiresAt) {
      throw new Error("Code has expired");
    }

    // Use caller-selected scopes if provided, otherwise fall back to requested scopes.
    // Caller may only grant scopes that are in ALLOWED_SCOPES.
    const grantedScopes =
      args.grantedScopes && args.grantedScopes.length > 0
        ? args.grantedScopes
        : record.scopes;

    for (const scope of grantedScopes) {
      if (!ALLOWED_SCOPES.includes(scope)) {
        throw new Error(`Invalid scope: ${scope}`);
      }
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();

    for (const scope of grantedScopes) {
      if (!canGrantScope(scope, identity, user?.email ?? null)) {
        throw new Error("You are not an admin.");
      }
    }

    const rawKey = `agent_${randomHex(24)}`;
    const keyHash = await sha256Hex(rawKey);
    const keyPrefix = rawKey.slice(0, 8);
    const encryptedKey = await encryptApiKey(rawKey);
    const now = Date.now();
    const agentName = record.agentName?.trim() || generateAutoName();
    const agentModel = normalizeAgentModel(record.agentModel);
    const publicAgentId = `ag_${randomHex(8)}`;

    await ctx.db.insert("apiKeys", {
      keyHash,
      keyPrefix,
      encryptedKey,
      publicAgentId,
      agentName,
      agentModel,
      avatarUrl: record.avatarUrl,
      scopes: grantedScopes,
      revoked: false,
      createdAt: now,
      ownerAuthId: identity.subject,
    });

    await ctx.db.patch(record._id, {
      status: "approved",
      apiKey: rawKey,
      apiKeyScopes: grantedScopes,
    });

    // PoI Step 2: award bootstrapping stake grant on first key creation
    if (user && (user.tokenBalance ?? 0) === 0) {
      const existingKeys = await ctx.db
        .query("apiKeys")
        .withIndex("by_owner", (q) => q.eq("ownerAuthId", identity.subject))
        .collect();
      if (existingKeys.length <= 1) {
        await ctx.db.patch(user._id, { tokenBalance: STAKE.INITIAL_GRANT });
      }
    }

    return { ok: true };
  },
});

export const pollDeviceCode = internalMutation({
  args: {
    deviceCode: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("deviceCodes")
      .withIndex("by_deviceCode", (q) => q.eq("deviceCode", args.deviceCode))
      .first();

    if (!record) {
      return { status: "invalid" as const };
    }

    if (Date.now() > record.expiresAt && record.status === "pending") {
      return { status: "expired" as const };
    }

    if (record.status === "consumed") {
      return { status: "consumed" as const };
    }

    if (record.status === "pending") {
      return { status: "pending" as const };
    }

    const apiKey = record.apiKey;
    if (!apiKey) {
      return { status: "pending" as const };
    }

    await ctx.db.patch(record._id, {
      status: "consumed",
      apiKey: undefined,
    });

    return {
      status: "approved" as const,
      apiKey,
      scopes: record.apiKeyScopes ?? record.scopes,
    };
  },
});
