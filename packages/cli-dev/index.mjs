#!/usr/bin/env node

import { cp, mkdir, readdir, readFile, writeFile, chmod } from "node:fs/promises";
import { generateKeyPairSync, createHash, createSign } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync, execFileSync } from "node:child_process";

// ── Auto-update check ─────────────────────────────────────────────────
// Silently re-exec with npx @latest if a newer version is available.
// Skipped if already running as @latest (AOP_LATEST=1) or if offline.
if (!process.env.AOP_LATEST) {
  try {
    const pkgPath = fileURLToPath(new URL("./package.json", import.meta.url));
    const { name, version } = JSON.parse(await readFile(pkgPath, "utf8"));
    const latest = execFileSync("npm", ["show", name, "version"], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (latest && latest !== version) {
      spawnSync("npx", [`${name}@${latest}`, ...process.argv.slice(2)], {
        stdio: "inherit",
        env: { ...process.env, AOP_LATEST: "1" },
      });
      process.exit(0);
    }
  } catch { /* offline or npm unavailable — continue with current version */ }
}

// ── ANSI helpers (zero dependencies) ────────────────────────────────
const isColorSupported =
  process.env.FORCE_COLOR !== "0" &&
  (process.env.FORCE_COLOR || process.stdout.isTTY);

const c = isColorSupported
  ? {
      reset: "\x1b[0m",
      bold: "\x1b[1m",
      dim: "\x1b[2m",
      cyan: "\x1b[36m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      red: "\x1b[31m",
      magenta: "\x1b[35m",
      blue: "\x1b[34m",
      white: "\x1b[37m",
      bgCyan: "\x1b[46m",
      bgBlue: "\x1b[44m",
    }
  : {
      reset: "", bold: "", dim: "", cyan: "", green: "", yellow: "",
      red: "", magenta: "", blue: "", white: "", bgCyan: "", bgBlue: "",
    };

const SPINNER_FRAMES = ["◒", "◐", "◓", "◑"];

// ── Engine definitions ────────────────────────────────────────────────
// Usage: --engine provider[/model]  e.g.  --engine anthropic/sonnet-4.6
//                                         --engine google/gemini-2.5-flash
//                                         --engine openclaw[/agent-id]
const ENGINES = {
  anthropic: {
    defaultBin: "claude",
    envKey: "CLAUDE_BIN",
    models: ["sonnet-4.6", "opus-4.6", "haiku-4.5"],
    resolveModel: (m) => ({ "sonnet-4.6": "claude-sonnet-4-6", "opus-4.6": "claude-opus-4-6", "haiku-4.5": "claude-haiku-4-5" }[m] ?? m),
    args: (prompt, opts = {}) => [
      "--dangerously-skip-permissions",
      ...(opts.model ? ["--model", opts.model] : []),
      "-p", prompt,
    ],
  },
  google: {
    defaultBin: "gemini",
    envKey: "GEMINI_BIN",
    models: [],
    resolveModel: (m) => m,
    args: (prompt, opts = {}) => [
      "-y",
      ...(opts.model ? ["-m", opts.model] : []),
      "-p", prompt,
    ],
  },
  openai: {
    defaultBin: "codex",
    envKey: "CODEX_BIN",
    models: [],
    resolveModel: (m) => m,
    args: (prompt, opts = {}) => [
      "--dangerously-bypass-approvals-and-sandbox",
      ...(opts.model ? ["-m", opts.model] : []),
      "exec", "--skip-git-repo-check", prompt,
    ],
  },
  kilocode: {
    defaultBin: "kilo",
    envKey: "KILO_BIN",
    models: [],
    modelHint: "format: provider/model  e.g. --engine kilocode/openai/o3\n    Run: kilo models  for the full list",
    resolveModel: (m) => m,
    args: (prompt, opts = {}) => [
      "run", "--auto",
      ...(opts.model ? ["-m", opts.model] : []),
      prompt,
    ],
  },
  opencode: {
    defaultBin: "opencode",
    envKey: "OPENCODE_BIN",
    models: [],
    modelHint: "format: provider/model  e.g. --engine opencode/openai/gpt-5\n    Run: opencode models  for the full list",
    resolveModel: (m) => m,
    args: (prompt, opts = {}) => [
      "run",
      ...(opts.model ? ["-m", opts.model] : []),
      prompt,
    ],
  },
  openclaw: {
    defaultBin: "openclaw",
    envKey: "OPENCLAW_BIN",
    models: [],
    resolveModel: (m) => m,
    args: (prompt, opts = {}) =>
      opts.agentId
        ? ["agent", "--agent", opts.agentId, "--message", prompt]
        : ["agent", "--message", prompt],
  },
};

const DEFAULT_SCOPES = ["comment:create", "consensus:write", "claim:new", "classification:write", "policy:write", "output:write", "slots:configure"];
// DEV: points to the dev Convex deployment. Override via env vars.
const DEFAULT_API_BASE_URL =
  process.env.AOP_API_BASE_URL ||
  process.env.AOP_API_URL ||
  "https://scintillating-goose-888.convex.site";
const DEFAULT_APP_URL =
  process.env.AOP_APP_URL || "http://localhost:4000";
const HOME_TOKEN_PATH = join(homedir(), ".aop", "token.json");
const HOME_SIGNING_KEY_PATH = join(homedir(), ".aop", "signing-key.pem");
const HOME_ORCHESTRATIONS_PATH = join(homedir(), ".aop", "orchestrations");
const CWD_TOKEN_PATH = join(process.cwd(), ".aop", "token.json");
const CWD_ORCHESTRATIONS_PATH = join(process.cwd(), ".aop", "orchestrations");
const BUNDLED_ORCHESTRATIONS_PATH = fileURLToPath(
  new URL("./orchestrations", import.meta.url),
);
const POLL_INTERVAL_MS = 5_000;

const args = process.argv.slice(2);
const flags = parseFlags(args);
const positional = args.filter((arg) => !arg.startsWith("-"));

if (args.includes("--version") || args.includes("-V")) {
  const pkgPath = fileURLToPath(new URL("./package.json", import.meta.url));
  const { version } = JSON.parse(await readFile(pkgPath, "utf8"));
  console.log(version);
  process.exit(0);
}

if (flags.help || positional.length === 0) {
  printHelp();
  process.exit(0);
}

const isSetup = positional[0] === "setup";
const isLogin =
  positional[0] === "login" ||
  (positional[0] === "auth" && positional[1] === "login");
const isOrchestrations = positional[0] === "orchestrations";
const isRun = positional[0] === "run";
const isBalance = positional[0] === "balance";

if (!isSetup && !isLogin && !isOrchestrations && !isRun && !isBalance) {
  console.error(`\n  ${c.red}✗${c.reset} Unknown command: ${c.bold}${positional.join(" ")}${c.reset}\n`);
  printHelp();
  process.exit(1);
}

const apiBaseUrl = normalizeBaseUrl(flags.apiBaseUrl || DEFAULT_API_BASE_URL);
const appUrl = normalizeBaseUrl(flags.appUrl || DEFAULT_APP_URL);
const tokenPathOverride = flags.tokenPath ? resolve(flags.tokenPath) : undefined;
const orchestrationsPathOverride =
  flags.orchestrationsPath || flags.skillsPath
    ? resolve(flags.orchestrationsPath || flags.skillsPath)
    : undefined;
const scopes = parseScopes(flags.scopes);
const agentName = flags.name;
const agentModel = flags.model;
const installOrchestrations = !(flags.noOrchestrations || flags.noSkills);
const overwriteOrchestrations =
  flags.overwriteOrchestrations || flags.overwriteSkills;

if (isRun) {
  await runPipelineAgent({ flags });
} else if (isBalance) {
  await runBalanceCommand({ flags });
} else if (isOrchestrations) {
  await runOrchestrationsCommand({
    orchestrationsPathOverride,
    overwriteOrchestrations,
  });
} else {
  await runSetup({
    apiBaseUrl,
    appUrl,
    scopes,
    agentName,
    agentModel,
    tokenPathOverride,
    force: flags.force,
  });
}

function parseFlags(rawArgs) {
  const nextValue = (index) => rawArgs[index + 1];
  const flagsState = {
    apiBaseUrl: undefined,
    appUrl: undefined,
    scopes: undefined,
    name: undefined,
    model: undefined,
    orchestrationsPath: undefined,
    tokenPath: undefined,
    skillsPath: undefined,
    noOrchestrations: false,
    noSkills: false,
    overwriteOrchestrations: false,
    overwriteSkills: false,
    force: false,
    layer: undefined,
    role: undefined,
    mode: undefined,
    engine: undefined,
    model: undefined,
    auto: false,
    help: false,
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === "--help" || arg === "-h") {
      flagsState.help = true;
      continue;
    }
    if (arg === "--api-base-url") {
      flagsState.apiBaseUrl = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--app-url") {
      flagsState.appUrl = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--scopes") {
      flagsState.scopes = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--name") {
      flagsState.name = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--model") {
      flagsState.model = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--token-path") {
      flagsState.tokenPath = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--orchestrations-path") {
      flagsState.orchestrationsPath = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--skills-path") {
      flagsState.skillsPath = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--force") {
      flagsState.force = true;
      continue;
    }
    if (arg === "--no-orchestrations") {
      flagsState.noOrchestrations = true;
      continue;
    }
    if (arg === "--no-skills") {
      flagsState.noSkills = true;
      continue;
    }
    if (arg === "--overwrite-orchestrations") {
      flagsState.overwriteOrchestrations = true;
      continue;
    }
    if (arg === "--overwrite-skills") {
      flagsState.overwriteSkills = true;
      continue;
    }
    if (arg === "--layer") {
      flagsState.layer = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--role") {
      flagsState.role = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--mode") {
      flagsState.mode = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--engine") {
      flagsState.engine = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--model") {
      flagsState.model = nextValue(i);
      i += 1;
      continue;
    }
    if (arg === "--auto") {
      const next = nextValue(i);
      const parsed = next && /^\d+$/.test(next) ? parseInt(next, 10) : null;
      flagsState.auto = parsed ?? 30;
      if (parsed !== null) i += 1;
      continue;
    }
  }

  return flagsState;
}

function parseScopes(rawScopes) {
  if (!rawScopes) return DEFAULT_SCOPES;
  return rawScopes
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function parseStoredToken(rawToken) {
  if (!rawToken || typeof rawToken !== "object") {
    return { apiKey: null, apiBaseUrl: null };
  }

  const token = rawToken;
  const apiKey = typeof token.apiKey === "string" ? token.apiKey : null;
  const rawBaseUrl =
    typeof token.apiBaseUrl === "string"
      ? token.apiBaseUrl
      : typeof token.baseUrl === "string"
        ? token.baseUrl
        : null;

  return {
    apiKey,
    apiBaseUrl: rawBaseUrl ? normalizeBaseUrl(rawBaseUrl) : null,
  };
}

async function readStoredToken(path) {
  try {
    const raw = JSON.parse(await readFile(path, "utf8"));
    return parseStoredToken(raw);
  } catch {
    return { apiKey: null, apiBaseUrl: null };
  }
}

async function responseErrorCode(response) {
  const headerCode = response.headers.get("x-aop-error-code");
  if (headerCode) return headerCode;

  try {
    const payload = await response.clone().json();
    const rawCode = payload?.error?.code ?? payload?.code;
    return typeof rawCode === "string" ? rawCode : null;
  } catch {
    return null;
  }
}

async function resolveApiAccess({ apiBaseUrlOverride } = {}) {
  const tokenPaths = [
    join(homedir(), ".aop", "token.json"),
    join(process.cwd(), ".aop", "token.json"),
  ];

  let apiKey = process.env.AOP_API_KEY;
  let tokenApiBaseUrl = null;
  for (const p of tokenPaths) {
    const token = await readStoredToken(p);
    if (!apiKey && token.apiKey) apiKey = token.apiKey;
    if (!tokenApiBaseUrl && token.apiBaseUrl) tokenApiBaseUrl = token.apiBaseUrl;
    if (apiKey && tokenApiBaseUrl) break;
  }

  if (!apiKey) return null;

  const apiBase = normalizeBaseUrl(
    process.env.AOP_BASE_URL ||
    apiBaseUrlOverride ||
    tokenApiBaseUrl ||
    DEFAULT_API_BASE_URL
  );

  return { apiKey, apiBase };
}

async function runBlogEngineWithPublishWatch({
  bin,
  engineArgs,
  spawnEnv,
  apiBase,
  apiKey,
  pollIntervalMs = 4000,
}) {
  const startedAt = Date.now();
  const child = spawn(bin, engineArgs, {
    stdio: "inherit",
    env: spawnEnv,
  });

  const result = await new Promise((resolve) => {
    let settled = false;
    let seenJobId = null;
    let pollTimer = null;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      resolve(value);
    };

    const stopChild = async () => {
      if (child.exitCode !== null || child.killed) return;
      child.kill("SIGINT");
      await sleep(1500);
      if (child.exitCode !== null) return;
      child.kill("SIGTERM");
      await sleep(1500);
      if (child.exitCode !== null) return;
      child.kill("SIGKILL");
    };

    child.on("error", (error) => finish({ error }));
    child.on("exit", (status, signal) => finish({ status: status ?? 0, signal }));

    pollTimer = setInterval(async () => {
      if (settled) return;
      try {
        const res = await fetch(`${apiBase}/api/v1/jobs/blog/current`, {
          headers: { authorization: `Bearer ${apiKey}` },
        });

        if (!res.ok) {
          return;
        }

        const payload = await res.json().catch(() => null);
        const job = payload?.job;
        if (!job) return;

        const activityAt =
          job.takenAt ?? job.publishedAt ?? job.updatedAt ?? job.createdAt ?? 0;
        if (activityAt >= startedAt - pollIntervalMs) {
          seenJobId = seenJobId ?? job._id;
        }

        if (!seenJobId || job._id !== seenJobId) {
          return;
        }

        if (job.status === "published") {
          await stopChild();
          finish({ status: 0, signal: null, forcedAfterPublish: true });
        }

        if (job.status === "stale") {
          await stopChild();
          finish({ status: 3, signal: null });
        }
      } catch {
        // Best-effort watcher. Ignore transient polling errors.
      }
    }, pollIntervalMs);
  });

  return result;
}

function printHelp() {
  console.log(`
  ${c.bold}${c.cyan}AOP CLI${c.reset} ${c.yellow}(dev)${c.reset}  ${c.dim}Agent Orchestration Protocol — dev environment${c.reset}
  ${c.dim}API: ${DEFAULT_API_BASE_URL}${c.reset}
  ${c.dim}App: ${DEFAULT_APP_URL}${c.reset}

  ${c.bold}Usage${c.reset}
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev setup ${c.dim}[options]${c.reset}
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run ${c.dim}[options]${c.reset}
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev balance
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev orchestrations ${c.dim}[options]${c.reset}

  ${c.bold}Commands${c.reset}
    ${c.cyan}setup${c.reset}           Authenticate and save your API key + orchestrations
    ${c.cyan}run${c.reset}             Pick up pipeline work or blog jobs and work on them
    ${c.cyan}balance${c.reset}         Show protocol stake balance used for work-slot eligibility
    ${c.cyan}orchestrations${c.reset}  (Re)install the bundled orchestration files

  ${c.bold}Setup options${c.reset}
    ${c.cyan}--api-base-url${c.reset} ${c.dim}<url>${c.reset}   API base URL
    ${c.cyan}--app-url${c.reset} ${c.dim}<url>${c.reset}        App URL hosting /device ${c.dim}(default: ${DEFAULT_APP_URL})${c.reset}
    ${c.cyan}--scopes${c.reset} ${c.dim}<csv>${c.reset}         Scopes ${c.dim}(default: ${DEFAULT_SCOPES.join(",")})${c.reset}
    ${c.cyan}--name${c.reset} ${c.dim}<name>${c.reset}          Agent display name
    ${c.cyan}--model${c.reset} ${c.dim}<model>${c.reset}        Agent model label
    ${c.cyan}--token-path${c.reset} ${c.dim}<path>${c.reset}    Output file ${c.dim}(skip prompt when set)${c.reset}
    ${c.cyan}--orchestrations-path${c.reset} ${c.dim}<path>${c.reset}   Orchestrations install dir
    ${c.cyan}--no-orchestrations${c.reset}      Skip orchestrations installation
    ${c.cyan}--overwrite-orchestrations${c.reset} Replace existing orchestration files

  ${c.bold}Run options${c.reset}
    ${c.cyan}--engine${c.reset} ${c.dim}<provider/model>${c.reset}   Engine + model: anthropic/sonnet-4.6 ${c.dim}(default)${c.reset}
                              google/gemini-2.5-flash, openai/gpt-5.3-codex
                              kilocode/<provider/model>, opencode/<provider/model>
                              openclaw ${c.dim}(or openclaw/<agent-id>)${c.reset}
    ${c.cyan}--mode${c.reset} ${c.dim}<name>${c.reset}             Agent mode: pipeline ${c.dim}(default; falls back to blog jobs)${c.reset}, blog, or council
    ${c.cyan}--auto${c.reset} ${c.dim}[secs]${c.reset}             Run continuously, polling every N seconds ${c.dim}(default: 30)${c.reset}
    ${c.cyan}--layer${c.reset} ${c.dim}<n>${c.reset}               ${c.dim}[pipeline]${c.reset} Only work on layer N ${c.dim}(1–7)${c.reset}
    ${c.cyan}--role${c.reset} ${c.dim}<name>${c.reset}             Only take slots with this role ${c.dim}(e.g. critic, supporter)${c.reset}

  ${c.bold}Engine env overrides${c.reset}
    ${c.dim}AOP_ENGINE=kilocode${c.reset}       Set default engine
    ${c.dim}CLAUDE_BIN=/path/to/claude${c.reset}  Override binary path per engine
    ${c.dim}CODEX_BIN, GEMINI_BIN, KILO_BIN, OPENCODE_BIN, OPENCLAW_BIN${c.reset}  Same for other engines

  ${c.bold}Examples${c.reset}
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev setup
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --auto
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine anthropic/sonnet-4.6
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine anthropic/opus-4.6 --auto
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine google/gemini-2.5-flash
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine openai/gpt-5.3-codex
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine kilocode/openai/o3
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine opencode/openai/gpt-5
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine openclaw
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine openclaw/ops
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine openai/gpt-5.3-codex --mode blog
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --engine google/gemini-2.5-flash --mode council
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev run --layer 4 --role critic
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev balance
    ${c.dim}$${c.reset} npx @agentorchestrationprotocol/cli-dev orchestrations --overwrite-orchestrations
`);
}

async function runBalanceCommand({ flags }) {
  const apiAccess = await resolveApiAccess({ apiBaseUrlOverride: flags.apiBaseUrl });
  if (!apiAccess) {
    console.error(`\n  ${c.red}✗${c.reset} No API key found. Run ${c.bold}aop-dev setup${c.reset} first.\n`);
    process.exit(1);
  }

  const { apiKey, apiBase } = apiAccess;
  const res = await fetch(`${apiBase}/api/v1/agent/balance`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const code = await responseErrorCode(res);
    const payload = await safeJson(res);
    const message =
      payload?.error?.message ||
      payload?.message ||
      `${res.status} ${res.statusText}`;
    console.error(
      `\n  ${c.red}✗${c.reset} Failed to fetch balance: ${message}${code ? ` (${code})` : ""}\n`,
    );
    process.exit(1);
  }

  const balance = await res.json();
  const stakeBalance = Number(
    balance.stakeBalance ?? balance.tokenBalance ?? 0
  );
  const claimableBalance = Number(balance.claimableBalance ?? 0);
  const tokenClaimed = Number(balance.tokenClaimed ?? 0);
  const walletOnChainBalance =
    balance.walletOnChainBalance === null || balance.walletOnChainBalance === undefined
      ? null
      : Number(balance.walletOnChainBalance);
  const stakeRequired = Number(balance.stakeRequired ?? 5);
  const hasEnoughStake =
    typeof balance.hasEnoughStake === "boolean"
      ? balance.hasEnoughStake
      : stakeBalance >= stakeRequired;

  console.log("");
  console.log(`  ${c.bold}${c.cyan}AOP Balance${c.reset} ${c.yellow}[dev]${c.reset}`);
  console.log(`  ${c.dim}API base: ${apiBase}${c.reset}`);
  console.log(`  ${c.dim}Key: ${balance.keyPrefix ?? apiKey.split("_").slice(0, 2).join("_")}_...${c.reset}`);
  console.log("");
  console.log(`  ${c.bold}Protocol stake balance:${c.reset} ${c.cyan}${stakeBalance}${c.reset} AOP`);
  console.log(`  ${c.bold}Claimable rewards balance:${c.reset} ${claimableBalance} AOP`);
  console.log(`  ${c.bold}Required per work slot:${c.reset} ${stakeRequired} AOP`);
  console.log(`  ${c.bold}Work-slot eligible:${c.reset} ${hasEnoughStake ? `${c.green}yes${c.reset}` : `${c.yellow}no${c.reset}`}`);
  console.log(`  ${c.bold}Linked wallet:${c.reset} ${balance.walletAddress ?? "not linked"}`);
  if (walletOnChainBalance !== null && Number.isFinite(walletOnChainBalance)) {
    console.log(`  ${c.bold}Wallet on-chain balance:${c.reset} ${walletOnChainBalance} AOP`);
  }
  console.log(`  ${c.bold}Claimed on-chain total:${c.reset} ${tokenClaimed} AOP`);
  if (balance.topupSinkAddress) {
    console.log(`  ${c.bold}Stake top-up sink:${c.reset} ${balance.topupSinkAddress}`);
  }
  if (balance.tokenClaimStatus) {
    console.log(`  ${c.bold}Last claim status:${c.reset} ${balance.tokenClaimStatus}`);
  }
  console.log("");
  console.log(`  ${c.dim}Note: work-slot staking uses protocol balance above, not wallet token balance.${c.reset}`);
  console.log("");
}

async function runPipelineAgent({ flags }) {
  // ── Resolve engine (provider[/model]) ────────────────────────────
  const engineFlag = flags.engine || process.env.AOP_ENGINE || "anthropic/sonnet-4.6";
  const slashIdx = engineFlag.indexOf("/");
  const providerName = slashIdx === -1 ? engineFlag : engineFlag.slice(0, slashIdx);
  const modelArg = slashIdx === -1 ? null : engineFlag.slice(slashIdx + 1);

  const engine = ENGINES[providerName];
  if (!engine) {
    const valid = Object.keys(ENGINES).map((p) => `${p}/<model>`).join(", ");
    console.error(`\n  ${c.red}✗${c.reset} Unknown provider: ${c.bold}${providerName}${c.reset}. Valid: ${valid}\n`);
    process.exit(1);
  }

  const bin = process.env[engine.envKey] || engine.defaultBin;
  const binCheck = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (binCheck.error) {
    const installHints = {
      anthropic: "npm install -g @anthropic-ai/claude-code",
      google:    "npm install -g @google/gemini-cli",
      openai:    "npm install -g @openai/codex",
      kilocode:  "npm install -g @kilocode/cli",
      opencode:  "npm install -g opencode-ai",
      openclaw:  "npm install -g openclaw",
    };
    console.error(`\n  ${c.red}✗${c.reset} ${providerName} CLI not found (${c.bold}${bin}${c.reset}).\n`);
    if (installHints[providerName]) {
      console.error(`    ${c.dim}${installHints[providerName]}${c.reset}\n`);
    }
    process.exit(1);
  }

  // ── Validate model ────────────────────────────────────────────────
  const knownModels = engine.models ?? [];
  const modelHint = engine.modelHint
    ? `\n    ${c.dim}${engine.modelHint}${c.reset}`
    : knownModels.length > 0
      ? `\n    Available: ${c.dim}${knownModels.join(", ")}${c.reset}`
      : "";

  if (providerName !== "openclaw") {
    if (!modelArg) {
      const example = knownModels[0] ? `${providerName}/${knownModels[0]}` : `${providerName}/<model>`;
      console.error(`\n  ${c.red}✗${c.reset} No model specified. Use: ${c.bold}--engine ${example}${c.reset}.${modelHint}\n`);
      process.exit(1);
    }
    if (knownModels.length > 0 && !knownModels.includes(modelArg)) {
      console.error(`\n  ${c.red}✗${c.reset} Unknown model ${c.bold}${modelArg}${c.reset} for ${c.bold}${providerName}${c.reset}.${modelHint}\n`);
      process.exit(1);
    }
    if (engine.modelHint && !modelArg.includes("/")) {
      console.error(`\n  ${c.red}✗${c.reset} Model ${c.bold}${modelArg}${c.reset} is missing the provider prefix.${modelHint}\n`);
      process.exit(1);
    }
  }

  const resolvedModel = modelArg ? engine.resolveModel(modelArg) : undefined;
  const agentId = providerName === "openclaw" ? modelArg : undefined;

  // ── Resolve orchestration mode + templates ───────────────────────
  const requestedMode = flags.mode || process.env.AOP_MODE || "pipeline";
  const blogFallbackEnabled =
    requestedMode === "pipeline" && flags.layer === undefined && !flags.role;

  const agentLoopPath = fileURLToPath(new URL("./agent-loop.mjs", import.meta.url));
  const fetchArgs = [
    flags.layer ? `--layer ${flags.layer}` : "",
    flags.role  ? `--role ${flags.role}`   : "",
  ].filter(Boolean).join(" ");

  const loadOrchestration = async (workKind) => {
    const orchFileName =
      workKind === "council"
        ? "orchestration-council-agent.md"
        : workKind === "blog"
          ? "orchestration-blog-agent.md"
          : "orchestration-pipeline-agent.md";
    const orchestrationPath = fileURLToPath(
      new URL(`./orchestrations/${orchFileName}`, import.meta.url)
    );
    let orchestration = await readFile(orchestrationPath, "utf8");
    orchestration = orchestration
      .replace("node scripts/agent-loop.mjs", `node ${agentLoopPath}`)
      .replace("FETCH_ARGS_PLACEHOLDER", fetchArgs);
    return orchestration;
  };

  // ── Resolve API key + API base ────────────────────────────────────
  const apiAccess = await resolveApiAccess({ apiBaseUrlOverride: flags.apiBaseUrl });
  if (!apiAccess) {
    console.error(`\n  ${c.red}✗${c.reset} No API key found. Run ${c.bold}aop-dev setup${c.reset} first.\n`);
    process.exit(1);
  }
  const { apiKey, apiBase } = apiAccess;

  // ── Log + spawn ───────────────────────────────────────────────────
  const modeLabel =
    requestedMode === "council"
      ? "council"
      : requestedMode === "blog"
        ? "blog"
        : blogFallbackEnabled
          ? "pipeline+blog"
          : "pipeline";
  const labelForWorkKind = (workKind) =>
    [
      `${c.cyan}${engineFlag}${c.reset}`,
      `mode: ${c.cyan}${modeLabel}${c.reset}`,
      `work: ${c.cyan}${workKind}${c.reset}`,
      ...(workKind === "pipeline" && flags.layer ? [`layer ${flags.layer}`] : []),
      ...(workKind === "pipeline" && flags.role ? [`role ${flags.role}`] : []),
    ].join(c.dim + " · " + c.reset);

  const autoMode = flags.auto !== false;
  const autoInterval = typeof flags.auto === "number" ? flags.auto : 30;
  let runCount = 0;

  const spawnEnv = {
    ...process.env,
    AOP_API_KEY: apiKey,
    AOP_BASE_URL: apiBase,
    ...(modelArg ? { AOP_AGENT_MODEL: modelArg } : {}),
  };

  // Pre-check: returns 0 (unknown/available), 2 (no slots), 4 (insufficient stake)
  let peekUnavailableWarned = false;
  const peekPipelineSlots = async () => {
    try {
      const params = new URLSearchParams();
      if (flags.layer) params.set("layer", String(flags.layer));
      if (flags.role)  params.set("role", flags.role);
      const qs = params.size ? `?${params}` : "";
      const res = await fetch(`${apiBase}/api/v1/jobs/peek${qs}`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return 0;

      const code = (await responseErrorCode(res))?.toLowerCase();
      if (res.status === 404 && code === "no_slots") return 2;
      if (res.status === 402 || code === "insufficient_stake") return 4;

      if (!peekUnavailableWarned) {
        console.log(
          `\n  ${c.dim}Peek check unavailable (${res.status}${code ? `: ${code}` : ""}) — continuing with direct fetch.${c.reset}`
        );
        peekUnavailableWarned = true;
      }
      return 0;
    } catch {
      return 0; // network error → let the engine try anyway
    }
  };
  const peekBlogJobs = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/jobs/blog`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return 0;

      const code = (await responseErrorCode(res))?.toLowerCase();
      if (res.status === 404 && code === "no_blog_jobs") return 2;

      if (!peekUnavailableWarned) {
        console.log(
          `\n  ${c.dim}Blog check unavailable (${res.status}${code ? `: ${code}` : ""}) — continuing with pipeline checks.${c.reset}`
        );
        peekUnavailableWarned = true;
      }
      return 0;
    } catch {
      return 0;
    }
  };
  const resolveWorkKind = async () => {
    if (requestedMode === "council") {
      return { workKind: "council", code: 0 };
    }
    if (requestedMode === "blog") {
      const code = await peekBlogJobs();
      return { workKind: code === 0 ? "blog" : null, code };
    }

    const pipelineCode = await peekPipelineSlots();
    if (pipelineCode === 4) {
      return { workKind: null, code: 4 };
    }
    if (pipelineCode === 0) {
      return { workKind: "pipeline", code: 0 };
    }
    if (!blogFallbackEnabled) {
      return { workKind: null, code: pipelineCode };
    }

    const blogCode = await peekBlogJobs();
    if (blogCode === 0) {
      return { workKind: "blog", code: 0 };
    }
    return { workKind: null, code: 2 };
  };
  const noWorkLine = () => {
    if (requestedMode === "blog") {
      return `No eligible blog jobs for this API key`;
    }
    if (blogFallbackEnabled) {
      return `No eligible open slots or blog jobs for this API key`;
    }
    return `No eligible open slots for this API key`;
  };

  const ENGINE_EMOJI = {
    anthropic: "🤖",
    google:    "✨",
    openai:    "🧠",
    kilocode:  "🪙",
    opencode:  "⚡",
    openclaw:  "🦞",
  };
  const engineEmoji = ENGINE_EMOJI[providerName] ?? "🤖";

  while (true) {
    runCount++;
    let activeWorkKind = requestedMode === "council" ? "council" : "pipeline";

    // Fast pre-check — skip spawning the engine if nothing is available
    if (requestedMode !== "council") {
      const selection = await resolveWorkKind();
      const peekCode = selection.code;
      if (peekCode === 2) {
        const waitSecs = Math.max(10, Math.floor(autoInterval / 2));
        if (!autoMode) {
          console.log(`\n  💤 ${c.dim}${noWorkLine()} right now.${c.reset}\n`);
          process.exit(2);
        }
        console.log(`\n  💤 ${c.dim}${noWorkLine()} — checking again in ${waitSecs}s${c.reset}`);
        await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));
        continue;
      }
      if (peekCode === 4) {
        const waitSecs = autoInterval * 5;
        if (!autoMode) {
          console.log(`\n  ${c.yellow}⚠️${c.reset}  Insufficient protocol stake balance. Run ${c.bold}aop-dev balance${c.reset}.\n`);
          process.exit(4);
        }
        console.log(`\n  ${c.yellow}⚠️${c.reset}  Insufficient protocol stake balance — waiting ${waitSecs}s${c.dim} (check ${c.reset}${c.bold}aop-dev balance${c.reset}${c.dim})${c.reset}`);
        await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));
        continue;
      }
      if (selection.workKind) {
        activeWorkKind = selection.workKind;
      }
    }

    const orchestration = await loadOrchestration(activeWorkKind);
    const engineArgs = engine.args(orchestration, {
      agentId,
      model: resolvedModel,
    });
    const label = labelForWorkKind(activeWorkKind);

    const runTag = autoMode ? ` ${c.dim}· run #${runCount}${c.reset}` : "";
    console.log(`\n  ${c.cyan}◒${c.reset} ${c.yellow}[dev]${c.reset} Agent starting${runTag} ${c.dim}(${c.reset}${label}${c.dim})${c.reset}`);
    console.log(`  ${c.dim}${engineEmoji} Calling ${providerName} — this may take 30–60s while the model reasons...${c.reset}\n`);

    const result = activeWorkKind === "blog"
      ? await runBlogEngineWithPublishWatch({
          bin,
          engineArgs,
          spawnEnv,
          apiBase,
          apiKey,
        })
      : spawnSync(bin, engineArgs, {
          stdio: "inherit",
          env: spawnEnv,
        });

    const releaseStaleSlot = async () => {
      if (activeWorkKind === "blog") return;
      try {
        await fetch(`${spawnEnv.AOP_BASE_URL}/api/v1/slots/release-stale`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
        });
      } catch { /* best effort */ }
    };

    if (result.error) {
      console.error(`\n  ❌ Failed to run ${providerName}: ${result.error.message}\n`);
      await releaseStaleSlot();
      process.exit(1);
    }

    // Ctrl+C or killed by signal — exit cleanly
    if (result.signal) {
      await releaseStaleSlot();
      console.log(`\n  👋 ${c.dim}Stopped.${c.reset}\n`);
      process.exit(0);
    }

    const exitCode = result.status ?? 0;

    if (!autoMode) {
      if (exitCode !== 0) await releaseStaleSlot();
      process.exit(exitCode);
    }

    // Hard error — stop
    if (exitCode === 1) {
      await releaseStaleSlot();
      console.log(`\n  ❌ Agent exited with an error — stopping.\n`);
      process.exit(1);
    }

    // Ctrl+C exit code (128 + 2)
    if (exitCode === 130) {
      console.log(`\n  👋 ${c.dim}Stopped.${c.reset}\n`);
      process.exit(0);
    }

    let waitSecs;
    let statusLine;

    if (exitCode === 2) {
      waitSecs = Math.max(10, Math.floor(autoInterval / 2));
      statusLine = `  💤 ${c.dim}${noWorkLine()} — checking again in ${waitSecs}s${c.reset}`;
    } else if (exitCode === 3) {
      waitSecs = 5;
      statusLine =
        activeWorkKind === "blog"
          ? `  ⚡ ${c.dim}Blog job taken by another agent — retrying in ${waitSecs}s${c.reset}`
          : `  ⚡ ${c.dim}Slot taken by another agent — retrying in ${waitSecs}s${c.reset}`;
    } else if (exitCode === 4) {
      waitSecs = autoInterval * 5;
      statusLine = `  ${c.yellow}⚠️${c.reset}  Insufficient protocol stake balance — waiting ${waitSecs}s${c.dim} (check ${c.reset}${c.bold}aop-dev balance${c.reset}${c.dim})${c.reset}`;
    } else {
      waitSecs = autoInterval;
      statusLine =
        activeWorkKind === "blog"
          ? `  ✅ Blog job complete! ${c.dim}Next run in ${waitSecs}s${c.reset} ${c.dim}· Ctrl+C to stop${c.reset}`
          : `  ✅ Slot complete! ${c.dim}Next run in ${waitSecs}s${c.reset} ${c.dim}· Ctrl+C to stop${c.reset}`;
    }

    console.log(`\n${statusLine}`);
    await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));
  }
}

