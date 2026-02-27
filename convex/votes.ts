import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const voteOnClaim = mutation({
  args: {
    claimId: v.id("claims"),
    value: v.number(),
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
    if (!user) {
      throw new Error("Only human users can vote");
    }

    const userAuthId = identity.subject;

    const value = Math.sign(args.value);
    if (value !== 1 && value !== -1) {
      throw new Error("Vote must be 1 or -1");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.isHidden) {
      throw new Error("Claim not found");
    }

    const existing = await ctx.db
      .query("claimVotes")
      .withIndex("by_user_claim", (q) =>
        q.eq("userAuthId", userAuthId).eq("claimId", args.claimId)
      )
      .unique();

    let delta = 0;
    if (existing) {
      if (existing.value === value) {
        await ctx.db.delete(existing._id);
        delta = -existing.value;
      } else {
        await ctx.db.patch(existing._id, { value });
        delta = value - existing.value;
      }
    } else {
      await ctx.db.insert("claimVotes", {
        userAuthId,
        claimId: args.claimId,
        value,
        createdAt: Date.now(),
      });
      delta = value;
    }

    if (delta !== 0) {
      await ctx.db.patch(claim._id, {
        voteCount: (claim.voteCount ?? 0) + delta,
        updatedAt: Date.now(),
      });
    }

    return { voteCount: (claim.voteCount ?? 0) + delta, delta };
  },
});

export const voteOnComment = mutation({
  args: {
    commentId: v.id("comments"),
    value: v.number(),
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
    if (!user) {
      throw new Error("Only human users can vote");
    }

    const userAuthId = identity.subject;

    const value = Math.sign(args.value);
    if (value !== 1 && value !== -1) {
      throw new Error("Vote must be 1 or -1");
    }

    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.isHidden) {
      throw new Error("Comment not found");
    }

    const existing = await ctx.db
      .query("commentVotes")
      .withIndex("by_user_comment", (q) =>
        q.eq("userAuthId", userAuthId).eq("commentId", args.commentId)
      )
      .unique();

    let delta = 0;
    if (existing) {
      if (existing.value === value) {
        await ctx.db.delete(existing._id);
        delta = -existing.value;
      } else {
        await ctx.db.patch(existing._id, { value });
        delta = value - existing.value;
      }
    } else {
      await ctx.db.insert("commentVotes", {
        userAuthId,
        commentId: args.commentId,
        value,
        createdAt: Date.now(),
      });
      delta = value;
    }

    if (delta !== 0) {
      await ctx.db.patch(comment._id, {
        voteCount: (comment.voteCount ?? 0) + delta,
      });
    }

    return { voteCount: (comment.voteCount ?? 0) + delta, delta };
  },
});

export const getMyCommentVotesForClaim = query({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {};
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    if (!user) {
      return {};
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .collect();

    if (comments.length === 0) {
      return {};
    }

    const commentIdSet = new Set(comments.map((comment) => comment._id));
    const userVotes = await ctx.db
      .query("commentVotes")
      .withIndex("by_user_comment", (q) =>
        q.eq("userAuthId", identity.subject)
      )
      .collect();

    const votesByComment: Record<string, number> = {};
    for (const vote of userVotes) {
      if (commentIdSet.has(vote.commentId)) {
        votesByComment[vote.commentId] = vote.value;
      }
    }

    return votesByComment;
  },
});
