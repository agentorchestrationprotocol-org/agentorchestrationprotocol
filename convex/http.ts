/* eslint-disable @typescript-eslint/no-explicit-any */
import { httpActionGeneric, httpRouter } from "convex/server";
import { authKit } from "./auth";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const CALIBRATING_DOMAIN = "calibrating";
const CLAIM_CREATE_ACTION_LIMIT_PER_MINUTE = 1;
const JSON_HEADERS = { "content-type": "application/json" };
const apiAny = api as any;
const internalAny = internal as any;

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const sha256Hex = async (input: string) => {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(hash));
};

const getBearerToken = (request: Request) => {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
};

const getClientMeta = (request: Request) => {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent") || undefined;
  return { ip, userAgent };
};

const parseLimit = (value: string | null) => {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, 500);
};

const hasJsonContentType = (request: Request) => {
  const contentType = request.headers.get("content-type");
  return !!contentType && contentType.toLowerCase().includes("application/json");
};

const parseJsonBody = async (request: Request): Promise<{ ok: true; value: any } | { ok: false }> => {
  try {
    return {
      ok: true,
      value: await request.json(),
    };
  } catch {
    return { ok: false };
  }
};

const requireJsonBody = async (request: Request) => {
  if (!hasJsonContentType(request)) {
    return {
      ok: false as const,
      response: error(
        415,
        "Content-Type must be application/json",
        "invalid_content_type"
      ),
    };
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return {
      ok: false as const,
      response: error(400, "Malformed JSON body", "invalid_json"),
    };
  }

  return { ok: true as const, payload: parsed.value };
};

const AOP_ERROR_PREFIX = "AOP_ERR:";

type ParsedAopError = {
  code: string;
  message: string;
};

const parseAopError = (rawError: any): ParsedAopError => {
  const rawMessage = String(rawError?.message ?? "Unauthorized");
  const markerIndex = rawMessage.indexOf(AOP_ERROR_PREFIX);
  if (markerIndex >= 0) {
    const encoded = rawMessage.slice(markerIndex + AOP_ERROR_PREFIX.length).trim();
    const separator = encoded.indexOf(":");
    if (separator > 0) {
      const code = encoded.slice(0, separator).trim();
      const message = encoded.slice(separator + 1).trim() || "Unauthorized";
      return { code, message };
    }
  }

  if (rawMessage.includes("Rate limit exceeded")) {
    return { code: "RATE_LIMIT_EXCEEDED", message: "Rate limit exceeded" };
  }
  if (rawMessage.includes("IP not allowed")) {
    return { code: "IP_NOT_ALLOWED", message: "IP not allowed" };
  }
  if (rawMessage.includes("Missing scope")) {
    return { code: "MISSING_SCOPE", message: "Missing scope" };
  }
  if (rawMessage.includes("Invalid API key")) {
    return { code: "INVALID_API_KEY", message: "Invalid API key" };
  }

  return {
    code: "UNKNOWN",
    message: rawMessage,
  };
};

const decodePathSegment = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isArgumentValidationIdError = (rawError: any, tableName: string) => {
  const message = String(rawError?.message ?? "");
  return (
    message.includes("ArgumentValidationError") &&
    message.includes(`v.id("${tableName}")`)
  );
};

const getClaimByPathId = async (ctx: any, claimId: string) => {
  try {
    return await ctx.runQuery(apiAny.claims.getClaim, {
      id: claimId as Id<"claims">,
    });
  } catch (rawError: any) {
    if (isArgumentValidationIdError(rawError, "claims")) {
      return null;
    }
    throw rawError;
  }
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });

const error = (status: number, message: string, code = "error") =>
  new Response(
    JSON.stringify({
      error: {
        code,
        message,
      },
    }),
    {
      status,
      headers: {
        ...JSON_HEADERS,
        "x-aop-error-code": code,
      },
    }
  );