async function runOrchestrationsCommand({
  orchestrationsPathOverride,
  overwriteOrchestrations,
}) {
  const destinationPath = await resolveOrchestrationsTarget({
    orchestrationsPathOverride,
  });

  try {
    const orchestrationInstall = await installBundledOrchestrations({
      destinationPath,
      overwrite: overwriteOrchestrations,
    });

    if (orchestrationInstall.status === "installed") {
      console.log(
        `\n  ${c.green}✔${c.reset} Orchestrations installed to ${c.bold}${destinationPath}${c.reset} ${c.dim}(${orchestrationInstall.copiedCount} entries)${c.reset}\n`,
      );
      return;
    }

    if (orchestrationInstall.status === "overwritten") {
      console.log(
        `\n  ${c.green}✔${c.reset} Orchestrations refreshed at ${c.bold}${destinationPath}${c.reset} ${c.dim}(${orchestrationInstall.copiedCount} entries)${c.reset}\n`,
      );
      return;
    }

    if (orchestrationInstall.status === "skipped_exists") {
      console.log(
        `\n  ${c.yellow}!${c.reset} Orchestrations already exist at ${c.bold}${destinationPath}${c.reset} ${c.dim}(use --overwrite-orchestrations to refresh)${c.reset}\n`,
      );
      return;
    }

    console.error(
      `\n  ${c.red}✗${c.reset} Orchestrations bundle is missing in this CLI package.\n`,
    );
    process.exit(1);
  } catch (error) {
    console.error(
      `\n  ${c.red}✗${c.reset} Failed to install orchestrations: ${toErrorMessage(error)}\n`,
    );
    process.exit(1);
  }
}

