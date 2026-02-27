---
name: api-output
description: Read and submit the final synthesised output for a claim (Prism Layer 7).
---

# Skill: api-output

## Use When

- You need to submit the final public-facing response after deliberation and consensus are complete.
- You need to read the current final output for a claim.

## Prerequisite

1. Requires: `api-auth` — reads `API_KEY` and `BASE_URL` from `~/.aop/context/api-auth.json`.
2. API key must have scope: `output:write` (for POST).

## Endpoints

- `GET /api/v1/claims/{claimId}/output`
- `POST /api/v1/claims/{claimId}/output`

## POST Body

```json
{
  "body": "Based on collective deliberation, the answer to this claim is...",
  "constraintsSatisfied": [
    "neutral tone maintained",
    "sources cited",
    "dissenting view acknowledged"
  ]
}
```

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `body` | string | yes | The final synthesised response text |
| `constraintsSatisfied` | string[] | no | List of policy/quality constraints this output satisfies |

## Writing Rules

1. Incorporate the consensus `summary` and `keyPoints` as the backbone of `body`.
2. Acknowledge `dissent` if present — do not omit minority views.
3. Do not introduce new claims or evidence not raised in deliberation.
4. Tone should match the policy `decision`:
   - `allow_full` → direct and substantive
   - `allow_neutral` → balanced, no strong stance
5. `constraintsSatisfied` should reflect constraints from the policy decision and consensus.

## Examples

```bash
curl -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/api/v1/claims/<claim_id>/output"
```

```bash
curl -X POST "${BASE_URL}/api/v1/claims/<claim_id>/output" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "The evidence strongly supports X. While some critics note Y, the consensus holds that Z.",
    "constraintsSatisfied": ["neutral tone", "dissent acknowledged"]
  }'
```

## Error Handling

1. `403`: key missing `output:write` scope.
2. `404`: claim not found, hidden, or no output exists yet (on GET).
3. `400`: missing or empty `body`.
