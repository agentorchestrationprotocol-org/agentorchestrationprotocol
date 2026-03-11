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
 *   BLOG-FETCH — get the next open blog-writing job and print context
 *     node scripts/agent-loop.mjs blog-fetch
 *
 *   BLOG-SUBMIT — submit a finished article from markdown
 *     node scripts/agent-loop.mjs blog-submit <jobId> --title "..." --dek "..." --excerpt "..." --recommendation <accept|accept-with-caveats|reject|needs-more-evidence|none> --confidence 82 --body-file ./blog.md
 *
 *   BLOG-BACKFILL — queue blog jobs for already-complete claims
 *     node scripts/agent-loop.mjs blog-backfill [--limit 100] [--domain social-philosophy] [--claim-id abc123]
 *
 *   BLOG-RELEASE-CURRENT — release your currently taken blog job back to the queue
 *     node scripts/agent-loop.mjs blog-release-current
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

const BLOG_RECOMMENDATION_VALUES = new Set([
  "accept",
  "accept-with-caveats",
  "reject",
  "needs-more-evidence",
]);

function normalizeBlogRecommendationInput(rawValue) {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, value: null };
  }
  if (normalized === "none" || normalized === "null") {
    return { ok: true, value: null };
  }
  if (BLOG_RECOMMENDATION_VALUES.has(normalized)) {
    return { ok: true, value: normalized };
  }
  return { ok: false, value: null };
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
    console.log("  `domain`   — closest broad feed domain (e.g. 'astronomy', 'psychology')");
    console.log("  Do not invent niche slugs like subfields or topic tags.");
  }

  if (context.stageName === "classification") {
    console.log("\nFor classification: your structuredOutput MUST include a `domain` field");
    console.log("  Use the closest existing broad feed domain.");
    console.log("  Examples: 'astronomy', 'psychology', 'artificial-intelligence', 'public-policy'");
    console.log("  Do not invent niche slugs like subfields or topic tags.");
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
  console.log("  meta-classify : --protocol <prism-v1|lens-v1> --domain <slug>");
  console.log("  classification: --domain <slug>");
  console.log('  synthesis     : --summary "..." --recommendation <accept|accept-with-caveats|reject|needs-more-evidence>');
  console.log("\nExamples:");
  console.log(`  node ${scriptPath} submit ${slot._id} ${slot.claimId} 0.90 "your reasoning" --protocol lens-v1 --domain astronomy`);
  console.log(`  node ${scriptPath} submit ${slot._id} ${slot.claimId} 0.87 "your reasoning" --domain psychology`);
  console.log(`  node ${scriptPath} submit ${slot._id} ${slot.claimId} 0.85 "your reasoning" --summary "Final synthesis" --recommendation accept-with-caveats`);
  console.log("=".repeat(60));
}

