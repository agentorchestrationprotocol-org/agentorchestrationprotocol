import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { withCanonicalClaimDomain } from "../lib/domains";

const BLOG_MARKER = "kind:blog";
const BLOG_AUDIENCE = "audience:reader";
const BLOG_SOURCE = "source:consensus";
const DEFAULT_LIST_LIMIT = 12;
const MAX_LIST_LIMIT = 36;
const MAX_SCAN_LIMIT = 200;
const OUTPUT_SCAN_LIMIT = 12;

const recommendationLabel = (recommendation: string | undefined) => {
  switch (recommendation) {
    case "accept":
      return "Accept";
    case "accept-with-caveats":
      return "Accept with caveats";
    case "reject":
      return "Reject";
    case "needs-more-evidence":
      return "Needs more evidence";
    default:
      return null;
  }
};

const isBlogOutput = (
  output:
    | Pick<Doc<"claimOutputs">, "constraintsSatisfied">
    | null
    | undefined
) => Boolean(output?.constraintsSatisfied?.includes(BLOG_MARKER));

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

const extractExcerpt = (markdown: string, maxLength: number = 220) => {
  const plain = stripMarkdown(markdown);
  if (!plain) return "";

  const paragraphs = plain
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const firstParagraph = paragraphs.find((paragraph) => paragraph.length > 24) ?? plain;
  if (firstParagraph.length <= maxLength) return firstParagraph;

  const truncated = firstParagraph.slice(0, maxLength).trimEnd();
  const safe = truncated.replace(/[.,;:!?-]?\s+\S*$/, "");
  return `${safe || truncated}...`;
};

const estimateReadTimeMinutes = (markdown: string) => {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
};

const renderBulletList = (items: string[] | undefined, fallback: string) => {
  const normalized = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return [`- ${fallback}`];
  }
  return normalized.map((item) => `- ${item}`);
};

const buildReadableBody = (claim: Doc<"claims">, consensus: Doc<"claimConsensus">) => {
  const recommendation = recommendationLabel(consensus.recommendation ?? undefined);
  const domain = claim.domain === "calibrating" ? "Calibrating domain" : `d/${claim.domain}`;
  const sources = (claim.sources ?? []).filter((source) => source.url?.trim());
  const lines: string[] = [];

  lines.push(`# ${claim.title}`);
  lines.push("");
  lines.push(
    recommendation
      ? `**Bottom line:** ${recommendation}. **Confidence:** ${consensus.confidence}/100.`
      : `**Confidence:** ${consensus.confidence}/100.`
  );
  lines.push("");
  lines.push(consensus.summary.trim());
  lines.push("");
  lines.push("## What was evaluated");
  lines.push("");
  lines.push(claim.body.trim());
  lines.push("");
  lines.push("## What the council agreed on");
  lines.push("");
  lines.push(...renderBulletList(consensus.keyPoints, "The council produced a summary but no explicit key points."));
  lines.push("");

  if ((consensus.dissent ?? []).length > 0) {
    lines.push("## Caveats and disagreement");
    lines.push("");
    lines.push(...renderBulletList(consensus.dissent, "No dissent was recorded."));
    lines.push("");
  }

  if ((consensus.openQuestions ?? []).length > 0) {
    lines.push("## Open questions");
    lines.push("");
    lines.push(...renderBulletList(consensus.openQuestions, "No open questions were recorded."));
    lines.push("");
  }

  if (sources.length > 0) {
    lines.push("## Sources");
    lines.push("");
    for (const source of sources) {
      lines.push(`- ${source.title ? `[${source.title}](${source.url})` : source.url}`);
    }
    lines.push("");
  }

  lines.push("## Read the full record");
  lines.push("");
  lines.push(
    `This article is the reader-friendly layer. For the full claim, consensus history, comments, and pipeline trace, open [/d/${claim.domain}/${claim._id}](/d/${claim.domain}/${claim._id}).`
  );
  lines.push("");
  lines.push(`_Domain: ${domain}_`);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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

const getLatestBlogOutputForClaim = async (
  ctx: QueryCtx | MutationCtx,
  claimId: Id<"claims">
) => {
  const outputs = await ctx.db
    .query("claimOutputs")
    .withIndex("by_claim", (q) => q.eq("claimId", claimId))
    .order("desc")
    .take(OUTPUT_SCAN_LIMIT);
  return outputs.find(isBlogOutput) ?? null;
};

const toBlogSummary = (
  claim: Doc<"claims">,
  output: Doc<"claimOutputs">,
  consensus: Doc<"claimConsensus"> | null
) => {
  const canonicalClaim = withCanonicalClaimDomain(claim);
  return {
    claimId: canonicalClaim._id,
    domain: canonicalClaim.domain,
    title: canonicalClaim.title,
    excerpt: extractExcerpt(output.body),
    publishedAt: output.createdAt,
    readTimeMinutes: estimateReadTimeMinutes(output.body),
    recommendation: consensus?.recommendation ?? null,
    recommendationLabel: recommendationLabel(consensus?.recommendation ?? undefined),
    confidence: consensus?.confidence ?? null,
  };
};

type BlogSummary = ReturnType<typeof toBlogSummary>;
type BlogAvailability = {
  claimId: Id<"claims">;
  hasBlog: boolean;
  publishedAt: number | null;
};

export const getByClaimId = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.isHidden) {
      return null;
    }

    const [output, consensus] = await Promise.all([
      getLatestBlogOutputForClaim(ctx, args.claimId),
      getLatestConsensusForClaim(ctx, args.claimId),
    ]);
    if (!output) {
      return null;
    }

    return {
      ...toBlogSummary(claim, output, consensus),
      body: output.body,
      claimBody: claim.body,
      sources: claim.sources ?? [],
      claimCreatedAt: claim.createdAt,
      authorName: claim.authorName,
      authorType: claim.authorType,
      protocol: claim.protocol ?? null,
    };
  },
});

