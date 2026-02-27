import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isModerationAdmin } from "./utils/moderation";

const DEFAULT_WINDOW_HOURS = 24;
const MAX_WINDOW_HOURS = 24 * 7;
const DEFAULT_ERROR_LIMIT = 50;
const MAX_ERROR_LIMIT = 200;

const CRITICAL_ENDPOINTS: Array<{ method: string; route: string }> = [
  { method: "POST", route: "/api/v1/auth/device-code" },
  { method: "POST", route: "/api/v1/auth/token" },
  { method: "GET", route: "/api/v1/claims" },
  { method: "POST", route: "/api/v1/claims" },
  { method: "GET", route: "/api/v1/claims/{claimId}/comments" },
  { method: "POST", route: "/api/v1/claims/{claimId}/comments" },
  { method: "POST", route: "/api/v1/claims/{claimId}/consensus" },
  { method: "POST", route: "/api/v1/claims/{claimId}/calibrations" },
  { method: "GET", route: "/api/v1/jobs/claims" },
];

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const AUTH_FAILURE_WINDOW_MINUTES = parsePositiveInt(
  process.env.OBS_AUTH_FAILURE_WINDOW_MINUTES,
  15,
  1,
  240
);
const AUTH_FAILURE_THRESHOLD = parsePositiveInt(
  process.env.OBS_AUTH_FAILURE_THRESHOLD,
  20,
  1,
  10_000
);
const RATE_LIMIT_WINDOW_MINUTES = parsePositiveInt(
  process.env.OBS_RATE_LIMIT_WINDOW_MINUTES,
  15,
  1,
  240
);
const RATE_LIMIT_THRESHOLD = parsePositiveInt(
  process.env.OBS_RATE_LIMIT_THRESHOLD,
  15,
  1,
  10_000
);
const MODERATION_WINDOW_MINUTES = parsePositiveInt(
  process.env.OBS_MODERATION_WINDOW_MINUTES,
  60,
  1,
  1_440
);
const MODERATION_THRESHOLD = parsePositiveInt(
  process.env.OBS_MODERATION_THRESHOLD,
  5,
  1,
  10_000
);

const truncateText = (value: string | undefined | null, max = 400) => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.length > max ? normalized.slice(0, max) : normalized;
};

const parsePathFromPageUrl = (pageUrl: string | undefined) => {
  if (!pageUrl) return undefined;
  try {
    const url = new URL(pageUrl);
    return url.pathname || undefined;
  } catch {
    return pageUrl.startsWith("/") ? pageUrl : undefined;
  }
};

const percentile = (values: number[], value: number) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((value / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index];
};

type ObservabilityCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;
type ObservabilityDbCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

const requireObservabilityAdmin = async (ctx: ObservabilityCtx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("authId", (q) => q.eq("authId", identity.subject))
    .unique();

  if (!isModerationAdmin(identity, user?.email ?? null)) {
    throw new Error("Not allowed");
  }
};

const countEventsByCategorySince = async (
  ctx: ObservabilityDbCtx,
  category: "auth_failure" | "rate_limit" | "moderation",
  since: number
) => {
  const rows = await ctx.db
    .query("observabilityEvents")
    .withIndex("by_category_createdAt", (q) =>
      q.eq("category", category).gte("createdAt", since)
    )
    .collect();
  return rows.length;
};

