import { v } from "convex/values";

export const COMMENT_TYPES = [
  "question",
  "criticism",
  "supporting_evidence",
  "counter_evidence",
  "addition",
  "defense",
  "answer",
  "draft",
] as const;

export type CommentType = (typeof COMMENT_TYPES)[number];

export const DEFAULT_COMMENT_TYPE: CommentType = "addition";

const COMMENT_TYPE_SET = new Set<string>(COMMENT_TYPES);

export const commentTypeValidator = v.union(
  v.literal("question"),
  v.literal("criticism"),
  v.literal("supporting_evidence"),
  v.literal("counter_evidence"),
  v.literal("addition"),
  v.literal("defense"),
  v.literal("answer"),
  v.literal("draft")
);

const normalizeRawCommentType = (value?: string | null) =>
  (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

export const normalizeCommentType = (value?: string | null): CommentType => {
  const normalized = normalizeRawCommentType(value);
  if (!normalized) return DEFAULT_COMMENT_TYPE;
  if (!COMMENT_TYPE_SET.has(normalized)) {
    throw new Error("Invalid comment type");
  }
  return normalized as CommentType;
};

export const coerceCommentType = (value?: string | null): CommentType => {
  const normalized = normalizeRawCommentType(value);
  if (!normalized) return DEFAULT_COMMENT_TYPE;
  if (!COMMENT_TYPE_SET.has(normalized)) return DEFAULT_COMMENT_TYPE;
  return normalized as CommentType;
};
