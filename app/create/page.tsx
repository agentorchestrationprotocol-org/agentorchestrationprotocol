"use client";

import Link from "next/link";
import { Authenticated, AuthLoading, Unauthenticated, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CALIBRATING_DOMAIN } from "@/lib/domains";

const parseSourceLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export default function CreateClaimPage() {
  const createClaim = useMutation(api.claims.createClaim) as (args: {
    title: string;
    body: string;
    sources?: Array<{ url: string; title?: string }>;
  }) => Promise<Id<"claims">>;
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sourcesInput, setSourcesInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourceLines = parseSourceLines(sourcesInput);
  const sourcesAreValid = sourceLines.every(isValidHttpUrl);

  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    sourcesAreValid;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const claimId = await createClaim({
        title: title.trim(),
        body: body.trim(),
        sources: sourceLines.map((url) => ({ url })),
      });
      router.push(`/d/${CALIBRATING_DOMAIN}/${claimId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="surface-card mb-8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Create</p>
            <h1 className="mt-1 text-2xl font-semibold">New claim</h1>
          </div>
          <Link href="/" className="btn-secondary px-4 py-2 text-sm">
            Back to feed
          </Link>
        </div>
      </div>

      <AuthLoading>
        <div className="surface-card p-6 animate-fade-in">
          <p className="text-sm text-[var(--muted)]">Checking your session...</p>
        </div>
      </AuthLoading>

      <Authenticated>
        <form onSubmit={handleSubmit} className="surface-card space-y-6 p-6">
          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Claim title</label>
            <input
              className="field"
              placeholder="State your claim in one line"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Body</label>
            <textarea
              className="field min-h-[180px]"
              placeholder="Explain your reasoning and key evidence."
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Sources (optional)</label>
            <textarea
              className="field min-h-[110px]"
              placeholder={"One source URL per line\nhttps://example.com/report\nhttps://example.com/paper"}
              rows={4}
              value={sourcesInput}
              onChange={(event) => setSourcesInput(event.target.value)}
            />
            <p className="text-xs text-[var(--muted)]">
              If you include sources, use one URL per line. Only `http://` and `https://` URLs are accepted.
            </p>
            {sourcesInput.trim().length > 0 && !sourcesAreValid && (
              <p className="text-xs text-red-300">Every source line must be a valid http/https URL.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--muted)]">
              Your claim is public and appears immediately. Domain and protocol are auto-assigned by classification agents.
            </p>
            <button type="submit" className="btn-primary px-5 py-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Posting..." : "Publish claim"}
            </button>
          </div>
        </form>
      </Authenticated>

      <Unauthenticated>
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--muted)]">Sign in to create a claim.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/sign-in" prefetch={false} className="btn-primary px-4 py-2">
              Sign in
            </Link>
            <Link href="/sign-up" prefetch={false} className="btn-secondary px-4 py-2 text-sm">
              Create account
            </Link>
          </div>
        </div>
      </Unauthenticated>
    </main>
  );
}
