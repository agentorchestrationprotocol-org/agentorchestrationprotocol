import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

async function file(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

test("schema includes observability event table and indexes", async () => {
  const schema = await file("convex/schema.ts");

  assert.match(schema, /observabilityEvents: defineTable\(/);
  assert.match(schema, /source: v\.union\(v\.literal\("frontend"\), v\.literal\("backend"\), v\.literal\("system"\)\)/);
  assert.match(schema, /category: v\.union\(/);
  assert.match(schema, /v\.literal\("api_request"\)/);
  assert.match(schema, /v\.literal\("auth_failure"\)/);
  assert.match(schema, /v\.literal\("rate_limit"\)/);
  assert.match(schema, /\.index\("by_category_createdAt"/);
  assert.match(schema, /\.index\("by_route_createdAt"/);
});

test("observability module exposes telemetry, dashboard, and alert queries", async () => {
  const observability = await file("convex/observability.ts");

  assert.match(observability, /export const recordApiRequest = internalMutation\(/);
  assert.match(observability, /export const captureFrontendError = mutation\(/);
  assert.match(observability, /export const getApiDashboard = query\(/);
  assert.match(observability, /export const getAlertRulesStatus = query\(/);
  assert.match(observability, /export const listRecentErrors = query\(/);
  assert.match(observability, /OBS_AUTH_FAILURE_THRESHOLD/);
  assert.match(observability, /OBS_RATE_LIMIT_THRESHOLD/);
  assert.match(observability, /OBS_MODERATION_THRESHOLD/);
});

test("HTTP API routes are wrapped with observability instrumentation", async () => {
  const http = await file("convex/http.ts");

  assert.match(http, /const withObservedHandler = \(/);
  assert.match(http, /const canonicalizeRoute = \(/);
  assert.match(http, /x-aop-error-code/);
  assert.match(http, /recordApiMetric/);
  assert.match(http, /withObservedHandler\("POST", async \(ctx, request\) => \{/);
  assert.match(http, /withObservedHandler\("GET", async \(ctx, request\) => \{/);
});

test("frontend error tracker is mounted globally", async () => {
  const tracker = await file("components/FrontendErrorTracker.tsx");
  const layout = await file("app/layout.tsx");

  assert.match(tracker, /window\.addEventListener\("error"/);
  assert.match(tracker, /window\.addEventListener\("unhandledrejection"/);
  assert.match(tracker, /captureFrontendError/);
  assert.match(layout, /FrontendErrorTracker/);
  assert.match(layout, /<FrontendErrorTracker \/>/);
});

test("profile exposes observability dashboard for admins", async () => {
  const profile = await file("app/profile/page.tsx");

  assert.match(profile, /label: "Observability"/);
  assert.match(profile, /activeTab === "observability"/);
  assert.match(profile, /getApiDashboard/);
  assert.match(profile, /getAlertRulesStatus/);
  assert.match(profile, /listRecentErrors/);
  assert.match(profile, /API latency and error rates \(last 24h\)/);
});

test("observability runbook documents ownership and escalation", async () => {
  const runbook = await file("docs/observability-runbook.md");

  assert.match(runbook, /Observability Runbook/);
  assert.match(runbook, /Ownership And Escalation/);
  assert.match(runbook, /MODERATION_ADMIN_ALLOWLIST/);
  assert.match(runbook, /Auth failure spike/);
  assert.match(runbook, /Rate-limit spike/);
  assert.match(runbook, /Moderation events spike/);
});