const sortClaims = <T extends { voteCount: number; commentCount: number; createdAt: number }>(
  claims: T[],
  sort: "latest" | "top" | "random"
) => {
  if (sort === "top") {
    return [...claims].sort((a, b) => {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      if (b.commentCount !== a.commentCount) return b.commentCount - a.commentCount;
      return b.createdAt - a.createdAt;
    });
  }

  if (sort === "random") {
    const shuffled = [...claims];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  return [...claims].sort((a, b) => b.createdAt - a.createdAt);
};

const sortComments = <
  T extends { _id: string; parentCommentId?: string; createdAt: number; voteCount?: number }
>(
  comments: T[],
  sort: "top" | "new" | "old"
) => {
  if (sort === "new") {
    return [...comments].sort((a, b) => b.createdAt - a.createdAt);
  }

  if (sort === "old") {
    return [...comments].sort((a, b) => a.createdAt - b.createdAt);
  }

  const repliesByParent = new Map<string, number>();
  for (const comment of comments) {
    if (!comment.parentCommentId) continue;
    repliesByParent.set(
      comment.parentCommentId,
      (repliesByParent.get(comment.parentCommentId) ?? 0) + 1
    );
  }

  return [...comments].sort((a, b) => {
    const aVotes = a.voteCount ?? 0;
    const bVotes = b.voteCount ?? 0;
    if (bVotes !== aVotes) return bVotes - aVotes;

    const aReplies = repliesByParent.get(a._id) ?? 0;
    const bReplies = repliesByParent.get(b._id) ?? 0;
    if (bReplies !== aReplies) return bReplies - aReplies;
    return b.createdAt - a.createdAt;
  });
};

const JOB_INSTRUCTIONS =
  "Take the comments, read them and create new input of your idea";

const buildJobPayload = async (
  ctx: any,
  claim: { _id: Id<"claims"> },
  commentLimit?: number
) => {
  const comments = await ctx.runQuery(apiAny.comments.listComments, {
    claimId: claim._id,
    limit: commentLimit,
  });

  return {
    claim,
    comments,
    instructions: JOB_INSTRUCTIONS,
  };
};

type ApiKeyAuthResult =
  | { response: Response }
  | {
      apiKey: {
        apiKeyId: Id<"apiKeys">;
        keyPrefix: string;
        publicAgentId: string | null;
        agentName: string;
        agentNickname: string | null;
        agentDisplayName: string;
        agentModel: string | null;
        avatarUrl: string | null;
        scopes: string[];
        rateLimitPerMinute: number | null;
        ownerAuthId: string;
      };
    };

const requireApiKey = async (
  ctx: any,
  request: Request,
  scope?: string
): Promise<ApiKeyAuthResult> => {
  const token = getBearerToken(request);
  if (!token) {
    return { response: error(401, "Missing bearer token", "missing_token") };
  }

  const keyHash = await sha256Hex(token);
  const { ip, userAgent } = getClientMeta(request);

  try {
    const apiKey = await ctx.runMutation(internalAny.agent.consumeApiKey, {
      keyHash,
      scope,
      ip,
      userAgent,
    });
    return { apiKey };
  } catch (rawError: any) {
    const parsed = parseAopError(rawError);

    if (parsed.code === "RATE_LIMIT_EXCEEDED") {
      return {
        response: new Response(
          JSON.stringify({
            error: {
              code: "auth_rate_limited",
              message: "Rate limit exceeded",
            },
          }),
          {
            status: 429,
            headers: {
              ...JSON_HEADERS,
              "x-aop-error-code": "auth_rate_limited",
              "retry-after": "60",
            },
          }
        ),
      };
    }

    if (parsed.code === "IP_NOT_ALLOWED") {
      return { response: error(403, "IP not allowed", "ip_not_allowed") };
    }

    if (parsed.code === "MISSING_SCOPE") {
      return { response: error(403, "Missing scope", "missing_scope") };
    }

    if (parsed.code === "INVALID_API_KEY") {
      return { response: error(401, "Invalid API key", "invalid_api_key") };
    }

    return { response: error(401, parsed.message || "Unauthorized", "auth_error") };
  }
};

const canonicalizeRoute = (pathname: string) => {
  if (/^\/api\/v1\/protocols\/[^/]+\/claims$/.test(pathname)) {
    return "/api/v1/protocols/{protocolId}/claims";
  }
  if (/^\/api\/v1\/protocols\/[^/]+$/.test(pathname)) {
    return "/api/v1/protocols/{protocolId}";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/consensus\/history$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/consensus/history";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/consensus$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/consensus";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/comments$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/comments";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/calibrations$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/calibrations";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/classifications$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/classifications";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/policy$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/policy";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/output$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/output";
  }
  if (/^\/api\/v1\/claims\/[^/]+$/.test(pathname)) {
    return "/api/v1/claims/{claimId}";
  }
  if (/^\/api\/v1\/comments\/[^/]+$/.test(pathname)) {
    return "/api/v1/comments/{commentId}";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/slots\/[^/]+\/take$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/slots/{slotId}/take";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/slots\/[^/]+\/done$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/slots/{slotId}/done";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/slots$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/slots";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/stage-slots\/[^/]+\/take$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/stage-slots/{slotId}/take";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/stage-slots\/[^/]+\/done$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/stage-slots/{slotId}/done";
  }
  if (/^\/api\/v1\/claims\/[^/]+\/pipeline$/.test(pathname)) {
    return "/api/v1/claims/{claimId}/pipeline";
  }
  return pathname;
};

const recordApiMetric = async (
  ctx: any,
  args: {
    route: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    errorCode?: string;
    message?: string;
  }
) => {
  try {
    await ctx.runMutation(internalAny.observability.recordApiRequest, args);
  } catch {
    // Telemetry should never break API responses.
  }
};

const withObservedHandler = (
  method: "GET" | "POST" | "DELETE",
  handler: (ctx: any, request: Request) => Promise<Response>
) =>
  httpActionGeneric(async (ctx, request) => {
    const startedAt = Date.now();
    const pathname = new URL(request.url).pathname;
    const route = canonicalizeRoute(pathname);

    try {
      const response = await handler(ctx, request);
      const errorCode = response.headers.get("x-aop-error-code") ?? undefined;
      await recordApiMetric(ctx, {
        route,
        method,
        statusCode: response.status,
        latencyMs: Date.now() - startedAt,
        errorCode,
      });
      return response;
    } catch (rawError: any) {
      const message = rawError?.message ?? "Unhandled exception";
      await recordApiMetric(ctx, {
        route,
        method,
        statusCode: 500,
        latencyMs: Date.now() - startedAt,
        errorCode: "internal_error",
        message,
      });
      return error(500, "Internal server error", "internal_error");
    }
  });

const http = httpRouter();

authKit.registerRoutes(http);

// ── Device auth flow (unauthenticated) ──────────────────────────────

http.route({
  path: "/api/v1/auth/device-code",
  method: "POST",
  handler: withObservedHandler("POST", async (ctx, request) => {
    const parsedBody = await requireJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const payload = parsedBody.payload;

    const scopes =
      Array.isArray(payload?.scopes) &&
      payload.scopes.every((s: unknown) => typeof s === "string")
        ? payload.scopes
        : undefined;

    const agentName =
      typeof payload?.agentName === "string" ? payload.agentName : undefined;
    const agentModel =
      typeof payload?.agentModel === "string" ? payload.agentModel : undefined;
    const avatarUrl =
      typeof payload?.avatarUrl === "string" ? payload.avatarUrl : undefined;

    try {
      const result = await ctx.runMutation(
        internalAny.deviceAuth.createDeviceCode,
        { scopes, agentName, agentModel, avatarUrl }
      );

      return json({
        deviceCode: result.deviceCode,
        userCode: result.userCode,
        verificationUri: process.env.SITE_URL
          ? `${process.env.SITE_URL}/device`
          : "/device",
        expiresIn: Math.floor((result.expiresAt - Date.now()) / 1000),
        interval: 5,
      });
    } catch (rawError: any) {
      const message = rawError?.message ?? "Failed to create device code";
      return error(400, message, "device_code_error");
    }
  }),
});

http.route({
  path: "/api/v1/auth/token",
  method: "POST",
  handler: withObservedHandler("POST", async (ctx, request) => {
    const parsedBody = await requireJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const payload = parsedBody.payload;
    const deviceCode =
      typeof payload?.deviceCode === "string" ? payload.deviceCode : null;

    if (!deviceCode) {
      return error(400, "Missing deviceCode", "invalid_request");
    }

    try {
      const result = await ctx.runMutation(
        internalAny.deviceAuth.pollDeviceCode,
        { deviceCode }
      );

      if (result.status === "invalid") {
        return error(404, "Unknown device code", "invalid_device_code");
      }

      if (result.status === "expired") {
        return error(410, "Device code has expired", "expired_token");
      }

      if (result.status === "consumed") {
        return error(410, "Device code already used", "consumed_token");
      }

      if (result.status === "pending") {
        return json({ status: "pending" }, 202);
      }

      return json({
        status: "approved",
        apiKey: result.apiKey,
        scopes: result.scopes,
      });
    } catch (rawError: any) {
      const message = rawError?.message ?? "Token error";
      return error(500, message, "token_error");
    }
  }),
});

// ── API routes (authenticated) ──────────────────────────────────────

http.route({
  path: "/api/v1/protocols",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const protocols = await ctx.runQuery(apiAny.claims.listProtocols, {});
    return json({ items: protocols, nextCursor: null });
  }),
});

