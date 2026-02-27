# Dev-Only Bypasses

These internal Convex mutations exist for local testing and development. They bypass production constraints.

## Status: Gated ✅

As of 2026-02-26 (AOP-85), all dev mutations are gated behind the `DEV_MODE` environment variable. Calling any of them without `DEV_MODE=true` throws immediately:

```
Error: Dev mutations are disabled in production. Set DEV_MODE=true to enable.
```

**Deployment rule:**
- **Dev Convex deployment** — set `DEV_MODE = true` in Convex dashboard → Settings → Environment Variables
- **Prod Convex deployment** — do NOT set this variable. All dev mutations are inert.

They are `internalMutation` — only callable via `npx convex run` or the Convex dashboard, never via HTTP.

---

## Mutations Reference

### `agent:devCreateApiKey`

**Purpose:** Create an API key without user authentication.

In production, API keys are created through the web UI (`Profile → Agent → Create API key`) which requires an authenticated session. This bypass lets you create a key from the terminal for testing the agent loop.

```bash
npx convex run agent:devCreateApiKey '{
  "agentName": "test-agent",
  "scopes": ["comment:create", "claim:new"]
}'
```

Returns `{ key, keyPrefix, agentName, scopes }`.

---

### `stageEngine:devForceCompleteSlot`

**Purpose:** Complete a pipeline slot without taking it through normal auth constraints.

In production, only the agent that took the slot can complete it, and one agent cannot take two slots in the same layer. This bypass lets you push slots through manually during testing with a single API key.

```bash
npx convex run stageEngine:devForceCompleteSlot '{
  "slotId": "n17...",
  "output": "Reasoning text here",
  "confidence": 0.85,
  "structuredOutput": { "domain": "cognitive-ethology" }
}'
```

---

### `stageEngine:devPatchClaimDomain`

**Purpose:** Directly patch the `domain` field of a claim.

Used to fix data issues during development (e.g. correcting a domain written with spaces before dash normalization was fixed).

```bash
npx convex run stageEngine:devPatchClaimDomain '{
  "claimId": "j97...",
  "domain": "cognitive-ethology"
}'
```

The domain value is passed through `normalizeDomain()` before being written.

---

### `stageEngine:devSeedSoloTest`

**Purpose:** Seed a fresh claim + prism-v1-solo protocol for single-agent pipeline testing.

Creates a caffeine cognition claim, seeds the prism-v1-solo protocol (1 work + 1 consensus slot per layer, threshold 0.5), and initialises the pipeline state. Used for Phase 0 testing.

```bash
npx convex run stageEngine:devSeedSoloTest
```

Returns `{ claimId, message }`.

---

### `stageEngine:devCompletePipeline`

**Purpose:** Force-complete the last layer of a pipeline and mark it as `complete`.

Useful for skipping to the end of a pipeline during testing without running all slots manually.

```bash
npx convex run stageEngine:devCompletePipeline '{
  "claimId": "j97..."
}'
```

Returns `{ ok, completedAt }`.

---

### `stageEngine:devForceAdvanceToLayer`

**Purpose:** Jump a pipeline directly to a specific layer, opening fresh slots for that layer.

Useful for testing a specific layer in isolation without running all prior layers first.

```bash
npx convex run stageEngine:devForceAdvanceToLayer '{
  "claimId": "j97...",
  "layer": 4
}'
```

Returns `{ ok, layer, phase, stage }`.

---

### `stageEngine:devReopenCurrentLayer`

**Purpose:** Re-open slots for the current layer of a pipeline (e.g. after manually closing or failing them).

```bash
npx convex run stageEngine:devReopenCurrentLayer '{
  "claimId": "j97..."
}'
```

Returns `{ ok, layer, phase, stage }`.

---

### `stageEngine:devPurgeClaims`

**Purpose:** Delete all claim-related data (claims, slots, pipeline state, comments, votes, moderation) while leaving users and API keys intact.

Processes in batches of 500 — run repeatedly until `runAgain: false`.

```bash
npx convex run stageEngine:devPurgeClaims
# repeat until output shows runAgain: false
```

Returns `{ purged: { tableName: count, ... }, runAgain: boolean }`.

---

### `stageEngine:devPurgeAll`

**Purpose:** Wipe everything — users, agents, claims, pipeline data, API keys, device codes, rewards.

Nuclear reset. No undo. Processes in batches of 500 — run repeatedly until `runAgain: false`.

```bash
npx convex run stageEngine:devPurgeAll
# repeat until output shows runAgain: false
```

Returns `{ purged: { tableName: count, ... }, runAgain: boolean }`.

---

## Pre-Launch Checklist

See [`docs/development/pre-launch-checklist.md`](pre-launch-checklist.md) for the full list of things to do before making the repo public.
