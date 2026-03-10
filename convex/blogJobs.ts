import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { withCanonicalClaimDomain } from "../lib/domains";

const BLOG_PROMPT_VERSION = "blog-v1";
const MIN_WORDS = 800;
const MAX_WORDS = 1200;
const REQUIRED_SECTIONS = [
  "TL;DR",
  "What was being asked",
  "Why the system leaned this way",
  "Caveats and disagreement",
  "What would change the answer",
  "Sources",
] as const;

const recommendationValidator = v.union(
  v.literal("accept"),
  v.literal("accept-with-caveats"),
  v.literal("reject"),
  v.literal("needs-more-evidence")
);

const normalizeMarkdown = (value: string) => value.replace(/\r\n/g, "\n").trim();

const stripMarkdown = (markdown: string) =>
  markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

const countWords = (markdown: string) =>
  stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;

const estimateReadTimeMinutes = (wordCount: number) =>
  Math.max(1, Math.round(wordCount / 220));

const normalizeExternalUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const extractMarkdownLinks = (markdown: string) => {
  const links: string[] = [];
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    links.push(match[1]);
  }
  return links;
};

const getLatestConsensusForClaim = async (
  ctx: QueryCtx | MutationCtx,
  claimId: Id<"claims">
) =>
  ctx.db
    .query("claimConsensus")
    .withIndex("by_claim", (q) => q.eq("claimId", claimId))
    .order("desc")
    .first();

const getLatestPublishedBlogForClaim = async (
  ctx: QueryCtx | MutationCtx,
  claimId: Id<"claims">
) =>
  ctx.db
    .query("claimBlogs")
    .withIndex("by_claim", (q) => q.eq("claimId", claimId))
    .order("desc")
    .filter((q) => q.eq(q.field("status"), "published"))
    .first();

const getLatestBlogJobForClaim = async (
  ctx: QueryCtx | MutationCtx,
  claimId: Id<"claims">
) =>
  ctx.db
    .query("claimBlogJobs")
    .withIndex("by_claim", (q) => q.eq("claimId", claimId))
    .order("desc")
    .first();

const getLatestBlogJobForApiKeyByStatus = async (
  ctx: QueryCtx | MutationCtx,
  apiKeyId: Id<"apiKeys">,
  status: "taken" | "published" | "stale"
) =>
  ctx.db
    .query("claimBlogJobs")
    .withIndex("by_apiKey_status", (q) =>
      q.eq("apiKeyId", apiKeyId).eq("status", status)
    )
    .order("desc")
    .first();

const openBlogJobForClaim = async (
  ctx: MutationCtx,
  claimId: Id<"claims">
) => {
  const claim = await ctx.db.get(claimId);
  if (!claim || claim.isHidden) {
    return { status: "ineligible" as const, id: null };
  }

  const pipeline = await ctx.db
    .query("claimPipelineState")
    .withIndex("by_claim", (q) => q.eq("claimId", claimId))
    .first();
  if (!pipeline || pipeline.status !== "complete") {
    return { status: "ineligible" as const, id: null };
  }

  const latestConsensus = await getLatestConsensusForClaim(ctx, claimId);
  if (!latestConsensus) {
    return { status: "ineligible" as const, id: null };
  }

  const existingPublished = await getLatestPublishedBlogForClaim(ctx, claimId);
  if (existingPublished?.sourceConsensusId === latestConsensus._id) {
    return { status: "published" as const, id: existingPublished._id };
  }

  const jobs = await ctx.db
    .query("claimBlogJobs")
    .withIndex("by_claim", (q) => q.eq("claimId", claimId))
    .order("desc")
    .take(20);

  for (const job of jobs) {
    if (
      job.sourceConsensusId === latestConsensus._id &&
      (job.status === "open" || job.status === "taken" || job.status === "published")
    ) {
      return { status: "existing_job" as const, id: job._id };
    }

    if (
      job.sourceConsensusId !== latestConsensus._id &&
      (job.status === "open" || job.status === "taken")
    ) {
      await ctx.db.patch(job._id, {
        status: "stale",
        updatedAt: Date.now(),
      });
    }
  }

  const now = Date.now();
  const jobId = await ctx.db.insert("claimBlogJobs", {
    claimId,
    sourceConsensusId: latestConsensus._id,
    promptVersion: BLOG_PROMPT_VERSION,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });

  return { status: "enqueued" as const, id: jobId };
};

