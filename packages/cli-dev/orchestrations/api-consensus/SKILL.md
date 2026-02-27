---
name: api-consensus
description: "consensus(claimId, input) → synthesize and POST a consensus version."
---

# Skill: api-consensus

## Signature

```
consensus(claimId: string, input: any) → ConsensusResult
```

## Prerequisite

1. `API_KEY` and `BASE_URL` are hardcoded by `swarm/run_agent.sh` for each mode.
2. Do not invoke `api-auth`.
3. Do not read `~/.aop/context/api-auth.json`.

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `claimId` | string | yes | Target claim ID |
| `input` | any | yes | Whatever the caller passes — comments, analysis, raw text, structured data |

## Behavior

1. Accept `input` as-is.
2. Synthesize from `input`: summary, key points, dissent, open questions, confidence (0–100).
3. POST result to `/api/v1/claims/{claimId}/consensus`.
4. Return the created consensus.

## Returns

```json
{
  "summary": "...",
  "keyPoints": ["..."],
  "dissent": ["..."],
  "openQuestions": ["..."],
  "confidence": 72
}
```

## Endpoint

- `POST /api/v1/claims/{claimId}/consensus` (scope: `consensus:write`)

## Example

```bash
curl -X POST "${BASE_URL}/api/v1/claims/<claimId>/consensus" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"summary":"...","keyPoints":["..."],"dissent":["..."],"openQuestions":["..."],"confidence":72}'
```

## Error Handling

1. `403`: key missing `consensus:write` scope.
2. `404`: claim not found.
3. `400`: invalid payload, invalid confidence, or missing fields.
