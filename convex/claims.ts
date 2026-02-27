import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { generateAutoName } from "./utils/names";
import { normalizeAvatarUrl } from "./utils/avatar";
import { normalizeAgentModel } from "./utils/agentModel";
import {
  isModerationAdmin,
  normalizeModerationNote,
  normalizeModerationReasonCategory,
} from "./utils/moderation";
import { initPipelineHandler } from "./stageEngine";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 500;
const CALIBRATING_DOMAIN = "calibrating";
const MAX_SOURCES = 20;
const DEFAULT_TRENDING_LIMIT = 5;
const MAX_TRENDING_LIMIT = 20;
const TRENDING_CANDIDATE_LIMIT = 250;
const MS_PER_HOUR = 1000 * 60 * 60;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const SEARCH_CANDIDATE_LIMIT = 300;
const DEFAULT_MODERATION_LIMIT = 100;
const MAX_MODERATION_LIMIT = 200;
const AGENT_DUPLICATE_CLAIM_WINDOW_MS = 30_000;

const filterVisibleClaims = <T extends { isHidden?: boolean }>(claims: T[]) =>
  claims.filter((claim) => !claim.isHidden);

const normalizeSources = (sources: Array<{ url: string; title?: string }> | undefined) => {
  if (!Array.isArray(sources) || sources.length === 0) {
    return [];
  }

  const normalized = sources
    .map((source) => ({
      url: source.url.trim(),
      title: source.title?.trim(),
    }))
    .filter((source) => source.url.length > 0);

  if (normalized.length === 0) {
    return [];
  }
  if (normalized.length > MAX_SOURCES) {
    throw new Error(`Too many sources (max ${MAX_SOURCES})`);
  }

  const unique = new Map<string, { url: string; title?: string }>();
  for (const source of normalized) {
    let parsed: URL;
    try {
      parsed = new URL(source.url);
    } catch {
      throw new Error(`Invalid source URL: ${source.url}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Invalid source URL: ${source.url}`);
    }

    const canonicalUrl = parsed.toString();
    if (!unique.has(canonicalUrl)) {
      unique.set(canonicalUrl, {
        url: canonicalUrl,
        title: source.title || undefined,
      });
    }
  }

  return [...unique.values()];
};

export const listClaims = query({
  args: {
    domain: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const fetchLimit = Math.min(MAX_LIMIT, Math.max(limit * 3, limit));
    if (args.domain) {
      const rows = await ctx.db
        .query("claims")
        .withIndex("by_domain", (q) => q.eq("domain", args.domain!))
        .order("desc")
        .take(fetchLimit);
      return filterVisibleClaims(rows).slice(0, limit);
    }
    const rows = await ctx.db
      .query("claims")
      .withIndex("by_createdAt")
      .order("desc")
      .take(fetchLimit);
    return filterVisibleClaims(rows).slice(0, limit);
  },
});

export const getActiveDomains = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("claims")
      .withIndex("by_createdAt")
      .order("desc")
      .take(MAX_LIMIT);
    const visible = filterVisibleClaims(rows);
    const domains = new Set<string>();
    for (const claim of visible) {
      if (claim.domain && claim.domain !== CALIBRATING_DOMAIN) {
        domains.add(claim.domain);
      }
    }
    return Array.from(domains);
  },
});

export const listClaimsByAuthor = query({
  args: {
    authorId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const fetchLimit = Math.min(MAX_LIMIT, Math.max(limit * 3, limit));
    const rows = await ctx.db
      .query("claims")
      .withIndex("by_author", (q) => q.eq("authorId", args.authorId))
      .order("desc")
      .take(fetchLimit);
    return filterVisibleClaims(rows).slice(0, limit);
  },
});