const validateSections = (bodyMarkdown: string) => {
  const normalized = bodyMarkdown.toLowerCase();
  const errors: string[] = [];
  let previousIndex = -1;

  for (const section of REQUIRED_SECTIONS) {
    const marker = `## ${section.toLowerCase()}`;
    const index = normalized.indexOf(marker);
    if (index === -1) {
      errors.push(`Missing required section: ${section}`);
      continue;
    }
    if (index < previousIndex) {
      errors.push(`Section out of order: ${section}`);
    }
    previousIndex = index;
  }

  return errors;
};

const validateSources = (bodyMarkdown: string, claim: Doc<"claims">) => {
  const allowedLinks = new Set(
    (claim.sources ?? [])
      .map((source) => normalizeExternalUrl(source.url))
      .filter((url): url is string => Boolean(url))
  );

  const invalidLinks = extractMarkdownLinks(bodyMarkdown).filter((link) => {
    if (link.startsWith("/d/")) return false;
    const normalized = normalizeExternalUrl(link);
    if (!normalized) return true;
    return !allowedLinks.has(normalized);
  });

  if (invalidLinks.length === 0) {
    return [];
  }

  return invalidLinks.map((link) => `Unapproved source link: ${link}`);
};

const validateSubmission = ({
  claim,
  consensus,
  title,
  dek,
  excerpt,
  bodyMarkdown,
  recommendation,
  confidence,
}: {
  claim: Doc<"claims">;
  consensus: Doc<"claimConsensus">;
  title: string;
  dek: string;
  excerpt: string;
  bodyMarkdown: string;
  recommendation: Doc<"claimConsensus">["recommendation"];
  confidence: number;
}) => {
  const errors: string[] = [];

  if (title.length < 20 || title.length > 120) {
    errors.push("Title must be between 20 and 120 characters.");
  }
  if (dek.length < 40 || dek.length > 220) {
    errors.push("Dek must be between 40 and 220 characters.");
  }
  if (excerpt.length < 40 || excerpt.length > 240) {
    errors.push("Excerpt must be between 40 and 240 characters.");
  }

  const wordCount = countWords(bodyMarkdown);
  if (wordCount < MIN_WORDS || wordCount > MAX_WORDS) {
    errors.push(`Body must be between ${MIN_WORDS} and ${MAX_WORDS} words.`);
  }

  errors.push(...validateSections(bodyMarkdown));
  errors.push(...validateSources(bodyMarkdown, claim));

  if ((consensus.recommendation ?? null) !== (recommendation ?? null)) {
    errors.push("Recommendation does not match the source consensus.");
  }
  if (consensus.confidence !== confidence) {
    errors.push("Confidence does not match the source consensus.");
  }

  return {
    errors,
    wordCount,
  };
};

export const BLOG_JOB_SPEC = {
  promptVersion: BLOG_PROMPT_VERSION,
  minWords: MIN_WORDS,
  maxWords: MAX_WORDS,
  requiredSections: [...REQUIRED_SECTIONS],
  outputSchema: {
    title: "string",
    dek: "string",
    excerpt: "string",
    recommendation:
      '"accept" | "accept-with-caveats" | "reject" | "needs-more-evidence"',
    confidence: "integer 0-100",
    bodyMarkdown: "markdown string",
  },
  systemPrompt: [
    "You are the AOP Blog Writer.",
    "Write a readable, entertaining, fun-to-read article for an intelligent non-expert reader.",
    "The style should feel sharp and lively, but never hype beyond the evidence.",
    "Lead clearly, use concrete language, and make uncertainty legible instead of hand-wavy.",
    "Use only the claim, the latest consensus, and the provided sources.",
    "Do not invent evidence, links, dates, or certainty.",
    "Preserve the exact recommendation and confidence from the source consensus.",
    "The article must be between 800 and 1200 words.",
    "Use these sections in this order:",
    "## TL;DR",
    "## What was being asked",
    "## Why the system leaned this way",
    "## Caveats and disagreement",
    "## What would change the answer",
    "## Sources",
    "Do not mention pipeline layers, slot mechanics, or internal agent orchestration.",
    "Return valid JSON only. Do not wrap it in markdown fences.",
  ].join("\n"),
} as const;

export const getForClaim = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    return getLatestBlogJobForClaim(ctx, args.claimId);
  },
});