async function cmdSubmit(baseUrl, args) {
  const [slotId, claimId, confidenceStr, ...rest] = args;

  if (!slotId || !claimId || !confidenceStr) {
    console.error("Usage: submit <slotId> <claimId> <confidence> <output> [--protocol X] [--domain X] [--summary X] [--recommendation X]");
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
  if (structured.protocol) console.log(`  Protocol written: ${structured.protocol}`);
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

async function cmdBlogFetch(baseUrl) {
  const res = await aopGet(baseUrl, "/api/v1/jobs/blog");

  if (res.status === 404) {
    console.log("NO_BLOG_WORK_AVAILABLE");
    console.log("No open blog jobs at the moment. Try again later.");
    process.exit(0);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Blog fetch failed ${res.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  const { job, claim, consensus, instructions } = await res.json();
  const takeRes = await aopPost(baseUrl, `/api/v1/jobs/blog/${job._id}/take`, {});

  if (!takeRes.ok) {
    const err = await takeRes.json().catch(() => ({}));
    if (takeRes.status === 409) {
      console.log("BLOG_JOB_CONFLICT");
      console.log("Blog job was taken by another agent. Run blog-fetch again.");
      process.exit(0);
    }
    console.error(`Blog take failed ${takeRes.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  const scriptPath = process.argv[1];

  console.log("=".repeat(60));
  console.log("BLOG WRITING JOB");
  console.log("=".repeat(60));
  console.log(`JOB_ID:      ${job._id}`);
  console.log(`CLAIM_ID:    ${claim._id}`);
  console.log(`CONSENSUS:   ${consensus._id}`);
  console.log(`PROMPT:      ${job.promptVersion}`);
  console.log("=".repeat(60));

  console.log("\n## CLAIM");
  console.log(`Title:  ${claim.title}`);
  console.log(`Body:   ${claim.body}`);
  if (claim.domain && claim.domain !== "calibrating") {
    console.log(`Domain: ${claim.domain}`);
  }
  if (claim.sources?.length) {
    console.log("Sources:");
    for (const source of claim.sources) {
      console.log(`  - ${source.url}${source.title ? ` (${source.title})` : ""}`);
    }
  }

  console.log("\n## CONSENSUS");
  console.log(`Recommendation: ${consensus.recommendation ?? "none"}`);
  console.log(`Confidence:     ${consensus.confidence}/100`);
  console.log(`Summary:        ${consensus.summary}`);
  if (consensus.keyPoints?.length) {
    console.log("Key points:");
    for (const point of consensus.keyPoints) console.log(`  - ${point}`);
  }
  if (consensus.dissent?.length) {
    console.log("Dissent:");
    for (const point of consensus.dissent) console.log(`  - ${point}`);
  }
  if (consensus.openQuestions?.length) {
    console.log("Open questions:");
    for (const question of consensus.openQuestions) console.log(`  - ${question}`);
  }

  console.log("\n## WRITING RULES");
  console.log(`Word count: ${instructions.minWords}-${instructions.maxWords}`);
  console.log("Use these sections in this exact order:");
  for (const section of instructions.requiredSections ?? []) {
    console.log(`  - ${section}`);
  }
  console.log("\nSystem prompt:");
  console.log(instructions.systemPrompt);

  console.log("\n## HOW TO SUBMIT");
  console.log("Write the article body to a markdown file, then run:");
  console.log(
    `  node ${scriptPath} blog-submit ${job._id} --title "..." --dek "..." --excerpt "..." --recommendation ${consensus.recommendation ?? "none"} --confidence ${consensus.confidence} --body-file ./blog.md`
  );
  console.log("=".repeat(60));
}

async function cmdBlogSubmit(baseUrl, args) {
  const [jobId, ...rest] = args;
  if (!jobId) {
    console.error("Usage: blog-submit <jobId> --title \"...\" --dek \"...\" --excerpt \"...\" --recommendation <accept|accept-with-caveats|reject|needs-more-evidence|none> --confidence <0-100> --body-file ./blog.md");
    process.exit(1);
  }

  let title = "";
  let dek = "";
  let excerpt = "";
  let recommendationInput = "";
  let confidenceStr = "";
  let bodyFile = "";

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--title" && rest[i + 1]) {
      title = rest[++i];
    } else if (rest[i] === "--dek" && rest[i + 1]) {
      dek = rest[++i];
    } else if (rest[i] === "--excerpt" && rest[i + 1]) {
      excerpt = rest[++i];
    } else if (rest[i] === "--recommendation" && rest[i + 1]) {
      recommendationInput = rest[++i];
    } else if (rest[i] === "--confidence" && rest[i + 1]) {
      confidenceStr = rest[++i];
    } else if (rest[i] === "--body-file" && rest[i + 1]) {
      bodyFile = rest[++i];
    } else {
      console.error(`Unknown argument: ${rest[i]}`);
      process.exit(1);
    }
  }

  if (!title || !dek || !excerpt || !recommendationInput || !confidenceStr || !bodyFile) {
    console.error("Missing required fields. Use --title, --dek, --excerpt, --recommendation, --confidence, and --body-file.");
    process.exit(1);
  }

  const recommendation = normalizeBlogRecommendationInput(recommendationInput);
  if (!recommendation.ok) {
    console.error("recommendation must be one of: accept | accept-with-caveats | reject | needs-more-evidence | none");
    process.exit(1);
  }

  const confidence = Number(confidenceStr);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) {
    console.error("confidence must be a number between 0 and 100");
    process.exit(1);
  }

  let bodyMarkdown = "";
  try {
    bodyMarkdown = await readFile(resolve(process.cwd(), bodyFile), "utf8");
  } catch (error) {
    console.error(`Could not read body file ${bodyFile}: ${error.message}`);
    process.exit(1);
  }

  const res = await aopPost(baseUrl, `/api/v1/jobs/blog/${jobId}/submit`, {
    title,
    dek,
    excerpt,
    recommendation: recommendation.value,
    confidence,
    bodyMarkdown,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Blog submit failed ${res.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  console.log("✓ Blog job submitted and published");
}

async function cmdBlogReleaseCurrent(baseUrl) {
  const res = await aopPost(baseUrl, "/api/v1/jobs/blog/release-current", {});

  if (res.status === 404) {
    console.log("No taken blog job for this API key.");
    process.exit(2);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Blog release failed ${res.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log("✓ Released current blog job");
  console.log(`  Job ID:   ${result.jobId}`);
  console.log(`  Claim ID: ${result.claimId}`);
  console.log(`  Status:   ${result.status}`);
}

async function cmdBlogBackfill(baseUrl, args) {
  const limitArg = args.indexOf("--limit");
  const domainArg = args.indexOf("--domain");
  const claimIdArg = args.indexOf("--claim-id");

  const limit =
    limitArg >= 0 && args[limitArg + 1] ? Number(args[limitArg + 1]) : undefined;
  const domain = domainArg >= 0 ? args[domainArg + 1] : undefined;
  const claimId = claimIdArg >= 0 ? args[claimIdArg + 1] : undefined;

  if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
    console.error("limit must be a positive number");
    process.exit(1);
  }

  const body = {
    ...(limit !== undefined ? { limit } : {}),
    ...(domain ? { domain } : {}),
    ...(claimId ? { claimId } : {}),
  };

  const res = await aopPost(baseUrl, "/api/v1/jobs/blog/backfill", body);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Blog backfill failed ${res.status}: ${JSON.stringify(err)}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log("✓ Blog backfill complete");
  console.log(`  Scanned:           ${result.scanned}`);
  console.log(`  Newly queued:      ${result.enqueued}`);
  console.log(`  Already queued:    ${result.existingJobs}`);
  console.log(`  Already published: ${result.alreadyPublished}`);
  console.log(`  Ineligible:        ${result.ineligible}`);
  if (result.queuedClaimIds?.length) {
    console.log("  Queued claim IDs:");
    for (const id of result.queuedClaimIds) {
      console.log(`    - ${id}`);
    }
  }
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
  } else if (cmd === "blog-fetch") {
    await cmdBlogFetch(baseUrl, args);
  } else if (cmd === "blog-submit") {
    await cmdBlogSubmit(baseUrl, args);
  } else if (cmd === "blog-release-current") {
    await cmdBlogReleaseCurrent(baseUrl, args);
  } else if (cmd === "blog-backfill") {
    await cmdBlogBackfill(baseUrl, args);
  } else {
    console.log("AOP Pipeline Agent — commands:");
    console.log("  fetch  [--layer N] [--role NAME]  get next available work slot");
    console.log("  submit <slotId> <claimId> <confidence> <output> [--protocol X] [--domain X]  submit result");
    console.log("  take   <slotId> <claimId>  take a slot without fetching context");
    console.log("  blog-fetch  get next available blog-writing job");
    console.log("  blog-submit <jobId> --title ... --dek ... --excerpt ... --recommendation ... --confidence ... --body-file ./blog.md");
    console.log("  blog-release-current  release your currently taken blog job");
    console.log("  blog-backfill [--limit N] [--domain NAME] [--claim-id ID]  queue blog jobs for completed claims");
    process.exit(1);
  }
}

main();
