# AOP — Lines of Code

Tracked periodically. Excludes blank lines. Run `bash scripts/loc.sh` to update.

---

## History

| Date | Project code | Total (incl. libraries) | Note |
|---|---|---|---|
| 2026-02-21 | ~17,000 | — | Pre-lens-v1 revision layer, pre-CLI auto-update |
| 2026-02-22 | 20,453 | 53,952 | — |
| 2026-02-23 | 22,321 | 55,600 | PoI Steps 1–3 complete, meta-v1/lens-v1 routing, --auto CLI flag, export feature, human comments plan |
| 2026-02-24 | 22,516 | 55,656 | 6-engine support (kilocode added), engine invocation fixes, about page redesign |
| 2026-02-25 | 22,713 | 56,145 | Model pill + provider icons, pipeline always visible + markdown rendering, slot timeout, pre-check before spawning engine |

---

## 2026-02-25

### By extension

| Extension | Files | Code lines |
|---|---|---|
| `.ts` | 46 | 9,428 |
| `.tsx` | 35 | 7,705 |
| `.mjs` | 15 | 5,175 |
| `.css` | 2 | 257 |
| `.js` | 250 | 33,580 |

### By directory (project code only)

| Directory | Files | Code lines |
|---|---|---|
| `convex/` | 37 | 8,503 |
| `app/` | 29 | 7,086 |
| `packages/` | 4 | 3,079 |
| `scripts/` | 8 | 2,049 |
| `components/` | 14 | 1,772 |
| `contracts/src/` | ~3 | ~220 |
| `lib/` | 2 | 117 |
| config files | 5 | 34 |
| **Total** | **~102** | **~22,860** |

### Note on contracts/

`contracts/` reports 249 files and 33,499 lines but 247 of those files are the OpenZeppelin library (vendored dependency). The actual authored contract code is 3 files (`AgentSBT.sol`, `AOPToken.sol`, `Deploy.s.sol`) — approximately 220 lines.

The **total including OZ library** is **56,145 lines across 348 files**.
The **project-authored code** is **~22,860 lines across ~102 files**.

---

## What the code covers

| Area | Lines | What it is |
|---|---|---|
| Convex backend | 8,396 | Pipeline engine, protocols, rewards, SBT, claims, agents, observability, schema |
| Next.js frontend | 6,919 | Profile, claims, leaderboard, jobs, create, device auth, export |
| CLI packages | 2,864 | `cli-dev` + `cli` — 6 engines, agent loop, orchestrations, auto-update, --auto flag |
| Scripts | 2,049 | Agent loop, regression tests, LOC counter |
| Components | 1,772 | Shared React components |
| Smart contracts | ~220 | `AgentSBT.sol`, `AOPToken.sol`, deploy script |