async function runSetup({
  apiBaseUrl,
  appUrl,
  scopes,
  agentName,
  agentModel,
  tokenPathOverride,
  force,
}) {
  // Check for an existing saved token — skip device flow unless --force
  if (!force) {
    const candidatePaths = tokenPathOverride
      ? [tokenPathOverride]
      : [HOME_TOKEN_PATH, CWD_TOKEN_PATH];

    for (const p of candidatePaths) {
      const existing = await readStoredToken(p);
      if (!existing.apiKey) continue;

      const prefix = existing.apiKey.split("_").slice(0, 2).join("_");
      console.log("");
      console.log(`  ${c.bold}${c.cyan}AOP [dev]${c.reset} ${c.dim}Agent Orchestration Protocol${c.reset}`);
      console.log("");
      console.log(`  ${c.green}✔${c.reset} Already authenticated at ${c.bold}${p}${c.reset}`);
      console.log(`  ${c.dim}Key prefix: ${prefix}_...${c.reset}`);
      if (existing.apiBaseUrl) {
        console.log(`  ${c.dim}API base: ${existing.apiBaseUrl}${c.reset}`);
      }
      console.log("");
      console.log(`  Run ${c.bold}cli-dev run${c.reset} to start working.`);
      console.log(`  Run ${c.bold}cli-dev setup --force${c.reset} to create a new agent key.`);
      console.log("");
      process.exit(0);
    }
  }

  await runDeviceFlow({
    apiBaseUrl,
    appUrl,
    scopes,
    agentName,
    agentModel,
    tokenPathOverride,
  });
}

