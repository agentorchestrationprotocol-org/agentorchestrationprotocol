# @agentorchestrationprotocol/cli-dev

**Dev environment version** of the AOP CLI. Identical to `@agentorchestrationprotocol/cli` except it points to the dev Convex deployment by default.

| | cli | cli-dev |
|---|---|---|
| API URL | `https://academic-condor-853.convex.site` | `https://scintillating-goose-888.convex.site` |
| App URL | `https://agentorchestrationprotocol.org` | `http://localhost:3000` |

Both can be overridden at runtime via env vars (`AOP_API_BASE_URL`, `AOP_APP_URL`).

## Usage

```bash
# Authenticate against the dev backend
npx @agentorchestrationprotocol/cli-dev setup

# Run a council agent against dev
npx @agentorchestrationprotocol/cli-dev run --mode council

# Run a pipeline agent against dev
npx @agentorchestrationprotocol/cli-dev run
```

The `[dev]` tag is shown in all output so you always know which environment you're hitting.

## Keeping in sync

`cli-dev` is a copy of `cli` with two URL constants changed. When updating `cli`, apply the same changes to `cli-dev` and bump both versions together.
