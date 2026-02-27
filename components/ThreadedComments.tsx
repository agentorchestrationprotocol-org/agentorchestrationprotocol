"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import BotAvatar from "@/components/BotAvatar";
import ReportContentButton from "@/components/ReportContentButton";
import { formatAgentDisplayName } from "@/lib/agents";

type Comment = Doc<"comments">;
type SortMode = "top" | "new" | "old";
type CommentNode = Comment & { replies: CommentNode[]; replyCount: number };
type CommentType = "question" | "criticism" | "supporting_evidence" | "counter_evidence" | "addition" | "defense" | "answer";

type ThreadedCommentsProps = {
  claimId: Id<"claims">;
  comments?: Comment[];
  compact?: boolean;
};

const COMMENT_TYPES: CommentType[] = [
  "question",
  "criticism",
  "supporting_evidence",
  "counter_evidence",
  "addition",
  "defense",
  "answer",
];

const COMMENT_TYPE_SET = new Set<string>(COMMENT_TYPES);
const DEFAULT_COMMENT_TYPE: CommentType = "addition";

const normalizeCommentType = (value?: string | null): CommentType => {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (COMMENT_TYPE_SET.has(normalized)) {
    return normalized as CommentType;
  }
  return DEFAULT_COMMENT_TYPE;
};

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "blockquote"; lines: string[] }
  | { type: "code"; lang?: string; content: string };

const INLINE_TOKEN_REGEX =
  /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;

const toSafeLink = (value: string) => {
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
};

const renderInlineMarkdown = (input: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let last = 0;
  let token = 0;

  for (const match of input.matchAll(INLINE_TOKEN_REGEX)) {
    const index = match.index ?? 0;
    if (index > last) {
      nodes.push(input.slice(last, index));
    }

    const [full] = match;
    const linkText = match[2];
    const linkHref = match[3];
    const codeText = match[4];
    const strongText = match[5] ?? match[6];
    const emText = match[7] ?? match[8];

    if (linkText && linkHref) {
      const safeHref = toSafeLink(linkHref.trim());
      if (safeHref) {
        nodes.push(
          <a
            key={`${keyPrefix}-link-${token}`}
            href={safeHref}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-white/30 underline-offset-2 hover:text-[var(--ink)]"
          >
            {linkText}
          </a>
        );
      } else {
        nodes.push(full);
      }
    } else if (codeText) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${token}`}
          className="rounded px-1 py-0.5 font-mono text-[0.9em] text-[var(--ink)]"
        >
          {codeText}
        </code>
      );
    } else if (strongText) {
      nodes.push(
        <strong key={`${keyPrefix}-strong-${token}`} className="font-semibold text-[var(--ink)]">
          {strongText}
        </strong>
      );
    } else if (emText) {
      nodes.push(
        <em key={`${keyPrefix}-em-${token}`} className="italic text-[var(--ink-soft)]">
          {emText}
        </em>
      );
    } else {
      nodes.push(full);
    }

    token += 1;
    last = index + full.length;
  }

  if (last < input.length) {
    nodes.push(input.slice(last));
  }

  return nodes;
};

const parseMarkdownBlocks = (markdown: string): MarkdownBlock[] => {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  const isUnordered = (line: string) => /^\s*[-*]\s+/.test(line);
  const isOrdered = (line: string) => /^\s*\d+\.\s+/.test(line);

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || undefined;
      i += 1;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) {
        i += 1;
      }
      blocks.push({
        type: "code",
        lang,
        content: codeLines.join("\n"),
      });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    if (isUnordered(line)) {
      const items: string[] = [];
      while (i < lines.length && isUnordered(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (isOrdered(line)) {
      const items: string[] = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const next = lines[i];
      if (
        !next.trim() ||
        next.startsWith("```") ||
        /^(#{1,6})\s+/.test(next) ||
        /^\s*>\s?/.test(next) ||
        isUnordered(next) ||
        isOrdered(next)
      ) {
        break;
      }
      paragraphLines.push(next);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ").trim() });
  }

  return blocks;
};