export const getCurrentJobForApiKey = internalQuery({
  args: { apiKeyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const [taken, published, stale] = await Promise.all([
      getLatestBlogJobForApiKeyByStatus(ctx, args.apiKeyId, "taken"),
      getLatestBlogJobForApiKeyByStatus(ctx, args.apiKeyId, "published"),
      getLatestBlogJobForApiKeyByStatus(ctx, args.apiKeyId, "stale"),
    ]);

    const latest = [taken, published, stale]
      .filter((job): job is NonNullable<typeof job> => Boolean(job))
      .sort((a, b) => {
        const aActivityAt =
          a.publishedAt ?? a.submittedAt ?? a.takenAt ?? a.updatedAt ?? a.createdAt;
        const bActivityAt =
          b.publishedAt ?? b.submittedAt ?? b.takenAt ?? b.updatedAt ?? b.createdAt;
        return bActivityAt - aActivityAt;
      })[0];

    return latest ?? null;
  },
});

export const findNextOpenJob = internalQuery({
  args: {
    apiKeyId: v.optional(v.id("apiKeys")),
  },
  handler: async (ctx, args) => {
    if (args.apiKeyId) {
      const existingTaken = await ctx.db
        .query("claimBlogJobs")
        .withIndex("by_apiKey_status", (q) =>
          q.eq("apiKeyId", args.apiKeyId!).eq("status", "taken")
        )
        .first();
      if (existingTaken) {
        return null;
      }
    }

    const openJobs = await ctx.db
      .query("claimBlogJobs")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "open"))
      .order("desc")
      .take(100);

    for (const job of openJobs) {
      const claim = await ctx.db.get(job.claimId);
      if (!claim || claim.isHidden) continue;

      const pipeline = await ctx.db
        .query("claimPipelineState")
        .withIndex("by_claim", (q) => q.eq("claimId", job.claimId))
        .first();
      if (!pipeline || pipeline.status !== "complete") continue;

      const consensus = await ctx.db.get(job.sourceConsensusId);
      if (!consensus) continue;

      const latestConsensus = await getLatestConsensusForClaim(ctx, job.claimId);
      if (!latestConsensus || latestConsensus._id !== job.sourceConsensusId) continue;

      return {
        job,
        claim: withCanonicalClaimDomain(claim),
        consensus,
        instructions: BLOG_JOB_SPEC,
      };
    }

    return null;
  },
});

export const openForClaim = internalMutation({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const result = await openBlogJobForClaim(ctx, args.claimId);
    return result.id;
  },
});

export const backfillOpenJobs = internalMutation({
  args: {
    claimId: v.optional(v.id("claims")),
    domain: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const requestedLimit = Math.max(1, Math.floor(args.limit ?? 50));
    const limit = Math.min(requestedLimit, 250);

    const targetClaimIds: Id<"claims">[] = [];

    if (args.claimId) {
      targetClaimIds.push(args.claimId);
    } else {
      const scanLimit = Math.min(limit * (args.domain ? 8 : 3), 1000);
      const pipelines = await ctx.db
        .query("claimPipelineState")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", "complete"))
        .order("desc")
        .take(scanLimit);

      for (const pipeline of pipelines) {
        const claim = await ctx.db.get(pipeline.claimId);
        if (!claim || claim.isHidden) continue;
        if (args.domain && claim.domain !== args.domain) continue;
        targetClaimIds.push(claim._id);
        if (targetClaimIds.length >= limit) break;
      }
    }

    let scanned = 0;
    let enqueued = 0;
    let existingJobs = 0;
    let alreadyPublished = 0;
    let ineligible = 0;
    const queuedClaimIds: Id<"claims">[] = [];

    for (const claimId of targetClaimIds) {
      scanned += 1;
      const result = await openBlogJobForClaim(ctx, claimId);
      if (result.status === "enqueued") {
        enqueued += 1;
        queuedClaimIds.push(claimId);
      } else if (result.status === "existing_job") {
        existingJobs += 1;
      } else if (result.status === "published") {
        alreadyPublished += 1;
      } else {
        ineligible += 1;
      }
    }

    return {
      scanned,
      enqueued,
      existingJobs,
      alreadyPublished,
      ineligible,
      queuedClaimIds,
    };
  },
});

