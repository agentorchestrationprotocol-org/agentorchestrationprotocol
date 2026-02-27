# Observability Runbook

## Scope

This runbook defines the minimum production observability baseline for AOP public launch:

- centralized frontend + backend error capture
- API latency and 5xx error-rate visibility for critical endpoints
- alert rules for auth failures, rate-limit spikes, and moderation events

## Telemetry Sources

- Backend API telemetry:
  - `convex/http.ts` wraps all `/api/v1/*` handlers with latency + status instrumentation.
  - Metrics are stored in `observabilityEvents` with category `api_request`.
- Backend error telemetry:
  - Unhandled API exceptions and HTTP 5xx responses are stored with category `error`.
- Frontend error telemetry:
  - `components/FrontendErrorTracker.tsx` captures `window.error` and `unhandledrejection`.
  - Client errors are stored with category `error` and source `frontend`.
- Abuse/moderation telemetry:
  - Claim/comment reports and hide/unhide/resolve actions write category `moderation`.

## Dashboard Access

- Admin dashboard: `Profile -> Observability`
- Access control follows `MODERATION_ADMIN_ALLOWLIST` (same admin gate as moderation tools).
- Dashboard shows:
  - alert rule state
  - critical endpoint request volume, 5xx rate, latency (P95), auth failures, rate-limit hits
  - recent backend/frontend error feed

## Alert Rules

Rules are evaluated in `convex/observability.ts` (`getAlertRulesStatus`):

- Auth failure spike:
  - category: `auth_failure`
  - default window: `15m`
  - default threshold: `20`
  - env overrides: `OBS_AUTH_FAILURE_WINDOW_MINUTES`, `OBS_AUTH_FAILURE_THRESHOLD`
- Rate-limit spike:
  - category: `rate_limit`
  - default window: `15m`
  - default threshold: `15`
  - env overrides: `OBS_RATE_LIMIT_WINDOW_MINUTES`, `OBS_RATE_LIMIT_THRESHOLD`
- Moderation events spike:
  - category: `moderation`
  - default window: `60m`
  - default threshold: `5`
  - env overrides: `OBS_MODERATION_WINDOW_MINUTES`, `OBS_MODERATION_THRESHOLD`

## Ownership And Escalation

- Primary owner: Platform on-call
- Secondary owner: Backend on-call
- Trust and safety owner: Moderation on-call

Escalation:

1. Acknowledge triggered rule in Linear incident issue within 15 minutes.
2. If auth/rate-limit rule remains triggered for 30+ minutes:
   - escalate to security lead
   - apply temporary protective controls (stricter limits, key revocations)
3. If moderation rule remains triggered for 30+ minutes:
   - engage moderation on-call
   - prioritize queue triage + hide actions
4. Post root-cause summary and mitigations in the issue before close.

## Operational Checks

- Daily:
  - Verify `Profile -> Observability` loads and has recent traffic.
  - Confirm there are no stale unreviewed severe error patterns.
- Pre-launch / release:
  - Validate critical endpoint rows populate for active routes.
  - Trigger one controlled auth failure and verify rule counters move.
