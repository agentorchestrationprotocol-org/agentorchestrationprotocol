import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { withCanonicalClaimDomain } from "../lib/domains";

const DEFAULT_LIST_LIMIT = 12;
const MAX_LIST_LIMIT = 36;

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

const getLatestPublishedBlogForClaim = async (
  ctx: QueryCtx,
  claimId: Id<"claims">
) => {
  const latestConsensus = await ctx.db
    .query("claimConsensus")
    .withIndex("by_claim", (q) => q.eq("claimId", claimId))
    .order("desc")
    .first();

  if (!latestConsensus) {
    return null;
  }

  const blog = await ctx.db
    .query("claimBlogs")
    .withIndex("by_claim", (q) => q.eq("claimId", claimId))
    .order("desc")
    .filter((q) => q.eq(q.field("status"), "published"))
    .first();

  if (!blog || blog.sourceConsensusId !== latestConsensus._id) {
    return null;
  }

  return blog;
};

const toBlogSummary = (claim: Doc<"claims">, blog: Doc<"claimBlogs">) => {
  const canonicalClaim = withCanonicalClaimDomain(claim);
  return {
    claimId: canonicalClaim._id,
    domain: canonicalClaim.domain,
    title: blog.title,
    dek: blog.dek,
    excerpt: blog.excerpt,
    publishedAt: blog.publishedAt,
    readTimeMinutes: blog.readTimeMinutes,
    recommendation: blog.recommendation ?? null,
    recommendationLabel: recommendationLabel(blog.recommendation ?? undefined),
    confidence: blog.confidence,
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

    const blog = await getLatestPublishedBlogForClaim(ctx, args.claimId);
    if (!blog) {
      return null;
    }

    return {
      ...toBlogSummary(claim, blog),
      body: blog.bodyMarkdown,
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
      const blog = await getLatestPublishedBlogForClaim(ctx, claimId);
      availability.push({
        claimId,
        hasBlog: Boolean(blog),
        publishedAt: blog?.publishedAt ?? null,
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
    const blogRows = await ctx.db
      .query("claimBlogs")
      .withIndex("by_status_publishedAt", (q) => q.eq("status", "published"))
      .order("desc")
      .take(limit * 3);

    const published: BlogSummary[] = [];
    const seenClaimIds = new Set<string>();
    for (const blog of blogRows) {
      if (seenClaimIds.has(String(blog.claimId))) continue;

      const claim = await ctx.db.get(blog.claimId);
      if (!claim || claim.isHidden) continue;
      const latestConsensus = await ctx.db
        .query("claimConsensus")
        .withIndex("by_claim", (q) => q.eq("claimId", blog.claimId))
        .order("desc")
        .first();
      if (!latestConsensus || latestConsensus._id !== blog.sourceConsensusId) {
        continue;
      }

      published.push(toBlogSummary(claim, blog));
      seenClaimIds.add(String(blog.claimId));
      if (published.length >= limit) break;
    }

    return published;
  },
});