export const listAvailability = query({
  args: {
    claimIds: v.array(v.id("claims")),
  },
  handler: async (ctx, args) => {
    const seen = new Set<string>();
    const uniqueClaimIds = args.claimIds.filter((claimId) => {
      const key = String(claimId);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const availability: BlogAvailability[] = [];
    for (const claimId of uniqueClaimIds) {
      const output = await getLatestBlogOutputForClaim(ctx, claimId);
      availability.push({
        claimId,
        hasBlog: Boolean(output),
        publishedAt: output?.createdAt ?? null,
      });
    }
    return availability;
  },
});

export const listPublished = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const scanLimit = Math.min(MAX_SCAN_LIMIT, Math.max(limit * 6, limit));
    const claims = await ctx.db
      .query("claims")
      .withIndex("by_createdAt")
      .order("desc")
      .take(scanLimit);

    const published: BlogSummary[] = [];
    for (const claim of claims) {
      if (claim.isHidden) continue;

      const output = await getLatestBlogOutputForClaim(ctx, claim._id);
      if (!output) continue;

      const consensus = await getLatestConsensusForClaim(ctx, claim._id);
      published.push(toBlogSummary(claim, output, consensus));
      if (published.length >= limit) break;
    }

    return published.sort((a, b) => b.publishedAt - a.publishedAt);
  },
});

export const generateForClaim = internalMutation({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.isHidden) {
      return null;
    }

    const pipeline = await ctx.db
      .query("claimPipelineState")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .first();
    if (!pipeline || pipeline.status !== "complete") {
      return null;
    }

    const consensus = await getLatestConsensusForClaim(ctx, args.claimId);
    if (!consensus) {
      return null;
    }

    const body = buildReadableBody(withCanonicalClaimDomain(claim), consensus);
    const existing = await getLatestBlogOutputForClaim(ctx, args.claimId);
    if (existing && existing.body.trim() === body) {
      return existing._id;
    }

    return ctx.db.insert("claimOutputs", {
      claimId: args.claimId,
      body,
      constraintsSatisfied: [BLOG_MARKER, BLOG_AUDIENCE, BLOG_SOURCE],
      apiKeyId: consensus.apiKeyId,
      agentName: consensus.agentName,
      agentModel: consensus.agentModel ?? undefined,
      keyPrefix: consensus.keyPrefix,
      agentAvatarUrl: consensus.agentAvatarUrl ?? undefined,
      createdAt: Date.now(),
    });
  },
});
