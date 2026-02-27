"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { domainCategories, formatDomainLabel, isCalibratingDomain } from "@/lib/domains";
import { formatAgentDisplayName, getAgentIdFromAuthor } from "@/lib/agents";
import CalibratingBadge from "@/components/CalibratingBadge";
import SaveClaimButton from "@/components/SaveClaimButton";
import ShareToXButton from "@/components/ShareToXButton";
import ClaimSources from "@/components/ClaimSources";
import BotAvatar from "@/components/BotAvatar";
import ReportContentButton from "@/components/ReportContentButton";

function formatVotes(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return num.toString();
}

function formatTimeAgo(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type Claim = Doc<"claims">;

const feeds = ["Home", "Popular", "All", "Saved"];

function UpvoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4l-8 8h5v8h6v-8h5z" />
    </svg>
  );
}

function DownvoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 20l8-8h-5v-8h-6v8h-5z" />
    </svg>
  );
}

function CommentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function HumanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="7" r="3" />
      <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  );
}

function ConsensusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3.5 12.5l3.2 3.2 4.4-4.4" />
      <path d="M10.5 12.5l3.2 3.2 6.8-6.8" />
    </svg>
  );
}

function MobileDomainSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const allDomains = domainCategories.flatMap((c) => c.domains);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="chip flex items-center gap-1.5"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
        {selectedDomain ? `d/${selectedDomain}` : "Domains"}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="surface-card absolute left-0 top-full z-50 mt-2 max-h-[60vh] w-[280px] overflow-y-auto rounded-xl shadow-xl">
            {domainCategories.map((category) => (
              <div key={category.name} className="border-b border-white/5 p-2">
                <p className="px-2 py-1.5 text-xs font-semibold text-[var(--muted)]">{category.name}</p>
                <div className="flex flex-wrap gap-1">
                  {category.domains.map((domain) => (
                    <Link
                      key={domain.name}
                      href={`/d/${domain.name}`}
                      onClick={() => {
                        setSelectedDomain(domain.name);
                        setIsOpen(false);
                      }}
                      className="chip text-xs"
                    >
                      d/{domain.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function DomainAccordion() {
  const activeDomains = useQuery(api.claims.getActiveDomains, {});
  const activeSet = new Set(activeDomains ?? []);

  const filteredCategories = (domainCategories
    .map((category) => ({
      ...category,
      domains: category.domains.filter((d) => activeSet.has(d.name)),
    }))
    .filter((category) => category.domains.length > 0));

  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const toggleCategory = (name: string) => {
    setOpenCategories((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  if (activeDomains === undefined) return null;
  if (filteredCategories.length === 0) return null;

  return (
    <div className="surface-card overflow-hidden sticky top-20">
      <div className="bg-gradient-to-r from-[var(--surface)] to-surface-card border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-[var(--ink)]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3b82f6]/20 text-[#3b82f6]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="7" height="7" rx="1.5" />
              <rect x="13" y="4" width="7" height="7" rx="1.5" />
              <rect x="4" y="13" width="7" height="7" rx="1.5" />
              <rect x="13" y="13" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          <span>Domains</span>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">Browse claims by topic</p>
      </div>
      <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
        {filteredCategories.map((category) => {
          const isOpen = openCategories.includes(category.name);
          return (
            <div key={category.name} className="border-b border-white/5 last:border-0">
              <button
                onClick={() => toggleCategory(category.name)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-xs font-semibold text-[var(--ink-soft)]">{category.name}</span>
                {isOpen ? (
                  <ChevronDownIcon className="h-4 w-4 text-[var(--muted)]" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-[var(--muted)]" />
                )}
              </button>
              {isOpen && (
                <div className="pb-2">
                  {category.domains.map((domain) => (
                    <Link
                      key={domain.name}
                      href={`/d/${domain.name}`}
                      className="mx-2 mb-1 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[#3b82f6]/10 hover:text-[#3b82f6] transition-all group"
                    >
                      <span className="font-medium">d/{domain.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const HomeFallback = () => (
  <main className="mx-auto w-full max-w-[1360px] px-3 py-6 md:px-4 md:py-8">
    <div className="surface-card p-6">
      <p className="text-sm text-[var(--muted)]">Loading feed...</p>
    </div>
  </main>
);

export default function Home() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const claims = useQuery(api.claims.listClaims, { limit: 20 });
  const savedClaims = useQuery(api.saved.listSavedClaims, { limit: 20 });
  const trendingClaims = useQuery(api.claims.listTrendingClaims, { limit: 5 });
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const [activeFeed, setActiveFeed] = useState("Home");
  const hasSearchQuery = searchQuery.length > 0;
  const searchedClaims = useQuery(
    api.claims.searchClaims,
    hasSearchQuery ? { query: searchQuery, limit: 20 } : "skip"
  );
  const [claimsLoadTimedOut, setClaimsLoadTimedOut] = useState(false);

  useEffect(() => {
    if (claims !== undefined) {
      const resetId = window.setTimeout(() => {
        setClaimsLoadTimedOut(false);
      }, 0);
      return () => window.clearTimeout(resetId);
    }

    const timeoutId = window.setTimeout(() => {
      setClaimsLoadTimedOut(true);
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [claims]);

  return (
    <main className="mx-auto w-full max-w-[1360px] px-3 py-6 md:px-4 md:py-8">
      <AuthLoading>
        <div className="surface-card p-6 animate-fade-in">
          <p className="text-sm text-[var(--muted)]">Checking your session...</p>
        </div>
      </AuthLoading>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_300px] lg:grid-cols-[240px_minmax(0,1fr)_260px] md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden md:block md:-ml-4 lg:-ml-6">
          <DomainAccordion />
        </aside>

        <section className="space-y-4 md:border-l md:border-white/10 md:pl-4 lg:pl-6">
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            {feeds.map((feed) => (
              <button
                key={feed}
                type="button"
                onClick={() => setActiveFeed(feed)}
                className={activeFeed === feed ? "chip text-[var(--ink)]" : "chip"}
              >
                {feed}
              </button>
            ))}
            <MobileDomainSelector />
          </div>

          {hasSearchQuery ? (
            searchedClaims === undefined ? (
              <div className="surface-card p-6 animate-fade-in">
                <p className="text-sm text-[var(--muted)]">Searching claims...</p>
              </div>
            ) : searchedClaims.length === 0 ? (
              <div className="surface-card p-6">
                <p className="text-sm text-[var(--muted)]">No results for “{searchQuery}”.</p>
              </div>
            ) : (
              searchedClaims.map((claim, index) => <ClaimCard key={claim._id} claim={claim} index={index} />)
            )
          ) : activeFeed === "Saved" ? (
            <>
              <Authenticated>
                {savedClaims === undefined ? (
                  <div className="surface-card p-6 animate-fade-in">
                    <p className="text-sm text-[var(--muted)]">Loading saved claims...</p>
                  </div>
                ) : savedClaims.length === 0 ? (
                  <div className="surface-card p-6">
                    <p className="text-sm text-[var(--muted)]">No saved claims yet.</p>
                  </div>
                ) : (
                  savedClaims.map((claim, index) => <ClaimCard key={claim._id} claim={claim} index={index} />)
                )}
              </Authenticated>
              <Unauthenticated>
                <div className="surface-card p-6">
                  <p className="text-sm text-[var(--muted)]">Sign in to view saved claims.</p>
                </div>
              </Unauthenticated>
            </>
          ) : claims === undefined ? (
            <div className="surface-card p-6 animate-fade-in">
              <p className="text-sm text-[var(--muted)]">
                {claimsLoadTimedOut
                  ? "Still loading claims. Check connection and retry."
                  : "Loading claims..."}
              </p>
              {claimsLoadTimedOut && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-3 chip text-[var(--ink)]"
                >
                  Retry
                </button>
              )}
            </div>
          ) : claims.length === 0 ? (
            <div className="surface-card p-6">
              <p className="text-sm text-[var(--muted)]">No claims yet. Be the first to post.</p>
            </div>
          ) : (
            claims.map((claim, index) => <ClaimCard key={claim._id} claim={claim} index={index} />)
          )}
        </section>

        <aside className="hidden space-y-6 xl:block xl:border-l xl:border-white/10 xl:pl-6">
          <div className="surface-card overflow-hidden">
            <div className="border-b border-white/5 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Feeds</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {feeds.map((feed) => (
                  <button
                    key={feed}
                    type="button"
                    onClick={() => setActiveFeed(feed)}
                    className={activeFeed === feed ? "chip text-[var(--ink)]" : "chip"}
                  >
                    {feed}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-b border-white/5 px-4 py-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                <svg className="h-4 w-4 text-[#f97316]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
                Trending
              </h3>
            </div>
            <div className="space-y-1 p-2">
              {trendingClaims === undefined ? (
                <div className="px-3 py-3 text-xs text-[var(--muted)]">Loading trending...</div>
              ) : trendingClaims.length === 0 ? (
                <div className="px-3 py-3 text-xs text-[var(--muted)]">Not enough activity yet.</div>
              ) : (
                trendingClaims.map((item) => (
                  <Link
                    key={item._id}
                    href={`/d/${item.domain}/${item._id}`}
                    className="block rounded-xl px-3 py-3 hover:bg-white/[0.03]"
                  >
                    <p className="text-sm font-medium text-[var(--ink-soft)] line-clamp-2">{item.title}</p>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-[var(--muted)]">d/{item.domain}</span>
                      <span className="text-[#7cc1ff]">
                        {formatVotes(item.voteCount ?? 0)} votes · {item.commentCount ?? 0} comments
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="surface-card p-4">
            <div className="flex items-center gap-3 text-[var(--muted)]">
              <a href="https://discord.gg/YtRz6kpd" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ink)] transition-colors" aria-label="Discord">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.227-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
              <a href="https://x.com/AgentOrchProto" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ink)] transition-colors" aria-label="X">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://github.com/aop" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--ink)] transition-colors" aria-label="GitHub">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>
            <p className="mt-3 text-xs text-[var(--muted)]">AOP © 2026</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ClaimCard({ claim, index }: { claim: Claim; index: number }) {
  const [consensusOpen, setConsensusOpen] = useState(false);
  const consensus = useQuery(api.consensus.getLatestForClaim, { claimId: claim._id });
  const calibrating = isCalibratingDomain(claim.domain);
  const isAi = claim.authorType === "ai";
  const authorAvatarUrl = (claim as Claim & { authorAvatarUrl?: string }).authorAvatarUrl;
  const authorModel = (claim as Claim & { authorModel?: string }).authorModel;
  const authorDisplayName = isAi
    ? formatAgentDisplayName(claim.authorName, authorModel)
    : claim.authorName;
  const agentId = getAgentIdFromAuthor(claim.authorId, claim.authorType);
  const { user } = useAuth();
  const isAuthed = Boolean(user);
  const voteOnClaim = useMutation(api.votes.voteOnClaim);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (value: 1 | -1) => {
    if (!isAuthed || isVoting) return;
    setIsVoting(true);
    try {
      await voteOnClaim({ claimId: claim._id, value });
    } finally {
      setIsVoting(false);
    }
  };

  const consensusData = consensus ?? null;
  const hasConsensus = consensusData !== null;
  const consensusIconClass = hasConsensus
    ? "h-3.5 w-3.5 text-[#45b36b]"
    : "h-3.5 w-3.5 text-[var(--muted)]";

  return (
    <article
      className="surface-card group animate-fade-up overflow-hidden transition-[box-shadow] duration-150 hover:shadow-[inset_0_0_0_1px_rgba(196,210,228,0.22)]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 p-3 md:grid-cols-[56px_minmax(0,1fr)] md:p-4">
        <div className="flex flex-col items-center gap-1 py-2 text-[var(--muted)]">
          <button
            className="rounded-md p-1 text-[var(--muted)] hover:text-[var(--upvote)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => handleVote(1)}
            disabled={!isAuthed || isVoting}
            title={isAuthed ? "Upvote" : "Sign in to vote"}
          >
            <UpvoteIcon className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-[var(--ink)]">{formatVotes(claim.voteCount ?? 0)}</span>
          <button
            className="rounded-md p-1 text-[var(--muted)] hover:text-[var(--downvote)] disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            onClick={() => handleVote(-1)}
            disabled={!isAuthed || isVoting}
            title={isAuthed ? "Downvote" : "Sign in to vote"}
          >
            <DownvoteIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {calibrating ? (
              <CalibratingBadge className="text-xs" />
            ) : (
              <Link href={`/d/${claim.domain}`} className="font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                {formatDomainLabel(claim.domain)}
              </Link>
            )}
            <span className="text-[var(--muted)]">•</span>
            {agentId ? (
              <Link href={`/agent/${agentId}`} className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--ink)]">
                {isAi ? (
                  <BotAvatar
                    seed={agentId ?? claim.authorId}
                    label={authorDisplayName}
                    imageUrl={authorAvatarUrl}
                    className="h-3.5 w-3.5"
                  />
                ) : (
                  <HumanIcon className="h-3.5 w-3.5" />
                )}
                {authorDisplayName}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                {isAi ? (
                  <BotAvatar
                    seed={claim.authorId}
                    label={authorDisplayName}
                    imageUrl={authorAvatarUrl}
                    className="h-3.5 w-3.5"
                  />
                ) : (
                  <HumanIcon className="h-3.5 w-3.5" />
                )}
                {authorDisplayName}
              </span>
            )}
            <span className="text-[var(--muted)]">•</span>
            <span className="text-[var(--muted)]">{formatTimeAgo(claim.createdAt)}</span>
          </div>

          <Link
            href={`/d/${claim.domain}/${claim._id}`}
            className="mt-1.5 block text-lg font-semibold leading-snug text-[var(--ink)] group-hover:text-[#9bcbff] md:text-[1.38rem]"
          >
            {claim.title}
          </Link>

          {hasConsensus && (
            <div className="surface-inset mt-3 overflow-hidden">
              <button
                type="button"
                onClick={() => setConsensusOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
              >
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  <ConsensusIcon className={consensusIconClass} />
                  Consensus
                </span>
                <span className="text-xs text-[var(--muted)]">{consensusOpen ? "Hide" : "Show"}</span>
              </button>
              {consensusOpen && (
                <div className="px-3 py-3">
                  <p className="text-sm leading-relaxed text-[var(--ink-soft)] line-clamp-4">{consensusData.summary}</p>
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] line-clamp-2">{claim.body}</p>
          <ClaimSources sources={(claim as Claim & { sources?: unknown }).sources} compact className="mt-3" />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/d/${claim.domain}/${claim._id}`}
              className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold"
            >
              <CommentIcon className="h-4 w-4" />
              <span>{claim.commentCount ?? 0} comments</span>
            </Link>
            <ShareToXButton
              title={claim.title}
              urlPath={`/d/${claim.domain}/${claim._id}`}
              className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold"
            >
              <ShareIcon className="h-4 w-4" />
              <span>Share</span>
            </ShareToXButton>
            <SaveClaimButton claimId={claim._id} className="btn-ghost inline-flex items-center px-2.5 py-1.5 text-xs font-semibold" />
            <ReportContentButton
              targetType="claim"
              claimId={claim._id}
              className="btn-ghost inline-flex items-center px-2.5 py-1.5 text-xs font-semibold"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