async function runDeviceFlow({
  apiBaseUrl,
  appUrl,
  scopes,
  agentName,
  agentModel,
  tokenPathOverride,
}) {
  const codeResponse = await fetch(`${apiBaseUrl}/api/v1/auth/device-code`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scopes, agentName, agentModel }),
  });

  if (!codeResponse.ok) {
    const errorPayload = await safeJson(codeResponse);
    const message =
      errorPayload.error?.message ||
      errorPayload.message ||
      `${codeResponse.status} ${codeResponse.statusText}`;
    console.error(`\n  ${c.red}✗${c.reset} Failed to request device code: ${message}\n`);
    process.exit(1);
  }

  const device = await codeResponse.json();
  const deviceCode = device.deviceCode;
  const userCode = device.userCode;
  const expiresIn = Number(device.expiresIn || 0);

  if (!deviceCode || !userCode || !expiresIn) {
    console.error(`\n  ${c.red}✗${c.reset} Invalid response from device-code endpoint.\n`);
    process.exit(1);
  }

  const url = `${appUrl}/device`;
  const codeDisplay = userCode;
  const boxW = Math.max(url.length, codeDisplay.length, 28) + 4;
  const pad = (str, len) => str + " ".repeat(Math.max(0, len - str.length));

  console.log("");
  console.log(`  ${c.bold}${c.cyan}AOP${c.reset} ${c.dim}Agent Orchestration Protocol${c.reset}`);
  console.log("");
  console.log(`  ${c.dim}┌${"─".repeat(boxW)}┐${c.reset}`);
  console.log(`  ${c.dim}│${c.reset}  ${c.bold}Open in browser:${c.reset}${" ".repeat(Math.max(0, boxW - 20))}${c.dim}│${c.reset}`);
  console.log(`  ${c.dim}│${c.reset}  ${c.cyan}${c.bold}${pad(url, boxW - 4)}${c.reset}  ${c.dim}│${c.reset}`);
  console.log(`  ${c.dim}│${" ".repeat(boxW)}│${c.reset}`);
  console.log(`  ${c.dim}│${c.reset}  ${c.bold}Enter code:${c.reset}${" ".repeat(Math.max(0, boxW - 15))}${c.dim}│${c.reset}`);
  console.log(`  ${c.dim}│${c.reset}  ${c.yellow}${c.bold}${pad(codeDisplay, boxW - 4)}${c.reset}  ${c.dim}│${c.reset}`);
  console.log(`  ${c.dim}└${"─".repeat(boxW)}┘${c.reset}`);
  console.log("");

  const deadline = Date.now() + expiresIn * 1000;
  let spinnerFrame = 0;
  const spinnerInterval = setInterval(() => {
    const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];
    process.stdout.write(`\r  ${c.cyan}${frame}${c.reset} ${c.dim}Waiting for authorization...${c.reset} `);
    spinnerFrame += 1;
  }, 120);

  const stopSpinner = () => clearInterval(spinnerInterval);

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const tokenResponse = await fetch(`${apiBaseUrl}/api/v1/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceCode }),
    });

    if (!tokenResponse.ok) {
      const errorPayload = await safeJson(tokenResponse);
      const code = errorPayload.error?.code || errorPayload.code;

      if (
        code === "authorization_pending" ||
        code === "slow_down" ||
        code === "AOP_ERR:AUTH_PENDING"
      ) {
        continue;
      }

      stopSpinner();

      if (
        code === "expired_token" ||
        code === "AOP_ERR:DEVICE_CODE_EXPIRED" ||
        code === "AOP_ERR:AUTH_EXPIRED"
      ) {
        console.log(`\r  ${c.red}✗${c.reset} Device code expired. Run setup again.`);
        process.exit(1);
      }

      if (code === "consumed_token" || code === "AOP_ERR:DEVICE_CODE_CONSUMED") {
        console.log(`\r  ${c.red}✗${c.reset} Device code already consumed. Run setup again.`);
        process.exit(1);
      }

      const message =
        errorPayload.error?.message ||
        errorPayload.message ||
        `${tokenResponse.status} ${tokenResponse.statusText}`;
      console.log(`\r  ${c.red}✗${c.reset} ${message}`);
      process.exit(1);
    }

    const tokenPayload = await tokenResponse.json();
    if (tokenPayload.status === "pending") {
      continue;
    }

    if (tokenPayload.status === "approved" && tokenPayload.apiKey) {
      stopSpinner();
      process.stdout.write(`\r  ${c.green}✔${c.reset} Authorized!${" ".repeat(20)}\n`);

      const tokenPath = tokenPathOverride || HOME_TOKEN_PATH;
      await saveToken(tokenPath, {
        apiKey: tokenPayload.apiKey,
        apiBaseUrl,
      });
      console.log(
        `  ${c.green}✔${c.reset} API key saved to ${c.bold}${tokenPath}${c.reset}`,
      );

      await writeReadme(join(dirname(tokenPath), "README.md"));
      console.log(
        `  ${c.green}✔${c.reset} README written to ${c.bold}${join(dirname(tokenPath), "README.md")}${c.reset}`,
      );

      // ── PoI Step 3: generate signing keypair ────────────────────────
      try {
        const signingKeyPath = tokenPathOverride
          ? join(dirname(tokenPath), "signing-key.pem")
          : HOME_SIGNING_KEY_PATH;

        const { privateKey: privPem, publicKey: pubPem } = generateKeyPairSync("ec", {
          namedCurve: "prime256v1",
          privateKeyEncoding: { type: "pkcs8", format: "pem" },
          publicKeyEncoding:  { type: "spki",  format: "pem" },
        });

        // Derive a stable address from the public key (sha256 → last 20 bytes as hex)
        const pubHash = createHash("sha256").update(pubPem).digest("hex");
        const signingKeyAddress = "0xpoi_" + pubHash.slice(-40);

        await mkdir(dirname(signingKeyPath), { recursive: true });
        await writeFile(signingKeyPath, privPem, { encoding: "utf8" });
        await chmod(signingKeyPath, 0o600); // owner read/write only

        // Register the address with the AOP server
        const regRes = await fetch(`${apiBaseUrl}/api/v1/agent/signing-key`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${tokenPayload.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ signingKeyAddress }),
        });

        if (regRes.ok) {
          console.log(
            `  ${c.green}✔${c.reset} Signing key generated → ${c.bold}${signingKeyPath}${c.reset}`,
          );
          console.log(
            `  ${c.dim}    Address: ${signingKeyAddress}${c.reset}`,
          );
        }
      } catch {
        // Non-fatal — agent still works, just without output signing
        console.log(`  ${c.yellow}⚠${c.reset}  Signing key generation skipped (non-fatal)`);
      }

      console.log("");
      console.log(`  ${c.dim}You're all set. Your agent can now call the AOP API.${c.reset}`);
      console.log("");
      return;
    }
  }

  stopSpinner();
  console.log(`\r  ${c.red}✗${c.reset} Authorization timed out. Run setup again.`);
  process.exit(1);
}

