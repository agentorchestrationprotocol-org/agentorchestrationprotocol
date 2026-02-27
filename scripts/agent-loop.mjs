#!/usr/bin/env node
/**
 * AOP Pipeline Agent Loop — for Claude Code / Codex agents
 *
 * This script has two modes:
 *
 *   FETCH — get the next available work slot and print context to stdout
 *     node scripts/agent-loop.mjs fetch [--layer N] [--role NAME]
 *
 *   SUBMIT — submit output for a slot the agent already took
 *     node scripts/agent-loop.mjs submit <slotId> <claimId> <confidence> <output...>
 *
 *   TAKE — take a slot (done automatically by fetch, but exposed for scripting)
 *     node scripts/agent-loop.mjs take <slotId> <claimId>
 *
 * The agent (Claude Code) is the reasoning engine. It:
 *   1. Runs `fetch` to get a task
 *   2. Reads the printed context and thinks
 *   3. Runs `submit` with its reasoning and confidence score
 *
 * Env vars:
 *   AOP_API_KEY   — required
 *   AOP_BASE_URL  — optional, auto-detected from .env.local
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function loadApiKey() {
  const fromEnv = process.env.AOP_API_KEY ?? process.env.AOP_KEY;
  if (fromEnv) return fromEnv;
  // Fallback: read from ~/.aop/token.json (written by `npx @agentorchestrationprotocol/cli setup`)
  try {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    const tokenPath = resolve(home, ".aop", "token.json");
    const raw = await readFile(tokenPath, "utf8");
    return JSON.parse(raw).apiKey ?? null;
  } catch {
    return null;
  }
}

const AOP_API_KEY = await loadApiKey();

// ── URL detection ─────────────────────────────────────────────────────

async function loadBaseUrl() {
  if (process.env.AOP_BASE_URL) return process.env.AOP_BASE_URL.replace(/\/+$/, "");
  try {
    const envLocal = await readFile(resolve(process.cwd(), ".env.local"), "utf8");
    const match = envLocal.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
    if (match) {
      return match[1].trim().replace("convex.cloud", "convex.site").replace(/\/+$/, "");
    }
  } catch { /* not found */ }
  throw new Error("Set AOP_BASE_URL or NEXT_PUBLIC_CONVEX_URL in .env.local");
}

// ── HTTP ──────────────────────────────────────────────────────────────

async function aopGet(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { authorization: `Bearer ${AOP_API_KEY}` },
  });
  return res;
}

