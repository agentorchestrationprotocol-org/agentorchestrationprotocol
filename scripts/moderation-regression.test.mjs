import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();

async function file(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

function sectionUntilNextExport(source, startMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Could not find start marker: ${startMarker}`);
  const nextExport = source.indexOf("\nexport const ", start + startMarker.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

test("schema includes moderation tables and hidden content fields", async () => {
  const schema = await file("convex/schema.ts");

  assert.match(schema, /claims: defineTable\(/);
  assert.match(schema, /isHidden: v\.optional\(v\.boolean\(\)\)/);
  assert.match(schema, /hiddenAt: v\.optional\(v\.number\(\)\)/);
  assert.match(schema, /hiddenByAuthId: v\.optional\(v\.string\(\)\)/);
  assert.match(schema, /hiddenReasonCategory: v\.optional\(v\.string\(\)\)/);
  assert.match(schema, /hiddenNote: v\.optional\(v\.string\(\)\)/);
  assert.match(schema, /moderationReports: defineTable\(/);
  assert.match(schema, /moderationActions: defineTable\(/);
  assert.match(schema, /\.index\("by_status_createdAt"/);
});

test("claim and comment report + moderation actions are implemented", async () => {
  const claims = await file("convex/claims.ts");
  const comments = await file("convex/comments.ts");

  assert.match(claims, /export const reportClaim = mutation\(/);
  assert.match(claims, /export const setClaimModeration = mutation\(/);
  assert.match(claims, /export const listModerationQueue = query\(/);
  assert.match(claims, /export const listModerationActions = query\(/);
  assert.match(claims, /export const resolveModerationReport = mutation\(/);

  assert.match(comments, /export const reportComment = mutation\(/);
  assert.match(comments, /export const setCommentModeration = mutation\(/);
  assert.match(comments, /while \(stack\.length > 0\)/);
});

test("hidden content is filtered in feed/detail/API paths", async () => {
  const claims = await file("convex/claims.ts");
  const comments = await file("convex/comments.ts");
  const http = await file("convex/http.ts");

  const listClaimsSection = sectionUntilNextExport(
    claims,
    "export const listClaims = query({"
  );
  assert.match(listClaimsSection, /filterVisibleClaims/);

  const getClaimSection = sectionUntilNextExport(claims, "export const getClaim = query({");
  assert.match(getClaimSection, /if \(!claim \|\| !claim\.isHidden\)/);
  assert.match(getClaimSection, /return null/);

  const listCommentsSection = sectionUntilNextExport(
    comments,
    "export const listComments = query({"
  );
  assert.match(listCommentsSection, /if \(!claim \|\| claim\.isHidden\)/);
  assert.match(listCommentsSection, /rows\.filter\(\(comment\) => !comment\.isHidden\)/);

  assert.match(http, /Claim not found", "claim_not_found"/);
  assert.ok(
    http.includes('const commentsMatch = pathname.match(/^\\/api\\/v1\\/claims\\/([^/]+)\\/comments$/);'),
    "Expected claim comments route matcher in convex/http.ts"
  );
});

test("profile UI exposes moderation queue and report actions", async () => {
  const profile = await file("app/profile/page.tsx");
  const reportButton = await file("components/ReportContentButton.tsx");

  assert.match(profile, /label: "Moderation"/);
  assert.match(profile, /activeTab === "moderation"/);
  assert.match(profile, /setClaimModeration/);
  assert.match(profile, /setCommentModeration/);
  assert.match(profile, /listModerationQueue/);
  assert.match(profile, /Hidden claims and comments are excluded from feed, detail, and public API responses\./);

  assert.match(reportButton, /targetType: "claim"/);
  assert.match(reportButton, /targetType: "comment"/);
  assert.match(reportButton, /reasonCategory/);
  assert.match(reportButton, /"misinformation"/);
});

test("abuse handling runbook is documented", async () => {
  const runbook = await file("docs/moderation-runbook.md");
  assert.match(runbook, /Moderation Runbook/);
  assert.match(runbook, /MODERATION_ADMIN_ALLOWLIST/);
  assert.match(runbook, /Hide\/Unhide Behavior/);
  assert.match(runbook, /Response Workflow/);
});