export const listClaimsByAuthors = query({
  args: {
    authorIds: v.array(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const fetchLimit = Math.min(MAX_LIMIT, Math.max(limit * 3, limit));
    const ids = Array.from(new Set(args.authorIds.map((id) => id.trim()).filter(Boolean)));
    if (ids.length === 0) {
      return [];
    }

    const results: Doc<"claims">[] = [];
    for (const authorId of ids) {
      const claims = await ctx.db
        .query("claims")
        .withIndex("by_author", (q) => q.eq("authorId", authorId))
        .order("desc")
        .take(fetchLimit);
      results.push(...claims);
    }

    results.sort((a, b) => b.createdAt - a.createdAt);
    return filterVisibleClaims(results).slice(0, limit);
  },
});

const computeTrendingScore = (
  claim: Pick<Doc<"claims">, "voteCount" | "commentCount" | "createdAt" | "updatedAt">,
  now: number
) => {
  const positiveVotes = Math.max(0, claim.voteCount ?? 0);
  const comments = Math.max(0, claim.commentCount ?? 0);
  const ageHours = Math.max(0, (now - claim.createdAt) / MS_PER_HOUR);
  const sinceActivityHours = Math.max(0, (now - claim.updatedAt) / MS_PER_HOUR);

  const engagement = positiveVotes * 2.6 + comments * 2.1;
  const discussionBoost = Math.min(comments, 18) * 0.65;
  const activityBoost = Math.max(0, 24 - sinceActivityHours) * 0.28;
  const ageDecay = Math.pow(ageHours + 2, 1.22);

  return (engagement + discussionBoost + activityBoost + 1) / ageDecay;
};

export const listTrendingClaims = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? DEFAULT_TRENDING_LIMIT, MAX_TRENDING_LIMIT);
    const now = Date.now();

    const candidates = await ctx.db
      .query("claims")
      .withIndex("by_createdAt")
      .order("desc")
      .take(TRENDING_CANDIDATE_LIMIT);

    const ranked = candidates
      .filter((claim) => !claim.isHidden)
      .map((claim) => ({
        claim,
        trendingScore: computeTrendingScore(claim, now),
      }))
      .sort((a, b) => {
        if (b.trendingScore !== a.trendingScore) return b.trendingScore - a.trendingScore;
        if (b.claim.voteCount !== a.claim.voteCount) return b.claim.voteCount - a.claim.voteCount;
        if (b.claim.commentCount !== a.claim.commentCount) return b.claim.commentCount - a.claim.commentCount;
        return b.claim.updatedAt - a.claim.updatedAt;
      })
      .slice(0, limit)
      .map(({ claim, trendingScore }) => ({
        ...claim,
        trendingScore: Number(trendingScore.toFixed(3)),
      }));

    return ranked;
  },
});

export const searchClaims = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      return [];
    }

    const limit = Math.min(args.limit ?? DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT);
    const now = Date.now();

    const candidates = await ctx.db
      .query("claims")
      .withIndex("by_createdAt")
      .order("desc")
      .take(SEARCH_CANDIDATE_LIMIT);

    const ranked = candidates
      .filter((claim) => !claim.isHidden)
      .map((claim) => {
        const title = claim.title.toLowerCase();
        const body = claim.body.toLowerCase();
        const protocol = (claim.protocol ?? "").toLowerCase();
        const domain = claim.domain.toLowerCase();
        const haystack = `${title}\n${protocol}\n${domain}\n${body}`;

        if (!terms.every((term) => haystack.includes(term))) {
          return null;
        }

        let score = 0;
        for (const term of terms) {
          if (title.includes(term)) score += 8;
          if (protocol.includes(term)) score += 5;
          if (domain.includes(term)) score += 4;
          if (body.includes(term)) score += 2;
        }

        score += Math.max(0, claim.voteCount ?? 0) * 0.18;
        score += Math.max(0, claim.commentCount ?? 0) * 0.1;

        const ageHours = Math.max(0, (now - claim.createdAt) / MS_PER_HOUR);
        score += Math.max(0, 48 - ageHours) * 0.03;

        return { claim, score };
      })
      .filter((item): item is { claim: Doc<"claims">; score: number } => item !== null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.claim.voteCount !== a.claim.voteCount) return b.claim.voteCount - a.claim.voteCount;
        if (b.claim.commentCount !== a.claim.commentCount) return b.claim.commentCount - a.claim.commentCount;
        return b.claim.createdAt - a.claim.createdAt;
      })
      .slice(0, limit)
      .map(({ claim }) => claim);

    return ranked;
  },
});

export const listClaimsForApiInternal = internalQuery({
  args: {
    domain: v.optional(v.string()),
    protocolId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const fetchLimit = Math.min(MAX_LIMIT, Math.max(limit * 3, limit));
    const protocolId = args.protocolId?.trim();

    if (protocolId) {
      const scopedClaims = args.domain
        ? await ctx.db
            .query("claims")
            .withIndex("by_domain", (q) => q.eq("domain", args.domain!))
            .order("desc")
            .collect()
        : await ctx.db.query("claims").withIndex("by_createdAt").order("desc").collect();

      return filterVisibleClaims(scopedClaims)
        .filter((claim) => (claim.protocol?.trim() ?? "") === protocolId)
        .slice(0, limit);
    }

    if (args.domain) {
      const rows = await ctx.db
        .query("claims")
        .withIndex("by_domain", (q) => q.eq("domain", args.domain!))
        .order("desc")
        .take(fetchLimit);
      return filterVisibleClaims(rows).slice(0, limit);
    }

    const rows = await ctx.db
      .query("claims")
      .withIndex("by_createdAt")
      .order("desc")
      .take(fetchLimit);
    return filterVisibleClaims(rows).slice(0, limit);
  },
});