function MarkdownComment({ value }: { value: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(value), [value]);

  if (!value.trim()) {
    return null;
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const key = `md-${index}`;

        if (block.type === "heading") {
          const headingClass =
            block.level <= 2
              ? "text-base font-semibold text-[var(--ink)]"
              : "text-sm font-semibold text-[var(--ink)]";
          return (
            <p key={key} className={headingClass}>
              {renderInlineMarkdown(block.text, `${key}-heading`)}
            </p>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote key={key} className="pl-3 italic text-[var(--muted)]">
              {block.lines.map((line, lineIndex) => (
                <p key={`${key}-q-${lineIndex}`}>{renderInlineMarkdown(line, `${key}-q-${lineIndex}`)}</p>
              ))}
            </blockquote>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={key} className="list-disc pl-5 text-[var(--ink-soft)]">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-li-${itemIndex}`}>{renderInlineMarkdown(item, `${key}-li-${itemIndex}`)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={key} className="list-decimal pl-5 text-[var(--ink-soft)]">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-li-${itemIndex}`}>{renderInlineMarkdown(item, `${key}-li-${itemIndex}`)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "code") {
          return (
            <pre key={key} className="overflow-x-auto whitespace-pre-wrap rounded-md p-2 font-mono text-xs text-[var(--ink-soft)]">
              <code>{block.content}</code>
              {block.lang ? <span className="ml-2 text-[10px] text-[var(--muted)]">({block.lang})</span> : null}
            </pre>
          );
        }

        return (
          <p key={key} className="whitespace-pre-wrap text-[var(--ink-soft)]">
            {renderInlineMarkdown(block.text, `${key}-p`)}
          </p>
        );
      })}
    </div>
  );
}

const buildTree = (comments: Comment[], sortMode: SortMode) => {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => {
    nodes.set(comment._id, { ...comment, replies: [], replyCount: 0 });
  });

  nodes.forEach((node) => {
    if (node.parentCommentId && nodes.has(node.parentCommentId)) {
      nodes.get(node.parentCommentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  const computeReplyCounts = (node: CommentNode): number => {
    const count = node.replies.reduce((sum, reply) => sum + 1 + computeReplyCounts(reply), 0);
    node.replyCount = count;
    return count;
  };

  roots.forEach((root) => computeReplyCounts(root));

  const sortNodes = (items: CommentNode[]) => {
    items.sort((a, b) => {
      if (sortMode === "new") return b.createdAt - a.createdAt;
      if (sortMode === "old") return a.createdAt - b.createdAt;
      const aVotes = a.voteCount ?? 0;
      const bVotes = b.voteCount ?? 0;
      if (bVotes !== aVotes) return bVotes - aVotes;
      if (b.replyCount !== a.replyCount) return b.replyCount - a.replyCount;
      return b.createdAt - a.createdAt;
    });
    items.forEach((item) => sortNodes(item.replies));
  };

  sortNodes(roots);
  return roots;
};

const formatTimeAgo = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const QuestionIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.3 9a2.7 2.7 0 0 1 5.1 1.2c0 2-2.4 2.3-2.4 4" />
    <circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const CriticismIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3l9 16H3z" />
    <path d="M12 9v4" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const SupportingEvidenceIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l2.7 2.7L16.5 9" />
  </svg>
);

const CounterEvidenceIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </svg>
);

const AdditionIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const DefenseIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3l7 4v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V7l7-4z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const AnswerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" />
    <path d="M9.3 9a2.7 2.7 0 0 1 5.1 1.2c0 1.2-1.8 1.8-1.8 1.8" />
    <circle cx="12.6" cy="15.5" r="0.5" fill="currentColor" stroke="none" />
  </svg>
);

const HumanIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="7" r="3" />
    <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
  </svg>
);

const RobotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 3h6v3H9z" />
    <rect x="5" y="6" width="14" height="12" rx="3" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M8 16h8" />
  </svg>
);

const UpvoteIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4l-8 8h5v8h6v-8h5z" />
  </svg>
);

const DownvoteIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 20l8-8h-5v-8h-6v8h-5z" />
  </svg>
);

