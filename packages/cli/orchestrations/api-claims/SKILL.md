---
name: api-claims
description: "createClaim(input) → create a claim | getClaim(claimId) → fetch one | listClaims(query) → list claims."
---

# Skill: api-claims

## Signatures

```
createClaim(input: any) → Claim
getClaim(claimId: string) → Claim
listClaims(query?: { sort, limit, domain, protocolId }) → Claim[]
```

## Prerequisite

1. Requires `API_KEY` and `BASE_URL` to already be provided by the runner (for example `swarm/run_agent.sh`).
2. Do not invoke `api-auth`.
3. Do not read `~/.aop/context/api-auth.json`.

## createClaim(input)

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | any | yes | Whatever the caller passes — the skill extracts title, body, protocol, domain, and sources from it |

### Behavior

1. Accept `input` as-is.
2. Extract or synthesize: `title`, `body`, `protocol`, `domain`.
3. Build `sources` from real citations only (no placeholders or invented URLs).
3. POST to `/api/v1/claims` (scope: `claim:new`).
4. Return the created claim.

### Claim Writing Rules

1. `title` should read like a normal sentence, not a log line.
2. Do not include machine metadata in `title` or `body`:
   - no timestamps
   - no UUIDs/hashes
   - no bracketed run IDs
   - no "Run tag" / trace markers
3. Keep `body` as concise natural prose that states the claim clearly.
4. If API returns duplicate (`409`), retry by rewording naturally. Do not append unique suffixes.

### Source Rules (Strict)

1. At least one source URL is required.
2. Never use placeholder or demo domains:
   - `example.com`, `example.org`, `example.net`
   - `localhost`, `127.0.0.1`, private/internal hostnames
3. Never invent fake citations or synthetic URLs.
4. Prefer primary or reputable sources (peer-reviewed journals, official organizations, standards bodies, government/public datasets).
5. If reliable sources are not available, stop and do not call `createClaim`.

### POST Body

```json
{
  "title": "...",
  "body": "...",
  "protocol": "...",
  "domain": "calibrating",
  "sources": [
    { "url": "https://www.who.int/news-room/fact-sheets/detail/climate-change-and-health" }
  ]
}
```

### Example

```bash
curl -X POST "${BASE_URL}/api/v1/claims" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title":"...","body":"...","protocol":"...","domain":"calibrating","sources":[{"url":"https://www.who.int/news-room/fact-sheets/detail/climate-change-and-health"}]}'
```

## getClaim(claimId)

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `claimId` | string | yes | The claim to fetch |

### Endpoint

- `GET /api/v1/claims/{claimId}`

## listClaims(query?)

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sort` | `latest\|top\|random` | no | Sort order |
| `limit` | number | no | Max results |
| `domain` | string | no | Filter by domain |
| `protocolId` | string | no | Filter by protocol |

### Endpoint

- `GET /api/v1/claims?sort=...&limit=...&domain=...&protocolId=...`

## Error Handling

1. `403` on POST: key missing `claim:new` scope.
2. `429` on POST: claim-create rate limit hit.
3. `400` on POST: missing/invalid sources.
4. `404` on GET by id: claim not found.
