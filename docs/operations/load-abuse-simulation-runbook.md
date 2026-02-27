# Load And Abuse Simulation Runbook

## Goal

Rehearse launch traffic against production (or staging) to validate:

- concurrent read/write behavior for feeds, claims, and comments
- abuse-path handling (spam bursts, repeated payloads, malformed bodies)
- rate-limit behavior and moderation-control enforcement under load
- bottlenecks and required fixes before public go-live

## Prerequisites

- Target URL is reachable over HTTPS.
- API keys available:
  - read token: `AOP_SIM_READ_TOKEN`
  - comment write token: `AOP_SIM_COMMENT_TOKEN` (`comment:create`)
  - claim write token: `AOP_SIM_CLAIM_TOKEN` (`claim:new`)
- Optional hidden claim id for moderation-filter check:
  - `AOP_SIM_HIDDEN_CLAIM_ID`

## Quick Dry Run

```bash
node scripts/load-abuse-simulation.mjs --dry-run
```

Use this to verify configuration and scenario selection before sending traffic.

## Full Simulation

Example (15 minute rehearsal):

```bash
AOP_API_BASE_URL="https://<your-domain>" \
AOP_SIM_READ_TOKEN="<read_key>" \
AOP_SIM_COMMENT_TOKEN="<comment_key>" \
AOP_SIM_CLAIM_TOKEN="<claim_key>" \
AOP_SIM_HIDDEN_CLAIM_ID="<optional_hidden_claim_id>" \
node scripts/load-abuse-simulation.mjs \
  --duration-seconds 900 \
  --read-concurrency 12 \
  --write-concurrency 4 \
  --abuse-concurrency 6 \
  --fail-on-bottleneck
```

Default output:

- `artifacts/load-abuse-report-<timestamp>.md`

## Scenario Matrix

- Read traffic:
  - `read_feed`
  - `read_claim_detail`
  - `read_claim_comments`
- Write traffic:
  - `write_claim`
  - `write_comment`
- Abuse traffic:
  - `abuse_spam_burst`
  - `abuse_repeated_payload`
  - `abuse_malformed_body`
- Moderation controls:
  - `moderation_control_check` (if `AOP_SIM_HIDDEN_CLAIM_ID` is provided)

## Success Criteria

- Load run completes without systemic failures.
- 5xx rate remains below launch threshold.
- Abuse requests produce protective responses (notably `429` / expected validation `4xx`).
- Hidden-claim moderation checks return `404` for claim detail and comments.
- Report includes explicit bottlenecks and required fixes.

## Post-Run Actions

1. Attach the generated report to `AOP-57`.
2. Convert each bottleneck into a tracked issue with severity and owner.
3. Re-run simulation after fixes to confirm regression closure.

## Troubleshooting

- No claim/comment writes observed:
  - validate `AOP_SIM_COMMENT_TOKEN` and `AOP_SIM_CLAIM_TOKEN`.
- No `429` responses during abuse:
  - review key-level and action-level limits before launch.
- Hidden moderation check fails:
  - verify hidden content filtering paths in feed/detail/comments API routes.
