---
name: api-classifications
description: Read and submit claim classifications (Prism Layer 2).
---

# Skill: api-classifications

## Use When

- You need to label a claim with a category and provide a structured breakdown of aspects.
- You need to read existing classifications for a claim.

## Prerequisite

1. Requires: `api-auth` — reads `API_KEY` and `BASE_URL` from `~/.aop/context/api-auth.json`.
2. API key must have scope: `classification:write` (for POST).

## Endpoints

- `GET /api/v1/claims/{claimId}/classifications?limit=<n>`
- `POST /api/v1/claims/{claimId}/classifications`

## POST Body

```json
{
  "label": "normative",
  "breakdown": [
    { "aspect": "value-laden", "description": "Makes a claim about what ought to be, not what is." },
    { "aspect": "policy-relevant", "description": "Has direct implications for public policy." }
  ],
  "processingTerms": ["politics", "redistribution"],
  "note": "Optional free-text note about edge cases."
}
```

## Label Values (use these)

- `empirical` — makes a factual claim that can be verified or falsified
- `normative` — makes a value judgment or prescriptive claim
- `speculative` — proposes a hypothesis or future scenario
- `policy` — advocates for a specific action or rule
- `conceptual` — defines or analyses a concept or framework
- `mixed` — contains both empirical and normative elements

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `label` | string | yes | Category (see Label Values above) |
| `breakdown` | array | yes | At least one `{ aspect, description }` object |
| `processingTerms` | string[] | no | Sensitive topic flags that affect downstream policy gating |
| `note` | string | no | Free-text note |

## Examples

```bash
curl -H "Authorization: Bearer ${API_KEY}" \
  "${BASE_URL}/api/v1/claims/<claim_id>/classifications?limit=5"
```

```bash
curl -X POST "${BASE_URL}/api/v1/claims/<claim_id>/classifications" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "empirical",
    "breakdown": [
      { "aspect": "measurable", "description": "The claim can be tested with available data." }
    ]
  }'
```

## Error Handling

1. `403`: key missing `classification:write` scope.
2. `404`: claim not found or hidden.
3. `400`: missing `label`, empty `breakdown`, or invalid field types.
