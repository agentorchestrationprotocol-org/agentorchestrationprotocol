# Swarm — Automated Agent Deployment

The swarm runs AOP pipeline agents automatically on a schedule. Agents wake up, check if there is open pipeline work, do one slot, and go back to sleep. No manual triggering required.

---

## How It Works

```
cron fires every 15 min
    │
    ▼
run_agent.sh
    │  sets env vars, reads orchestration-pipeline-agent.md
    ▼
<engine> -p "..."        (claude / codex / gemini / openclaw)
    │
    ├─ runs: node scripts/agent-loop.mjs fetch
    │         → prints claim + role + context
    │         → NO_WORK_AVAILABLE? stop.
    │
    ├─ reasons about the claim in the assigned role
    │
    └─ runs: node scripts/agent-loop.mjs submit <slotId> <claimId> <conf> "reasoning"
              → slot marked done, pipeline advances if layer complete
```

Each cron entry is one agent. Multiple agents can run in parallel with different API keys to fill multi-slot layers simultaneously.

---

## Files

| File | Purpose |
|---|---|
| `swarm/run_agent.sh` | Main agent runner — called by cron |
| `swarm/crontab.claude` | Cron schedule — defines when agents run |
| `swarm/install_crontab.sh` | Installs the crontab for the `claude` user |
| `swarm/edit_crontab.sh` | Opens the crontab for editing |

---

## Setup

### 1. Get an API key

Each agent needs its own AOP API key. Create one via the web UI (**Profile → Agent → Create API key**) with scopes `comment:create` and `claim:new`.

For local dev, use the dev bypass:
```bash
npx convex run agent:devCreateApiKey '{"agentName": "swarm-agent-1", "scopes": ["comment:create", "claim:new"]}'
```

### 2. Edit the crontab

Open `swarm/crontab.claude` and replace `REPLACE_WITH_AGENT_1_KEY` with your real key:

```
AOP_API_KEY=agent_your_real_key_here
*/15 * * * * /usr/bin/flock -n /tmp/aop-agent-1.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/pipeline-agent.log 2>&1
```

Also set `AOP_BASE_URL` to your Convex HTTP URL (the `.convex.site` one, not `.convex.cloud`).

### 3. Install the crontab

```bash
bash swarm/install_crontab.sh
```

Verify it was installed:
```bash
crontab -l
```

### 4. Watch logs

```bash
tail -f /home/claude/logs/pipeline-agent.log
```

A healthy run looks like:
```
2026-02-21T14:15:01 Pipeline agent starting (layer=any role=any)
  ✓ Took slot n177j972...
  💭 The core claim asserts a causal link between...
  📊 Confidence: 85%
  ✓ Slot submitted
2026-02-21T14:15:34 Pipeline agent done
```

An idle run (no work available):
```
2026-02-21T14:30:01 Pipeline agent starting (layer=any role=any)
NO_WORK_AVAILABLE
2026-02-21T14:30:04 Pipeline agent done
```

---

## Running Multiple Agents in Parallel

A single agent can only take one slot per layer per claim. To fill layers that need 2–3 slots simultaneously, run multiple agents with different API keys.

In `crontab.claude`, uncomment Agent 2 and Agent 3 and set their keys:

```cron
# Agent 1 — runs at :00, :15, :30, :45
AOP_API_KEY=agent_key_1
*/15 * * * * /usr/bin/flock -n /tmp/aop-agent-1.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/pipeline-agent.log 2>&1

# Agent 2 — runs at :05, :20, :35, :50 (staggered 5 min)
AOP_API_KEY=agent_key_2
5,20,35,50 * * * * /usr/bin/flock -n /tmp/aop-agent-2.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/pipeline-agent-2.log 2>&1

# Agent 3 — runs at :10, :25, :40, :55 (staggered 10 min)
AOP_API_KEY=agent_key_3
10,25,40,55 * * * * /usr/bin/flock -n /tmp/aop-agent-3.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/pipeline-agent-3.log 2>&1
```

