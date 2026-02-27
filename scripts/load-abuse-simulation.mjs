#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_API_BASE_URL = "https://academic-condor-853.convex.site";
const DEFAULT_DURATION_SECONDS = 180;
const DEFAULT_READ_CONCURRENCY = 6;
const DEFAULT_WRITE_CONCURRENCY = 2;
const DEFAULT_ABUSE_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 20_000;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseInteger(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function parseArgs(argv) {
  const options = {
    baseUrl: normalizeBaseUrl(
      process.env.AOP_API_BASE_URL ?? process.env.AOP_API_URL ?? DEFAULT_API_BASE_URL
    ),
    durationSeconds: parseInteger(
      process.env.AOP_SIM_DURATION_SECONDS,
      DEFAULT_DURATION_SECONDS,
      10,
      7_200
    ),
    readConcurrency: parseInteger(
      process.env.AOP_SIM_READ_CONCURRENCY,
      DEFAULT_READ_CONCURRENCY,
      1,
      200
    ),
    writeConcurrency: parseInteger(
      process.env.AOP_SIM_WRITE_CONCURRENCY,
      DEFAULT_WRITE_CONCURRENCY,
      0,
      200
    ),
    abuseConcurrency: parseInteger(
      process.env.AOP_SIM_ABUSE_CONCURRENCY,
      DEFAULT_ABUSE_CONCURRENCY,
      0,
      200
    ),
    timeoutMs: parseInteger(
      process.env.AOP_SIM_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      100,
      120_000
    ),
    domain: process.env.AOP_SIM_DOMAIN?.trim() || null,
    seedClaimId: process.env.AOP_SIM_SEED_CLAIM_ID?.trim() || null,
    hiddenClaimId: process.env.AOP_SIM_HIDDEN_CLAIM_ID?.trim() || null,
    reportFile: process.env.AOP_SIM_REPORT_FILE?.trim() || null,
    dryRun: parseBoolean(process.env.AOP_SIM_DRY_RUN),
    failOnBottleneck: parseBoolean(process.env.AOP_SIM_FAIL_ON_BOTTLENECK),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--base-url" && next) {
      options.baseUrl = normalizeBaseUrl(next);
      i += 1;
      continue;
    }
    if (arg === "--duration-seconds" && next) {
      options.durationSeconds = parseInteger(next, options.durationSeconds, 10, 7_200);
      i += 1;
      continue;
    }
    if (arg === "--read-concurrency" && next) {
      options.readConcurrency = parseInteger(next, options.readConcurrency, 1, 200);
      i += 1;
      continue;
    }
    if (arg === "--write-concurrency" && next) {
      options.writeConcurrency = parseInteger(next, options.writeConcurrency, 0, 200);
      i += 1;
      continue;
    }
    if (arg === "--abuse-concurrency" && next) {
      options.abuseConcurrency = parseInteger(next, options.abuseConcurrency, 0, 200);
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms" && next) {
      options.timeoutMs = parseInteger(next, options.timeoutMs, 100, 120_000);
      i += 1;
      continue;
    }
    if (arg === "--domain" && next) {
      options.domain = next.trim() || null;
      i += 1;
      continue;
    }
    if (arg === "--seed-claim-id" && next) {
      options.seedClaimId = next.trim() || null;
      i += 1;
      continue;
    }
    if (arg === "--hidden-claim-id" && next) {
      options.hiddenClaimId = next.trim() || null;
      i += 1;
      continue;
    }
    if (arg === "--report-file" && next) {
      options.reportFile = next.trim() || null;
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--fail-on-bottleneck") {
      options.failOnBottleneck = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
  }

  return options;
}

function usage() {
  return `
Pre-launch load and abuse simulation for AOP.

Usage:
  node scripts/load-abuse-simulation.mjs [options]

Options:
  --base-url <url>            API base URL (default: env AOP_API_BASE_URL / AOP_API_URL)
  --duration-seconds <n>      Simulation time in seconds (default: ${DEFAULT_DURATION_SECONDS})
  --read-concurrency <n>      Read workers (default: ${DEFAULT_READ_CONCURRENCY})
  --write-concurrency <n>     Write workers (default: ${DEFAULT_WRITE_CONCURRENCY})
  --abuse-concurrency <n>     Abuse workers (default: ${DEFAULT_ABUSE_CONCURRENCY})
  --timeout-ms <n>            Per-request timeout (default: ${DEFAULT_TIMEOUT_MS})
  --domain <slug>             Optional domain filter for claim feed/job reads
  --seed-claim-id <id>        Optional claim id to seed comment operations
  --hidden-claim-id <id>      Optional hidden claim id for moderation-control verification
  --report-file <path>        Optional output markdown path
  --dry-run                   Print plan only (no network calls)
  --fail-on-bottleneck        Exit non-zero when bottlenecks are detected
  --help                      Show help

Required env vars for full simulation:
  AOP_SIM_READ_TOKEN          API key for read endpoints
  AOP_SIM_COMMENT_TOKEN       API key with comment:create (for write + abuse comment tests)
  AOP_SIM_CLAIM_TOKEN         API key with claim:new (for claim write + abuse claim tests)

Optional:
  AOP_SIM_DOMAIN
  AOP_SIM_SEED_CLAIM_ID
  AOP_SIM_HIDDEN_CLAIM_ID
  AOP_SIM_REPORT_FILE
  AOP_SIM_FAIL_ON_BOTTLENECK=1
`;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const idx = Math.max(0, Math.min(sorted.length - 1, rank));
  return sorted[idx];
}

function nowIso() {
  return new Date().toISOString();
}

function randomChoice(items) {
  if (!items.length) return null;
  const idx = Math.floor(Math.random() * items.length);
  return items[idx];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeHeaders(token, hasJsonBody = false) {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  if (hasJsonBody) headers.set("content-type", "application/json");
  return headers;
}

async function safeParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createEmptyMetric(name) {
  return {
    scenario: name,
    count: 0,
    success2xx: 0,
    redirect3xx: 0,
    client4xx: 0,
    server5xx: 0,
    networkErrors: 0,
    statusCounts: {},
    latencies: [],
  };
}

function createContext(options) {
  const tokenRead = process.env.AOP_SIM_READ_TOKEN?.trim() || null;
  const tokenComment = process.env.AOP_SIM_COMMENT_TOKEN?.trim() || null;
  const tokenClaim = process.env.AOP_SIM_CLAIM_TOKEN?.trim() || null;

  return {
    options,
    tokens: {
      read: tokenRead,
      comment: tokenComment,
      claim: tokenClaim,
    },
    claimPool: new Set(),
    metrics: new Map(),
    malformedStatusCounts: {},
    abuseStatusCounts: {},
    hiddenModerationChecks: [],
    startedAt: Date.now(),
  };
}

function recordStatusCounter(store, status) {
  const key = String(status);
  store[key] = (store[key] ?? 0) + 1;
}

function recordMetric(ctx, scenarioName, result) {
  const metric = ctx.metrics.get(scenarioName) ?? createEmptyMetric(scenarioName);
  metric.count += 1;

  if (typeof result.latencyMs === "number") {
    metric.latencies.push(result.latencyMs);
  }

  if (result.networkError) {
    metric.networkErrors += 1;
  } else if (typeof result.status === "number") {
    recordStatusCounter(metric.statusCounts, result.status);
    if (result.status >= 200 && result.status < 300) metric.success2xx += 1;
    else if (result.status >= 300 && result.status < 400) metric.redirect3xx += 1;
    else if (result.status >= 400 && result.status < 500) metric.client4xx += 1;
    else if (result.status >= 500) metric.server5xx += 1;
  }

  ctx.metrics.set(scenarioName, metric);
}

async function apiFetch(ctx, { scenario, path: routePath, method = "GET", token, body, rawBody, jsonBody }) {
  const url = `${ctx.options.baseUrl}${routePath}`;
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ctx.options.timeoutMs);
  const hasJsonBody = jsonBody !== undefined;

  try {
    const response = await fetch(url, {
      method,
      headers: makeHeaders(token, hasJsonBody),
      body: rawBody ?? (hasJsonBody ? JSON.stringify(jsonBody) : body),
      signal: controller.signal,
    });
    const elapsed = Date.now() - started;
    const text = await response.text();
    const payload = await safeParseJson(text);
    const headerErrorCode = response.headers.get("x-aop-error-code");
    const bodyErrorCode = payload?.error?.code;
    const errorCode = headerErrorCode || bodyErrorCode || null;

    if (scenario.startsWith("abuse_")) {
      recordStatusCounter(ctx.abuseStatusCounts, response.status);
    }
    if (scenario === "abuse_malformed_body") {
      recordStatusCounter(ctx.malformedStatusCounts, response.status);
    }

    return {
      status: response.status,
      latencyMs: elapsed,
      errorCode,
      payload,
      text,
      networkError: false,
    };
  } catch (error) {
    return {
      status: null,
      latencyMs: Date.now() - started,
      errorCode: "network_error",
      payload: null,
      text: null,
      networkError: true,
      errorMessage: String(error?.message ?? error ?? "Network error"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function makeClaimQuery(options) {
  const params = new URLSearchParams();
  params.set("sort", randomChoice(["latest", "top", "random"]) ?? "latest");
  params.set("limit", String(randomChoice([10, 20, 30]) ?? 20));
  if (options.domain) {
    params.set("domain", options.domain);
  }
  return `/api/v1/claims?${params.toString()}`;
}

async function seedClaimPool(ctx) {
  if (ctx.options.seedClaimId) {
    ctx.claimPool.add(ctx.options.seedClaimId);
  }

  if (!ctx.tokens.read) return;

  const query = makeClaimQuery({ ...ctx.options, domain: ctx.options.domain });
  const result = await apiFetch(ctx, {
    scenario: "setup_seed_claims",
    path: query,
    token: ctx.tokens.read,
  });
  recordMetric(ctx, "setup_seed_claims", result);

  const items = Array.isArray(result.payload?.items) ? result.payload.items : [];
  for (const item of items) {
    if (typeof item?._id === "string") {
      ctx.claimPool.add(item._id);
    }
  }
}

async function scenarioReadFeed(ctx) {
  const result = await apiFetch(ctx, {
    scenario: "read_feed",
    path: makeClaimQuery(ctx.options),
    token: ctx.tokens.read,
  });
  recordMetric(ctx, "read_feed", result);

  const items = Array.isArray(result.payload?.items) ? result.payload.items : [];
  for (const item of items) {
    if (typeof item?._id === "string") {
      ctx.claimPool.add(item._id);
    }
  }
}

async function scenarioReadClaimAndComments(ctx) {
  const claimId = randomChoice(Array.from(ctx.claimPool));
  if (!claimId) {
    await scenarioReadFeed(ctx);
    return;
  }

  const detailResult = await apiFetch(ctx, {
    scenario: "read_claim_detail",
    path: `/api/v1/claims/${encodeURIComponent(claimId)}`,
    token: ctx.tokens.read,
  });
  recordMetric(ctx, "read_claim_detail", detailResult);

  const commentsResult = await apiFetch(ctx, {
    scenario: "read_claim_comments",
    path: `/api/v1/claims/${encodeURIComponent(claimId)}/comments?sort=top&limit=30`,
    token: ctx.tokens.read,
  });
  recordMetric(ctx, "read_claim_comments", commentsResult);
}

async function scenarioWriteClaim(ctx) {
  if (!ctx.tokens.claim) return;
  const now = Date.now();
  const payload = {
    title: `Load sim claim ${now}`,
    body: "Synthetic launch rehearsal claim for write-path load testing.",
    protocol: "simulation",
    domain: ctx.options.domain ?? "calibrating",
    sources: [{ url: "https://example.com/load-simulation" }],
  };

  const result = await apiFetch(ctx, {
    scenario: "write_claim",
    method: "POST",
    path: "/api/v1/claims",
    token: ctx.tokens.claim,
    jsonBody: payload,
  });
  recordMetric(ctx, "write_claim", result);

  const claimId = result.payload?._id;
  if (typeof claimId === "string") {
    ctx.claimPool.add(claimId);
  }
}

async function scenarioWriteComment(ctx) {
  if (!ctx.tokens.comment) return;
  const claimId = randomChoice(Array.from(ctx.claimPool));
  if (!claimId) return;

  const result = await apiFetch(ctx, {
    scenario: "write_comment",
    method: "POST",
    path: `/api/v1/claims/${encodeURIComponent(claimId)}/comments`,
    token: ctx.tokens.comment,
    jsonBody: {
      body: `load-sim-comment ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`,
    },
  });
  recordMetric(ctx, "write_comment", result);
}

const SPAM_COMMENT_BODY = "AOP launch simulation spam burst payload";
const REPEATED_CLAIM_PAYLOAD = {
  title: "Repeated payload simulation claim",
  body: "Repeated write payload for abuse simulation.",
  protocol: "simulation",
  domain: "calibrating",
  sources: [{ url: "https://example.com/repeated-payload" }],
};

async function scenarioAbuseSpamBurst(ctx) {
  if (!ctx.tokens.comment) return;
  const claimId = randomChoice(Array.from(ctx.claimPool));
  if (!claimId) return;

  const result = await apiFetch(ctx, {
    scenario: "abuse_spam_burst",
    method: "POST",
    path: `/api/v1/claims/${encodeURIComponent(claimId)}/comments`,
    token: ctx.tokens.comment,
    jsonBody: {
      body: SPAM_COMMENT_BODY,
    },
  });
  recordMetric(ctx, "abuse_spam_burst", result);
}

async function scenarioAbuseRepeatedPayload(ctx) {
  if (!ctx.tokens.claim) return;

  const result = await apiFetch(ctx, {
    scenario: "abuse_repeated_payload",
    method: "POST",
    path: "/api/v1/claims",
    token: ctx.tokens.claim,
    jsonBody: REPEATED_CLAIM_PAYLOAD,
  });
  recordMetric(ctx, "abuse_repeated_payload", result);
}

async function scenarioAbuseMalformedBody(ctx) {
  const type = randomChoice(["claim_missing_fields", "claim_invalid_json", "comment_missing_body"]);
  if (!type) return;

  if (type === "claim_missing_fields") {
    if (!ctx.tokens.claim) return;
    const result = await apiFetch(ctx, {
      scenario: "abuse_malformed_body",
      method: "POST",
      path: "/api/v1/claims",
      token: ctx.tokens.claim,
      jsonBody: { title: "", sources: [] },
    });
    recordMetric(ctx, "abuse_malformed_body", result);
    return;
  }

  if (type === "claim_invalid_json") {
    if (!ctx.tokens.claim) return;
    const result = await apiFetch(ctx, {
      scenario: "abuse_malformed_body",
      method: "POST",
      path: "/api/v1/claims",
      token: ctx.tokens.claim,
      rawBody: '{"invalid":',
    });
    recordMetric(ctx, "abuse_malformed_body", result);
    return;
  }

  const claimId = randomChoice(Array.from(ctx.claimPool));
  if (!claimId || !ctx.tokens.comment) return;
  const result = await apiFetch(ctx, {
    scenario: "abuse_malformed_body",
    method: "POST",
    path: `/api/v1/claims/${encodeURIComponent(claimId)}/comments`,
    token: ctx.tokens.comment,
    jsonBody: { body: "" },
  });
  recordMetric(ctx, "abuse_malformed_body", result);
}

async function runWorkerPool({ workers, stopAt, task, jitterMs = 200 }) {
  const workerFns = Array.from({ length: workers }, (_, idx) =>
    (async () => {
      while (Date.now() < stopAt) {
        await task(idx);
        if (jitterMs > 0) {
          const pause = Math.floor(Math.random() * jitterMs);
          if (pause > 0) {
            await sleep(pause);
          }
        }
      }
    })()
  );
  await Promise.all(workerFns);
}

async function verifyModerationControls(ctx) {
  const hiddenClaimId = ctx.options.hiddenClaimId;
  if (!hiddenClaimId || !ctx.tokens.read) {
    return;
  }

  const checks = [
    {
      name: "hidden_claim_detail_returns_404",
      path: `/api/v1/claims/${encodeURIComponent(hiddenClaimId)}`,
      expectedStatus: 404,
    },
    {
      name: "hidden_claim_comments_returns_404",
      path: `/api/v1/claims/${encodeURIComponent(hiddenClaimId)}/comments?limit=5`,
      expectedStatus: 404,
    },
  ];

  for (const check of checks) {
    const result = await apiFetch(ctx, {
      scenario: "moderation_control_check",
      path: check.path,
      token: ctx.tokens.read,
    });
    recordMetric(ctx, "moderation_control_check", result);
    ctx.hiddenModerationChecks.push({
      name: check.name,
      expectedStatus: check.expectedStatus,
      actualStatus: result.status,
      ok: result.status === check.expectedStatus,
    });
  }
}

function summarizeMetrics(ctx, endedAt) {
  const metricRows = Array.from(ctx.metrics.values()).map((metric) => {
    const p50 = percentile(metric.latencies, 50);
    const p95 = percentile(metric.latencies, 95);
    return {
      ...metric,
      p50LatencyMs: p50,
      p95LatencyMs: p95,
    };
  });

  const totals = metricRows.reduce(
    (acc, row) => {
      acc.count += row.count;
      acc.success2xx += row.success2xx;
      acc.redirect3xx += row.redirect3xx;
      acc.client4xx += row.client4xx;
      acc.server5xx += row.server5xx;
      acc.networkErrors += row.networkErrors;
      acc.latencies.push(...row.latencies);
      return acc;
    },
    {
      count: 0,
      success2xx: 0,
      redirect3xx: 0,
      client4xx: 0,
      server5xx: 0,
      networkErrors: 0,
      latencies: [],
    }
  );

  const durationMs = Math.max(1, endedAt - ctx.startedAt);
  const durationSec = durationMs / 1000;
  const overallP95 = percentile(totals.latencies, 95);
  const overallP50 = percentile(totals.latencies, 50);
  const fiveXxRate = totals.count ? (totals.server5xx / totals.count) * 100 : 0;
  const rps = totals.count / durationSec;

  const bottlenecks = [];
  if (overallP95 !== null && overallP95 > 1_200) {
    bottlenecks.push({
      severity: "high",
      area: "latency",
      details: `Overall p95 latency is ${Math.round(overallP95)}ms (threshold 1200ms).`,
      fix: "Profile hot endpoints and reduce expensive DB/query paths.",
    });
  }
  if (fiveXxRate > 1) {
    bottlenecks.push({
      severity: "high",
      area: "errors",
      details: `Server 5xx rate is ${fiveXxRate.toFixed(2)}% (threshold 1%).`,
      fix: "Inspect backend error logs, fix unstable handlers, and add retries where safe.",
    });
  }

  const abuse429Count = Number(ctx.abuseStatusCounts["429"] ?? 0);
  const abuseRequestCount = Object.values(ctx.abuseStatusCounts).reduce((sum, value) => sum + value, 0);
  if (abuseRequestCount > 0 && abuse429Count === 0) {
    bottlenecks.push({
      severity: "medium",
      area: "rate_limit",
      details: "Abuse simulation did not trigger any HTTP 429 responses.",
      fix: "Review per-key and per-action rate limits and tighten thresholds for launch.",
    });
  }

  const malformedTotal = Object.values(ctx.malformedStatusCounts).reduce((sum, value) => sum + value, 0);
  const malformedDefended =
    Number(ctx.malformedStatusCounts["400"] ?? 0) +
    Number(ctx.malformedStatusCounts["415"] ?? 0) +
    Number(ctx.malformedStatusCounts["422"] ?? 0) +
    Number(ctx.malformedStatusCounts["429"] ?? 0);
  if (malformedTotal > 0 && malformedDefended / malformedTotal < 0.8) {
    bottlenecks.push({
      severity: "medium",
      area: "input_validation",
      details: `Only ${(100 * (malformedDefended / malformedTotal)).toFixed(1)}% malformed requests returned defensive 4xx responses (400/415/422/429).`,
      fix: "Harden request validation and ensure malformed payloads fail fast with consistent 4xx errors.",
    });
  }

  const malformed401 = Number(ctx.malformedStatusCounts["401"] ?? 0);
  if (malformed401 > 0) {
    bottlenecks.push({
      severity: "medium",
      area: "auth_mapping",
      details: `${malformed401} malformed requests returned 401 instead of validation/rate-limit responses.`,
      fix: "Ensure auth and parser error mapping preserves 400/415/429 semantics for malformed bodies.",
    });
  }

  for (const check of ctx.hiddenModerationChecks) {
    if (!check.ok) {
      bottlenecks.push({
        severity: "high",
        area: "moderation_controls",
        details: `${check.name} expected ${check.expectedStatus}, got ${check.actualStatus}.`,
        fix: "Ensure hidden content is consistently filtered across claim detail and comments APIs.",
      });
    }
  }

  return {
    startedAt: new Date(ctx.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    durationSeconds: Number(durationSec.toFixed(2)),
    config: {
      baseUrl: ctx.options.baseUrl,
      durationSeconds: ctx.options.durationSeconds,
      readConcurrency: ctx.options.readConcurrency,
      writeConcurrency: ctx.options.writeConcurrency,
      abuseConcurrency: ctx.options.abuseConcurrency,
      timeoutMs: ctx.options.timeoutMs,
      domain: ctx.options.domain,
      hiddenClaimId: ctx.options.hiddenClaimId,
    },
    totals: {
      requestCount: totals.count,
      success2xx: totals.success2xx,
      redirect3xx: totals.redirect3xx,
      client4xx: totals.client4xx,
      server5xx: totals.server5xx,
      networkErrors: totals.networkErrors,
      requestsPerSecond: Number(rps.toFixed(2)),
      p50LatencyMs: overallP50,
      p95LatencyMs: overallP95,
      server5xxRatePercent: Number(fiveXxRate.toFixed(2)),
    },
    scenarios: metricRows
      .sort((a, b) => b.count - a.count)
      .map((row) => ({
        scenario: row.scenario,
        requestCount: row.count,
        success2xx: row.success2xx,
        client4xx: row.client4xx,
        server5xx: row.server5xx,
        networkErrors: row.networkErrors,
        p50LatencyMs: row.p50LatencyMs,
        p95LatencyMs: row.p95LatencyMs,
        statusCounts: row.statusCounts,
      })),
    abuseStatusCounts: ctx.abuseStatusCounts,
    malformedStatusCounts: ctx.malformedStatusCounts,
    moderationChecks: ctx.hiddenModerationChecks,
    bottlenecks,
  };
}

function toMarkdownReport(summary) {
  const lines = [];
  lines.push("# AOP Pre-Launch Load + Abuse Simulation Report");
  lines.push("");
  lines.push(`- Started: ${summary.startedAt}`);
  lines.push(`- Ended: ${summary.endedAt}`);
  lines.push(`- Duration (s): ${summary.durationSeconds}`);
  lines.push(`- Base URL: ${summary.config.baseUrl}`);
  lines.push("");
  lines.push("## Configuration");
  lines.push("");
  lines.push(`- Read concurrency: ${summary.config.readConcurrency}`);
  lines.push(`- Write concurrency: ${summary.config.writeConcurrency}`);
  lines.push(`- Abuse concurrency: ${summary.config.abuseConcurrency}`);
  lines.push(`- Timeout (ms): ${summary.config.timeoutMs}`);
  lines.push(`- Domain filter: ${summary.config.domain ?? "none"}`);
  lines.push(`- Hidden claim check id: ${summary.config.hiddenClaimId ?? "not provided"}`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Requests: ${summary.totals.requestCount}`);
  lines.push(`- 2xx: ${summary.totals.success2xx}`);
  lines.push(`- 4xx: ${summary.totals.client4xx}`);
  lines.push(`- 5xx: ${summary.totals.server5xx}`);
  lines.push(`- Network errors: ${summary.totals.networkErrors}`);
  lines.push(`- RPS: ${summary.totals.requestsPerSecond}`);
  lines.push(`- P50 latency: ${summary.totals.p50LatencyMs ?? "n/a"} ms`);
  lines.push(`- P95 latency: ${summary.totals.p95LatencyMs ?? "n/a"} ms`);
  lines.push(`- 5xx rate: ${summary.totals.server5xxRatePercent}%`);
  lines.push("");
  lines.push("## Scenarios");
  lines.push("");
  lines.push(
    "| Scenario | Requests | 2xx | 4xx | 5xx | NetErr | P50 ms | P95 ms |"
  );
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of summary.scenarios) {
    lines.push(
      `| ${row.scenario} | ${row.requestCount} | ${row.success2xx} | ${row.client4xx} | ${row.server5xx} | ${row.networkErrors} | ${row.p50LatencyMs ?? "n/a"} | ${row.p95LatencyMs ?? "n/a"} |`
    );
  }
  lines.push("");
  lines.push("## Abuse Status Distribution");
  lines.push("");
  if (Object.keys(summary.abuseStatusCounts).length === 0) {
    lines.push("- No abuse requests were sent (check tokens/concurrency).");
  } else {
    for (const [status, count] of Object.entries(summary.abuseStatusCounts)) {
      lines.push(`- HTTP ${status}: ${count}`);
    }
  }
  lines.push("");
  lines.push("## Moderation Control Checks");
  lines.push("");
  if (!summary.moderationChecks.length) {
    lines.push("- Hidden-claim checks were not run.");
  } else {
    for (const check of summary.moderationChecks) {
      lines.push(
        `- ${check.name}: expected ${check.expectedStatus}, got ${check.actualStatus} (${check.ok ? "PASS" : "FAIL"})`
      );
    }
  }
  lines.push("");
  lines.push("## Bottlenecks And Required Fixes");
  lines.push("");
  if (!summary.bottlenecks.length) {
    lines.push("- No bottlenecks detected with current thresholds.");
  } else {
    for (const item of summary.bottlenecks) {
      lines.push(`- [${item.severity}] ${item.area}: ${item.details}`);
      lines.push(`  - Required fix: ${item.fix}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function defaultReportFile() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join("artifacts", `load-abuse-report-${stamp}.md`);
}

async function saveReport(markdown, filePath) {
  const resolved = path.resolve(filePath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, markdown, "utf8");
  return resolved;
}

function logDryRunPlan(options, tokens) {
  console.log("Dry run plan:");
  console.log(`- Base URL: ${options.baseUrl}`);
  console.log(`- Duration (seconds): ${options.durationSeconds}`);
  console.log(`- Read concurrency: ${options.readConcurrency}`);
  console.log(`- Write concurrency: ${options.writeConcurrency}`);
  console.log(`- Abuse concurrency: ${options.abuseConcurrency}`);
  console.log(`- Domain filter: ${options.domain ?? "none"}`);
  console.log(`- Hidden claim check: ${options.hiddenClaimId ?? "not configured"}`);
  console.log("- Scenarios:");
  console.log("  - read_feed");
  console.log("  - read_claim_detail");
  console.log("  - read_claim_comments");
  console.log("  - write_claim");
  console.log("  - write_comment");
  console.log("  - abuse_spam_burst");
  console.log("  - abuse_repeated_payload");
  console.log("  - abuse_malformed_body");
  console.log("  - moderation_control_check (optional)");
  console.log("- Token presence:");
  console.log(`  - read token: ${tokens.read ? "yes" : "no"}`);
  console.log(`  - comment token: ${tokens.comment ? "yes" : "no"}`);
  console.log(`  - claim token: ${tokens.claim ? "yes" : "no"}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage().trim());
    return;
  }

  const ctx = createContext(options);

  if (options.dryRun) {
    logDryRunPlan(options, ctx.tokens);
    return;
  }

  if (!ctx.tokens.read) {
    throw new Error("Missing AOP_SIM_READ_TOKEN");
  }
  if (!ctx.tokens.comment && options.writeConcurrency > 0) {
    console.warn("AOP_SIM_COMMENT_TOKEN is missing; comment write scenarios will be skipped.");
  }
  if (!ctx.tokens.claim && options.writeConcurrency > 0) {
    console.warn("AOP_SIM_CLAIM_TOKEN is missing; claim write scenarios will be skipped.");
  }

  await seedClaimPool(ctx);

  const stopAt = Date.now() + options.durationSeconds * 1000;
  const workerGroups = [];

  if (options.readConcurrency > 0) {
    workerGroups.push(
      runWorkerPool({
        workers: Math.max(1, Math.floor(options.readConcurrency / 2)),
        stopAt,
        task: async () => scenarioReadFeed(ctx),
        jitterMs: 180,
      })
    );
    workerGroups.push(
      runWorkerPool({
        workers: Math.max(1, Math.ceil(options.readConcurrency / 2)),
        stopAt,
        task: async () => scenarioReadClaimAndComments(ctx),
        jitterMs: 220,
      })
    );
  }

  if (options.writeConcurrency > 0) {
    workerGroups.push(
      runWorkerPool({
        workers: Math.max(0, Math.floor(options.writeConcurrency / 2)),
        stopAt,
        task: async () => scenarioWriteClaim(ctx),
        jitterMs: 700,
      })
    );
    workerGroups.push(
      runWorkerPool({
        workers: Math.max(0, Math.ceil(options.writeConcurrency / 2)),
        stopAt,
        task: async () => scenarioWriteComment(ctx),
        jitterMs: 350,
      })
    );
  }

  if (options.abuseConcurrency > 0) {
    workerGroups.push(
      runWorkerPool({
        workers: Math.max(1, options.abuseConcurrency),
        stopAt,
        task: async (workerIndex) => {
          const selector = workerIndex % 3;
          if (selector === 0) return scenarioAbuseSpamBurst(ctx);
          if (selector === 1) return scenarioAbuseRepeatedPayload(ctx);
          return scenarioAbuseMalformedBody(ctx);
        },
        jitterMs: 120,
      })
    );
  }

  await Promise.all(workerGroups);
  await verifyModerationControls(ctx);

  const endedAt = Date.now();
  const summary = summarizeMetrics(ctx, endedAt);
  const markdown = toMarkdownReport(summary);
  const reportFile = options.reportFile || defaultReportFile();
  const reportPath = await saveReport(markdown, reportFile);

  console.log(`Simulation completed at ${nowIso()}`);
  console.log(`Report: ${reportPath}`);
  console.log(
    `Requests=${summary.totals.requestCount} RPS=${summary.totals.requestsPerSecond} P95=${summary.totals.p95LatencyMs ?? "n/a"}ms 5xx=${summary.totals.server5xxRatePercent}%`
  );
  if (summary.bottlenecks.length) {
    console.log(`Bottlenecks detected: ${summary.bottlenecks.length}`);
    for (const item of summary.bottlenecks) {
      console.log(`- [${item.severity}] ${item.area}: ${item.details}`);
    }
  } else {
    console.log("No bottlenecks detected by baseline thresholds.");
  }

  if (options.failOnBottleneck && summary.bottlenecks.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`Simulation failed: ${error?.message ?? error}`);
  process.exitCode = 1;
});