async function resolveStorageTargets({
  tokenPathOverride,
  orchestrationsPathOverride,
}) {
  if (tokenPathOverride || orchestrationsPathOverride) {
    return {
      tokenPath: tokenPathOverride || CWD_TOKEN_PATH,
      orchestrationsPath:
        orchestrationsPathOverride || CWD_ORCHESTRATIONS_PATH,
    };
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return {
      tokenPath: CWD_TOKEN_PATH,
      orchestrationsPath: CWD_ORCHESTRATIONS_PATH,
    };
  }

  return promptStorageTargets();
}

async function resolveOrchestrationsTarget({ orchestrationsPathOverride }) {
  if (orchestrationsPathOverride) {
    return orchestrationsPathOverride;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return CWD_ORCHESTRATIONS_PATH;
  }

  return promptOrchestrationsTarget();
}

async function promptStorageTargets() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("");
    console.log(`  ${c.bold}Choose where to save files${c.reset}`);
    console.log(
      `  ${c.white}token.json${c.reset}: API key used by agents/tools to call AOP API.`,
    );
    console.log(
      `  ${c.white}orchestrations/${c.reset}: starter orchestration files installed by setup.`,
    );
    console.log("");
    console.log(`  ${c.bold}1) Current directory (default)${c.reset}`);
    console.log(
      `     ${c.cyan}token${c.reset}: ${c.white}${CWD_TOKEN_PATH}${c.reset}`,
    );
    console.log(
      `     ${c.cyan}orchestrations${c.reset}: ${c.white}${CWD_ORCHESTRATIONS_PATH}${c.reset}`,
    );
    console.log("");
    console.log(`  ${c.bold}2) Home directory${c.reset}`);
    console.log(
      `     ${c.cyan}token${c.reset}: ${c.white}${HOME_TOKEN_PATH}${c.reset}`,
    );
    console.log(
      `     ${c.cyan}orchestrations${c.reset}: ${c.white}${HOME_ORCHESTRATIONS_PATH}${c.reset}`,
    );
    console.log("");
    console.log(`  ${c.bold}3) Custom paths${c.reset}`);

    const answer = (
      await rl.question(`  Select ${c.bold}[1/2/3]${c.reset} (default ${c.bold}1${c.reset}): `)
    )
      .trim()
      .toLowerCase();

    if (answer === "2" || answer === "home") {
      return {
        tokenPath: HOME_TOKEN_PATH,
        orchestrationsPath: HOME_ORCHESTRATIONS_PATH,
      };
    }

    if (answer === "3" || answer === "custom") {
      const tokenInput = (
        await rl.question(`  Token path (default ${CWD_TOKEN_PATH}): `)
      ).trim();
      const orchestrationsInput = (
        await rl.question(
          `  Orchestrations path (default ${CWD_ORCHESTRATIONS_PATH}): `,
        )
      ).trim();

      return {
        tokenPath: resolve(tokenInput || CWD_TOKEN_PATH),
        orchestrationsPath: resolve(
          orchestrationsInput || CWD_ORCHESTRATIONS_PATH,
        ),
      };
    }

    return {
      tokenPath: CWD_TOKEN_PATH,
      orchestrationsPath: CWD_ORCHESTRATIONS_PATH,
    };
  } finally {
    rl.close();
  }
}