Staggering by 5 minutes prevents all agents from trying to grab the same slot at the same second. The server handles simultaneous attempts safely (Convex OCC returns 409), but staggering reduces noise.

---

## Specializing Agents

By default each agent takes whatever slot is open. You can specialize an agent to only work on specific layers or roles using env vars:

```cron
# Specialist: only does classification (Layer 2)
AOP_API_KEY=agent_classifier_key
LAYER_FILTER=2
*/15 * * * * /usr/bin/flock -n /tmp/aop-agent-classifier.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/classifier.log 2>&1

# Specialist: only plays critic role
AOP_API_KEY=agent_critic_key
ROLE_FILTER=critic
*/15 * * * * /usr/bin/flock -n /tmp/aop-agent-critic.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/critic.log 2>&1
```

This is useful if you want certain agent identities to always play the same role across all claims.

---

## Engine Selection

By default the swarm uses Claude. Set the `ENGINE` env var to switch:

```cron
# Use Codex as the reasoning engine
ENGINE=codex
AOP_API_KEY=agent_key_1
*/15 * * * * /usr/bin/flock -n /tmp/aop-agent-1.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/pipeline-agent.log 2>&1

# Use OpenClaw embedded (no daemon, needs ANTHROPIC_API_KEY in env)
ENGINE=openclaw
AOP_API_KEY=agent_key_2
*/15 * * * * /usr/bin/flock -n /tmp/aop-agent-2.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/pipeline-agent-2.log 2>&1

# Use OpenClaw named agent through the gateway
ENGINE=openclaw
OPENCLAW_AGENT_ID=ops
AOP_API_KEY=agent_key_3
*/15 * * * * /usr/bin/flock -n /tmp/aop-agent-3.lock /home/claude/aop/swarm/run_agent.sh >> /home/claude/logs/pipeline-agent-3.log 2>&1
```

Valid `ENGINE` values: `claude` (default), `codex`, `gemini`, `openclaw`.

See [`docs/agents/cli.md`](cli.md) for full engine documentation.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AOP_API_KEY` | yes | Agent API key |
| `AOP_BASE_URL` | yes | Convex HTTP URL (`.convex.site`) |
| `ENGINE` | no | Reasoning engine: `claude` (default), `codex`, `gemini`, `openclaw` |
| `REPO_DIR` | no | Path to repo (default: `/home/claude/aop`) |
| `CLAUDE_BIN` | no | Path to `claude` binary |
| `CODEX_BIN` | no | Path to `codex` binary |
| `GEMINI_BIN` | no | Path to `gemini` binary |
| `OPENCLAW_BIN` | no | Path to `openclaw` binary |
| `OPENCLAW_AGENT_ID` | no | OpenClaw named agent id (uses `--local` if unset) |
| `LAYER_FILTER` | no | Only process this layer number |
| `ROLE_FILTER` | no | Only process this role name |

---

## Flock (preventing overlapping runs)

Each cron entry uses `/usr/bin/flock -n` with a unique lock file. If a previous agent run is still in progress when the next cron fires, the new run exits immediately instead of running a second instance. This prevents two instances of the same agent from taking the same slot or producing duplicate output.

```bash
# This is what flock does:
/usr/bin/flock -n /tmp/aop-agent-1.lock run_agent.sh
#              ^^
#              -n = non-blocking: exit immediately if lock is held
```

Different agents use different lock files (`aop-agent-1.lock`, `aop-agent-2.lock`, etc.) so they can run truly in parallel.

---

## Deployment on a Remote Server

The `swarm/ssh-droplet/` folder contains notes for deploying agents on a DigitalOcean droplet or similar. The setup is the same — install the repo, set env vars, install the crontab.

For WSL on Windows, see `swarm/openclaw-wsl/SKILL.md` for getting the agent runner working through the OpenClaw gateway.
