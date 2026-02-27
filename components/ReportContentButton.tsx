"use client";

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const REASON_OPTIONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate speech" },
  { value: "violence", label: "Violence" },
  { value: "sexual", label: "Sexual content" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Other" },
];

const formatErrorMessage = (error: unknown) => {
  const raw =
    typeof (error as { message?: string })?.message === "string"
      ? (error as { message: string }).message
      : String(error ?? "");
  return raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/Server Error\s*/gi, "")
    .replace(/Uncaught Error:\s*/gi, "")
    .replace(/Error:\s*/gi, "")
    .replace(/\[Request ID:[^\]]+\]\s*/gi, "")
    .trim();
};

type ReportContentButtonProps =
  | {
      targetType: "claim";
      claimId: Id<"claims">;
      className?: string;
    }
  | {
      targetType: "comment";
      commentId: Id<"comments">;
      className?: string;
    };

export default function ReportContentButton(props: ReportContentButtonProps) {
  const { user } = useAuth();
  const reportClaim = useMutation(api.claims.reportClaim);
  const reportComment = useMutation(api.comments.reportComment);

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reasonCategory, setReasonCategory] = useState(REASON_OPTIONS[0].value);
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const triggerClassName = useMemo(
    () =>
      props.className ??
      "rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] hover:text-[var(--ink)]",
    [props.className]
  );

  const submit = async () => {
    if (!user || isSubmitting) return;
    setIsSubmitting(true);
    setStatus(null);
    try {
      if (props.targetType === "claim") {
        await reportClaim({
          claimId: props.claimId,
          reasonCategory,
          details: details.trim() || undefined,
        });
      } else {
        await reportComment({
          commentId: props.commentId,
          reasonCategory,
          details: details.trim() || undefined,
        });
      }
      setStatus("Report submitted.");
      setDetails("");
      setTimeout(() => {
        setIsOpen(false);
      }, 700);
    } catch (error: unknown) {
      setStatus(formatErrorMessage(error) || "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setStatus(null);
        }}
        className={triggerClassName}
      >
        Report
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Reason
        </label>
        <select
          value={reasonCategory}
          onChange={(event) => setReasonCategory(event.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--ink)] outline-none focus:border-[var(--border-hover)]"
        >
          {REASON_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        placeholder="Optional context for moderators"
        rows={2}
        className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--border-hover)]"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isSubmitting}
          className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Sending..." : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setStatus(null);
          }}
          className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] hover:text-[var(--ink)]"
        >
          Cancel
        </button>
        {status && <span className="text-[10px] text-[var(--muted)]">{status}</span>}
      </div>
    </div>
  );
}
