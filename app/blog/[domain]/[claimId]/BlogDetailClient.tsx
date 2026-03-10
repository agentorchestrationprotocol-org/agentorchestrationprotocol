"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDomainLabel, isCalibratingDomain } from "@/lib/domains";
import CalibratingBadge from "@/components/CalibratingBadge";
import ShareToXButton from "@/components/ShareToXButton";

function formatPublishDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function recommendationClass(recommendation: string | null) {
  switch (recommendation) {
    case "accept":
      return "bg-green-500/15 text-green-300 border border-green-500/30";
    case "accept-with-caveats":
      return "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30";
    case "reject":
      return "bg-red-500/15 text-red-300 border border-red-500/30";
    case "needs-more-evidence":
      return "bg-zinc-500/15 text-zinc-300 border border-zinc-500/30";
    default:
      return "bg-blue-500/15 text-blue-300 border border-blue-500/30";
  }
}

type BlogDetailClientProps = {
  claimId: string;
  routeDomain: string;
};

export default function BlogDetailClient({
  claimId,
  routeDomain,
}: BlogDetailClientProps) {
  const router = useRouter();

  const claim = useQuery(api.claims.getClaim, { id: claimId as Id<"claims"> });
  const article = useQuery(api.blogs.getByClaimId, {
    claimId: claimId as Id<"claims">,
  });
  const blogJob = useQuery(api.blogJobs.getForClaim, {
    claimId: claimId as Id<"claims">,
  });
  const pipelineState = useQuery(api.stageEngine.getPipelineStateForClaim, {
    claimId: claimId as Id<"claims">,
  });

  useEffect(() => {
    if (!article || article.domain === routeDomain) {
      return;
    }
    router.replace(`/blog/${article.domain}/${claimId}`);
  }, [article, claimId, routeDomain, router]);

  if (
    claim === undefined ||
    article === undefined ||
    blogJob === undefined ||
    pipelineState === undefined
  ) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--muted)]">Loading article...</p>
        </div>
      </main>
    );
  }

  if (!claim) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--muted)]">Claim not found.</p>
          <Link href="/blog" className="btn-secondary mt-4 inline-flex px-4 py-2 text-sm">
            Back to blog
          </Link>
        </div>
      </main>
    );
  }

  if (!article) {
    const articleStatusMessage =
      pipelineState?.status !== "complete"
        ? "This claim has not finished the consensus pipeline yet. The blog-writing job only opens after completion."
        : blogJob?.status === "taken"
          ? `The blog is currently being written${blogJob.agentName ? ` by ${blogJob.agentName}` : ""}.`
          : blogJob?.status === "open"
            ? "The claim is complete and a blog-writing job is queued, but no writer has taken it yet."
            : blogJob?.status === "stale"
              ? "A newer consensus landed, so the previous blog draft is stale and the article is being refreshed."
              : "This claim exists, but its reader-facing article is not ready yet.";

    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--ink-soft)]">{articleStatusMessage}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={`/d/${claim.domain}/${claim._id}`}
              className="btn-primary inline-flex px-4 py-2 text-sm"
            >
              Open raw claim
            </Link>
            <Link href="/blog" className="btn-secondary inline-flex px-4 py-2 text-sm">
              Back to blog
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const rawClaimHref = `/d/${article.domain}/${article.claimId}`;
  const sharePath = `/blog/${article.domain}/${article.claimId}`;
  const calibrating = isCalibratingDomain(article.domain);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="surface-card p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {calibrating ? (
              <CalibratingBadge className="text-xs" />
            ) : (
              <Link
                href={`/blog/${article.domain}/${article.claimId}`}
                className="font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                {formatDomainLabel(article.domain)}
              </Link>
            )}
            <span className="text-[var(--muted)]">•</span>
            <span className="text-[var(--muted)]">{formatPublishDate(article.publishedAt)}</span>
            <span className="text-[var(--muted)]">•</span>
            <span className="text-[var(--muted)]">{article.readTimeMinutes} min read</span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${recommendationClass(article.recommendation)}`}
            >
              {article.recommendationLabel ?? "Published"}
            </span>
            {typeof article.confidence === "number" && (
              <span className="chip pointer-events-none">Confidence {article.confidence}/100</span>
            )}
          </div>

          <h1 className="mt-4 max-w-4xl text-balance text-3xl font-semibold leading-tight text-[var(--ink)] sm:text-5xl">
            {article.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-[var(--ink-soft)] sm:text-lg">
            {article.excerpt}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={rawClaimHref} className="btn-secondary inline-flex px-4 py-2 text-sm">
              View raw claim
            </Link>
            <ShareToXButton
              title={article.title}
              urlPath={sharePath}
              ariaLabel={`Share "${article.title}" on X`}
              className="btn-ghost inline-flex items-center px-3 py-2 text-sm font-semibold"
            >
              Share on X
            </ShareToXButton>
            <Link href="/blog" className="btn-ghost inline-flex px-3 py-2 text-sm font-semibold">
              More stories
            </Link>
          </div>

          <div
            className="mt-8 prose prose-invert prose-sm max-w-none text-[var(--ink-soft)]
              prose-headings:text-[var(--ink)] prose-headings:font-semibold
              prose-p:leading-8 prose-li:leading-7 prose-a:text-[#8cc8ff]
              prose-strong:text-[var(--ink)] prose-code:text-indigo-300
              prose-code:bg-white/5 prose-code:px-1 prose-code:rounded"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.body}</ReactMarkdown>
          </div>
        </article>

        <aside className="space-y-4">
          <section className="surface-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Reader Mode
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)]">
              This page is the readable summary. The raw claim page still contains the full
              deliberation, consensus history, comments, and pipeline trace.
            </p>
          </section>

          <section className="surface-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Original Claim
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--ink-soft)] whitespace-pre-line">
              {article.claimBody}
            </p>
          </section>

          <section className="surface-card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Raw Record
            </p>
            <div className="mt-3">
              <Link
                href={rawClaimHref}
                className="btn-secondary inline-flex w-full justify-center px-4 py-2 text-sm"
              >
                Open full claim
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