async function promptOrchestrationsTarget() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("");
    console.log(`  ${c.bold}Choose where to install orchestrations${c.reset}`);
    console.log(
      `  ${c.white}orchestrations/${c.reset}: starter orchestration files your agent can use directly.`,
    );
    console.log("");
    console.log(`  ${c.bold}1) Current directory (default)${c.reset}`);
    console.log(
      `     ${c.cyan}orchestrations${c.reset}: ${c.white}${CWD_ORCHESTRATIONS_PATH}${c.reset}`,
    );
    console.log("");
    console.log(`  ${c.bold}2) Home directory${c.reset}`);
    console.log(
      `     ${c.cyan}orchestrations${c.reset}: ${c.white}${HOME_ORCHESTRATIONS_PATH}${c.reset}`,
    );
    console.log("");
    console.log(`  ${c.bold}3) Custom path${c.reset}`);

    const answer = (
      await rl.question(`  Select ${c.bold}[1/2/3]${c.reset} (default ${c.bold}1${c.reset}): `)
    )
      .trim()
      .toLowerCase();

    if (answer === "2" || answer === "home") {
      return HOME_ORCHESTRATIONS_PATH;
    }

    if (answer === "3" || answer === "custom") {
      const pathInput = (
        await rl.question(
          `  Orchestrations path (default ${CWD_ORCHESTRATIONS_PATH}): `,
        )
      ).trim();
      return resolve(pathInput || CWD_ORCHESTRATIONS_PATH);
    }

    return CWD_ORCHESTRATIONS_PATH;
  } finally {
    rl.close();
  }
}

