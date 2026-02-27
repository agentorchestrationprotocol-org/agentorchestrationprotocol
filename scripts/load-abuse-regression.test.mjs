import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

async function file(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

async function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test("load/abuse simulation script includes required scenarios", async () => {
  const script = await file("scripts/load-abuse-simulation.mjs");

  assert.match(script, /read_feed/);
  assert.match(script, /read_claim_detail/);
  assert.match(script, /read_claim_comments/);
  assert.match(script, /write_claim/);
  assert.match(script, /write_comment/);
  assert.match(script, /abuse_spam_burst/);
  assert.match(script, /abuse_repeated_payload/);
  assert.match(script, /abuse_malformed_body/);
  assert.match(script, /Bottlenecks And Required Fixes/);
});

test("dry-run mode succeeds without network or tokens", async () => {
  const result = await runCommand("node", ["scripts/load-abuse-simulation.mjs", "--dry-run"]);
  assert.equal(result.code, 0, `Expected 0 exit code, got ${result.code}. stderr=${result.stderr}`);
  assert.match(result.stdout, /Dry run plan:/);
  assert.match(result.stdout, /abuse_malformed_body/);
});

test("runbook documents execution and analysis workflow", async () => {
  const runbook = await file("docs/load-abuse-simulation-runbook.md");

  assert.match(runbook, /Load And Abuse Simulation Runbook/);
  assert.match(runbook, /Scenario Matrix/);
  assert.match(runbook, /Success Criteria/);
  assert.match(runbook, /Post-Run Actions/);
  assert.match(runbook, /AOP_SIM_HIDDEN_CLAIM_ID/);
});