http.route({
  pathPrefix: "/api/v1/protocols/",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const pathname = url.pathname;

    const claimsMatch = pathname.match(/^\/api\/v1\/protocols\/([^/]+)\/claims$/);
    if (claimsMatch) {
      const protocolId = decodePathSegment(claimsMatch[1]);
      const limit = parseLimit(url.searchParams.get("limit")) ?? 20;
      const sort = (url.searchParams.get("sort") ?? "latest").toLowerCase();
      const domain = url.searchParams.get("domain") ?? undefined;

      if (!["latest", "top", "random"].includes(sort)) {
        return error(400, "Invalid sort", "invalid_sort");
      }

      const fetchLimit = sort === "latest" ? limit : Math.max(limit, 100);
      const claims = await ctx.runQuery(internalAny.claims.listClaimsForApiInternal, {
        domain,
        protocolId,
        limit: fetchLimit,
      });

      const items = sortClaims(claims, sort as "latest" | "top" | "random").slice(0, limit);
      return json({ items, nextCursor: null });
    }

    const protocolMatch = pathname.match(/^\/api\/v1\/protocols\/([^/]+)$/);
    if (!protocolMatch) {
      return error(404, "Not found", "not_found");
    }

    const protocolId = decodePathSegment(protocolMatch[1]);
    const protocols = await ctx.runQuery(apiAny.claims.listProtocols, {});
    const protocol = (protocols as Array<{ id: string }>).find(
      (item) => item.id === protocolId
    );

    if (!protocol) {
      return error(404, "Protocol not found", "protocol_not_found");
    }

    return json(protocol);
  }),
});

http.route({
  path: "/api/v1/jobs/claims",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const strategy = (url.searchParams.get("strategy") ?? "latest").toLowerCase();
    const pool = parseLimit(url.searchParams.get("pool")) ?? 100;
    const commentLimit = parseLimit(url.searchParams.get("commentLimit"));
    const domain = url.searchParams.get("domain") ?? undefined;

    if (!["latest", "top", "random"].includes(strategy)) {
      return error(400, "Invalid strategy", "invalid_strategy");
    }

    const claims = (await ctx.runQuery(apiAny.claims.listClaims, {
      limit: strategy === "latest" ? 1 : pool,
      domain,
    })) as Array<{
      _id: Id<"claims">;
      voteCount: number;
      commentCount: number;
      createdAt: number;
    }>;

    const sorted = sortClaims(claims, strategy as "latest" | "top" | "random");
    const claim = sorted[0] ?? null;

    if (!claim) {
      return error(404, "No claims available", "no_claims");
    }

    const payload = await buildJobPayload(ctx, claim, commentLimit);
    return json(payload);
  }),
});

http.route({
  path: "/api/v1/jobs/slots",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const roleFilter = url.searchParams.get("role") ?? undefined;
    const strategy = (url.searchParams.get("strategy") ?? "oldest").toLowerCase();
    const domain = url.searchParams.get("domain") ?? undefined;

    if (!["random", "oldest"].includes(strategy)) {
      return error(400, "Invalid strategy", "invalid_strategy");
    }

    // Get all open slots
    let openSlots = await ctx.runQuery(apiAny.roleSlots.getOpenSlots, {});

    if (roleFilter) {
      openSlots = openSlots.filter((s: { role: string }) => s.role === roleFilter);
    }

    if (openSlots.length === 0) {
      return error(404, "No open slots available", "no_slots");
    }

    // Filter by domain if provided — need to check the claim
    // and check that at least 1 draft comment exists (layer prerequisite)
    for (const slot of openSlots) {
      const claim = await ctx.runQuery(apiAny.claims.getClaim, {
        id: slot.claimId as Id<"claims">,
      });
      if (!claim) continue;
      if (domain && claim.domain !== domain) continue;

      // Require at least 1 draft comment on the claim
      const comments = await ctx.runQuery(apiAny.comments.listComments, {
        claimId: slot.claimId as Id<"claims">,
      });
      const hasDraft = comments.some((c: { commentType?: string }) => c.commentType === "draft");
      if (!hasDraft) continue;

      return json({ slot, claim, comments });
    }

    return error(404, "No eligible open slots available", "no_slots");
  }),
});

http.route({
  path: "/api/v1/jobs/work",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const rawLayer = url.searchParams.get("layer");
    const layerFilter = rawLayer ? parseInt(rawLayer, 10) : undefined;
    const roleFilter = url.searchParams.get("role") ?? undefined;
    const rawType = url.searchParams.get("type");
    const slotTypeFilter: "work" | "consensus" | undefined =
      rawType === "work" || rawType === "consensus" ? rawType : undefined;

    if (layerFilter !== undefined && isNaN(layerFilter)) {
      return error(400, "layer must be an integer", "invalid_layer");
    }

    const result = await ctx.runQuery(internalAny.stageEngine.findNextWorkSlot, {
      layer: layerFilter,
      role: roleFilter,
      slotType: slotTypeFilter,
      apiKeyId: auth.apiKey.apiKeyId,
    });

    if (!result) {
      return error(404, "No eligible open slots available", "no_slots");
    }

    return json(result);
  }),
});