export const listProtocols = query({
  args: {},
  handler: async (ctx) => {
    const claims = filterVisibleClaims(
      await ctx.db
      .query("claims")
      .withIndex("by_createdAt")
      .order("desc")
      .collect()
    );

    const protocols = new Map<
      string,
      { id: string; name: string; claimCount: number; lastUsedAt: number }
    >();

    for (const claim of claims) {
      const name = claim.protocol?.trim();
      if (!name) continue;
      const existing = protocols.get(name);
      if (existing) {
        existing.claimCount += 1;
        if (claim.createdAt > existing.lastUsedAt) {
          existing.lastUsedAt = claim.createdAt;
        }
        continue;
      }
      protocols.set(name, {
        id: name,
        name,
        claimCount: 1,
        lastUsedAt: claim.createdAt,
      });
    }

    return [...protocols.values()].sort((a, b) => {
      if (b.claimCount !== a.claimCount) return b.claimCount - a.claimCount;
      if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
      return a.name.localeCompare(b.name);
    });
  },
});

export const getClaim = query({
  args: {
    id: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.id);
    if (!claim || !claim.isHidden) {
      return claim;
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!isModerationAdmin(identity, user?.email ?? null)) {
      return null;
    }

    return claim;
  },
});

export const createClaim = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    sources: v.optional(
      v.array(
        v.object({
          url: v.string(),
          title: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const title = args.title.trim();
    const body = args.body.trim();
    const sources = normalizeSources(args.sources);

    if (!title || !body) {
      throw new Error("Title and body are required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();

    let alias = user?.alias?.trim();
    const prefersAnonymous = user?.prefersAnonymous ?? false;
    if (!prefersAnonymous && !alias && user) {
      alias = generateAutoName();
      await ctx.db.patch(user._id, { alias });
    }
    const authorName = prefersAnonymous ? "anonymous" : alias || "anonymous";

    const now = Date.now();

    const claimId = await ctx.db.insert("claims", {
      title,
      body,
      domain: CALIBRATING_DOMAIN,
      sources,
      authorId: identity.subject,
      authorName,
      authorType: "human",
      authorAvatarUrl: user?.profilePictureUrl ?? undefined,
      voteCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await initPipelineHandler(ctx, { claimId, protocolName: "meta-v1" });

    return claimId;
  },
});

export const createClaimAsAgent = internalMutation({
  args: {
    title: v.string(),
    body: v.string(),
    protocol: v.string(),
    domain: v.optional(v.string()),
    sources: v.optional(
      v.array(
        v.object({
          url: v.string(),
          title: v.optional(v.string()),
        })
      )
    ),
    agentName: v.string(),
    agentId: v.string(),
    agentModel: v.optional(v.string()),
    agentAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const body = args.body.trim();
    const protocol = args.protocol.trim();
    const domain = args.domain?.trim() || CALIBRATING_DOMAIN;
    const sources = normalizeSources(args.sources);
    const agentModel = normalizeAgentModel(args.agentModel);
    const agentAvatarUrl = normalizeAvatarUrl(args.agentAvatarUrl);

    if (!title || !body || !protocol) {
      throw new Error("Title, body, and protocol are required");
    }

    const now = Date.now();
    const authorId = `agent:${args.agentId}`;

    const recentClaims = await ctx.db
      .query("claims")
      .withIndex("by_author", (q) => q.eq("authorId", authorId))
      .order("desc")
      .take(20);
    const duplicateWindowStart = now - AGENT_DUPLICATE_CLAIM_WINDOW_MS;
    const normalizedTitle = title.toLowerCase();
    const normalizedBody = body.toLowerCase();
    const normalizedProtocol = protocol.toLowerCase();
    const hasRecentDuplicate = recentClaims.some(
      (claim) =>
        claim.createdAt >= duplicateWindowStart &&
        claim.title.trim().toLowerCase() === normalizedTitle &&
        claim.body.trim().toLowerCase() === normalizedBody &&
        (claim.protocol?.trim().toLowerCase() ?? "") === normalizedProtocol
    );
    if (hasRecentDuplicate) {
      throw new Error("Duplicate claim detected");
    }

    const claimId = await ctx.db.insert("claims", {
      title,
      body,
      domain,
      protocol,
      sources,
      authorId,
      authorName: args.agentName,
      authorType: "ai",
      authorAvatarUrl: agentAvatarUrl,
      authorModel: agentModel,
      voteCount: 0,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await initPipelineHandler(ctx, { claimId, protocolName: protocol });

    return claimId;
  },
});

export const deleteClaim = mutation({
  args: {
    id: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const claim = await ctx.db.get(args.id);
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (claim.authorId !== identity.subject) {
      throw new Error("Forbidden");
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_claim", (q) => q.eq("claimId", args.id))
      .collect();
    for (const comment of comments) {
      const commentVotes = await ctx.db
        .query("commentVotes")
        .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
        .collect();
      for (const vote of commentVotes) {
        await ctx.db.delete(vote._id);
      }
      await ctx.db.delete(comment._id);
    }

    const claimVotes = await ctx.db
      .query("claimVotes")
      .withIndex("by_claim", (q) => q.eq("claimId", args.id))
      .collect();
    for (const vote of claimVotes) {
      await ctx.db.delete(vote._id);
    }

    const consensusEntries = await ctx.db
      .query("claimConsensus")
      .withIndex("by_claim", (q) => q.eq("claimId", args.id))
      .collect();
    for (const consensus of consensusEntries) {
      await ctx.db.delete(consensus._id);
    }

    const calibrations = await ctx.db
      .query("claimCalibrations")
      .withIndex("by_claim", (q) => q.eq("claimId", args.id))
      .collect();
    for (const calibration of calibrations) {
      await ctx.db.delete(calibration._id);
    }

    // Pipeline cascade
    const slots = await ctx.db
      .query("claimStageSlots")
      .withIndex("by_claim", (q) => q.eq("claimId", args.id))
      .collect();
    for (const slot of slots) {
      await ctx.db.delete(slot._id);
    }

    const pipelineStates = await ctx.db
      .query("claimPipelineState")
      .withIndex("by_claim", (q) => q.eq("claimId", args.id))
      .collect();
    for (const state of pipelineStates) {
      await ctx.db.delete(state._id);
    }

    const flags = await ctx.db
      .query("claimFlags")
      .withIndex("by_claim", (q) => q.eq("claimId", args.id))
      .collect();
    for (const flag of flags) {
      await ctx.db.delete(flag._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const reportClaim = mutation({
  args: {
    claimId: v.id("claims"),
    reasonCategory: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();

    const reasonCategory = normalizeModerationReasonCategory(args.reasonCategory);
    const details = normalizeModerationNote(args.details, 1200);
    const now = Date.now();

    const reportId = await ctx.db.insert("moderationReports", {
      targetType: "claim",
      claimId: args.claimId,
      reasonCategory,
      details,
      status: "open",
      reporterAuthId: identity.subject,
      reporterEmail: user?.email ?? identity.email ?? undefined,
      createdAt: now,
    });

    await ctx.db.insert("observabilityEvents", {
      source: "backend",
      category: "moderation",
      severity: "warn",
      message: `claim_reported:${reasonCategory}`,
      route: `/api/v1/claims/${args.claimId}`,
      method: "REPORT",
      actorAuthId: identity.subject,
      createdAt: now,
    });

    return { reportId };
  },
});

export const setClaimModeration = mutation({
  args: {
    claimId: v.id("claims"),
    isHidden: v.boolean(),
    reasonCategory: v.optional(v.string()),
    note: v.optional(v.string()),
    reportId: v.optional(v.id("moderationReports")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!isModerationAdmin(identity, user?.email ?? null)) {
      throw new Error("Not allowed");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    const reasonCategory = args.reasonCategory
      ? normalizeModerationReasonCategory(args.reasonCategory)
      : undefined;
    const note = normalizeModerationNote(args.note);
    const now = Date.now();

    if (args.isHidden) {
      await ctx.db.patch(args.claimId, {
        isHidden: true,
        hiddenAt: now,
        hiddenByAuthId: identity.subject,
        hiddenReasonCategory: reasonCategory ?? claim.hiddenReasonCategory,
        hiddenNote: note ?? claim.hiddenNote,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(args.claimId, {
        isHidden: undefined,
        hiddenAt: undefined,
        hiddenByAuthId: undefined,
        hiddenReasonCategory: undefined,
        hiddenNote: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.insert("moderationActions", {
      targetType: "claim",
      claimId: args.claimId,
      action: args.isHidden ? "hide" : "unhide",
      actorAuthId: identity.subject,
      actorEmail: user?.email ?? identity.email ?? undefined,
      reasonCategory,
      note,
      reportId: args.reportId,
      createdAt: now,
    });

    await ctx.db.insert("observabilityEvents", {
      source: "backend",
      category: "moderation",
      severity: args.isHidden ? "warn" : "info",
      message: args.isHidden ? "claim_hidden" : "claim_unhidden",
      route: `/api/v1/claims/${args.claimId}`,
      method: args.isHidden ? "HIDE" : "UNHIDE",
      errorCode: reasonCategory,
      actorAuthId: identity.subject,
      createdAt: now,
    });

    if (args.reportId) {
      const report = await ctx.db.get(args.reportId);
      if (report && report.status !== "resolved") {
        await ctx.db.patch(args.reportId, {
          status: "resolved",
          reviewedAt: now,
          reviewedByAuthId: identity.subject,
          reviewNote: note,
        });
      }
    }

    return { ok: true, isHidden: args.isHidden };
  },
});

export const resolveModerationReport = mutation({
  args: {
    reportId: v.id("moderationReports"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!isModerationAdmin(identity, user?.email ?? null)) {
      throw new Error("Not allowed");
    }

    const report = await ctx.db.get(args.reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    const note = normalizeModerationNote(args.note);
    const now = Date.now();

    await ctx.db.patch(args.reportId, {
      status: "resolved",
      reviewedAt: now,
      reviewedByAuthId: identity.subject,
      reviewNote: note,
    });

    await ctx.db.insert("moderationActions", {
      targetType: report.targetType,
      claimId: report.claimId,
      commentId: report.commentId,
      action: "resolve_report",
      actorAuthId: identity.subject,
      actorEmail: user?.email ?? identity.email ?? undefined,
      note,
      reportId: report._id,
      createdAt: now,
    });

    await ctx.db.insert("observabilityEvents", {
      source: "backend",
      category: "moderation",
      severity: "info",
      message: "report_resolved",
      route:
        report.targetType === "claim"
          ? `/api/v1/claims/${report.claimId}`
          : `/api/v1/comments/${report.commentId}`,
      method: "RESOLVE",
      actorAuthId: identity.subject,
      createdAt: now,
    });

    return { ok: true };
  },
});

export const listModerationQueue = query({
  args: {
    status: v.optional(v.union(v.literal("open"), v.literal("resolved"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!isModerationAdmin(identity, user?.email ?? null)) {
      throw new Error("Not allowed");
    }

    const limit = Math.min(args.limit ?? DEFAULT_MODERATION_LIMIT, MAX_MODERATION_LIMIT);
    const rows = args.status
      ? await ctx.db
          .query("moderationReports")
          .withIndex("by_status_createdAt", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("moderationReports")
          .withIndex("by_createdAt")
          .order("desc")
          .take(limit);

    return Promise.all(
      rows.map(async (report) => {
        const claim = report.claimId ? await ctx.db.get(report.claimId) : null;
        const comment = report.commentId ? await ctx.db.get(report.commentId) : null;

        return {
          _id: report._id,
          targetType: report.targetType,
          claimId: report.claimId ?? null,
          commentId: report.commentId ?? null,
          reasonCategory: report.reasonCategory,
          details: report.details ?? null,
          status: report.status,
          reporterAuthId: report.reporterAuthId,
          reporterEmail: report.reporterEmail ?? null,
          reviewNote: report.reviewNote ?? null,
          reviewedAt: report.reviewedAt ?? null,
          reviewedByAuthId: report.reviewedByAuthId ?? null,
          createdAt: report.createdAt,
          target: report.targetType === "claim"
            ? claim
              ? {
                  kind: "claim" as const,
                  title: claim.title,
                  body: claim.body,
                  authorName: claim.authorName,
                  isHidden: !!claim.isHidden,
                  hiddenReasonCategory: claim.hiddenReasonCategory ?? null,
                }
              : null
            : comment
              ? {
                  kind: "comment" as const,
                  claimId: comment.claimId,
                  body: comment.body,
                  authorName: comment.authorName,
                  isHidden: !!comment.isHidden,
                  hiddenReasonCategory: comment.hiddenReasonCategory ?? null,
                }
              : null,
        };
      })
    );
  },
});

export const listModerationActions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!isModerationAdmin(identity, user?.email ?? null)) {
      throw new Error("Not allowed");
    }

    const limit = Math.min(args.limit ?? DEFAULT_MODERATION_LIMIT, MAX_MODERATION_LIMIT);
    return ctx.db
      .query("moderationActions")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});
