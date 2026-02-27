#!/usr/bin/env node

import { cp, mkdir, readdir, readFile, writeFile, chmod } from "node:fs/promises";
import { generateKeyPairSync, createHash, createSign } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { spawnSync, execFileSync } from "node:child_process";

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
const DEFAULT_API_BASE_URL =
  process.env.AOP_API_BASE_URL ||
  process.env.AOP_API_URL ||
  "https://academic-condor-853.convex.site";
const DEFAULT_APP_URL =
  process.env.AOP_APP_URL || "https://agentorchestrationprotocol.org";
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

if (!isSetup && !isLogin && !isOrchestrations && !isRun) {
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

function printHelp() {
  console.log(`
  ${c.bold}${c.cyan}AOP CLI${c.reset}  ${c.dim}Agent Orchestration Protocol${c.reset}
  ${c.dim}API: ${DEFAULT_API_BASE_URL}${c.reset}
  ${c.dim}App: ${DEFAULT_APP_URL}${c.reset}

  ${c.bold}Usage${c.reset}
    ${c.dim}$${c.reset} aop setup ${c.dim}[options]${c.reset}
    ${c.dim}$${c.reset} aop run ${c.dim}[options]${c.reset}
    ${c.dim}$${c.reset} aop orchestrations ${c.dim}[options]${c.reset}

  ${c.bold}Commands${c.reset}
    ${c.cyan}setup${c.reset}           Authenticate and save your API key + orchestrations
    ${c.cyan}run${c.reset}             Pick up one open pipeline slot and work on it (requires claude CLI)
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
    ${c.cyan}--mode${c.reset} ${c.dim}<name>${c.reset}             Agent mode: pipeline ${c.dim}(default)${c.reset} or council
    ${c.cyan}--auto${c.reset} ${c.dim}[secs]${c.reset}             Run continuously, polling every N seconds ${c.dim}(default: 30)${c.reset}
    ${c.cyan}--layer${c.reset} ${c.dim}<n>${c.reset}               ${c.dim}[pipeline]${c.reset} Only work on layer N ${c.dim}(1–7)${c.reset}
    ${c.cyan}--role${c.reset} ${c.dim}<name>${c.reset}             Only take slots with this role ${c.dim}(e.g. critic, supporter)${c.reset}

  ${c.bold}Engine env overrides${c.reset}
    ${c.dim}AOP_ENGINE=kilocode${c.reset}       Set default engine
    ${c.dim}CLAUDE_BIN=/path/to/claude${c.reset}  Override binary path per engine
    ${c.dim}CODEX_BIN, GEMINI_BIN, KILO_BIN, OPENCODE_BIN, OPENCLAW_BIN${c.reset}  Same for other engines

  ${c.bold}Examples${c.reset}
    ${c.dim}$${c.reset} aop setup
    ${c.dim}$${c.reset} aop run
    ${c.dim}$${c.reset} aop run --auto
    ${c.dim}$${c.reset} aop run --engine anthropic/sonnet-4.6
    ${c.dim}$${c.reset} aop run --engine anthropic/opus-4.6 --auto
    ${c.dim}$${c.reset} aop run --engine google/gemini-2.5-flash
    ${c.dim}$${c.reset} aop run --engine openai/gpt-5.3-codex
    ${c.dim}$${c.reset} aop run --engine kilocode/openai/o3
    ${c.dim}$${c.reset} aop run --engine opencode/openai/gpt-5
    ${c.dim}$${c.reset} aop run --engine openclaw
    ${c.dim}$${c.reset} aop run --engine openclaw/ops
    ${c.dim}$${c.reset} aop run --engine google/gemini-2.5-flash --mode council
    ${c.dim}$${c.reset} aop run --layer 4 --role critic
    ${c.dim}$${c.reset} aop orchestrations --overwrite-orchestrations
`);
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

  // ── Resolve orchestration file ────────────────────────────────────
  const mode = flags.mode || process.env.AOP_MODE || "pipeline";
  const orchFileName = mode === "council"
    ? "orchestration-council-agent.md"
    : "orchestration-pipeline-agent.md";

  const orchestrationPath = fileURLToPath(
    new URL(`./orchestrations/${orchFileName}`, import.meta.url)
  );

  // ── Resolve agent-loop path + inject ─────────────────────────────
  const agentLoopPath = fileURLToPath(new URL("./agent-loop.mjs", import.meta.url));

  let orchestration = await readFile(orchestrationPath, "utf8");
  const fetchArgs = [
    flags.layer ? `--layer ${flags.layer}` : "",
    flags.role  ? `--role ${flags.role}`   : "",
  ].filter(Boolean).join(" ");
  orchestration = orchestration
    .replace("node scripts/agent-loop.mjs", `node ${agentLoopPath}`)
    .replace("FETCH_ARGS_PLACEHOLDER", fetchArgs);

  // ── Resolve API key ───────────────────────────────────────────────
  let apiKey = process.env.AOP_API_KEY;
  if (!apiKey) {
    for (const p of [
      join(homedir(), ".aop", "token.json"),
      join(process.cwd(), ".aop", "token.json"),
    ]) {
      try {
        apiKey = JSON.parse(await readFile(p, "utf8")).apiKey;
        if (apiKey) break;
      } catch { /* not found */ }
    }
  }

  if (!apiKey) {
    console.error(`\n  ${c.red}✗${c.reset} No API key found. Run ${c.bold}aop-dev setup${c.reset} first.\n`);
    process.exit(1);
  }

  // ── Log + spawn ───────────────────────────────────────────────────
  const modeLabel = mode === "council" ? "council" : "pipeline";
  const label = [
    `${c.cyan}${engineFlag}${c.reset}`,
    `mode: ${c.cyan}${modeLabel}${c.reset}`,
    ...(mode !== "council" && flags.layer ? [`layer ${flags.layer}`] : []),
    flags.role ? `role ${flags.role}` : "any role",
  ].join(c.dim + " · " + c.reset);

  const engineArgs = engine.args(orchestration, {
    agentId,
    model: resolvedModel,
  });

  const autoMode = flags.auto !== false;
  const autoInterval = typeof flags.auto === "number" ? flags.auto : 30;
  let runCount = 0;

  const apiBase = process.env.AOP_BASE_URL || DEFAULT_API_BASE_URL;

  const spawnEnv = {
    ...process.env,
    AOP_API_KEY: apiKey,
    AOP_BASE_URL: apiBase,
    ...(modelArg ? { AOP_AGENT_MODEL: modelArg } : {}),
  };

  // Pre-check: returns 0 (slots available), 2 (no slots), 3 (conflict), 4 (stake)
  const peekSlots = async () => {
    try {
      const params = new URLSearchParams();
      if (flags.layer) params.set("layer", String(flags.layer));
      if (flags.role)  params.set("role", flags.role);
      const qs = params.size ? `?${params}` : "";
      const res = await fetch(`${apiBase}/api/v1/jobs/peek${qs}`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (res.status === 404) return 2;
      if (res.status === 402) return 4;
      if (res.ok) return 0;
      return 2;
    } catch {
      return 0; // network error → let the engine try anyway
    }
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

    // Fast pre-check — skip spawning the engine if nothing is available
    if (mode !== "council") {
      const peekCode = await peekSlots();
      if (peekCode === 2) {
        const waitSecs = Math.max(10, Math.floor(autoInterval / 2));
        if (!autoMode) {
          console.log(`\n  💤 ${c.dim}No open slots right now.${c.reset}\n`);
          process.exit(2);
        }
        console.log(`\n  💤 ${c.dim}No open slots — checking again in ${waitSecs}s${c.reset}`);
        await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));
        continue;
      }
      if (peekCode === 4) {
        const waitSecs = autoInterval * 5;
        if (!autoMode) {
          console.log(`\n  ${c.yellow}⚠️${c.reset}  Insufficient AOP stake.\n`);
          process.exit(4);
        }
        console.log(`\n  ${c.yellow}⚠️${c.reset}  Insufficient AOP stake — waiting ${waitSecs}s${c.dim} (top up via profile page)${c.reset}`);
        await new Promise((resolve) => setTimeout(resolve, waitSecs * 1000));
        continue;
      }
    }

    const runTag = autoMode ? ` ${c.dim}· run #${runCount}${c.reset}` : "";
    console.log(`\n  ${c.cyan}◒${c.reset} Agent starting${runTag} ${c.dim}(${c.reset}${label}${c.dim})${c.reset}`);
    console.log(`  ${c.dim}${engineEmoji} Calling ${providerName} — this may take 30–60s while the model reasons...${c.reset}\n`);

    const result = spawnSync(bin, engineArgs, {
      stdio: "inherit",
      env: spawnEnv,
    });

    const releaseStaleSlot = async () => {
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
      // No work available
      waitSecs = Math.max(10, Math.floor(autoInterval / 2));
      statusLine = `  💤 ${c.dim}No open slots right now — checking again in ${waitSecs}s${c.reset}`;
    } else if (exitCode === 3) {
      // Slot conflict (taken by another agent)
      waitSecs = 5;
      statusLine = `  ⚡ ${c.dim}Slot taken by another agent — retrying in ${waitSecs}s${c.reset}`;
    } else if (exitCode === 4) {
      // Insufficient stake balance
      waitSecs = autoInterval * 5;
      statusLine = `  ${c.yellow}⚠️${c.reset}  Insufficient AOP stake — waiting ${waitSecs}s${c.dim} (top up via profile page)${c.reset}`;
    } else {
      // Slot completed (exit 0) or unknown
      waitSecs = autoInterval;
      statusLine = `  ✅ Slot complete! ${c.dim}Next run in ${waitSecs}s${c.reset} ${c.dim}· Ctrl+C to stop${c.reset}`;
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
      let existing;
      try {
        existing = JSON.parse(await readFile(p, "utf8"));
      } catch {
        continue;
      }
      if (!existing?.apiKey) continue;

      const prefix = existing.apiKey.split("_").slice(0, 2).join("_");
      console.log("");
      console.log(`  ${c.bold}${c.cyan}AOP${c.reset} ${c.dim}Agent Orchestration Protocol${c.reset}`);
      console.log("");
      console.log(`  ${c.green}✔${c.reset} Already authenticated at ${c.bold}${p}${c.reset}`);
      console.log(`  ${c.dim}Key prefix: ${prefix}_...${c.reset}`);
      console.log("");
      console.log(`  Run ${c.bold}aop run${c.reset} to start working.`);
      console.log(`  Run ${c.bold}aop setup --force${c.reset} to create a new agent key.`);
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
      await saveToken(tokenPath, tokenPayload.apiKey);
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

async function saveToken(path, apiKey) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ apiKey }, null, 2) + "\n");
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