const COMMENT_TYPE_META: Record<
  CommentType,
  {
    label: string;
    hint: string;
    badgeClass: string;
    activeClass: string;
    icon: ({ className }: { className?: string }) => ReactNode;
  }
> = {
  question: {
    label: "Question",
    hint: "Asks for clarification or missing context.",
    badgeClass: "bg-sky-500/15 text-sky-200 ring-sky-400/35",
    activeClass: "bg-sky-500/30 text-sky-100 ring-sky-300/60",
    icon: QuestionIcon,
  },
  criticism: {
    label: "Criticism",
    hint: "Challenges assumptions or identifies flaws.",
    badgeClass: "bg-rose-500/15 text-rose-200 ring-rose-400/35",
    activeClass: "bg-rose-500/30 text-rose-100 ring-rose-300/60",
    icon: CriticismIcon,
  },
  supporting_evidence: {
    label: "Supporting Evidence",
    hint: "Adds facts that support the claim.",
    badgeClass: "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35",
    activeClass: "bg-emerald-500/30 text-emerald-100 ring-emerald-300/60",
    icon: SupportingEvidenceIcon,
  },
  counter_evidence: {
    label: "Counter Evidence",
    hint: "Adds facts that weaken the claim.",
    badgeClass: "bg-amber-500/15 text-amber-200 ring-amber-400/35",
    activeClass: "bg-amber-500/30 text-amber-100 ring-amber-300/60",
    icon: CounterEvidenceIcon,
  },
  addition: {
    label: "Addition",
    hint: "Adds context without strong agreement/disagreement.",
    badgeClass: "bg-zinc-500/20 text-zinc-200 ring-zinc-400/35",
    activeClass: "bg-zinc-500/35 text-zinc-100 ring-zinc-300/60",
    icon: AdditionIcon,
  },
  defense: {
    label: "Defense",
    hint: "Responds to a criticism by defending the claim.",
    badgeClass: "bg-indigo-500/15 text-indigo-200 ring-indigo-400/35",
    activeClass: "bg-indigo-500/30 text-indigo-100 ring-indigo-300/60",
    icon: DefenseIcon,
  },
  answer: {
    label: "Answer",
    hint: "Directly answers a question raised in the thread.",
    badgeClass: "bg-teal-500/15 text-teal-200 ring-teal-400/35",
    activeClass: "bg-teal-500/30 text-teal-100 ring-teal-300/60",
    icon: AnswerIcon,
  },
};

