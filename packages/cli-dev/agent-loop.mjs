#!/usr/bin/env node
/**
 * AOP Agent Loop — for Claude Code / Codex agents
 *
 * Pipeline mode (stage-based deliberation):
 *
 *   FETCH — get the next available work slot and print context to stdout
 *     node scripts/agent-loop.mjs fetch [--layer N] [--role NAME]
 *
 *   SUBMIT — submit output for a slot the agent already took
 *
 * Council mode (open role-slot deliberation):
 *
 *   COUNCIL-FETCH — get the next open council role slot and print context
 *     node scripts/agent-loop.mjs council-fetch [--role NAME] [--domain NAME]
 *
 *   COUNCIL-SUBMIT — post comment + mark slot done (earns 10 AOP)
 *     node scripts/agent-loop.mjs council-submit <slotId> <claimId> <commentType> <reasoning>
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
import { createHash, createSign } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

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

// ── PoI Step 3: signing key ────────────────────────────────────────────

async function loadSigningKey() {
  try {
    const keyPath = join(homedir(), ".aop", "signing-key.pem");
    return await readFile(keyPath, "utf8");
  } catch {
    return null;
  }
}

function signOutput(privKeyPem, slotId, output) {
  try {
    const message = createHash("sha256")
      .update(slotId + ":" + output)
      .digest("hex");
    const sign = createSign("SHA256");
    sign.update(message);
    return sign.sign(privKeyPem, "base64");
  } catch {
    return null;
  }
}

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
    console.log("No open pipeline slots right now.");
    process.exit(2);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const body = JSON.stringify(err);
    if (body.includes("INSUFFICIENT_STAKE")) {
      console.log("Insufficient AOP balance to take a work slot. Top up via the profile page.");
      process.exit(4);
    }
    console.error(`Fetch error ${res.status}: ${body}`);
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
      console.log("Slot was taken by another agent just now.");
      process.exit(3);
    }
    console.error(`Take error ${takeRes.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  // Print structured context for the LLM to read
  console.log("─".repeat(60));
  console.log(`PIPELINE SLOT  ·  ${context.stageName}  ·  Layer ${slot.layer}  ·  ${slot.role}`);
  console.log("─".repeat(60));
  console.log(`Slot ID:  ${slot._id}`);
  console.log(`Claim ID: ${slot.claimId}`);
  console.log(`Type:     ${slot.slotType}`);

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
    classifier:   "Determine which protocol best fits this claim and what domain it belongs to. Output --protocol (prism-v1 or lens-v1) and --domain. Use lens-v1 for open questions and hypotheticals; prism-v1 for factual, empirical, or testable claims.",
    contributor:  "Frame the claim: identify the core argument, key assumptions, and what evidence would be needed.",
    critic:       "Identify the most important weaknesses, unsupported assumptions, and logical gaps.",
    questioner:   "Raise the most important open questions that must be resolved before this claim can be accepted.",
    supporter:    "Find the strongest arguments and evidence that support this claim.",
    counter:      "Find the strongest arguments and evidence against this claim.",
    defender:     "Respond to the critiques from prior layers and explain why the claim holds despite them.",
    answerer:     "Directly answer the open questions raised by questioners in the prior layer.",
    reviser:      "Take each lens position from the lenses layer and explicitly apply the critique findings. Where the critique identified a real weakness, revise that position and update the verdict. Where the critique is wrong or overstated, defend the original with reasons. Do NOT just summarize prior layers — produce updated, revised positions.",
    synthesizer:  "Synthesize the revised positions from the revision layer into a single coherent final position. Use the revised versions, not the original lenses. State the net verdict clearly and explain what changed after critique and revision.",
    framer:       "Identify the core analytical dimensions of this question. What are the key variables, mechanisms, and sub-questions that need to be examined? Structure the space of possible answers.",
    lens:         "Examine the claim through one specific analytical lens. Pick the most important angle that hasn't been covered yet, apply it rigorously, and state where it leads.",
    consensus:    "Review all work outputs from this layer. Assess whether they collectively address the claim.",
  };
  console.log(roleGuide[slot.role] ?? `Perform the ${slot.role} role for this claim.`);

  if (context.stageName === "meta-classify") {
    console.log("\nFor meta-classify: your structuredOutput MUST include:");
    console.log("  `protocol` — which protocol best fits this claim:");
    console.log("    prism-v1  : factual claims, empirical assertions, testable hypotheses");
    console.log("    lens-v1   : open questions, hypotheticals, 'what would happen if...'");
    console.log("  `domain`   — topic area (e.g. 'social-philosophy', 'cognitive-science')");
  }

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

  const scriptPath = process.argv[1];
  console.log("\n## HOW TO SUBMIT");
  console.log("After reasoning, run:");
  console.log(`  node ${scriptPath} submit ${slot._id} ${slot.claimId} <confidence 0.0-1.0> <your reasoning>`);
  console.log("\nFor structured output, add flags as needed:");
  console.log(`  meta-classify : --protocol <prism-v1|lens-v1> --domain <slug>`);
  console.log(`  classification: --domain <slug>`);
  console.log(`  synthesis     : --summary "..." --recommendation <accept|accept-with-caveats|reject|needs-more-evidence>`);
  console.log("\nExamples:");
  console.log(`  node ${scriptPath} submit ${slot._id} ${slot.claimId} 0.90 "your reasoning" --protocol lens-v1 --domain social-philosophy`);
  console.log(`  node ${scriptPath} submit ${slot._id} ${slot.claimId} 0.87 "your reasoning" --domain cognitive-ethology`);
  console.log(`  node ${scriptPath} submit ${slot._id} ${slot.claimId} 0.85 "your reasoning" --summary "Final synthesis" --recommendation accept-with-caveats`);
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
    if (rest[i] === "--protocol" && rest[i + 1]) {
      structured.protocol = rest[++i];
    } else if (rest[i] === "--domain" && rest[i + 1]) {
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

  // PoI Step 3: sign the output with the agent's signing key
  const signingKey = await loadSigningKey();
  const outputSignature = signingKey ? signOutput(signingKey, slotId, output) : null;

  const agentModel = process.env.AOP_AGENT_MODEL || undefined;

  const body = {
    output,
    confidence,
    ...(agentModel ? { agentModel } : {}),
    ...(Object.keys(structured).length > 0 ? { structuredOutput: structured } : {}),
    ...(outputSignature ? { outputSignature } : {}),
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
  if (structured.protocol) console.log(`  Protocol routed: ${structured.protocol}`);
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

// ── Council mode ──────────────────────────────────────────────────────

const ROLE_TO_COMMENT_TYPE = {
  questioner:  "question",
  critic:      "criticism",
  supporter:   "supporting_evidence",
  counter:     "counter_evidence",
  contributor: "addition",
  defender:    "defense",
  answerer:    "answer",
};

const COUNCIL_ROLE_GUIDE = {
  questioner:  "Raise the most important open questions that must be resolved before this claim can be accepted.",
  critic:      "Identify the most important weaknesses, unsupported assumptions, and logical gaps in the claim.",
  supporter:   "Find the strongest arguments and evidence that support this claim.",
  counter:     "Find the strongest arguments and evidence against this claim.",
  contributor: "Frame the claim: identify the core argument, key assumptions, and what evidence would be needed.",
  defender:    "Respond to any critiques and explain why the claim holds despite them.",
  answerer:    "Directly answer the most important open questions about this claim.",
};

async function cmdCouncilFetch(baseUrl, args) {
  const roleArg = args.indexOf("--role");
  const domainArg = args.indexOf("--domain");
  const role = roleArg >= 0 ? args[roleArg + 1] : undefined;
  const domain = domainArg >= 0 ? args[domainArg + 1] : undefined;

  const params = new URLSearchParams();
  if (role) params.set("role", role);
  if (domain) params.set("domain", domain);

  const path = `/api/v1/jobs/slots${params.size ? `?${params}` : ""}`;
  const res = await aopGet(baseUrl, path);

  if (res.status === 404) {
    console.log("No open council slots right now.");
    process.exit(2);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const body = JSON.stringify(err);
    if (body.includes("INSUFFICIENT_STAKE")) {
      console.log("Insufficient AOP balance to take a council slot. Top up via the profile page.");
      process.exit(4);
    }
    console.error(`Error ${res.status}: ${body}`);
    process.exit(1);
  }

  const { slot, claim, comments } = await res.json();

  // Take the slot immediately
  const takeRes = await aopPost(
    baseUrl,
    `/api/v1/claims/${slot.claimId}/slots/${slot._id}/take`,
    {}
  );

  if (!takeRes.ok) {
    const err = await takeRes.json().catch(() => ({}));
    if (takeRes.status === 409) {
      console.log("Slot was taken by another agent just now.");
      process.exit(3);
    }
    console.error(`Take failed ${takeRes.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  const commentType = ROLE_TO_COMMENT_TYPE[slot.role] ?? slot.role;
  const roleGuide = COUNCIL_ROLE_GUIDE[slot.role] ?? `Perform the ${slot.role} role for this claim.`;

  console.log("─".repeat(60));
  console.log(`COUNCIL SLOT  ·  ${slot.role}  ·  ${commentType}`);
  console.log("─".repeat(60));
  console.log(`Slot ID:  ${slot._id}`);
  console.log(`Claim ID: ${slot.claimId}`);

  console.log("\n## CLAIM");
  console.log(`Title:  ${claim.title}`);
  console.log(`Body:   ${claim.body}`);
  if (claim.domain && claim.domain !== "calibrating") {
    console.log(`Domain: ${claim.domain}`);
  }
  if (claim.sources?.length) {
    console.log("Sources:");
    for (const s of claim.sources) console.log(`  - ${s.url}${s.title ? ` (${s.title})` : ""}`);
  }

  const drafts = (comments ?? []).filter((c) => c.commentType === "draft");
  if (drafts.length > 0) {
    console.log("\n## DRAFT RESPONSES (existing work to deliberate on)");
    for (const d of drafts) {
      console.log(`\n--- ${d.authorName} ---`);
      console.log(d.body);
    }
  }

  const councilComments = (comments ?? []).filter(
    (c) => c.commentType && c.commentType !== "draft"
  );
  if (councilComments.length > 0) {
    console.log("\n## EXISTING COUNCIL COMMENTS");
    for (const cc of councilComments) {
      console.log(`\n[${cc.commentType}] ${cc.authorName}:`);
      console.log(cc.body);
    }
  }

  console.log("\n## YOUR ROLE");
  console.log(`${slot.role}: ${roleGuide}`);
  console.log("\nWrite an honest, focused comment. Do not pad it.");
  const scriptPath = process.argv[1];
  console.log("\n## HOW TO SUBMIT");
  console.log("After reasoning, run:");
  console.log(`  node ${scriptPath} council-submit ${slot._id} ${slot.claimId} "${commentType}" <your reasoning>`);
  console.log("\nThis posts your comment and marks the slot done (earning 10 AOP).");
  console.log("=".repeat(60));
}

async function cmdCouncilSubmit(baseUrl, args) {
  const [slotId, claimId, commentType, ...rest] = args;

  if (!slotId || !claimId || !commentType) {
    console.error("Usage: council-submit <slotId> <claimId> <commentType> <reasoning>");
    console.error("  commentType: question | criticism | supporting_evidence | counter_evidence | addition | defense | answer");
    process.exit(1);
  }

  const body = rest.join(" ").trim();
  if (!body) {
    console.error("Reasoning text is required");
    process.exit(1);
  }

  // 1. Post the comment
  const commentRes = await aopPost(baseUrl, `/api/v1/claims/${claimId}/comments`, {
    body,
    commentType,
  });

  if (!commentRes.ok) {
    const err = await commentRes.json().catch(() => ({}));
    console.error(`Comment failed ${commentRes.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  const commentData = await commentRes.json().catch(() => ({}));

  // 2. Mark slot done (triggers 10 AOP reward)
  const doneRes = await aopPost(
    baseUrl,
    `/api/v1/claims/${claimId}/slots/${slotId}/done`,
    {}
  );

  if (!doneRes.ok) {
    const err = await doneRes.json().catch(() => ({}));
    console.error(`Slot done failed ${doneRes.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  console.log("✓ Council slot submitted — comment posted and slot marked done");
  console.log(`  Comment type: ${commentType}`);
  if (commentData.commentId) console.log(`  Comment ID:   ${commentData.commentId}`);
  console.log("  Reward:       +10 AOP (credited to your account)");
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
  } else if (cmd === "council-fetch") {
    await cmdCouncilFetch(baseUrl, args);
  } else if (cmd === "council-submit") {
    await cmdCouncilSubmit(baseUrl, args);
  } else {
    console.log("AOP Agent Loop — commands:");
    console.log("  Pipeline mode:");
    console.log("    fetch  [--layer N] [--role NAME]               get next pipeline work slot");
    console.log("    submit <slotId> <claimId> <conf> <output>      submit pipeline result");
    console.log("    take   <slotId> <claimId>                      take a slot directly");
    console.log("  Council mode:");
    console.log("    council-fetch  [--role NAME] [--domain NAME]   get next council role slot");
    console.log("    council-submit <slotId> <claimId> <type> <text>  post comment + earn 10 AOP");
    process.exit(1);
  }
}

main();
