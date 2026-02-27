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

const COMMENT_CREATE_TOKEN = process.env.AOP_TEST_KEY_COMMENT_CREATE;
const PROVENANCE_CLAIM_ID = process.env.AOP_TEST_PROVENANCE_CLAIM_ID;
const EXPECTED_AGENT_NAME = process.env.AOP_TEST_EXPECTED_AGENT_NAME;
const EXPECTED_AGENT_MODEL = process.env.AOP_TEST_EXPECTED_AGENT_MODEL;

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function authHeader(token) {
  return { authorization: `Bearer ${token}` };
}

async function file(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Could not find start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `Could not find end marker: ${endMarker}`);
  return source.slice(start, end);
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

test("comment API route does not consume request-level agentName overrides", async () => {
  const httpSource = await file("convex/http.ts");
  const commentPostSection = section(
    httpSource,
    'const commentsMatch = pathname.match(/^\\/api\\/v1\\/claims\\/([^/]+)\\/comments$/);',
    'const consensusMatch = pathname.match(/^\\/api\\/v1\\/claims\\/([^/]+)\\/consensus$/);'
  );

  assert.doesNotMatch(commentPostSection, /payload\?\.agentName/);
  assert.doesNotMatch(commentPostSection, /\bagentName\b/);
  assert.match(commentPostSection, /postCommentWithKey/);
});

test("postCommentWithKey persists identity from API key, not request payload", async () => {
  const agentSource = await file("convex/agent.ts");
  const postCommentSection = section(
    agentSource,
    "export const postCommentWithKey = internalMutation({",
    "export const consumeApiKey = internalMutation({"
  );

  assert.doesNotMatch(postCommentSection, /args\.agentName/);
  assert.doesNotMatch(postCommentSection, /agentName:\s*v\.optional\(v\.string\(\)\)/);
  assert.match(postCommentSection, /authorName:\s*apiKey\.agentName/);
  assert.match(postCommentSection, /agentName:\s*apiKey\.agentName/);
  assert.match(postCommentSection, /authorModel:\s*apiKey\.agentModel/);
});

test("agent model update path backfills claims, comments, and consensus", async () => {
  const agentSource = await file("convex/agent.ts");
  const modelUpdateSection = section(
    agentSource,
    "export const updateApiKeyModel = mutation({",
    "export const revokeApiKey = mutation({"
  );

  assert.match(modelUpdateSection, /\.query\("claims"\)/);
  assert.match(modelUpdateSection, /authorModel:\s*agentModel/);
  assert.match(modelUpdateSection, /\.query\("comments"\)/);
  assert.match(modelUpdateSection, /\.query\("claimConsensus"\)/);
  assert.match(modelUpdateSection, /await ctx\.db\.patch\(row\._id,\s*\{\s*agentModel\s*\}\)/);
});

test("AI rendering uses agent name + model formatter across feed, domain, detail, and threads", async () => {
  const uiFiles = [
    "app/page.tsx",
    "app/d/[domain]/page.tsx",
    "app/d/[domain]/[claimId]/page.tsx",
    "components/ThreadedComments.tsx",
  ];

  for (const relativePath of uiFiles) {
    const source = await file(relativePath);
    assert.match(
      source,
      /formatAgentDisplayName\(/,
      `${relativePath} must render AI authors with formatAgentDisplayName`
    );
  }
});

test(
  "optional live API: comment creation cannot spoof persisted agent identity",
  {
    skip:
      !COMMENT_CREATE_TOKEN || !PROVENANCE_CLAIM_ID || !EXPECTED_AGENT_NAME
        ? "Set AOP_TEST_KEY_COMMENT_CREATE, AOP_TEST_PROVENANCE_CLAIM_ID, AOP_TEST_EXPECTED_AGENT_NAME."
        : false,
  },
  async (t) => {
    let createdCommentId = null;
    t.after(async () => {
      if (!createdCommentId) return;
      await apiFetch(`/api/v1/comments/${createdCommentId}`, {
        method: "DELETE",
        headers: authHeader(COMMENT_CREATE_TOKEN),
      });
    });

    const uniqueBody = `provenance-regression-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createResponse = await apiFetch(
      `/api/v1/claims/${encodeURIComponent(PROVENANCE_CLAIM_ID)}/comments`,
      {
        method: "POST",
        headers: authHeader(COMMENT_CREATE_TOKEN),
        body: JSON.stringify({
          body: uniqueBody,
          agentName: "spoofed-name-should-be-ignored",
        }),
      }
    );
    const createBody = await readJson(createResponse);

    if (createResponse.status === 429) {
      t.skip("Rate limited while creating provenance test comment.");
      return;
    }

    assert.equal(
      createResponse.status,
      200,
      `Expected 200 from comment create, got ${createResponse.status}. Response: ${JSON.stringify(createBody)}`
    );
    createdCommentId = createBody?.commentId ?? null;
    assert.ok(createdCommentId, `Missing commentId in response: ${JSON.stringify(createBody)}`);

    const listResponse = await apiFetch(
      `/api/v1/claims/${encodeURIComponent(PROVENANCE_CLAIM_ID)}/comments?sort=new&limit=100`,
      {
        method: "GET",
        headers: authHeader(COMMENT_CREATE_TOKEN),
      }
    );
    const listBody = await readJson(listResponse);
    assert.equal(
      listResponse.status,
      200,
      `Expected 200 from comment list, got ${listResponse.status}. Response: ${JSON.stringify(listBody)}`
    );

    const item =
      listBody?.items?.find?.((comment) => comment?._id === createdCommentId) ?? null;
    assert.ok(item, `Created comment ${createdCommentId} not found in list response.`);
    assert.equal(
      item.authorName,
      EXPECTED_AGENT_NAME,
      `Comment authorName should match persisted key name, got ${JSON.stringify(item.authorName)}`
    );

    if (EXPECTED_AGENT_MODEL !== undefined) {
      assert.equal(
        item.authorModel ?? null,
        EXPECTED_AGENT_MODEL || null,
        `Comment authorModel mismatch. Expected ${JSON.stringify(EXPECTED_AGENT_MODEL)}, got ${JSON.stringify(item.authorModel)}`
      );
    }
  }
);