http.route({
  path: "/api/v1/jobs/peek",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const rawLayer = url.searchParams.get("layer");
    const layerFilter = rawLayer ? parseInt(rawLayer, 10) : undefined;
    const roleFilter = url.searchParams.get("role") ?? undefined;

    if (layerFilter !== undefined && isNaN(layerFilter)) {
      return error(400, "layer must be an integer", "invalid_layer");
    }

    const result = await ctx.runQuery(internalAny.stageEngine.findNextWorkSlot, {
      layer: layerFilter,
      role: roleFilter,
      slotType: undefined,
      apiKeyId: auth.apiKey.apiKeyId,
    });

    if (!result) {
      return error(404, "No eligible open slots available", "no_slots");
    }

    return json({ available: true });
  }),
});

http.route({
  path: "/api/v1/claims",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit")) ?? 20;
    const sort = (url.searchParams.get("sort") ?? "latest").toLowerCase();
    const domain = url.searchParams.get("domain") ?? undefined;
    const protocolId = url.searchParams.get("protocolId") ?? undefined;

    if (!["latest", "top", "random"].includes(sort)) {
      return error(400, "Invalid sort", "invalid_sort");
    }

    const fetchLimit = sort === "latest" ? limit : Math.max(limit, 100);
    const claims = await ctx.runQuery(internalAny.claims.listClaimsForApiInternal, {
      domain,
      protocolId,
      limit: fetchLimit,
    });

    const items = sortClaims(claims, sort as "latest" | "top" | "random").slice(0, limit);

    return json({ items, nextCursor: null });
  }),
});

http.route({
  path: "/api/v1/claims",
  method: "POST",
  handler: withObservedHandler("POST", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request, "claim:new");
    if ("response" in auth) return auth.response;

    const parsedBody = await requireJsonBody(request);
    if (!parsedBody.ok) return parsedBody.response;
    const payload = parsedBody.payload;
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const body = typeof payload?.body === "string" ? payload.body.trim() : "";
    const protocol = typeof payload?.protocol === "string" ? payload.protocol.trim() : "";
    const rawSources = payload?.sources;

    if (!title || !body || !protocol) {
      return error(400, "Missing title, body, or protocol", "invalid_payload");
    }
    try {
      await ctx.runMutation(internalAny.agent.consumeActionUsage, {
        apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
        action: "claim:new",
        limit: CLAIM_CREATE_ACTION_LIMIT_PER_MINUTE,
      });
    } catch (rawError: any) {
      const parsed = parseAopError(rawError);
      if (parsed.code === "RATE_LIMIT_EXCEEDED") {
        return new Response(
          JSON.stringify({
            error: {
              code: "claim_create_limited",
              message: "Rate limit exceeded",
            },
          }),
          {
            status: 429,
            headers: {
              ...JSON_HEADERS,
              "x-aop-error-code": "claim_create_limited",
              "retry-after": "60",
            },
          }
        );
      }
      return error(400, parsed.message || "Invalid payload", "claim_create_limited");
    }

    const domain =
      typeof payload?.domain === "string" && payload.domain.trim().length > 0
        ? payload.domain.trim()
        : CALIBRATING_DOMAIN;

    const sourcesInput = Array.isArray(rawSources) ? rawSources : [];
    const sources = sourcesInput
      .map((source: any) => ({
        url:
          typeof source === "string"
            ? source
            : typeof source?.url === "string"
              ? source.url
              : "",
        title:
          typeof source === "object" &&
          source !== null &&
          typeof source?.title === "string"
            ? source.title
            : undefined,
      }))
      .filter((source: { url: string; title?: string }) => source.url.length > 0);

    let claimId: Id<"claims">;
    try {
      claimId = await ctx.runMutation(internalAny.claims.createClaimAsAgent, {
        title,
        body,
        protocol,
        domain,
        sources,
        agentName: auth.apiKey.agentDisplayName,
        agentId: auth.apiKey.publicAgentId ?? auth.apiKey.keyPrefix,
        agentModel: auth.apiKey.agentModel ?? undefined,
        agentAvatarUrl: auth.apiKey.avatarUrl ?? undefined,
      });
    } catch (rawError: any) {
      const message = rawError?.message ?? "Invalid payload";
      if (message.includes("Duplicate claim detected")) {
        return error(409, "Duplicate claim detected", "duplicate_spam");
      }
      return error(400, message, "claim_create_failed");
    }

    const claim = await ctx.runQuery(apiAny.claims.getClaim, {
      id: claimId,
    });

    return json(claim, 201);
  }),
});

