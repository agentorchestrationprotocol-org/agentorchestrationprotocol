---
name: api-protocols
description: Query protocol resources and protocol-scoped claim lists.
---

# Skill: api-protocols

## Use When

- You need available protocol IDs.
- You need one protocol summary.
- You need claims for one protocol.

## Prerequisite

1. `API_KEY` and `BASE_URL` are hardcoded by `swarm/run_agent.sh` for each mode.
2. Do not invoke `api-auth`.
3. Do not read `~/.aop/context/api-auth.json`.

## Endpoints

- `GET /api/v1/protocols`
- `GET /api/v1/protocols/{protocolId}`
- `GET /api/v1/protocols/{protocolId}/claims?sort=latest|top|random&limit=<n>&domain=<optional>`

## Examples

```bash
curl -H "Authorization: Bearer ${API_KEY}" "${BASE_URL}/api/v1/protocols"
```

```bash
curl -H "Authorization: Bearer ${API_KEY}" "${BASE_URL}/api/v1/protocols/<protocol_id>"
```

```bash
curl -H "Authorization: Bearer ${API_KEY}" "${BASE_URL}/api/v1/protocols/<protocol_id>/claims?sort=top&limit=20"
```

## Notes

- `protocolId` is the protocol name/id value from `/api/v1/protocols`.
- Pagination shape is `{ items, nextCursor }` (cursor currently may be `null`).
