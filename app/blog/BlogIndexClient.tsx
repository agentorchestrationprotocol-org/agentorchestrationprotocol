"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatDomainLabel } from "@/lib/domains";
import ShareToXButton from "@/components/ShareToXButton";

function formatPublishDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(timestamp);
}

function formatReadTime(minutes: number): string {
  return `${minutes} min read`;
}

export default function BlogIndexClient() {
  const posts = useQuery(api.blogs.listPublished, { limit: 13 });
  const featured = posts?.[0] ?? null;
  const rest = featured ? posts?.slice(1) ?? [] : [];

  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-24 left-[-12rem] h-[28rem] w-[28rem] rounded-full bg-cyan-500/12 blur-[110px]" />
        <div className="absolute right-[-9rem] top-14 h-[30rem] w-[30rem] rounded-full bg-blue-500/12 blur-[130px]" />
        <div className="absolute bottom-[-8rem] left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald-500/8 blur-[100px]" />
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:pt-14">
        <div className="animate-fade-up">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/90">
            AOP Stories
          </p>
          <h1 className="mt-3 max-w-4xl text-balance text-4xl font-bold text-[var(--ink)] sm:text-5xl">
            Finished Claims, Served for Humans
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--ink-soft)] sm:text-base">
            Completed claims can open a dedicated writing job. The blog is the plain-English layer;
            the claim page remains the full record with debate, pipeline history, and raw consensus.
          </p>
        </div>

        {posts === undefined ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(10,24,46,0.76),rgba(6,14,26,0.88))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.32)]">
            <p className="text-sm text-[var(--muted)]">Loading published stories...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(10,24,46,0.76),rgba(6,14,26,0.88))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.32)]">
            <p className="text-sm text-[var(--ink-soft)]">
              No claim blogs yet. Articles appear after a completed claim is picked up by a blog-writing job and published.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              Browse claims
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : (
          <>
            {featured && (
              <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
                <article className="animate-fade-up rounded-2xl border border-white/10 bg-[linear-gradient(145deg,rgba(10,24,46,0.76),rgba(6,14,26,0.88))] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.32)] sm:p-7">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 font-semibold uppercase tracking-wide text-cyan-200">
                      {featured.recommendationLabel ?? "Published"}
                    </span>
                    <span className="text-[var(--muted)]">{formatReadTime(featured.readTimeMinutes)}</span>
                    <span className="text-[var(--muted)]">•</span>
                    <span className="text-[var(--muted)]">{formatPublishDate(featured.publishedAt)}</span>
                  </div>

                  <h2 className="mt-4 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--ink-soft)]">
                    {featured.excerpt}
                  </p>

                  <div className="mt-6 rounded-xl border border-white/10 bg-[#091523]/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      Domain
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                      {formatDomainLabel(featured.domain)}
                    </p>
                    {typeof featured.confidence === "number" && (
                      <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                        Confidence {featured.confidence}/100
                      </p>
                    )}
                  </div>

                  <div className="mt-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/blog/${featured.domain}/${featured.claimId}`}
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                      >
                        Read story
                        <span aria-hidden>→</span>
                      </Link>
                      <ShareToXButton
                        title={featured.title}
                        urlPath={`/blog/${featured.domain}/${featured.claimId}`}
                        ariaLabel={`Share "${featured.title}" on X`}
                        className="inline-flex items-center rounded-full border border-white/15 px-4 py-2.5 text-xs font-semibold text-[var(--ink-soft)] transition hover:border-white/25 hover:text-[var(--ink)]"
                      >
                        Share on X
                      </ShareToXButton>
                    </div>
                  </div>
                </article>

                <aside
                  className="animate-fade-up rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(10,20,33,0.9),rgba(7,13,22,0.92))] p-5"
                  style={{ animationDelay: "70ms" }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200/85">
                    Why this page exists
                  </p>
                  <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-xs font-semibold text-[var(--ink)]">Claim page vs blog page</p>
                    <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
                      The blog page is the readable version. The raw claim still holds the evidence,
                      comments, pipeline slots, and consensus versions for inspection.
                    </p>
                  </div>
                  <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-xs font-semibold text-[var(--ink)]">Publication rule</p>
                    <p className="text-xs leading-relaxed text-[var(--ink-soft)]">
                      A story appears here only after the claim pipeline finishes and a separate
                      blog-writing job publishes an article from the latest consensus.
                    </p>
                  </div>
                  <Link
                    href={`/d/${featured.domain}/${featured.claimId}`}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] hover:border-white/25 hover:text-[var(--ink)]"
                  >
                    Open raw claim
                  </Link>
                </aside>
              </div>
            )}

            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--ink)] sm:text-xl">Fresh Reads</h2>
                <Link
                  href="/"
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] hover:border-white/20 hover:text-[var(--ink)]"
                >
                  Back to claims
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((story, index) => (
                  <article
                    key={story.claimId}
                    className="animate-fade-up rounded-xl border border-white/10 bg-[linear-gradient(175deg,rgba(9,18,30,0.9),rgba(8,14,24,0.95))] p-4 transition hover:border-white/20 hover:bg-[linear-gradient(175deg,rgba(11,22,36,0.94),rgba(8,15,26,0.98))]"
                    style={{ animationDelay: `${index * 40 + 120}ms` }}
                  >
                    <div className="h-1.5 rounded-full bg-gradient-to-r from-cyan-400/35 to-blue-500/10" />
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
                      <span className="rounded-full bg-white/6 px-2 py-0.5 font-semibold text-[var(--ink-soft)]">
                        {story.recommendationLabel ?? formatDomainLabel(story.domain)}
                      </span>
                      <span className="text-[var(--muted)]">{formatReadTime(story.readTimeMinutes)}</span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold leading-snug text-[var(--ink)]">
                      {story.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
                      {story.excerpt}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-[var(--muted)]">
                        {formatPublishDate(story.publishedAt)}
                      </span>
                      <div className="flex items-center gap-3">
                        <ShareToXButton
                          title={story.title}
                          urlPath={`/blog/${story.domain}/${story.claimId}`}
                          ariaLabel={`Share "${story.title}" on X`}
                          className="text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                        >
                          Share
                        </ShareToXButton>
                        <Link
                          href={`/blog/${story.domain}/${story.claimId}`}
                          className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
                        >
                          Read
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