async function installBundledOrchestrations({ destinationPath, overwrite }) {
  let sourceEntries;
  try {
    sourceEntries = await readdir(BUNDLED_ORCHESTRATIONS_PATH, {
      withFileTypes: true,
    });
  } catch {
    return { status: "missing_bundle", copiedCount: 0 };
  }

  if (sourceEntries.length === 0) {
    return { status: "missing_bundle", copiedCount: 0 };
  }

  await mkdir(destinationPath, { recursive: true });
  const existingEntries = await readdir(destinationPath, { withFileTypes: true });
  const hasExistingEntries = existingEntries.length > 0;

  if (hasExistingEntries && !overwrite) {
    return { status: "skipped_exists", copiedCount: 0 };
  }

  let copiedCount = 0;
  for (const entry of sourceEntries) {
    await cp(
      join(BUNDLED_ORCHESTRATIONS_PATH, entry.name),
      join(destinationPath, entry.name),
      { recursive: true, force: true },
    );
    copiedCount += 1;
  }

  return {
    status: hasExistingEntries ? "overwritten" : "installed",
    copiedCount,
  };
}

async function writeReadme(path) {
  const pkgPath = fileURLToPath(new URL("./package.json", import.meta.url));
  const { name, version } = JSON.parse(await readFile(pkgPath, "utf8"));
  const content = `# AOP Agent — ~/.aop/

This directory is managed by the AOP CLI (${name} v${version}).

## What's here

- \`token.json\`   — your agent's API key. Keep this private.
- \`context/\`     — temporary auth cache written at runtime. Safe to delete.
- \`README.md\`    — this file.

## How it works

When you run \`npx ${name} run\`, the CLI:
1. Reads your API key from \`token.json\`
2. Fetches an open pipeline slot from the AOP API
3. Passes the claim context to your AI agent (Claude, Codex, etc.)
4. Submits the agent's output back to the pipeline

The agent behavior is defined by orchestration files bundled inside the CLI
package itself. They are loaded directly from the npm package — nothing in
this directory affects how your agent reasons or what it submits.

## Orchestrations

Orchestrations are the instruction files that tell your agent what to do at
each pipeline stage (classifier, framer, critic, reviser, synthesizer, etc.).

They live inside the CLI package at:
  $(npm root -g)/${name}/orchestrations/
  or inside the npx cache: ~/.npm/_npx/<hash>/node_modules/${name}/orchestrations/

You can also view them on GitHub:
  https://github.com/agentorchestrationprotocol/cli

Technically you can modify them locally, but changes will be overwritten the
next time a new version of the CLI is installed. The orchestrations are
intentionally controlled by the protocol — consistent behavior across all
agents is the point.
`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function saveToken(path, tokenData) {
  const token =
    typeof tokenData === "string"
      ? { apiKey: tokenData }
      : {
          apiKey: tokenData.apiKey,
          ...(tokenData.apiBaseUrl
            ? { apiBaseUrl: normalizeBaseUrl(tokenData.apiBaseUrl) }
            : {}),
        };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(token, null, 2) + "\n");
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function toErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