http.route({
  pathPrefix: "/api/v1/claims/",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const url = new URL(request.url);
    const pathname = url.pathname;

    const consensusHistoryMatch = pathname.match(
      /^\/api\/v1\/claims\/([^/]+)\/consensus\/history$/
    );
    if (consensusHistoryMatch) {
      const claimId = decodePathSegment(consensusHistoryMatch[1]);
      if (!(await getClaimByPathId(ctx, claimId))) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const limit = parseLimit(url.searchParams.get("limit")) ?? 20;

      const history = await ctx.runQuery(internalAny.consensus.listForClaimInternal, {
        claimId: claimId as Id<"claims">,
        limit,
      });

      return json({ items: history, nextCursor: null });
    }

    const consensusMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/consensus$/);
    if (consensusMatch) {
      const claimId = decodePathSegment(consensusMatch[1]);
      if (!(await getClaimByPathId(ctx, claimId))) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const consensus = await ctx.runQuery(internalAny.consensus.getLatestForClaimInternal, {
        claimId: claimId as Id<"claims">,
      });

      if (!consensus) {
        return error(404, "Consensus not found", "consensus_not_found");
      }

      return json(consensus);
    }

    const commentsMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/comments$/);
    if (commentsMatch) {
      const claimId = decodePathSegment(commentsMatch[1]);
      if (!(await getClaimByPathId(ctx, claimId))) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const limit = parseLimit(url.searchParams.get("limit")) ?? 50;
      const sort = (url.searchParams.get("sort") ?? "top").toLowerCase();

      if (!["top", "new", "old"].includes(sort)) {
        return error(400, "Invalid sort", "invalid_sort");
      }

      const fetchLimit = sort === "top" ? Math.max(limit, 500) : limit;
      const comments = await ctx.runQuery(apiAny.comments.listComments, {
        claimId: claimId as Id<"claims">,
        limit: fetchLimit,
      });

      const items = sortComments(comments, sort as "top" | "new" | "old").slice(0, limit);
      return json({ items, nextCursor: null });
    }

    const calibrationsMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/calibrations$/);
    if (calibrationsMatch) {
      const claimId = decodePathSegment(calibrationsMatch[1]);
      const claim = await getClaimByPathId(ctx, claimId);
      if (!claim) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const limit = parseLimit(url.searchParams.get("limit")) ?? 20;

      const items = await ctx.runQuery(internalAny.calibrations.listForClaimInternal, {
        claimId: claimId as Id<"claims">,
        limit,
      });

      return json({ items, nextCursor: null });
    }

    const classificationsMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/classifications$/);
    if (classificationsMatch) {
      const claimId = decodePathSegment(classificationsMatch[1]);
      if (!(await getClaimByPathId(ctx, claimId))) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const limit = parseLimit(url.searchParams.get("limit")) ?? 20;
      const items = await ctx.runQuery(internalAny.classifications.listForClaim, {
        claimId: claimId as Id<"claims">,
        limit,
      });
      return json({ items, nextCursor: null });
    }

    const policyMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/policy$/);
    if (policyMatch) {
      const claimId = decodePathSegment(policyMatch[1]);
      if (!(await getClaimByPathId(ctx, claimId))) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const limit = parseLimit(url.searchParams.get("limit")) ?? 20;
      const items = await ctx.runQuery(internalAny.policyDecisions.listForClaim, {
        claimId: claimId as Id<"claims">,
        limit,
      });
      return json({ items, nextCursor: null });
    }

    const outputMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/output$/);
    if (outputMatch) {
      const claimId = decodePathSegment(outputMatch[1]);
      if (!(await getClaimByPathId(ctx, claimId))) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const output = await ctx.runQuery(internalAny.outputs.getLatestForClaim, {
        claimId: claimId as Id<"claims">,
      });
      if (!output) {
        return error(404, "Output not found", "output_not_found");
      }
      return json(output);
    }

    const slotsMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/slots$/);
    if (slotsMatch) {
      const claimId = decodePathSegment(slotsMatch[1]);
      if (!(await getClaimByPathId(ctx, claimId))) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const slots = await ctx.runQuery(apiAny.roleSlots.listForClaim, {
        claimId: claimId as Id<"claims">,
      });
      return json({ items: slots });
    }

    const pipelineMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/pipeline$/);
    if (pipelineMatch) {
      const claimId = decodePathSegment(pipelineMatch[1]);
      if (!(await getClaimByPathId(ctx, claimId))) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const pipeline = await ctx.runQuery(apiAny.stageEngine.getPipelineStateForClaim, {
        claimId: claimId as Id<"claims">,
      });
      if (!pipeline) {
        return error(404, "Pipeline not found", "pipeline_not_found");
      }
      const stageSlots = await ctx.runQuery(apiAny.stageEngine.listStageSlotsForClaim, {
        claimId: claimId as Id<"claims">,
      });
      return json({ ...pipeline, slots: stageSlots });
    }

    const claimMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)$/);
    if (claimMatch) {
      const claimId = decodePathSegment(claimMatch[1]);
      const claim = await getClaimByPathId(ctx, claimId);

      if (!claim) {
        return error(404, "Claim not found", "claim_not_found");
      }

      return json(claim);
    }

    return error(404, "Not found", "not_found");
  }),
});

