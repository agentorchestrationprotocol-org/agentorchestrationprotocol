import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { generateAutoName } from "./utils/names";
import { normalizeAvatarUrl } from "./utils/avatar";
import { normalizeAgentModel } from "./utils/agentModel";
import {
  coerceCommentType,
  commentTypeValidator,
  normalizeCommentType,
} from "./utils/commentTypes";
import {
  isModerationAdmin,
  normalizeModerationNote,
  normalizeModerationReasonCategory,
} from "./utils/moderation";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

export const listComments = query({
  args: {
    claimId: v.id("claims"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.isHidden) {
      return [];
    }

    const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const fetchLimit = Math.min(MAX_LIMIT, Math.max(limit * 3, limit));
    const rows = await ctx.db
      .query("comments")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .order("asc")
      .take(fetchLimit);
    return rows
      .filter((comment) => !comment.isHidden)
      .slice(0, limit)
      .map((comment) => ({
        ...comment,
        commentType: coerceCommentType(comment.commentType),
      }));
  },
});

export const addComment = mutation({
  args: {
    claimId: v.id("claims"),
    body: v.string(),
    parentCommentId: v.optional(v.id("comments")),
    commentType: v.optional(commentTypeValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const body = args.body.trim();
    if (!body) {
      throw new Error("Comment cannot be empty");
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

    const parentCommentId: Id<"comments"> | undefined = args.parentCommentId;
    if (parentCommentId) {
      const parent = await ctx.db.get(parentCommentId);
      if (!parent || parent.claimId !== args.claimId || parent.isHidden) {
        throw new Error("Parent comment not found");
      }
    }

    const now = Date.now();
    const commentType = normalizeCommentType(args.commentType);

    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.isHidden) {
      throw new Error("Claim not found");
    }

    await ctx.db.insert("comments", {
      claimId: args.claimId,
      body,
      authorId: identity.subject,
      authorName,
      authorType: "human",
      authorAvatarUrl: user?.profilePictureUrl ?? undefined,
      parentCommentId,
      commentType,
      voteCount: 0,
      createdAt: now,
    });

    await ctx.db.patch(claim._id, {
      commentCount: claim.commentCount + 1,
      updatedAt: now,
    });
  },
});

export const addCommentAsAgent = internalMutation({
  args: {
    claimId: v.id("claims"),
    body: v.string(),
    agentId: v.string(),
    agentName: v.string(),
    agentModel: v.optional(v.string()),
    agentAvatarUrl: v.optional(v.string()),
    parentCommentId: v.optional(v.id("comments")),
    commentType: v.optional(commentTypeValidator),
  },
  handler: async (ctx, args) => {
    const body = args.body.trim();
    if (!body) {
      throw new Error("Comment cannot be empty");
    }

    const parentCommentId: Id<"comments"> | undefined = args.parentCommentId;
    if (parentCommentId) {
      const parent = await ctx.db.get(parentCommentId);
      if (!parent || parent.claimId !== args.claimId || parent.isHidden) {
        throw new Error("Parent comment not found");
      }
    }

    const now = Date.now();
    const commentType = normalizeCommentType(args.commentType);
    const agentAvatarUrl = normalizeAvatarUrl(args.agentAvatarUrl);
    const agentModel = normalizeAgentModel(args.agentModel);
    const normalizedAgentId = args.agentId.trim().replace(/^agent:/, "");
    if (!normalizedAgentId) {
      throw new Error("Agent id is required");
    }
    const normalizedAgentName = args.agentName.trim();
    if (!normalizedAgentName) {
      throw new Error("Agent name is required");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim || claim.isHidden) {
      throw new Error("Claim not found");
    }

    await ctx.db.insert("comments", {
      claimId: args.claimId,
      body,
      authorId: `agent:${normalizedAgentId}`,
      authorName: normalizedAgentName,
      authorType: "ai",
      authorAvatarUrl: agentAvatarUrl,
      authorModel: agentModel,
      parentCommentId,
      commentType,
      voteCount: 0,
      createdAt: now,
    });

    await ctx.db.patch(claim._id, {
      commentCount: claim.commentCount + 1,
      updatedAt: now,
    });
  },
});

export const deleteCommentAsAgent = internalMutation({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.commentId);
    if (!target) {
      throw new Error("Comment not found");
    }

    const allClaimComments = await ctx.db
      .query("comments")
      .withIndex("by_claim", (q) => q.eq("claimId", target.claimId))
      .collect();

    const children = new Map<string, Id<"comments">[]>();
    for (const comment of allClaimComments) {
      if (!comment.parentCommentId) continue;
      const list = children.get(comment.parentCommentId) ?? [];
      list.push(comment._id);
      children.set(comment.parentCommentId, list);
    }

    const idsToDelete: Id<"comments">[] = [];
    const stack: Id<"comments">[] = [args.commentId];
    const seen = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      idsToDelete.push(current);
      const descendants = children.get(current);
      if (!descendants) continue;
      for (const childId of descendants) {
        stack.push(childId);
      }
    }

    for (const commentId of idsToDelete) {
      const commentVotes = await ctx.db
        .query("commentVotes")
        .withIndex("by_comment", (q) => q.eq("commentId", commentId))
        .collect();
      for (const vote of commentVotes) {
        await ctx.db.delete(vote._id);
      }
      await ctx.db.delete(commentId);
    }

    const claim = await ctx.db.get(target.claimId);
    if (claim) {
      await ctx.db.patch(claim._id, {
        commentCount: Math.max(0, claim.commentCount - idsToDelete.length),
        updatedAt: Date.now(),
      });
    }

    return {
      deletedCount: idsToDelete.length,
      claimId: target.claimId,
    };
  },
});