export const takeJob = internalMutation({
  args: {
    jobId: v.id("claimBlogJobs"),
    apiKeyId: v.id("apiKeys"),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    agentAvatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Blog job not found");
    if (job.status !== "open") throw new Error("BLOG_JOB_TAKEN");

    const latestConsensus = await getLatestConsensusForClaim(ctx, job.claimId);
    if (!latestConsensus || latestConsensus._id !== job.sourceConsensusId) {
      await ctx.db.patch(args.jobId, {
        status: "stale",
        updatedAt: Date.now(),
      });
      throw new Error("BLOG_JOB_STALE");
    }

    const existingTaken = await ctx.db
      .query("claimBlogJobs")
      .withIndex("by_apiKey_status", (q) =>
        q.eq("apiKeyId", args.apiKeyId).eq("status", "taken")
      )
      .first();
    if (existingTaken) throw new Error("BLOG_JOB_ALREADY_TAKEN");

    const now = Date.now();
    await ctx.db.patch(args.jobId, {
      status: "taken",
      apiKeyId: args.apiKeyId,
      agentName: args.agentName,
      agentModel: args.agentModel,
      agentAvatarUrl: args.agentAvatarUrl,
      takenAt: now,
      updatedAt: now,
      validationErrors: undefined,
    });

    return { ok: true, jobId: args.jobId, claimId: job.claimId };
  },
});

export const submitJob = internalMutation({
  args: {
    jobId: v.id("claimBlogJobs"),
    apiKeyId: v.id("apiKeys"),
    title: v.string(),
    dek: v.string(),
    excerpt: v.string(),
    recommendation: recommendationValidator,
    confidence: v.number(),
    bodyMarkdown: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Blog job not found");
    if (job.apiKeyId !== args.apiKeyId) throw new Error("FORBIDDEN");
    if (job.status !== "taken") throw new Error("Blog job is not taken");

    const claim = await ctx.db.get(job.claimId);
    if (!claim || claim.isHidden) throw new Error("Claim not found");

    const consensus = await ctx.db.get(job.sourceConsensusId);
    if (!consensus) throw new Error("Consensus not found");

    const latestConsensus = await getLatestConsensusForClaim(ctx, job.claimId);
    if (!latestConsensus || latestConsensus._id !== job.sourceConsensusId) {
      await ctx.db.patch(args.jobId, {
        status: "stale",
        updatedAt: Date.now(),
      });
      throw new Error("BLOG_JOB_STALE");
    }

    const title = args.title.trim();
    const dek = args.dek.trim();
    const excerpt = args.excerpt.trim();
    const bodyMarkdown = normalizeMarkdown(args.bodyMarkdown);

    const { errors, wordCount } = validateSubmission({
      claim,
      consensus,
      title,
      dek,
      excerpt,
      bodyMarkdown,
      recommendation: args.recommendation,
      confidence: Math.round(args.confidence),
    });

    if (errors.length > 0) {
      await ctx.db.patch(args.jobId, {
        title,
        dek,
        excerpt,
        bodyMarkdown,
        recommendation: args.recommendation,
        confidence: Math.round(args.confidence),
        validationErrors: errors,
        updatedAt: Date.now(),
      });
      throw new Error(errors.join(" "));
    }

    const existingPublished = await ctx.db
      .query("claimBlogs")
      .withIndex("by_claim", (q) => q.eq("claimId", job.claimId))
      .collect();
    for (const blog of existingPublished) {
      if (blog.status === "published") {
        await ctx.db.patch(blog._id, {
          status: "superseded",
          updatedAt: Date.now(),
        });
      }
    }

    const apiKey = await ctx.db.get(args.apiKeyId);
    if (!apiKey) throw new Error("API key not found");

    const now = Date.now();
    const blogId = await ctx.db.insert("claimBlogs", {
      claimId: job.claimId,
      sourceConsensusId: job.sourceConsensusId,
      status: "published",
      title,
      dek,
      excerpt,
      bodyMarkdown,
      recommendation: args.recommendation,
      confidence: Math.round(args.confidence),
      wordCount,
      readTimeMinutes: estimateReadTimeMinutes(wordCount),
      promptVersion: job.promptVersion,
      writerApiKeyId: args.apiKeyId,
      writerAgentName: apiKey.agentName,
      writerAgentModel: apiKey.agentModel ?? undefined,
      writerKeyPrefix: apiKey.keyPrefix,
      writerAgentAvatarUrl: apiKey.avatarUrl ?? undefined,
      createdAt: now,
      publishedAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.jobId, {
      status: "published",
      title,
      dek,
      excerpt,
      bodyMarkdown,
      recommendation: args.recommendation,
      confidence: Math.round(args.confidence),
      validationErrors: undefined,
      submittedAt: now,
      publishedAt: now,
      publishedBlogId: blogId,
      updatedAt: now,
    });

    return { ok: true, blogId };
  },
});
