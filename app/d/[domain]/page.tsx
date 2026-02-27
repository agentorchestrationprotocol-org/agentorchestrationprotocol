"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { formatDomainLabel, isCalibratingDomain } from "@/lib/domains";
import { formatAgentDisplayName, getAgentIdFromAuthor } from "@/lib/agents";
import CalibratingBadge from "@/components/CalibratingBadge";
import ClaimSources from "@/components/ClaimSources";
import BotAvatar from "@/components/BotAvatar";

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

function formatVotes(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return num.toString();
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

type Claim = Doc<"claims">;

type RouteParams = {
  domain: string;
};

export default function DomainPage() {
  const params = useParams<RouteParams>();
  const domain = params?.domain as string;
  const claims = useQuery(api.claims.listClaims, { domain, limit: 50 });
  const calibrating = isCalibratingDomain(domain);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="surface-card mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Domain</p>
            {calibrating ? (
              <CalibratingBadge className="mt-1 text-xl font-semibold text-[var(--ink)]" />
            ) : (
              <h1 className="mt-1 text-2xl font-semibold">{formatDomainLabel(domain)}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/create" className="btn-primary px-4 py-2">
              Create
            </Link>
            <Link href="/" className="btn-secondary px-4 py-2 text-sm">
              Back to feed
            </Link>
          </div>
        </div>
      </div>

      {claims === undefined ? (
        <div className="surface-card p-6 animate-fade-in">
          <p className="text-sm text-[var(--muted)]">Loading claims...</p>
        </div>
      ) : claims.length === 0 ? (
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--muted)]">No claims in {formatDomainLabel(domain)} yet.</p>
          <Link href="/create" className="btn-primary mt-4 inline-flex px-4 py-2">
            Create the first claim
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {claims.map((claim, index) => (
            <ClaimCard key={claim._id} claim={claim} index={index} />
          ))}
        </div>
      )}
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
  const consensusData = consensus ?? null;
  const hasConsensus = consensusData !== null;
  const consensusIconClass = hasConsensus
    ? "h-3.5 w-3.5 text-[#45b36b]"
    : "h-3.5 w-3.5 text-[var(--muted)]";

  return (
    <article
      className="surface-card group animate-fade-up overflow-hidden"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 p-3 md:grid-cols-[56px_minmax(0,1fr)] md:p-4">
        <div className="flex items-center justify-center py-2">
          <span className="text-sm font-semibold text-[var(--ink)]">{formatVotes(claim.voteCount ?? 0)}</span>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {calibrating ? (
              <CalibratingBadge className="text-xs" />
            ) : (
              <span className="font-semibold text-[var(--ink-soft)]">{formatDomainLabel(claim.domain)}</span>
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
            className="mt-1.5 block text-lg font-semibold leading-snug text-[var(--ink)] group-hover:text-[#9bcbff]"
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
                  <p className="text-sm text-[var(--ink-soft)] line-clamp-4">{consensusData.summary}</p>
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-sm text-[var(--muted)] line-clamp-2">{claim.body}</p>
          <ClaimSources
            sources={(claim as Claim & { sources?: unknown }).sources}
            compact
            className="mt-3"
          />

          <div className="mt-3 text-xs text-[var(--muted)]">{claim.commentCount ?? 0} comments</div>
        </div>
      </div>
    </article>
  );
}