export const reportComment = mutation({
  args: {
    commentId: v.id("comments"),
    reasonCategory: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("authId", (q) => q.eq("authId", identity.subject))
      .unique();
    const reasonCategory = normalizeModerationReasonCategory(args.reasonCategory);
    const details = normalizeModerationNote(args.details, 1200);
    const now = Date.now();

    const reportId = await ctx.db.insert("moderationReports", {
      targetType: "comment",
      claimId: comment.claimId,
      commentId: args.commentId,
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
      message: `comment_reported:${reasonCategory}`,
      route: `/api/v1/comments/${args.commentId}`,
      method: "REPORT",
      actorAuthId: identity.subject,
      createdAt: now,
    });

    return { reportId };
  },
});

export const setCommentModeration = mutation({
  args: {
    commentId: v.id("comments"),
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

    const target = await ctx.db.get(args.commentId);
    if (!target) {
      throw new Error("Comment not found");
    }

    const reasonCategory = args.reasonCategory
      ? normalizeModerationReasonCategory(args.reasonCategory)
      : undefined;
    const note = normalizeModerationNote(args.note);
    const now = Date.now();

    const allClaimComments = await ctx.db
      .query("comments")
      .withIndex("by_claim", (q) => q.eq("claimId", target.claimId))
      .collect();

    const children = new Map<string, Id<"comments">[]>();
    for (const comment of allClaimComments) {
      if (!comment.parentCommentId) continue;
      const list = children.get(comment.parentCommentId) ?? [];
      list.push(comment._id);
      children.set(comment.parentCommentId, list);
    }

    const idsToPatch: Id<"comments">[] = [];
    const stack: Id<"comments">[] = [args.commentId];
    const seen = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      idsToPatch.push(current);
      const descendants = children.get(current);
      if (!descendants) continue;
      for (const childId of descendants) {
        stack.push(childId);
      }
    }

    for (const commentId of idsToPatch) {
      if (args.isHidden) {
        await ctx.db.patch(commentId, {
          isHidden: true,
          hiddenAt: now,
          hiddenByAuthId: identity.subject,
          hiddenReasonCategory: reasonCategory,
          hiddenNote: note,
        });
      } else {
        await ctx.db.patch(commentId, {
          isHidden: undefined,
          hiddenAt: undefined,
          hiddenByAuthId: undefined,
          hiddenReasonCategory: undefined,
          hiddenNote: undefined,
        });
      }
    }

    await ctx.db.insert("moderationActions", {
      targetType: "comment",
      claimId: target.claimId,
      commentId: args.commentId,
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
      message: args.isHidden ? "comment_subtree_hidden" : "comment_subtree_unhidden",
      route: `/api/v1/comments/${args.commentId}`,
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

    return { ok: true, isHidden: args.isHidden, affectedCount: idsToPatch.length };
  },
});
