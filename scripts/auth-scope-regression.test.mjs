import assert from "node:assert/strict";
import test from "node:test";

const DEFAULT_API_BASE_URL = "https://academic-condor-853.convex.site";
const API_BASE_URL = normalizeBaseUrl(
  process.env.AOP_API_BASE_URL ??
    process.env.AOP_API_URL ??
    DEFAULT_API_BASE_URL
);

const COMMENT_CREATE_TOKEN = process.env.AOP_TEST_KEY_COMMENT_CREATE;
const CLAIM_NEW_TOKEN = process.env.AOP_TEST_KEY_CLAIM_NEW;
const CONSENSUS_WRITE_TOKEN = process.env.AOP_TEST_KEY_CONSENSUS_WRITE;
const REQUIRE_SCOPE_KEYS = parseBoolean(process.env.AOP_REQUIRE_SCOPE_KEYS);

const RUN_RATE_LIMIT_TEST = parseBoolean(process.env.AOP_TEST_RUN_RATE_LIMIT);
const RATE_LIMIT_TOKEN = process.env.AOP_TEST_KEY_RATE_LIMIT;
const RATE_LIMIT_BURST = parseInteger(process.env.AOP_TEST_RATE_LIMIT_BURST, 20);

function parseBoolean(value) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseInteger(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function authHeader(token) {
  return { authorization: `Bearer ${token}` };
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function apiFetch(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  const headers = new Headers(init.headers ?? {});

  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function assertError(response, expected) {
  const body = await readJson(response);
  const payload = JSON.stringify(body);

  assert.equal(
    response.status,
    expected.status,
    `Expected status ${expected.status}, got ${response.status}. Response: ${payload}`
  );
  assert.ok(
    body && typeof body === "object" && body.error,
    `Expected error payload. Response: ${payload}`
  );
  assert.equal(
    body.error.code,
    expected.code,
    `Expected error code ${expected.code}, got ${body.error?.code}. Response: ${payload}`
  );

  if (expected.messageIncludes) {
    assert.ok(
      typeof body.error.message === "string" &&
        body.error.message.includes(expected.messageIncludes),
      `Expected error message to include "${expected.messageIncludes}". Response: ${payload}`
    );
  }

  return body;
}

test(
  "scope key env vars are present when enforced",
  { skip: !REQUIRE_SCOPE_KEYS ? "Set AOP_REQUIRE_SCOPE_KEYS=1 to enforce in CI." : false },
  () => {
    assert.ok(
      COMMENT_CREATE_TOKEN,
      "Missing AOP_TEST_KEY_COMMENT_CREATE while AOP_REQUIRE_SCOPE_KEYS=1."
    );
    assert.ok(CLAIM_NEW_TOKEN, "Missing AOP_TEST_KEY_CLAIM_NEW while AOP_REQUIRE_SCOPE_KEYS=1.");
    assert.ok(
      CONSENSUS_WRITE_TOKEN,
      "Missing AOP_TEST_KEY_CONSENSUS_WRITE while AOP_REQUIRE_SCOPE_KEYS=1."
    );
  }
);

test("missing bearer token is rejected on protected routes", async () => {
  const response = await apiFetch("/api/v1/claims?limit=1");
  await assertError(response, {
    status: 401,
    code: "missing_token",
    messageIncludes: "Missing bearer token",
  });
});

test(
  "claim:new scope enforcement",
  {
    skip:
      !COMMENT_CREATE_TOKEN || !CLAIM_NEW_TOKEN
        ? "Set AOP_TEST_KEY_COMMENT_CREATE and AOP_TEST_KEY_CLAIM_NEW."
        : false,
  },
  async () => {
    const missingScope = await apiFetch("/api/v1/claims", {
      method: "POST",
      headers: authHeader(COMMENT_CREATE_TOKEN),
      body: JSON.stringify({}),
    });

    await assertError(missingScope, {
      status: 403,
      code: "auth_error",
      messageIncludes: "Missing scope",
    });

    const hasScope = await apiFetch("/api/v1/claims", {
      method: "POST",
      headers: authHeader(CLAIM_NEW_TOKEN),
      body: JSON.stringify({}),
    });

    const body = await readJson(hasScope);
    assert.notEqual(
      hasScope.status,
      403,
      `AOP_TEST_KEY_CLAIM_NEW appears to be missing claim:new. Response: ${JSON.stringify(body)}`
    );
    assert.ok(
      hasScope.status === 400 || hasScope.status === 429,
      `Expected 400 (invalid payload) or 429 (claim action limited), got ${hasScope.status}. Response: ${JSON.stringify(body)}`
    );
  }
);

test(
  "comment:create scope enforcement",
  {
    skip:
      !COMMENT_CREATE_TOKEN || !CLAIM_NEW_TOKEN
        ? "Set AOP_TEST_KEY_COMMENT_CREATE and AOP_TEST_KEY_CLAIM_NEW."
        : false,
  },
  async () => {
    const missingScope = await apiFetch("/api/v1/comments/not-a-real-comment", {
      method: "DELETE",
      headers: authHeader(CLAIM_NEW_TOKEN),
    });

    await assertError(missingScope, {
      status: 403,
      code: "auth_error",
      messageIncludes: "Missing scope",
    });

    const hasScope = await apiFetch("/api/v1/comments/not-a-real-comment", {
      method: "DELETE",
      headers: authHeader(COMMENT_CREATE_TOKEN),
    });

    const body = await readJson(hasScope);
    assert.notEqual(
      hasScope.status,
      403,
      `AOP_TEST_KEY_COMMENT_CREATE appears to be missing comment:create. Response: ${JSON.stringify(body)}`
    );
    assert.ok(
      hasScope.status === 400 || hasScope.status === 404,
      `Expected 400/404 for non-existent comment, got ${hasScope.status}. Response: ${JSON.stringify(body)}`
    );
  }
);

test(
  "consensus:write scope enforcement",
  {
    skip:
      !COMMENT_CREATE_TOKEN || !CONSENSUS_WRITE_TOKEN
        ? "Set AOP_TEST_KEY_COMMENT_CREATE and AOP_TEST_KEY_CONSENSUS_WRITE."
        : false,
  },
  async () => {
    const payload = {
      summary: "Regression check",
      keyPoints: ["Scope enforcement works"],
    };

    const missingScope = await apiFetch("/api/v1/claims/not-a-real-claim/consensus", {
      method: "POST",
      headers: authHeader(COMMENT_CREATE_TOKEN),
      body: JSON.stringify(payload),
    });

    await assertError(missingScope, {
      status: 403,
      code: "auth_error",
      messageIncludes: "Missing scope",
    });

    const hasScope = await apiFetch("/api/v1/claims/not-a-real-claim/consensus", {
      method: "POST",
      headers: authHeader(CONSENSUS_WRITE_TOKEN),
      body: JSON.stringify(payload),
    });

    const body = await readJson(hasScope);
    assert.notEqual(
      hasScope.status,
      403,
      `AOP_TEST_KEY_CONSENSUS_WRITE appears to be missing consensus:write. Response: ${JSON.stringify(body)}`
    );
    assert.ok(
      hasScope.status === 400 || hasScope.status === 404,
      `Expected 400/404 for non-existent claim, got ${hasScope.status}. Response: ${JSON.stringify(body)}`
    );
  }
);

test("device token endpoint rejects unknown device codes", async () => {
  const response = await apiFetch("/api/v1/auth/token", {
    method: "POST",
    body: JSON.stringify({ deviceCode: "definitely-invalid-device-code" }),
  });

  await assertError(response, {
    status: 404,
    code: "invalid_device_code",
    messageIncludes: "Unknown device code",
  });
});

test("device code starts in pending status", async () => {
  const createResponse = await apiFetch("/api/v1/auth/device-code", {
    method: "POST",
    body: JSON.stringify({ scopes: ["comment:create"] }),
  });
  const createBody = await readJson(createResponse);

  assert.equal(
    createResponse.status,
    200,
    `Expected 200 when creating device code, got ${createResponse.status}. Response: ${JSON.stringify(createBody)}`
  );
  assert.equal(typeof createBody?.deviceCode, "string");
  assert.ok(createBody.deviceCode.length > 0);

  const tokenResponse = await apiFetch("/api/v1/auth/token", {
    method: "POST",
    body: JSON.stringify({ deviceCode: createBody.deviceCode }),
  });
  const tokenBody = await readJson(tokenResponse);

  assert.equal(
    tokenResponse.status,
    202,
    `Expected 202 pending, got ${tokenResponse.status}. Response: ${JSON.stringify(tokenBody)}`
  );
  assert.equal(tokenBody?.status, "pending");
});

test(
  "optional: api key rate limit enforcement",
  {
    skip: !RUN_RATE_LIMIT_TEST
      ? "Set AOP_TEST_RUN_RATE_LIMIT=1 to enable."
      : !RATE_LIMIT_TOKEN
        ? "Set AOP_TEST_KEY_RATE_LIMIT when enabling rate limit test."
        : false,
  },
  async () => {
    let sawRateLimit = false;

    for (let i = 0; i < RATE_LIMIT_BURST; i += 1) {
      const response = await apiFetch("/api/v1/protocols", {
        method: "GET",
        headers: authHeader(RATE_LIMIT_TOKEN),
      });
      const body = await readJson(response);

      if (response.status === 429) {
        sawRateLimit = true;
        assert.equal(body?.error?.code, "auth_error");
        break;
      }

      assert.equal(
        response.status,
        200,
        `Expected 200 or 429 while probing rate limit, got ${response.status}. Response: ${JSON.stringify(body)}`
      );
    }

    assert.ok(
      sawRateLimit,
      `Did not hit rate limit within ${RATE_LIMIT_BURST} requests. Increase AOP_TEST_RATE_LIMIT_BURST or use a lower-limit key.`
    );
  }
);
