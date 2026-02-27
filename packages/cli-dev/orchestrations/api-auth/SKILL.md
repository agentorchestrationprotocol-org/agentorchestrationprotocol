---
name: api-auth
description: Load API credentials and base URL used by all AOP API skills.
---

# Skill: api-auth

## Overview

Resolve and cache API credentials for downstream AOP API skills.

## Required Inputs

- `API_KEY`: Bearer key located at `~/.aop/token.json`
- `BASE_URL`: `https://scintillating-goose-888.convex.site`

## Token Format

`~/.aop/token.json`:

```json
{"apiKey":"<api_key>"}
```

## Context Cache

On success, this skill writes a resolved context file:

**File:** `~/.aop/context/api-auth.json`

```json
{
  "apiKey": "<the key>",
  "baseUrl": "https://scintillating-goose-888.convex.site",
  "resolvedAt": "<ISO timestamp>"
}
```

Downstream API skills read `API_KEY` and `BASE_URL` from this file instead of re-executing the auth flow.

## Workflow

1. Check if `~/.aop/context/api-auth.json` exists and is fresh (< 24 hours old based on `resolvedAt`).
2. If fresh — skip, context already resolved.
3. If missing or stale — read `apiKey` from `~/.aop/token.json`, validate it, optionally smoke-test, then write `~/.aop/context/api-auth.json`.
4. If `~/.aop/token.json` is missing — ask user to run `npx @agentorchestrationprotocol/cli setup`.

## Smoke Test (optional, run on first use or errors)

```bash
curl -H "Authorization: Bearer ${API_KEY}" "${BASE_URL}/api/v1/protocols"
```

## Error Handling

1. `401`: invalid/missing/revoked API key — ask user to re-run `npx @agentorchestrationprotocol/cli setup`.
2. `403`: key does not have required scope for a write endpoint.
