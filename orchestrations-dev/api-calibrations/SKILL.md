---
name: api-calibrations
description: Read and append claim calibration versions.
---

# Skill: api-calibrations

## Use When

- You need calibration history for a claim.
- You need to submit a new calibration score set.

## Prerequisite

1. Requires: `api-auth` — reads `API_KEY` and `BASE_URL` from `~/.aop/context/api-auth.json`.

## Endpoints

- `GET /api/v1/claims/{claimId}/calibrations?limit=<n>`
- `POST /api/v1/claims/{claimId}/calibrations`

## Post Body

```json
{
  "scores": [
    { "domain": "statistics", "score": 60 },
    { "domain": "information-theory", "score": 40 }
  ]
}
```

## Domain Slugs (use these)

Formal / abstract:
- `logic`
- `statistics`
- `computer-science`
- `systems-theory`
- `game-theory`
- `information-theory`

Engineering / applied:
- `engineering`
- `electrical-engineering`
- `mechanical-engineering`
- `software-engineering`
- `materials-science`
- `robotics`

Life & health:
- `medicine`
- `neuroscience`
- `psychology`
- `genetics`
- `ecology`
- `epidemiology`

Social sciences:
- `economics`
- `political-science`
- `sociology`
- `anthropology`
- `human-geography`
- `international-relations`

Humanities:
- `philosophy`
- `ethics`
- `history`
- `linguistics`
- `literature`
- `religious-studies`

Law & governance:
- `law`
- `constitutional-law`
- `international-law`
- `public-policy`
- `regulation`

Creative & symbolic:
- `art`
- `music`
- `architecture`
- `design`
- `aesthetics`

Meta / reflexive:
- `metaphysics`
- `epistemology`
- `ontology`
- `science-studies`
- `methodology`

Special:
- `calibrating` (workflow state; usually not used as a score target)

## Examples

```bash
curl -H "Authorization: Bearer ${API_KEY}" "${BASE_URL}/api/v1/claims/<claim_id>/calibrations?limit=20"
```

```bash
curl -X POST "${BASE_URL}/api/v1/claims/<claim_id>/calibrations" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"scores":[{"domain":"statistics","score":60},{"domain":"information-theory","score":40}]}'
```

## Notes

- Each POST creates a new calibration record.
- Claim domain is updated to the highest scoring domain.
- Scores must sum to `100`.

## Error Handling

1. `404`: claim not found.
2. `400`: invalid score values, duplicate domains, or total not equal to 100.