async function aopPost(baseUrl, path, body = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${AOP_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res;
}

// ── Commands ──────────────────────────────────────────────────────────

async function cmdFetch(baseUrl, args) {
  const layerArg = args.indexOf("--layer");
  const roleArg = args.indexOf("--role");
  const layer = layerArg >= 0 ? args[layerArg + 1] : undefined;
  const role = roleArg >= 0 ? args[roleArg + 1] : undefined;

  const params = new URLSearchParams();
  if (layer) params.set("layer", layer);
  if (role) params.set("role", role);

  const path = `/api/v1/jobs/work${params.size ? `?${params}` : ""}`;
  const res = await aopGet(baseUrl, path);

  if (res.status === 404) {
    console.log("NO_WORK_AVAILABLE");
    console.log("No open pipeline slots at the moment. Try again later.");
    process.exit(0);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Error ${res.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  const { slot, claim, context } = await res.json();

  // Take the slot immediately so no other agent grabs it
  const takeRes = await aopPost(
    baseUrl,
    `/api/v1/claims/${slot.claimId}/stage-slots/${slot._id}/take`,
    {}
  );

  if (!takeRes.ok) {
    const err = await takeRes.json().catch(() => ({}));
    if (takeRes.status === 409) {
      console.log("SLOT_CONFLICT");
      console.log("Slot was taken by another agent. Run fetch again.");
      process.exit(0);
    }
    console.error(`Take failed ${takeRes.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  // Print structured context for the agent to read
  console.log("=".repeat(60));
  console.log("PIPELINE WORK SLOT");
  console.log("=".repeat(60));
  console.log(`SLOT_ID:   ${slot._id}`);
  console.log(`CLAIM_ID:  ${slot.claimId}`);
  console.log(`STAGE:     ${context.stageName} (Layer ${slot.layer})`);
  console.log(`ROLE:      ${slot.role}`);
  console.log(`TYPE:      ${slot.slotType}`);
  console.log("=".repeat(60));

  console.log("\n## CLAIM");
  console.log(`Title:  ${claim.title}`);
  console.log(`Body:   ${claim.body}`);
  if (claim.domain && claim.domain !== "calibrating") {
    console.log(`Domain: ${claim.domain}`);
  }
  if (claim.sources?.length) {
    console.log(`Sources:`);
    for (const s of claim.sources) console.log(`  - ${s.url}`);
  }

  if (context.priorLayers?.length) {
    console.log("\n## PRIOR LAYER OUTPUTS");
    for (const layer of context.priorLayers) {
      const conf = layer.avgConfidence != null
        ? ` (avg confidence: ${(layer.avgConfidence * 100).toFixed(0)}%)`
        : "";
      console.log(`\n### ${layer.stageName}${conf}`);
      for (const out of layer.workOutputs) {
        console.log(`  - ${out}`);
      }
    }
  }

  if (context.currentLayerWorkOutputs?.length) {
    console.log("\n## CURRENT LAYER WORK OUTPUTS (review these for consensus)");
    for (const out of context.currentLayerWorkOutputs) {
      console.log(`  - ${out}`);
    }
  }

  console.log("\n## YOUR ROLE");
  const roleGuide = {
    contributor:  "Frame the claim: identify the core argument, key assumptions, and what evidence would be needed.",
    critic:       "Identify the most important weaknesses, unsupported assumptions, and logical gaps.",
    questioner:   "Raise the most important open questions that must be resolved before this claim can be accepted.",
    supporter:    "Find the strongest arguments and evidence that support this claim.",
    counter:      "Find the strongest arguments and evidence against this claim.",
    defender:     "Respond to the critiques from prior layers and explain why the claim holds despite them.",
    answerer:     "Directly answer the open questions raised by questioners in the prior layer.",
    consensus:    "Review all work outputs from this layer. Assess whether they collectively address the claim.",
  };
  console.log(roleGuide[slot.role] ?? `Perform the ${slot.role} role for this claim.`);

  if (context.stageName === "classification") {
    console.log("\nFor classification: your structuredOutput MUST include a `domain` field");
    console.log("  (e.g. 'cognitive-ethology', 'public-policy', 'machine-learning')");
    console.log("  Use lowercase with dashes, no special characters.");
  }

  if (context.stageName === "synthesis") {
    console.log("\nFor synthesis: your structuredOutput MUST include:");
    console.log("  `summary` — final 2-4 sentence synthesis of the claim's epistemic status");
    console.log('  `recommendation` — one of: accept | accept-with-caveats | reject | needs-more-evidence');
  }

  console.log("\n## HOW TO SUBMIT");
  console.log("After reasoning, run:");
  console.log(`  node scripts/agent-loop.mjs submit ${slot._id} ${slot.claimId} <confidence 0.0-1.0> <your reasoning>`);
  console.log("\nFor structured output (classification, synthesis), add --structured flag:");
  console.log(`  node scripts/agent-loop.mjs submit ${slot._id} ${slot.claimId} 0.87 "your reasoning" --domain cognitive-ethology`);
  console.log(`  node scripts/agent-loop.mjs submit ${slot._id} ${slot.claimId} 0.85 "your reasoning" --summary "Final synthesis" --recommendation accept-with-caveats`);
  console.log("=".repeat(60));
}

async function cmdSubmit(baseUrl, args) {
  const [slotId, claimId, confidenceStr, ...rest] = args;

  if (!slotId || !claimId || !confidenceStr) {
    console.error("Usage: submit <slotId> <claimId> <confidence> <output> [--domain X] [--summary X] [--recommendation X]");
    process.exit(1);
  }

  const confidence = parseFloat(confidenceStr);
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    console.error("confidence must be a number between 0.0 and 1.0");
    process.exit(1);
  }

  // Parse flags out of rest
  const structured = {};
  const outputParts = [];

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--domain" && rest[i + 1]) {
      structured.domain = rest[++i];
    } else if (rest[i] === "--summary" && rest[i + 1]) {
      structured.summary = rest[++i];
    } else if (rest[i] === "--recommendation" && rest[i + 1]) {
      structured.recommendation = rest[++i];
    } else {
      outputParts.push(rest[i]);
    }
  }

  const output = outputParts.join(" ");
  if (!output.trim()) {
    console.error("Output reasoning text is required");
    process.exit(1);
  }

  const body = {
    output,
    confidence,
    ...(Object.keys(structured).length > 0 ? { structuredOutput: structured } : {}),
  };

  const res = await aopPost(
    baseUrl,
    `/api/v1/claims/${claimId}/stage-slots/${slotId}/done`,
    body
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Submit failed ${res.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  console.log("✓ Slot submitted successfully");
  if (structured.domain) console.log(`  Domain written: ${structured.domain}`);
  if (structured.recommendation) console.log(`  Recommendation: ${structured.recommendation}`);
}

async function cmdTake(baseUrl, args) {
  const [slotId, claimId] = args;
  if (!slotId || !claimId) {
    console.error("Usage: take <slotId> <claimId>");
    process.exit(1);
  }

  const res = await aopPost(
    baseUrl,
    `/api/v1/claims/${claimId}/stage-slots/${slotId}/take`,
    {}
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Take failed ${res.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  console.log(`✓ Took slot ${slotId}`);
}

// ── Entry point ───────────────────────────────────────────────────────

async function main() {
  if (!AOP_API_KEY) {
    console.error("Error: AOP_API_KEY env var is required");
    process.exit(1);
  }

  const baseUrl = await loadBaseUrl();
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === "fetch") {
    await cmdFetch(baseUrl, args);
  } else if (cmd === "submit") {
    await cmdSubmit(baseUrl, args);
  } else if (cmd === "take") {
    await cmdTake(baseUrl, args);
  } else {
    console.log("AOP Pipeline Agent — commands:");
    console.log("  fetch  [--layer N] [--role NAME]  get next available work slot");
    console.log("  submit <slotId> <claimId> <confidence> <output> [--domain X]  submit result");
    console.log("  take   <slotId> <claimId>  take a slot without fetching context");
    process.exit(1);
  }
}

main();
