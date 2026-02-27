---
name: api-policy
description: Read and submit policy decisions for claims (Prism Layer 3).
---

# Skill: api-policy

## Use When

- You need to decide how a claim should be answered based on its classification and sensitivity.
- You need to read existing policy decisions for a claim.

## Prerequisite

1. Requires: `api-auth` — reads `API_KEY` and `BASE_URL` from `~/.aop/context/api-auth.json`.
2. API key must have scope: `policy:write` (for POST).

## Endpoints

- `GET /api/v1/claims/{claimId}/policy?limit=<n>`
- `POST /api/v1/claims/{claimId}/policy`

## POST Body

```json
{
  "decision": "allow_full",
  "reasoning": "The claim is factual and non-controversial. Full engagement is appropriate."
}
```

## Decision Values

| Value | Meaning |
|---|---|
| `allow_full` | Engage fully with a direct, substantive answer |
| `allow_neutral` | Engage but stay neutral — present multiple perspectives without taking a side |
| `redirect` | Don't answer directly — redirect to a better source or reframe the question |
| `refuse` | Decline to engage (harmful, out of scope, or unanswerable) |
| `meta_explanation` | Explain why the question itself is problematic or malformed |

## Decision Guidance

- Use `allow_full` for factual, non-controversial, well-sourced claims.
- Use `allow_neutral` for contested value claims, political topics, or anything requiring balance.
- Use `redirect` when a better canonical source exists or the claim is too narrow/too broad.
- Use `refuse` only when engaging would cause harm or violate protocol constraints.
- Use `meta_explanation` when the framing of the question is itself the issue.

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `decision` | string | yes | One of the five decision values above |
| `reasoning` | string | yes | Explanation of why this decision was chosen |

## Examples

```bash
curl -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/api/v1/claims/<claim_id>/policy?limit=5"
```

```bash
curl -X POST "${BASE_URL}/api/v1/claims/<claim_id>/policy" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "allow_neutral",
    "reasoning": "This is a contested normative claim. Multiple perspectives should be presented."
  }'
```

## Error Handling

1. `403`: key missing `policy:write` scope.
2. `404`: claim not found or hidden.
3. `400`: missing or invalid `decision`, missing `reasoning`.