const CommentComposer = ({
  claimId,
  parentCommentId,
  onDone,
  compact,
}: {
  claimId: Id<"claims">;
  parentCommentId?: Id<"comments">;
  onDone?: () => void;
  compact?: boolean;
}) => {
  const addComment = useMutation(api.comments.addComment);
  const [body, setBody] = useState("");
  const [commentType, setCommentType] = useState<CommentType>(DEFAULT_COMMENT_TYPE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = body.trim().length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addComment({
        claimId,
        body: body.trim(),
        parentCommentId,
        commentType,
      });
      setBody("");
      setCommentType(DEFAULT_COMMENT_TYPE);
      onDone?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const rows = compact ? 2 : 3;
  const wrapper = compact ? "p-3" : "p-4";
  const buttonLabel = parentCommentId ? "Post reply" : "Post comment";
  const placeholder = parentCommentId ? "Write a reply..." : "Add a comment...";

  return (
    <div className={`surface-panel ${wrapper}`}>
      <Authenticated>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Comment type
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMENT_TYPES.map((type) => {
                const meta = COMMENT_TYPE_META[type];
                const selected = commentType === type;
                const Icon = meta.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCommentType(type)}
                    title={meta.hint}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ring-1 transition ${
                      selected
                        ? meta.activeClass
                        : "text-[var(--muted)] ring-white/15 hover:text-[var(--ink-soft)] hover:ring-white/25"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              {COMMENT_TYPE_META[commentType].hint}
            </p>
          </div>
          <textarea
            className="field min-h-[84px] text-sm"
            rows={rows}
            placeholder={placeholder}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Posting..." : buttonLabel}
            </button>
            {parentCommentId && (
              <button
                type="button"
                onClick={onDone}
                className="btn-ghost px-2 py-1 text-xs font-semibold"
              >
                Cancel
              </button>
            )}
            {!parentCommentId && (
              <span className="text-xs text-[var(--muted)]">Public · Markdown supported</span>
            )}
          </div>
        </form>
      </Authenticated>
      <Unauthenticated>
        <p className="text-xs text-[var(--muted)]">Sign in to add a comment.</p>
      </Unauthenticated>
    </div>
  );
};

const CommentNodeView = ({
  node,
  depth,
  claimId,
  compact,
  collapseAll,
  isAuthed,
  voteValueFor,
  onVote,
}: {
  node: CommentNode;
  depth: number;
  claimId: Id<"claims">;
  compact?: boolean;
  collapseAll: boolean;
  isAuthed: boolean;
  voteValueFor: (commentId: Id<"comments">) => number;
  onVote: (commentId: Id<"comments">, value: 1 | -1) => Promise<void>;
}) => {
  const [isReplying, setIsReplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const authorBadge = node.authorType === "ai" ? "AI" : "Human";
  const authorAvatarUrl = (node as CommentNode & { authorAvatarUrl?: string }).authorAvatarUrl;
  const authorModel = (node as CommentNode & { authorModel?: string }).authorModel;
  const commentType = normalizeCommentType(
    (node as CommentNode & { commentType?: string | null }).commentType
  );
  const commentTypeMeta = COMMENT_TYPE_META[commentType];
  const CommentTypeIcon = commentTypeMeta.icon;
  const authorDisplayName =
    node.authorType === "ai"
      ? formatAgentDisplayName(node.authorName, authorModel)
      : node.authorName;
  const margin = compact ? depth * 12 : depth * 16;

  const collapsed = collapseAll ? true : isCollapsed;
  const voteValue = voteValueFor(node._id);

  const handleVote = async (value: 1 | -1) => {
    if (!isAuthed || isVoting) return;
    setIsVoting(true);
    try {
      await onVote(node._id, value);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="space-y-2" style={{ marginLeft: margin }}>
      <div className="surface-panel p-3">
        <div className="flex items-center gap-2 text-xs">
          {node.authorType === "ai" ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink)]">
              <BotAvatar
                seed={`${node.authorId}:${node.authorName}`}
                label={authorDisplayName}
                imageUrl={authorAvatarUrl}
                className="h-4 w-4"
              />
              {authorDisplayName}
            </span>
          ) : (
            <span className="font-semibold text-[var(--ink)]">{node.authorName}</span>
          )}
          <span className="text-[var(--muted)]">•</span>
          <span className="text-[var(--muted)]">{formatTimeAgo(node.createdAt)}</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${commentTypeMeta.badgeClass}`}
          >
            <CommentTypeIcon className="h-3.5 w-3.5" />
            {commentTypeMeta.label}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {node.replyCount > 0 && (
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="btn-ghost px-2 py-1 text-xs font-semibold"
              >
                {collapsed ? `Expand (${node.replyCount})` : "Collapse"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsReplying((prev) => !prev)}
              className="btn-ghost px-2 py-1 text-xs font-semibold"
            >
              Reply
            </button>
            <ReportContentButton
              targetType="comment"
              commentId={node._id}
              className="btn-ghost px-2 py-1 text-xs font-semibold"
            />
            <button
              type="button"
              onClick={() => void handleVote(1)}
              className={`btn-ghost px-1 py-1 ${voteValue === 1 ? "text-[var(--upvote)]" : ""} disabled:cursor-not-allowed disabled:opacity-50`}
              title={isAuthed ? "Upvote" : "Sign in to vote"}
              disabled={!isAuthed || isVoting}
            >
              <UpvoteIcon className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-5 text-center text-xs font-semibold text-[var(--ink-soft)]">
              {node.voteCount ?? 0}
            </span>
            <button
              type="button"
              onClick={() => void handleVote(-1)}
              className={`btn-ghost px-1 py-1 ${voteValue === -1 ? "text-[var(--downvote)]" : ""} disabled:cursor-not-allowed disabled:opacity-50`}
              title={isAuthed ? "Downvote" : "Sign in to vote"}
              disabled={!isAuthed || isVoting}
            >
              <DownvoteIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="chip pointer-events-none inline-flex items-center gap-1.5">
            {authorBadge === "AI" ? (
              <RobotIcon className="h-3.5 w-3.5" />
            ) : (
              <HumanIcon className="h-3.5 w-3.5" />
            )}
            {authorBadge}
          </span>
        </div>
        <div className="mt-2 text-sm leading-relaxed">
          <MarkdownComment value={node.body} />
        </div>
      </div>

      {isReplying && (
        <CommentComposer
          claimId={claimId}
          parentCommentId={node._id}
          onDone={() => setIsReplying(false)}
          compact={compact}
        />
      )}

      {!collapsed && node.replies.length > 0 && (
        <div className="space-y-2">
          {node.replies.map((reply) => (
            <CommentNodeView
              key={reply._id}
              node={reply}
              depth={depth + 1}
              claimId={claimId}
              compact={compact}
              collapseAll={collapseAll}
              isAuthed={isAuthed}
              voteValueFor={voteValueFor}
              onVote={onVote}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function ThreadedComments({ claimId, comments, compact }: ThreadedCommentsProps) {
  const { user } = useAuth();
  const [limit, setLimit] = useState(50);
  const [sortMode, setSortMode] = useState<SortMode>("top");
  const [collapseAll, setCollapseAll] = useState(false);
  const voteOnComment = useMutation(api.votes.voteOnComment);
  const myCommentVotes = useQuery(api.votes.getMyCommentVotesForClaim, { claimId });
  const fetchedComments = useQuery(api.comments.listComments, { claimId, limit });
  const resolvedComments = comments ?? fetchedComments;
  const isAuthed = Boolean(user);
  const votesByComment = (myCommentVotes ?? {}) as Record<string, number>;

  const voteValueFor = (commentId: Id<"comments">) =>
    typeof votesByComment[commentId] === "number" ? votesByComment[commentId] : 0;

  const handleVoteOnComment = async (commentId: Id<"comments">, value: 1 | -1) => {
    await voteOnComment({ commentId, value });
  };

  const tree = useMemo(
    () => (resolvedComments ? buildTree(resolvedComments, sortMode) : []),
    [resolvedComments, sortMode]
  );
  const canLoadMore =
    resolvedComments !== undefined && resolvedComments.length >= limit && limit < 500;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span className="text-xs font-semibold uppercase tracking-[0.16em]">Sort</span>
        {(["top", "new", "old"] as SortMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setSortMode(mode)}
            className={sortMode === mode ? "chip text-[var(--ink)]" : "chip"}
          >
            {mode}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCollapseAll((prev) => !prev);
          }}
          className="btn-ghost ml-auto px-2.5 py-1.5 text-xs font-semibold"
        >
          {collapseAll ? "Expand all" : "Collapse all"}
        </button>
      </div>

      <CommentComposer claimId={claimId} compact={compact} />

      {resolvedComments === undefined ? (
        <p className="text-sm text-[var(--muted)]">Loading comments...</p>
      ) : resolvedComments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No comments yet.</p>
      ) : (
        <div className="space-y-3">
          {tree.map((node) => (
            <CommentNodeView
              key={node._id}
              node={node}
              depth={0}
              claimId={claimId}
              compact={compact}
              collapseAll={collapseAll}
              isAuthed={isAuthed}
              voteValueFor={voteValueFor}
              onVote={handleVoteOnComment}
            />
          ))}
        </div>
      )}

      {canLoadMore && (
        <button
          type="button"
          onClick={() => setLimit((prev) => Math.min(prev + 50, 500))}
          className="btn-secondary px-3 py-1.5 text-xs"
        >
          Load more comments
        </button>
      )}
    </div>
  );
}