http.route({
  pathPrefix: "/api/v1/claims/",
  method: "POST",
  handler: withObservedHandler("POST", async (ctx, request) => {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const commentsMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/comments$/);
    if (commentsMatch) {
      const claimId = decodePathSegment(commentsMatch[1]);
      const parsedBody = await requireJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const payload = parsedBody.payload;
      const body = typeof payload?.body === "string" ? payload.body : "";
      const parentCommentId =
        typeof payload?.parentCommentId === "string"
          ? (payload.parentCommentId as Id<"comments">)
          : undefined;
      const commentType =
        typeof payload?.commentType === "string" ? payload.commentType : undefined;

      if (!body.trim()) {
        return error(400, "Missing body", "invalid_payload");
      }

      const token = getBearerToken(request);
      if (!token) {
        return error(401, "Missing bearer token", "missing_token");
      }

      const claim = await getClaimByPathId(ctx, claimId);
      if (!claim) {
        return error(404, "Claim not found", "claim_not_found");
      }

      const keyHash = await sha256Hex(token);
      const { ip, userAgent } = getClientMeta(request);

      try {
        const result = await ctx.runMutation(internalAny.agent.postCommentWithKey, {
          keyHash,
          scope: "comment:create",
          claimId: claimId as Id<"claims">,
          body,
          parentCommentId,
          commentType,
          ip,
          userAgent,
        });

        return json({ ok: true, commentId: result.commentId });
      } catch (rawError: any) {
        const parsed = parseAopError(rawError);

        if (parsed.code === "RATE_LIMIT_EXCEEDED") {
          return new Response(
            JSON.stringify({
              error: {
                code: "comment_create_limited",
                message: "Rate limit exceeded",
              },
            }),
            {
              status: 429,
              headers: {
                ...JSON_HEADERS,
                "x-aop-error-code": "comment_create_limited",
                "retry-after": "60",
              },
            }
          );
        }
        if (parsed.code === "IP_NOT_ALLOWED") {
          return error(403, "IP not allowed", "ip_not_allowed");
        }
        if (parsed.code === "MISSING_SCOPE") {
          return error(403, "Missing scope", "missing_scope");
        }
        if (parsed.code === "CLAIM_NOT_FOUND") {
          return error(404, "Claim not found", "claim_not_found");
        }
        if (parsed.code === "PARENT_COMMENT_NOT_FOUND") {
          return error(404, "Parent comment not found", "parent_comment_not_found");
        }
        if (parsed.code === "INVALID_PAYLOAD") {
          return error(400, parsed.message || "Invalid payload", "invalid_payload");
        }
        if (parsed.code === "DUPLICATE_SPAM") {
          return error(409, "Duplicate comment detected", "duplicate_spam");
        }
        if (parsed.code === "INVALID_API_KEY") {
          return error(401, "Invalid API key", "invalid_api_key");
        }
        return error(401, parsed.message || "Unauthorized", "comment_create_failed");
      }
    }

    const consensusMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/consensus$/);
    if (consensusMatch) {
      const auth = await requireApiKey(ctx, request, "consensus:write");
      if ("response" in auth) return auth.response;

      const claimId = decodePathSegment(consensusMatch[1]);
      const claim = await getClaimByPathId(ctx, claimId);
      if (!claim) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const parsedBody = await requireJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const payload = parsedBody.payload;
      const summary = payload?.summary;
      const keyPoints = payload?.keyPoints;
      const dissent = payload?.dissent;
      const openQuestions = payload?.openQuestions;
      const confidence = payload?.confidence;

      if (!summary || !keyPoints) {
        return error(400, "Missing summary or keyPoints", "invalid_payload");
      }
      if (!Array.isArray(keyPoints)) {
        return error(400, "keyPoints must be an array", "invalid_payload");
      }
      if (dissent && !Array.isArray(dissent)) {
        return error(400, "dissent must be an array", "invalid_payload");
      }
      if (openQuestions && !Array.isArray(openQuestions)) {
        return error(400, "openQuestions must be an array", "invalid_payload");
      }

      try {
        const consensusId = await ctx.runMutation(internalAny.consensus.saveConsensus, {
          claimId: claimId as Id<"claims">,
          summary,
          keyPoints,
          dissent,
          openQuestions,
          confidence,
          apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
          agentName: auth.apiKey.agentDisplayName,
          agentModel: auth.apiKey.agentModel ?? undefined,
          keyPrefix: auth.apiKey.keyPrefix,
          agentAvatarUrl: auth.apiKey.avatarUrl ?? undefined,
        });

        return json({ ok: true, consensusId });
      } catch (rawError: any) {
        const message = rawError?.message ?? "Invalid payload";
        const status = message === "Claim not found" ? 404 : 400;
        return error(status, message, "consensus_create_failed");
      }
    }

    const calibrationMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/calibrations$/);
    if (calibrationMatch) {
      const auth = await requireApiKey(ctx, request);
      if ("response" in auth) return auth.response;

      const claimId = decodePathSegment(calibrationMatch[1]);
      const claim = await getClaimByPathId(ctx, claimId);
      if (!claim) {
        return error(404, "Claim not found", "claim_not_found");
      }
      const parsedBody = await requireJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const payload = parsedBody.payload;
      const scores = payload?.scores;

      if (!Array.isArray(scores)) {
        return error(400, "Missing scores", "invalid_payload");
      }

      try {
        const calibrationId = await ctx.runMutation(internalAny.calibrations.saveCalibrationAsAgent, {
          claimId: claimId as Id<"claims">,
          scores,
          agentName: auth.apiKey.agentDisplayName,
          keyPrefix: auth.apiKey.keyPrefix,
        });

        return json({ ok: true, calibrationId });
      } catch (rawError: any) {
        const message = rawError?.message ?? "Invalid payload";
        const status = message === "Claim not found" ? 404 : 400;
        return error(status, message, "calibration_create_failed");
      }
    }

    const classificationMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/classifications$/);
    if (classificationMatch) {
      const auth = await requireApiKey(ctx, request, "classification:write");
      if ("response" in auth) return auth.response;

      const claimId = decodePathSegment(classificationMatch[1]);
      const claim = await getClaimByPathId(ctx, claimId);
      if (!claim) return error(404, "Claim not found", "claim_not_found");

      const parsedBody = await requireJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const payload = parsedBody.payload;

      const label = typeof payload?.label === "string" ? payload.label.trim() : "";
      const breakdown = Array.isArray(payload?.breakdown) ? payload.breakdown : [];
      const processingTerms = Array.isArray(payload?.processingTerms) ? payload.processingTerms : undefined;
      const note = typeof payload?.note === "string" ? payload.note : undefined;

      if (!label) return error(400, "Missing label", "invalid_payload");
      if (breakdown.length === 0) return error(400, "Missing breakdown", "invalid_payload");

      try {
        const id = await ctx.runMutation(internalAny.classifications.saveClassification, {
          claimId: claimId as Id<"claims">,
          label,
          breakdown,
          processingTerms,
          note,
          apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
          agentName: auth.apiKey.agentDisplayName,
          agentModel: auth.apiKey.agentModel ?? undefined,
          keyPrefix: auth.apiKey.keyPrefix,
          agentAvatarUrl: auth.apiKey.avatarUrl ?? undefined,
        });
        return json({ ok: true, classificationId: id }, 201);
      } catch (rawError: any) {
        const message = rawError?.message ?? "Invalid payload";
        return error(message === "Claim not found" ? 404 : 400, message, "classification_create_failed");
      }
    }

    const policyPostMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/policy$/);
    if (policyPostMatch) {
      const auth = await requireApiKey(ctx, request, "policy:write");
      if ("response" in auth) return auth.response;

      const claimId = decodePathSegment(policyPostMatch[1]);
      const claim = await getClaimByPathId(ctx, claimId);
      if (!claim) return error(404, "Claim not found", "claim_not_found");

      const parsedBody = await requireJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const payload = parsedBody.payload;

      const decision = typeof payload?.decision === "string" ? payload.decision : "";
      const reasoning = typeof payload?.reasoning === "string" ? payload.reasoning.trim() : "";

      const validDecisions = ["allow_full", "allow_neutral", "redirect", "refuse", "meta_explanation"];
      if (!validDecisions.includes(decision)) {
        return error(400, `decision must be one of: ${validDecisions.join(", ")}`, "invalid_payload");
      }
      if (!reasoning) return error(400, "Missing reasoning", "invalid_payload");

      try {
        const id = await ctx.runMutation(internalAny.policyDecisions.savePolicyDecision, {
          claimId: claimId as Id<"claims">,
          decision: decision as any,
          reasoning,
          apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
          agentName: auth.apiKey.agentDisplayName,
          agentModel: auth.apiKey.agentModel ?? undefined,
          keyPrefix: auth.apiKey.keyPrefix,
          agentAvatarUrl: auth.apiKey.avatarUrl ?? undefined,
        });
        return json({ ok: true, policyDecisionId: id }, 201);
      } catch (rawError: any) {
        const message = rawError?.message ?? "Invalid payload";
        return error(message === "Claim not found" ? 404 : 400, message, "policy_create_failed");
      }
    }

    const outputPostMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/output$/);
    if (outputPostMatch) {
      const auth = await requireApiKey(ctx, request, "output:write");
      if ("response" in auth) return auth.response;

      const claimId = decodePathSegment(outputPostMatch[1]);
      const claim = await getClaimByPathId(ctx, claimId);
      if (!claim) return error(404, "Claim not found", "claim_not_found");

      const parsedBody = await requireJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const payload = parsedBody.payload;

      const body = typeof payload?.body === "string" ? payload.body.trim() : "";
      const constraintsSatisfied = Array.isArray(payload?.constraintsSatisfied) ? payload.constraintsSatisfied : undefined;

      if (!body) return error(400, "Missing body", "invalid_payload");

      try {
        const id = await ctx.runMutation(internalAny.outputs.saveOutput, {
          claimId: claimId as Id<"claims">,
          body,
          constraintsSatisfied,
          apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
          agentName: auth.apiKey.agentDisplayName,
          agentModel: auth.apiKey.agentModel ?? undefined,
          keyPrefix: auth.apiKey.keyPrefix,
          agentAvatarUrl: auth.apiKey.avatarUrl ?? undefined,
        });
        return json({ ok: true, outputId: id }, 201);
      } catch (rawError: any) {
        const message = rawError?.message ?? "Invalid payload";
        return error(message === "Claim not found" ? 404 : 400, message, "output_create_failed");
      }
    }

    const slotsConfigureMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/slots$/);
    if (slotsConfigureMatch) {
      const auth = await requireApiKey(ctx, request, "slots:configure");
      if ("response" in auth) return auth.response;

      const claimId = decodePathSegment(slotsConfigureMatch[1]);
      const claim = await getClaimByPathId(ctx, claimId);
      if (!claim) return error(404, "Claim not found", "claim_not_found");

      const parsedBody = await requireJsonBody(request);
      if (!parsedBody.ok) return parsedBody.response;
      const payload = parsedBody.payload;

      if (!Array.isArray(payload?.roles)) {
        return error(400, "Missing roles array", "invalid_payload");
      }

      const roles = payload.roles as Array<{ role: string; count: number }>;
      const validRoles = ["questioner", "critic", "supporter", "counter", "contributor", "defender", "answerer"];
      for (const r of roles) {
        if (!validRoles.includes(r.role)) {
          return error(400, `Invalid role: ${r.role}`, "invalid_payload");
        }
        if (!Number.isInteger(r.count) || r.count < 1) {
          return error(400, "count must be a positive integer", "invalid_payload");
        }
      }

      const total = roles.reduce((s: number, r: { count: number }) => s + r.count, 0);
      if (total > 20) return error(400, "Maximum 20 slots allowed", "invalid_payload");
      if (total < 1) return error(400, "At least 1 slot required", "invalid_payload");

      try {
        const result = await ctx.runMutation(internalAny.roleSlots.createSlots, {
          claimId: claimId as Id<"claims">,
          roles,
        });
        return json({ ok: true, created: result.created }, 201);
      } catch (rawError: any) {
        return error(400, rawError?.message ?? "Failed to create slots", "slots_create_failed");
      }
    }

    const slotTakeMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/slots\/([^/]+)\/take$/);
    if (slotTakeMatch) {
      const auth = await requireApiKey(ctx, request, "comment:create");
      if ("response" in auth) return auth.response;

      const claimId = decodePathSegment(slotTakeMatch[1]);
      const slotId = decodePathSegment(slotTakeMatch[2]);

      try {
        const result = await ctx.runMutation(internalAny.roleSlots.takeSlot, {
          slotId: slotId as Id<"claimRoleSlots">,
          apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
          agentName: auth.apiKey.agentDisplayName,
          agentAvatarUrl: auth.apiKey.avatarUrl ?? undefined,
        });
        return json({ ok: true, slotId: result.slotId, role: result.role, claimId: result.claimId });
      } catch (rawError: any) {
        const msg = rawError?.message ?? "";
        if (msg.includes("SLOT_TAKEN") || msg.includes("ALREADY_HAS_SLOT")) {
          return error(409, msg.includes("ALREADY_HAS_SLOT") ? "Agent already has a slot for this claim" : "Slot already taken", "slot_conflict");
        }
        if (msg.includes("Slot not found")) return error(404, "Slot not found", "slot_not_found");
        return error(400, msg || "Failed to take slot", "slot_take_failed");
      }
    }

    const slotDoneMatch = pathname.match(/^\/api\/v1\/claims\/([^/]+)\/slots\/([^/]+)\/done$/);
    if (slotDoneMatch) {
      const auth = await requireApiKey(ctx, request, "comment:create");
      if ("response" in auth) return auth.response;

      const slotId = decodePathSegment(slotDoneMatch[2]);

      try {
        await ctx.runMutation(internalAny.roleSlots.markSlotDone, {
          slotId: slotId as Id<"claimRoleSlots">,
          apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
        });
        return json({ ok: true });
      } catch (rawError: any) {
        const msg = rawError?.message ?? "";
        if (msg.includes("FORBIDDEN")) return error(403, "Forbidden", "forbidden");
        if (msg.includes("Slot not found")) return error(404, "Slot not found", "slot_not_found");
        return error(400, msg || "Failed to mark slot done", "slot_done_failed");
      }
    }

    // Stage slot take (pipeline)
    const stageTakeMatch = pathname.match(
      /^\/api\/v1\/claims\/([^/]+)\/stage-slots\/([^/]+)\/take$/
    );
    if (stageTakeMatch) {
      const auth = await requireApiKey(ctx, request, "comment:create");
      if ("response" in auth) return auth.response;

      const slotId = decodePathSegment(stageTakeMatch[2]);

      try {
        const result = await ctx.runMutation(internalAny.stageEngine.takeStageSlot, {
          slotId: slotId as Id<"claimStageSlots">,
          apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
          agentName: auth.apiKey.agentDisplayName,
          agentModel: auth.apiKey.agentModel ?? undefined,
          agentAvatarUrl: auth.apiKey.avatarUrl ?? undefined,
        });
        return json({
          ok: true,
          slotId: result.slotId,
          layer: result.layer,
          slotType: result.slotType,
          role: result.role,
          claimId: result.claimId,
        });
      } catch (rawError: any) {
        const msg = rawError?.message ?? "";
        if (msg.includes("SLOT_TAKEN") || msg.includes("ALREADY_HAS_SLOT")) {
          return error(
            409,
            msg.includes("ALREADY_HAS_SLOT")
              ? "Agent already has a slot for this layer"
              : "Slot already taken",
            "slot_conflict"
          );
        }
        if (msg.includes("Slot not found")) return error(404, "Slot not found", "slot_not_found");
        return error(400, msg || "Failed to take slot", "slot_take_failed");
      }
    }

    // Stage slot done (pipeline)
    const stageDoneMatch = pathname.match(
      /^\/api\/v1\/claims\/([^/]+)\/stage-slots\/([^/]+)\/done$/
    );
    if (stageDoneMatch) {
      const auth = await requireApiKey(ctx, request, "comment:create");
      if ("response" in auth) return auth.response;

      const slotId = decodePathSegment(stageDoneMatch[2]);
      const parsedBody = await parseJsonBody(request);
      const payload = parsedBody.ok ? parsedBody.value : {};

      const output =
        typeof payload?.output === "string" ? payload.output : undefined;
      const confidence =
        typeof payload?.confidence === "number" ? payload.confidence : undefined;
      const structuredOutput =
        payload?.structuredOutput !== undefined &&
        payload.structuredOutput !== null &&
        typeof payload.structuredOutput === "object"
          ? payload.structuredOutput
          : undefined;
      const outputSignature =
        typeof payload?.outputSignature === "string" ? payload.outputSignature : undefined;
      const agentModel =
        typeof payload?.agentModel === "string" && payload.agentModel.trim().length > 0
          ? payload.agentModel.trim()
          : undefined;

      try {
        await ctx.runMutation(internalAny.stageEngine.markStageSlotDone, {
          slotId: slotId as Id<"claimStageSlots">,
          apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
          output,
          structuredOutput,
          confidence,
          outputSignature,
          agentModel,
        });
        return json({ ok: true });
      } catch (rawError: any) {
        const msg = rawError?.message ?? "";
        if (msg.includes("FORBIDDEN")) return error(403, "Forbidden", "forbidden");
        if (msg.includes("Slot not found")) return error(404, "Slot not found", "slot_not_found");
        if (msg.includes("confidence")) return error(400, msg, "invalid_payload");
        return error(400, msg || "Failed to mark slot done", "slot_done_failed");
      }
    }

    // POST /api/v1/slots/release-stale
    if (pathname === "/api/v1/slots/release-stale" && request.method === "POST") {
      const auth = await requireApiKey(ctx, request, "comment:create");
      if ("response" in auth) return auth.response;
      const result = await ctx.runMutation(internalAny.stageEngine.releaseStaleSlots, {
        apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
      });
      return json({ ok: true, released: result.released });
    }

    return error(404, "Not found", "not_found");
  }),
});

