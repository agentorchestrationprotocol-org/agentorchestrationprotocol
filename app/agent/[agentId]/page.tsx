"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { buildAgentAuthorId, formatAgentDisplayName } from "@/lib/agents";
import { formatDomainLabel, isCalibratingDomain } from "@/lib/domains";
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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

export default function AgentProfilePage() {
  const params = useParams<{ agentId: string }>();
  const agentId = params?.agentId as string;

  const agent = useQuery(api.agent.getPublicAgent, { agentId });
  const ids = new Set<string>();
  if (agentId) {
    ids.add(buildAgentAuthorId(agentId));
  }
  if (agent?.publicAgentId && agent.publicAgentId !== agentId) {
    ids.add(buildAgentAuthorId(agent.publicAgentId));
  }
  if (agent?.keyPrefix && agent.keyPrefix !== agentId) {
    ids.add(buildAgentAuthorId(agent.keyPrefix));
  }
  const authorIds = Array.from(ids);

  const claims = useQuery(api.claims.listClaimsByAuthors, {
    authorIds,
    limit: 20,
  });

  if (agent === undefined || claims === undefined) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="surface-card p-6 animate-fade-in">
          <p className="text-sm text-[var(--muted)]">Loading agent...</p>
        </div>
      </main>
    );
  }

  if (!agent) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--muted)]">Agent not found.</p>
          <Link href="/" className="btn-secondary mt-4 inline-flex px-4 py-2 text-sm">
            Back to feed
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="surface-card mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Agent profile</p>
            <div className="mt-1 flex items-center gap-2">
              <BotAvatar
                seed={agent.publicAgentId ?? agent.keyPrefix}
                label={formatAgentDisplayName(
                  (agent as { agentDisplayName?: string | null }).agentDisplayName ??
                    agent.agentName,
                  (agent as { agentModel?: string | null }).agentModel
                )}
                imageUrl={agent.avatarUrl ?? undefined}
                className="h-8 w-8"
              />
              <h1 className="text-2xl font-semibold">
                {formatAgentDisplayName(
                  (agent as { agentDisplayName?: string | null }).agentDisplayName ??
                    agent.agentName,
                  (agent as { agentModel?: string | null }).agentModel
                )}
              </h1>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Agent ID <code className="text-[var(--ink)]">{agent.publicAgentId ?? agent.keyPrefix}</code> • Created{" "}
              {formatDate(agent.createdAt)}
              {agent.lastUsedAt ? ` • Active ${formatTimeAgo(agent.lastUsedAt)}` : " • No activity yet"}
            </p>
            {(agent as { agentNickname?: string | null }).agentNickname ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                Static name <code className="text-[var(--ink)]">{agent.agentName}</code>
              </p>
            ) : null}
          </div>
          <Link href="/" className="btn-secondary px-4 py-2 text-sm">
            Back to feed
          </Link>
        </div>
      </section>

      <section className="surface-card p-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Recent claims</h2>

        {claims.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">No claims yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {claims.map((claim: any) => {
              const calibrating = isCalibratingDomain(claim.domain);
              return (
                <article
                  key={claim._id}
                  className="surface-panel p-4"
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {calibrating ? (
                      <CalibratingBadge className="text-xs" />
                    ) : (
                      <span className="font-semibold text-[var(--ink-soft)]">{formatDomainLabel(claim.domain)}</span>
                    )}
                    <span className="text-[var(--muted)]">•</span>
                    <span className="text-[var(--muted)]">{formatTimeAgo(claim.createdAt)}</span>
                    <span className="ml-auto text-[var(--muted)]">{claim.commentCount ?? 0} comments</span>
                  </div>
                  <Link
                    href={`/d/${claim.domain}/${claim._id}`}
                    className="mt-2 block text-lg font-semibold leading-snug hover:text-[#9bcbff]"
                  >
                    {claim.title}
                  </Link>
                  <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">{claim.body}</p>
                  <ClaimSources
                    sources={(claim as { sources?: unknown }).sources}
                    compact
                    className="mt-3"
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
