import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const DEFAULT_API_BASE_URL = "https://academic-condor-853.convex.site";
const API_BASE_URL = normalizeBaseUrl(
  process.env.AOP_API_BASE_URL ??
    process.env.AOP_API_URL ??
    DEFAULT_API_BASE_URL
);

const RUN_LIVE_INTEGRITY = parseBoolean(process.env.AOP_TEST_RUN_LIVE_INTEGRITY);
const REQUIRE_INTEGRITY_ENV = parseBoolean(process.env.AOP_REQUIRE_INTEGRITY_ENV);
const COMMENT_CREATE_TOKEN = process.env.AOP_TEST_KEY_COMMENT_CREATE;
const INTEGRITY_CLAIM_ID = process.env.AOP_TEST_INTEGRITY_CLAIM_ID;

function parseBoolean(value) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function authHeader(token) {
  return { authorization: `Bearer ${token}` };
}

async function file(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function sectionUntilNextExport(source, startMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Could not find start marker: ${startMarker}`);
  const nextExport = source.indexOf("\nexport const ", start + startMarker.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function apiFetch(pathname, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const headers = new Headers(init.headers ?? {});

  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  try {
    return await fetch(`${API_BASE_URL}${pathname}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getClaim(claimId, token) {
  const response = await apiFetch(`/api/v1/claims/${encodeURIComponent(claimId)}`, {
    method: "GET",
    headers: authHeader(token),
  });
  const body = await readJson(response);
  assert.equal(
    response.status,
    200,
    `Expected 200 from claim fetch, got ${response.status}. Response: ${JSON.stringify(body)}`
  );
  return body;
}

async function getComments(claimId, token) {
  const response = await apiFetch(
    `/api/v1/claims/${encodeURIComponent(claimId)}/comments?sort=new&limit=500`,
    {
      method: "GET",
      headers: authHeader(token),
    }
  );
  const body = await readJson(response);
  assert.equal(
    response.status,
    200,
    `Expected 200 from comments fetch, got ${response.status}. Response: ${JSON.stringify(body)}`
  );
  return body?.items ?? [];
}

async function assertCounterMatchesComments(claimId, token) {
  const [claim, comments] = await Promise.all([
    getClaim(claimId, token),
    getComments(claimId, token),
  ]);
  if (comments.length < 500) {
    assert.equal(
      claim.commentCount,
      comments.length,
      `commentCount mismatch for claim ${claimId}: claim.commentCount=${claim.commentCount} comments.length=${comments.length}`
    );
  }
  return { claim, comments };
}

async function createComment(claimId, token, body, parentCommentId) {
  const payload = parentCommentId ? { body, parentCommentId } : { body };
  const response = await apiFetch(
    `/api/v1/claims/${encodeURIComponent(claimId)}/comments`,
    {
      method: "POST",
      headers: authHeader(token),
      body: JSON.stringify(payload),
    }
  );
  const json = await readJson(response);
  assert.equal(
    response.status,
    200,
    `Expected 200 from comment create, got ${response.status}. Response: ${JSON.stringify(json)}`
  );
  const commentId = json?.commentId ?? null;
  assert.ok(commentId, `Missing commentId in response: ${JSON.stringify(json)}`);
  return commentId;
}

test(
  "integrity env vars are present when enforced",
  { skip: !REQUIRE_INTEGRITY_ENV ? "Set AOP_REQUIRE_INTEGRITY_ENV=1 to enforce in CI." : false },
  () => {
    assert.equal(
      RUN_LIVE_INTEGRITY,
      true,
      "AOP_REQUIRE_INTEGRITY_ENV=1 requires AOP_TEST_RUN_LIVE_INTEGRITY=1."
    );
    assert.ok(
      COMMENT_CREATE_TOKEN,
      "Missing AOP_TEST_KEY_COMMENT_CREATE while AOP_REQUIRE_INTEGRITY_ENV=1."
    );
    assert.ok(
      INTEGRITY_CLAIM_ID,
      "Missing AOP_TEST_INTEGRITY_CLAIM_ID while AOP_REQUIRE_INTEGRITY_ENV=1."
    );
  }
);

test("deleteClaim mutation cascades comments, votes, consensus, and calibrations", async () => {
  const claimsSource = await file("convex/claims.ts");
  const deleteClaimSection = sectionUntilNextExport(
    claimsSource,
    "export const deleteClaim = mutation({"
  );

  assert.match(deleteClaimSection, /\.query\("comments"\)/);
  assert.match(deleteClaimSection, /\.withIndex\("by_claim"/);
  assert.match(deleteClaimSection, /\.query\("commentVotes"\)/);
  assert.match(deleteClaimSection, /\.withIndex\("by_comment"/);
  assert.match(deleteClaimSection, /\.query\("claimVotes"\)/);
  assert.match(deleteClaimSection, /\.query\("claimConsensus"\)/);
  assert.match(deleteClaimSection, /\.query\("claimCalibrations"\)/);
  assert.match(deleteClaimSection, /await ctx\.db\.delete\(args\.id\)/);

  const commentVotesPos = deleteClaimSection.indexOf('.query("commentVotes")');
  const commentsPos = deleteClaimSection.indexOf("await ctx.db.delete(comment._id)");
  const claimVotesPos = deleteClaimSection.indexOf('.query("claimVotes")');
  const consensusPos = deleteClaimSection.indexOf('.query("claimConsensus")');
  const calibrationsPos = deleteClaimSection.indexOf('.query("claimCalibrations")');
  const claimDeletePos = deleteClaimSection.indexOf("await ctx.db.delete(args.id)");

  assert.ok(commentVotesPos !== -1 && commentsPos !== -1 && commentVotesPos < commentsPos);
  assert.ok(claimVotesPos !== -1 && claimVotesPos < claimDeletePos);
  assert.ok(consensusPos !== -1 && consensusPos < claimDeletePos);
  assert.ok(calibrationsPos !== -1 && calibrationsPos < claimDeletePos);
});

test("deleteCommentAsAgent removes descendants and vote artifacts and patches counters", async () => {
  const commentsSource = await file("convex/comments.ts");
  const deleteCommentSection = sectionUntilNextExport(
    commentsSource,
    "export const deleteCommentAsAgent = internalMutation({"
  );

  assert.match(deleteCommentSection, /const children = new Map/);
  assert.match(deleteCommentSection, /const stack: Id<"comments">\[] = \[args\.commentId\]/);
  assert.match(deleteCommentSection, /while \(stack\.length > 0\)/);
  assert.match(deleteCommentSection, /\.query\("commentVotes"\)/);
  assert.match(deleteCommentSection, /await ctx\.db\.delete\(commentId\)/);
  assert.match(
    deleteCommentSection,
    /commentCount:\s*Math\.max\(0,\s*claim\.commentCount - idsToDelete\.length\)/
  );
});

test(
  "optional live integrity: DELETE /api/v1/comments/:id returns 410 Gone",
  {
    skip:
      !RUN_LIVE_INTEGRITY
        ? "Set AOP_TEST_RUN_LIVE_INTEGRITY=1 to enable."
        : !COMMENT_CREATE_TOKEN
          ? "Set AOP_TEST_KEY_COMMENT_CREATE."
          : false,
  },
  async () => {
    const response = await apiFetch(`/api/v1/comments/fake_id`, {
      method: "DELETE",
      headers: authHeader(COMMENT_CREATE_TOKEN),
    });
    assert.equal(
      response.status,
      410,
      `Expected 410 Gone from deprecated delete endpoint, got ${response.status}.`
    );
  }
);

test(
  "optional live integrity: claim routes reject non-claim IDs without 500s",
  {
    skip:
      !RUN_LIVE_INTEGRITY
        ? "Set AOP_TEST_RUN_LIVE_INTEGRITY=1 to enable."
        : !COMMENT_CREATE_TOKEN || !INTEGRITY_CLAIM_ID
          ? "Set AOP_TEST_KEY_COMMENT_CREATE and AOP_TEST_INTEGRITY_CLAIM_ID."
          : false,
  },
  async () => {
    const marker = `integrity-wrong-id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const probeCommentId = await createComment(
      INTEGRITY_CLAIM_ID,
      COMMENT_CREATE_TOKEN,
      `${marker} probe`
    );

    const paths = [
      `/api/v1/claims/${encodeURIComponent(probeCommentId)}`,
      `/api/v1/claims/${encodeURIComponent(probeCommentId)}/comments?sort=top&limit=5`,
      `/api/v1/claims/${encodeURIComponent(probeCommentId)}/consensus`,
      `/api/v1/claims/${encodeURIComponent(probeCommentId)}/calibrations?limit=5`,
    ];

    for (const pathname of paths) {
      const response = await apiFetch(pathname, {
        method: "GET",
        headers: authHeader(COMMENT_CREATE_TOKEN),
      });
      const body = await readJson(response);

      assert.notEqual(
        response.status,
        500,
        `Expected non-500 for wrong-table ID on ${pathname}. Response: ${JSON.stringify(body)}`
      );
      assert.equal(
        response.status,
        404,
        `Expected 404 for wrong-table ID on ${pathname}, got ${response.status}. Response: ${JSON.stringify(body)}`
      );
    }
  }
);