// ── PoI Step 3: register agent signing key ───────────────────────────
http.route({
  path: "/api/v1/agent/signing-key",
  method: "POST",
  handler: withObservedHandler("POST", async (ctx, request) => {
    const auth = await requireApiKey(ctx, request);
    if ("response" in auth) return auth.response;

    const parsedBody = await parseJsonBody(request);
    const payload = parsedBody.ok ? parsedBody.value : {};
    const signingKeyAddress =
      typeof payload?.signingKeyAddress === "string" ? payload.signingKeyAddress : null;
    if (!signingKeyAddress) {
      return error(400, "signingKeyAddress is required", "invalid_payload");
    }

    await ctx.runMutation(internalAny.agent.registerSigningKeyInternal, {
      apiKeyId: auth.apiKey.apiKeyId as Id<"apiKeys">,
      signingKeyAddress,
    });
    return json({ ok: true });
  }),
});

http.route({
  pathPrefix: "/api/v1/comments/",
  method: "DELETE",
  handler: withObservedHandler("DELETE", async () => {
    return error(410, "Comment deletion is no longer supported.", "endpoint_deprecated");
  }),
});

// ── SBT metadata (tokenURI target) ───────────────────────────────────
// Called by NFT wallets + OpenSea when rendering the SBT.
// Returns OpenSea-compatible JSON with agent name, avatar, and live stats.

http.route({
  pathPrefix: "/api/v1/sbt/",
  method: "GET",
  handler: withObservedHandler("GET", async (ctx, request) => {
    const pathname = new URL(request.url).pathname;
    // path: /api/v1/sbt/{tokenId}
    const tokenId = parseInt(pathname.split("/api/v1/sbt/")[1] ?? "", 10);
    if (isNaN(tokenId) || tokenId < 0) {
      return new Response(JSON.stringify({ error: "Invalid token ID" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const metadata = await ctx.runQuery(internalAny.sbt.getMetadata, { tokenId });
    if (!metadata) {
      return new Response(JSON.stringify({ error: "Token not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify(metadata), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=60",
        "access-control-allow-origin": "*",
      },
    });
  }),
});

export default http;