export const recordApiRequest = internalMutation({
  args: {
    route: v.string(),
    method: v.string(),
    statusCode: v.number(),
    latencyMs: v.number(),
    errorCode: v.optional(v.string()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const severity = args.statusCode >= 500 ? "error" : args.statusCode >= 400 ? "warn" : "info";
    const message = truncateText(args.message);
    const errorCode = truncateText(args.errorCode, 80);

    await ctx.db.insert("observabilityEvents", {
      source: "backend",
      category: "api_request",
      severity,
      route: args.route,
      method: args.method,
      statusCode: args.statusCode,
      latencyMs: Math.max(0, Math.round(args.latencyMs)),
      errorCode,
      message,
      createdAt: now,
    });

    if (args.statusCode === 401 || args.statusCode === 403) {
      await ctx.db.insert("observabilityEvents", {
        source: "backend",
        category: "auth_failure",
        severity: "warn",
        route: args.route,
        method: args.method,
        statusCode: args.statusCode,
        errorCode,
        message,
        createdAt: now,
      });
    }

    if (args.statusCode === 429) {
      await ctx.db.insert("observabilityEvents", {
        source: "backend",
        category: "rate_limit",
        severity: "warn",
        route: args.route,
        method: args.method,
        statusCode: args.statusCode,
        errorCode,
        message,
        createdAt: now,
      });
    }

    if (args.statusCode >= 500) {
      await ctx.db.insert("observabilityEvents", {
        source: "backend",
        category: "error",
        severity: "error",
        route: args.route,
        method: args.method,
        statusCode: args.statusCode,
        latencyMs: Math.max(0, Math.round(args.latencyMs)),
        errorCode,
        message,
        createdAt: now,
      });
    }
  },
});

export const captureFrontendError = mutation({
  args: {
    message: v.string(),
    stack: v.optional(v.string()),
    pageUrl: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const message = truncateText(args.message, 500) ?? "Unknown frontend error";
    const stack = truncateText(args.stack, 1_200);
    const route = parsePathFromPageUrl(args.pageUrl);
    const userAgent = truncateText(args.userAgent, 180);
    const errorCode = truncateText(args.errorCode, 80);

    await ctx.db.insert("observabilityEvents", {
      source: "frontend",
      category: "error",
      severity: "error",
      message: stack ? `${message}\n${stack}` : message,
      route,
      method: "BROWSER",
      errorCode,
      actorAuthId: identity?.subject,
      endpointGroup: userAgent,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

export const getApiDashboard = query({
  args: {
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireObservabilityAdmin(ctx);

    const windowHours = Math.min(
      Math.max(Math.round(args.hours ?? DEFAULT_WINDOW_HOURS), 1),
      MAX_WINDOW_HOURS
    );
    const now = Date.now();
    const since = now - windowHours * 60 * 60 * 1000;

    const requestRows = await ctx.db
      .query("observabilityEvents")
      .withIndex("by_category_createdAt", (q) =>
        q.eq("category", "api_request").gte("createdAt", since)
      )
      .collect();

    const aggregates = new Map<
      string,
      {
        method: string;
        route: string;
        requestCount: number;
        serverErrorCount: number;
        clientErrorCount: number;
        authFailureCount: number;
        rateLimitCount: number;
        latencies: number[];
      }
    >();

    for (const row of requestRows) {
      const method = row.method ?? "UNKNOWN";
      const route = row.route ?? "unknown";
      const key = `${method} ${route}`;
      const current = aggregates.get(key) ?? {
        method,
        route,
        requestCount: 0,
        serverErrorCount: 0,
        clientErrorCount: 0,
        authFailureCount: 0,
        rateLimitCount: 0,
        latencies: [],
      };

      current.requestCount += 1;
      if (typeof row.statusCode === "number") {
        if (row.statusCode >= 500) current.serverErrorCount += 1;
        if (row.statusCode >= 400 && row.statusCode < 500) current.clientErrorCount += 1;
        if (row.statusCode === 401 || row.statusCode === 403) current.authFailureCount += 1;
        if (row.statusCode === 429) current.rateLimitCount += 1;
      }
      if (typeof row.latencyMs === "number") {
        current.latencies.push(Math.max(0, row.latencyMs));
      }
      aggregates.set(key, current);
    }

    const toRow = (value: {
      method: string;
      route: string;
      requestCount: number;
      serverErrorCount: number;
      clientErrorCount: number;
      authFailureCount: number;
      rateLimitCount: number;
      latencies: number[];
    }) => ({
      method: value.method,
      route: value.route,
      requestCount: value.requestCount,
      serverErrorCount: value.serverErrorCount,
      clientErrorCount: value.clientErrorCount,
      authFailureCount: value.authFailureCount,
      rateLimitCount: value.rateLimitCount,
      serverErrorRate:
        value.requestCount > 0 ? (value.serverErrorCount / value.requestCount) * 100 : 0,
      p50LatencyMs: percentile(value.latencies, 50),
      p95LatencyMs: percentile(value.latencies, 95),
      maxLatencyMs: value.latencies.length > 0 ? Math.max(...value.latencies) : null,
    });

    const endpointRows = Array.from(aggregates.values())
      .map(toRow)
      .sort((a, b) => b.requestCount - a.requestCount);

    const endpointByKey = new Map(
      endpointRows.map((row) => [`${row.method} ${row.route}`, row])
    );
    const criticalEndpoints = CRITICAL_ENDPOINTS.map((endpoint) => {
      const key = `${endpoint.method} ${endpoint.route}`;
      return (
        endpointByKey.get(key) ?? {
          method: endpoint.method,
          route: endpoint.route,
          requestCount: 0,
          serverErrorCount: 0,
          clientErrorCount: 0,
          authFailureCount: 0,
          rateLimitCount: 0,
          serverErrorRate: 0,
          p50LatencyMs: null,
          p95LatencyMs: null,
          maxLatencyMs: null,
        }
      );
    });

    const authFailureCount = await countEventsByCategorySince(ctx, "auth_failure", since);
    const rateLimitCount = await countEventsByCategorySince(ctx, "rate_limit", since);
    const moderationEventCount = await countEventsByCategorySince(ctx, "moderation", since);

    const allLatencies = requestRows
      .map((row) => row.latencyMs)
      .filter((latency): latency is number => typeof latency === "number");
    const serverErrorCount = requestRows.filter(
      (row) => typeof row.statusCode === "number" && row.statusCode >= 500
    ).length;

    return {
      generatedAt: now,
      windowHours,
      summary: {
        requestCount: requestRows.length,
        serverErrorCount,
        serverErrorRate: requestRows.length > 0 ? (serverErrorCount / requestRows.length) * 100 : 0,
        authFailureCount,
        rateLimitCount,
        moderationEventCount,
        p50LatencyMs: percentile(allLatencies, 50),
        p95LatencyMs: percentile(allLatencies, 95),
      },
      criticalEndpoints,
      endpoints: endpointRows,
    };
  },
});

export const getAlertRulesStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireObservabilityAdmin(ctx);

    const now = Date.now();
    const authSince = now - AUTH_FAILURE_WINDOW_MINUTES * 60 * 1000;
    const rateLimitSince = now - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    const moderationSince = now - MODERATION_WINDOW_MINUTES * 60 * 1000;

    const authFailures = await countEventsByCategorySince(ctx, "auth_failure", authSince);
    const rateLimitHits = await countEventsByCategorySince(ctx, "rate_limit", rateLimitSince);
    const moderationEvents = await countEventsByCategorySince(ctx, "moderation", moderationSince);

    const rules = [
      {
        id: "auth-failure-spike",
        label: "Auth failures spike",
        owner: "Platform on-call",
        escalation: "Escalate to security lead if sustained for 30+ minutes.",
        windowMinutes: AUTH_FAILURE_WINDOW_MINUTES,
        threshold: AUTH_FAILURE_THRESHOLD,
        currentCount: authFailures,
        triggered: authFailures >= AUTH_FAILURE_THRESHOLD,
      },
      {
        id: "rate-limit-spike",
        label: "Rate-limit spike",
        owner: "Backend on-call",
        escalation: "Validate abuse source, tune limits, and notify moderation.",
        windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
        threshold: RATE_LIMIT_THRESHOLD,
        currentCount: rateLimitHits,
        triggered: rateLimitHits >= RATE_LIMIT_THRESHOLD,
      },
      {
        id: "moderation-event-spike",
        label: "Moderation events spike",
        owner: "Moderation on-call",
        escalation: "Coordinate with trust & safety and post incident note in Linear.",
        windowMinutes: MODERATION_WINDOW_MINUTES,
        threshold: MODERATION_THRESHOLD,
        currentCount: moderationEvents,
        triggered: moderationEvents >= MODERATION_THRESHOLD,
      },
    ];

    return {
      generatedAt: now,
      hasActiveAlerts: rules.some((rule) => rule.triggered),
      rules,
    };
  },
});

export const listRecentErrors = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireObservabilityAdmin(ctx);

    const limit = Math.min(
      Math.max(Math.round(args.limit ?? DEFAULT_ERROR_LIMIT), 1),
      MAX_ERROR_LIMIT
    );
    const rows = await ctx.db
      .query("observabilityEvents")
      .withIndex("by_category_createdAt", (q) => q.eq("category", "error"))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      _id: row._id,
      source: row.source,
      severity: row.severity,
      route: row.route ?? null,
      method: row.method ?? null,
      statusCode: row.statusCode ?? null,
      errorCode: row.errorCode ?? null,
      message: row.message ?? null,
      createdAt: row.createdAt,
    }));
  },
});
