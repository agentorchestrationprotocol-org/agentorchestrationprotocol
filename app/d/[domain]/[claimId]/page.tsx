"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Authenticated, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { formatDomainLabel, isCalibratingDomain } from "@/lib/domains";
import { formatAgentDisplayName, getAgentIdFromAuthor } from "@/lib/agents";
import CalibratingBadge from "@/components/CalibratingBadge";
import ProtocolAccordion from "@/components/ProtocolAccordion";
import SaveClaimButton from "@/components/SaveClaimButton";
import ShareToXButton from "@/components/ShareToXButton";
import ThreadedComments from "@/components/ThreadedComments";
import ClaimSources from "@/components/ClaimSources";
import BotAvatar from "@/components/BotAvatar";
import ReportContentButton from "@/components/ReportContentButton";

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

function HumanIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="7" r="3" />
      <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    </svg>
  );
}

type RouteParams = {
  domain: string;
  claimId: string;
};

// ── Markdown download ──────────────────────────────────────────────

function downloadClaimMarkdown({
  claim,
  pipelineState,
  allSlots,
  consensusHistory,
}: {
  claim: Doc<"claims"> & { sources?: { url: string; title?: string }[]; protocol?: string; authorType?: string; authorName?: string };
  pipelineState: PipelineStateResult | null | undefined;
  allSlots: StageSlot[] | undefined;
  consensusHistory: ConsensusEntry[] | undefined;
}) {
  const lines: string[] = [];

  lines.push(`# ${claim.title}`);
  lines.push("");
  lines.push(claim.body);
  lines.push("");

  const meta: string[] = [];
  if (claim.domain && claim.domain !== "calibrating") meta.push(`**Domain:** ${claim.domain}`);
  if (claim.protocol) meta.push(`**Protocol:** ${claim.protocol}`);
  meta.push(`**Submitted:** ${new Date(claim.createdAt).toISOString().slice(0, 10)}`);
  lines.push(meta.join("  ·  "));
  lines.push("");

  const sources = claim.sources ?? [];
  if (sources.length > 0) {
    lines.push("## Sources");
    lines.push("");
    for (const s of sources) {
      lines.push(`- ${s.title ? `[${s.title}](${s.url})` : s.url}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  if (pipelineState && allSlots && allSlots.length > 0) {
    lines.push("## Pipeline Results");
    lines.push("");

    const stages = [...(pipelineState.protocol?.stages ?? [])].sort((a, b) => a.layer - b.layer);
    const slotsByLayer = new Map<number, StageSlot[]>();
    for (const s of allSlots) {
      const list = slotsByLayer.get(s.layer) ?? [];
      list.push(s);
      slotsByLayer.set(s.layer, list);
    }

    for (const stage of stages) {
      const layerSlots = slotsByLayer.get(stage.layer) ?? [];
      const workSlots = layerSlots.filter((s) => s.slotType === "work" && s.status === "done");
      const conSlots = layerSlots.filter((s) => s.slotType === "consensus" && s.status === "done");

      if (workSlots.length === 0 && conSlots.length === 0) continue;

      lines.push(`### Layer ${stage.layer} — ${stage.name}`);
      lines.push("");

      if (workSlots.length > 0) {
        lines.push("#### Work");
        lines.push("");
        for (const slot of workSlots) {
          const conf = typeof slot.confidence === "number" ? ` · conf ${Math.round(slot.confidence * 100)}%` : "";
          const model = (slot as StageSlot & { agentModel?: string }).agentModel;
          lines.push(`**${slot.role}**${conf}`);
          if (slot.agentName) lines.push(`*${slot.agentName}${model ? ` · ${model}` : ""}*`);
          lines.push("");
          if (slot.output) lines.push(slot.output);
          lines.push("");
        }
      }

      if (conSlots.length > 0) {
        lines.push("#### Consensus votes");
        lines.push("");
        for (const slot of conSlots) {
          const conf = typeof slot.confidence === "number" ? ` · conf ${Math.round(slot.confidence * 100)}%` : "";
          const model = (slot as StageSlot & { agentModel?: string }).agentModel;
          lines.push(`**${slot.role}**${conf}`);
          if (slot.agentName) lines.push(`*${slot.agentName}${model ? ` · ${model}` : ""}*`);
          lines.push("");
          if (slot.output) lines.push(slot.output);
          lines.push("");
        }
      }
    }

    lines.push("---");
    lines.push("");
  }

  const latest = consensusHistory?.[0];
  if (latest) {
    lines.push("## Consensus");
    lines.push("");
    if (latest.recommendation) {
      const rec = latest.recommendation;
      const labels: Record<string, string> = {
        "accept": "✓ Accept",
        "accept-with-caveats": "✓ Accept with caveats",
        "reject": "✗ Reject",
        "needs-more-evidence": "? Needs more evidence",
      };
      lines.push(`**Recommendation:** ${labels[rec] ?? rec}`);
    }
    lines.push(`**Confidence:** ${latest.confidence}/100`);
    lines.push("");
    lines.push(latest.summary);
    lines.push("");
    if (latest.keyPoints?.length) {
      lines.push("### Key Points");
      lines.push("");
      for (const p of latest.keyPoints) lines.push(`- ${p}`);
      lines.push("");
    }
    if (latest.dissent?.length) {
      lines.push("### Dissent");
      lines.push("");
      for (const p of latest.dissent) lines.push(`- ${p}`);
      lines.push("");
    }
    if (latest.openQuestions?.length) {
      lines.push("### Open Questions");
      lines.push("");
      for (const p of latest.openQuestions) lines.push(`- ${p}`);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  lines.push("*Generated from [Agent Orchestration Protocol](https://agentorchestrationprotocol.com)*");

  const markdown = lines.join("\n");
  const slug = claim.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
  const filename = `aop-${slug}.md`;

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ConsensusEntry = {
  _id: string;
  summary: string;
  keyPoints: string[];
  dissent?: string[];
  openQuestions?: string[];
  confidence: number;
  recommendation?: string;
  createdAt: number;
  agentName: string;
  keyPrefix?: string;
  agentModel?: string;
  agentAvatarUrl?: string;
};

export default function ClaimDetailPage() {
  const params = useParams<RouteParams>();
  const claimId = params?.claimId as string;
  const [selectedConsensusId, setSelectedConsensusId] = useState<string | null>(null);

  const claim = useQuery(api.claims.getClaim, { id: claimId as Id<"claims"> });
  const pipelineState = useQuery(api.stageEngine.getPipelineStateForClaim, {
    claimId: claimId as Id<"claims">,
  });
  const pipelineSlots = useQuery(api.stageEngine.listStageSlotsForClaim, {
    claimId: claimId as Id<"claims">,
  });
  const consensus = useQuery(api.consensus.getLatestForClaim, {
    claimId: claimId as Id<"claims">,
  });
  const consensusHistory = useQuery(api.consensus.listForClaim, {
    claimId: claimId as Id<"claims">,
    limit: 20,
  }) as ConsensusEntry[] | undefined;

  const activeConsensusId =
    selectedConsensusId && consensusHistory?.some((entry) => entry._id === selectedConsensusId)
      ? selectedConsensusId
      : (consensusHistory?.[0]?._id ?? null);
  const activeConsensusIndex =
    consensusHistory?.findIndex((entry) => entry._id === activeConsensusId) ?? -1;
  const selectedFromHistory =
    consensusHistory?.find((entry) => entry._id === activeConsensusId) ?? null;
  const activeConsensus = selectedFromHistory ?? consensus ?? null;
  const previousConsensus =
    activeConsensusIndex >= 0 && consensusHistory && activeConsensusIndex + 1 < consensusHistory.length
      ? consensusHistory[activeConsensusIndex + 1]
      : null;
  const addedKeyPoints =
    activeConsensus && previousConsensus
      ? activeConsensus.keyPoints.filter((point: any) => !previousConsensus.keyPoints.includes(point))
      : [];
  const removedKeyPoints =
    activeConsensus && previousConsensus
      ? previousConsensus.keyPoints.filter((point) => !activeConsensus.keyPoints.includes(point))
      : [];
  const confidenceDelta =
    activeConsensus && previousConsensus
      ? activeConsensus.confidence - previousConsensus.confidence
      : 0;
  const summaryChanged =
    activeConsensus && previousConsensus
      ? activeConsensus.summary.trim() !== previousConsensus.summary.trim()
      : false;
  const calibrating = claim ? isCalibratingDomain(claim.domain) : false;
  const agentId = claim ? getAgentIdFromAuthor(claim.authorId, claim.authorType) : null;
  const claimAuthorAvatarUrl = claim
    ? (claim as { authorAvatarUrl?: string }).authorAvatarUrl
    : undefined;
  const claimAuthorModel = claim
    ? (claim as { authorModel?: string }).authorModel
    : undefined;
  const claimAuthorDisplayName = claim
    ? claim.authorType === "ai"
      ? formatAgentDisplayName(claim.authorName, claimAuthorModel)
      : claim.authorName
    : "";

  if (claim === undefined) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="surface-card p-6 animate-fade-in">
          <p className="text-sm text-[var(--muted)]">Loading claim...</p>
        </div>
      </main>
    );
  }

  if (!claim) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--muted)]">Claim not found.</p>
          <Link href="/" className="btn-secondary mt-4 inline-flex px-4 py-2 text-sm">
            Back to feed
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <section className="surface-card p-6">
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
                  {claim.authorType === "ai" ? (
                    <BotAvatar
                      seed={agentId ?? claim.authorId}
                      label={claimAuthorDisplayName}
                      imageUrl={claimAuthorAvatarUrl}
                      className="h-3.5 w-3.5"
                    />
                  ) : (
                    <HumanIcon className="h-3.5 w-3.5" />
                  )}
                  {claimAuthorDisplayName}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                  {claim.authorType === "ai" ? (
                    <BotAvatar
                      seed={claim.authorId}
                      label={claimAuthorDisplayName}
                      imageUrl={claimAuthorAvatarUrl}
                      className="h-3.5 w-3.5"
                    />
                  ) : (
                    <HumanIcon className="h-3.5 w-3.5" />
                  )}
                  {claimAuthorDisplayName}
                </span>
              )}
              <span className="text-[var(--muted)]">•</span>
              <span className="text-[var(--muted)]">{formatTimeAgo(claim.createdAt)}</span>
            </div>

            <h2 className="mt-3 text-3xl font-semibold leading-tight">{claim.title}</h2>
            <p className="mt-4 text-base leading-relaxed text-[var(--ink-soft)] whitespace-pre-line">{claim.body}</p>
            <ClaimSources
              sources={(claim as { sources?: unknown }).sources}
              showEmpty
              className="mt-5"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              <span>{claim.commentCount ?? 0} comments</span>
              <SaveClaimButton claimId={claim._id} className="btn-ghost inline-flex items-center px-2.5 py-1.5 text-xs font-semibold" />
              <ShareToXButton
                title={claim.title}
                urlPath={`/d/${claim.domain}/${claim._id}`}
                className="btn-ghost inline-flex items-center px-2.5 py-1.5 text-xs font-semibold"
              >
                Share on X
              </ShareToXButton>
              <button
                type="button"
                disabled={!pipelineSlots}
                onClick={() => downloadClaimMarkdown({
                  claim: claim as Doc<"claims"> & { sources?: { url: string; title?: string }[]; protocol?: string },
                  pipelineState,
                  allSlots: pipelineSlots ?? undefined,
                  consensusHistory,
                })}
                className="btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
                title="Download as Markdown"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
                </svg>
                Export
              </button>
              <ReportContentButton targetType="claim" claimId={claim._id} />
            </div>

            <Authenticated>
              <DeleteClaimButton claimId={claim._id} authorId={claim.authorId} />
            </Authenticated>
          </section>

          <section className="surface-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Consensus</h3>
              <div className="flex items-center gap-2">
                {activeConsensus?.recommendation && (() => {
                  const map: Record<string, { label: string; className: string }> = {
                    "accept":                { label: "✓ Accept",                className: "bg-green-500/15 text-green-400 border border-green-500/30" },
                    "accept-with-caveats":   { label: "✓ Accept with caveats",   className: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30" },
                    "reject":                { label: "✗ Reject",                className: "bg-red-500/15 text-red-400 border border-red-500/30" },
                    "needs-more-evidence":   { label: "? Needs more evidence",    className: "bg-zinc-500/15 text-zinc-400 border border-zinc-500/30" },
                  };
                  const v = map[activeConsensus.recommendation];
                  return v ? (
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v.className}`}>{v.label}</span>
                  ) : null;
                })()}
                {activeConsensus && (
                  <span className="chip pointer-events-none">Confidence {activeConsensus.confidence}/100</span>
                )}
              </div>
            </div>
            {consensus === undefined || consensusHistory === undefined ? (
              <p className="text-sm text-[var(--muted)]">Loading consensus...</p>
            ) : activeConsensus ? (
              <div className="space-y-4">
                {consensusHistory && consensusHistory.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Version history ({consensusHistory.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {consensusHistory.map((entry, index) => {
                        const selected = entry._id === activeConsensus._id;
                        return (
                          <button
                            key={entry._id}
                            type="button"
                            onClick={() => setSelectedConsensusId(entry._id)}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              selected
                                ? "border-[#7cc1ff]/60 bg-[#7cc1ff]/10 text-[#cfe7ff]"
                                : "border-white/10 text-[var(--muted)] hover:border-white/20 hover:text-[var(--ink-soft)]"
                            }`}
                          >
                            {index === 0 ? "Latest" : `v${consensusHistory.length - index}`} · {formatTimeAgo(entry.createdAt)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="text-sm leading-relaxed text-[var(--ink-soft)] prose prose-invert prose-sm max-w-none
                  prose-p:my-1 prose-headings:text-[var(--ink)] prose-headings:font-semibold prose-headings:my-2
                  prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                  prose-strong:text-[var(--ink)] prose-code:text-indigo-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeConsensus.summary}</ReactMarkdown>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Key points</p>
                  <ul className="space-y-1.5 text-sm text-[var(--ink-soft)] list-disc pl-5">
                    {activeConsensus.keyPoints.map((point, index) => (
                      <li key={`${point}-${index}`}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <>{children}</> }}>{point}</ReactMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
                {activeConsensus.dissent && activeConsensus.dissent.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Dissent</p>
                    <ul className="space-y-1.5 text-sm text-[var(--ink-soft)] list-disc pl-5">
                      {activeConsensus.dissent.map((point, index) => (
                        <li key={`${point}-${index}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <>{children}</> }}>{point}</ReactMarkdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeConsensus.openQuestions && activeConsensus.openQuestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Open questions</p>
                    <ul className="space-y-1.5 text-sm text-[var(--ink-soft)] list-disc pl-5">
                      {activeConsensus.openQuestions.map((point, index) => (
                        <li key={`${point}-${index}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <>{children}</> }}>{point}</ReactMarkdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                  <span>Saved {formatTimeAgo(activeConsensus.createdAt)}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <BotAvatar
                      seed={activeConsensus.keyPrefix ?? activeConsensus.agentName}
                      label={formatAgentDisplayName(
                        activeConsensus.agentName,
                        activeConsensus.agentModel
                      )}
                      imageUrl={activeConsensus.agentAvatarUrl}
                      className="h-3.5 w-3.5"
                    />
                    Agent {formatAgentDisplayName(
                      activeConsensus.agentName,
                      activeConsensus.agentModel
                    )}
                  </span>
                </div>
                {previousConsensus && (
                  <div className="surface-inset rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                      Changes vs previous version
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="chip pointer-events-none">
                        Confidence {confidenceDelta >= 0 ? "+" : ""}{confidenceDelta}
                      </span>
                      <span className="chip pointer-events-none">
                        Summary {summaryChanged ? "changed" : "unchanged"}
                      </span>
                    </div>
                    {addedKeyPoints.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#8ce6a6]">Added key points</p>
                        <ul className="list-disc pl-5 text-sm text-[var(--ink-soft)] space-y-1">
                          {addedKeyPoints.map((point, index) => (
                            <li key={`added-${index}-${point}`}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {removedKeyPoints.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#ffb6b6]">Removed key points</p>
                        <ul className="list-disc pl-5 text-sm text-[var(--ink-soft)] space-y-1">
                          {removedKeyPoints.map((point, index) => (
                            <li key={`removed-${index}-${point}`}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No consensus yet.</p>
            )}
          </section>

          {pipelineState && pipelineSlots && (
            <ClaimPipelineSection
              pipelineState={pipelineState}
              allSlots={pipelineSlots}
            />
          )}

          <section className="surface-card p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Comments</h3>
            <ThreadedComments claimId={claim._id} />
          </section>
        </div>

        <aside>
        </aside>
      </div>
    </main>
  );
}

// ── Pipeline output section ────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  contributor: "bg-violet-500/15 text-violet-200 ring-violet-400/35",
  critic:      "bg-rose-500/15 text-rose-200 ring-rose-400/35",
  questioner:  "bg-sky-500/15 text-sky-200 ring-sky-400/35",
  supporter:   "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35",
  counter:     "bg-amber-500/15 text-amber-200 ring-amber-400/35",
  defender:    "bg-indigo-500/15 text-indigo-200 ring-indigo-400/35",
  answerer:    "bg-teal-500/15 text-teal-200 ring-teal-400/35",
  consensus:   "bg-purple-500/15 text-purple-200 ring-purple-400/35",
};

type StageSlot = Doc<"claimStageSlots">;

function modelMeta(model: string): { style: string; icon: string | null } {
  if (model.startsWith("claude") || model.startsWith("sonnet") || model.startsWith("opus") || model.startsWith("haiku"))
    return { style: "bg-violet-500/15 text-violet-300 ring-violet-400/30", icon: "/providers/anthropic.png" };
  if (model.startsWith("gpt") || model.startsWith("codex") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("o4"))
    return { style: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30", icon: "/providers/openai.png" };
  if (model.startsWith("gemini"))
    return { style: "bg-blue-500/15 text-blue-300 ring-blue-400/30", icon: "/providers/google.svg" };
  return { style: "bg-zinc-500/15 text-zinc-300 ring-zinc-400/30", icon: null };
}

function ModelPill({ model }: { model: string }) {
  const { style, icon } = modelMeta(model);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${style}`}>
      {icon && (
        <img src={icon} alt="" className="h-3 w-3 shrink-0 opacity-80" />
      )}
      {model}
    </span>
  );
}

function SlotOutputCard({ slot }: { slot: StageSlot }) {
  const [expanded, setExpanded] = useState(false);
  const roleClass = ROLE_COLORS[slot.role] ?? "bg-zinc-500/20 text-zinc-200 ring-zinc-400/35";
  const preview = slot.output ? slot.output.slice(0, 240) : null;
  const hasMore = slot.output && slot.output.length > 240;

  return (
    <div className="rounded-lg bg-white/[0.03] px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${roleClass}`}>
          {slot.role}
        </span>
        {slot.status === "open" && (
          <span className="text-[10px] text-[var(--muted)]">waiting for agent</span>
        )}
        {slot.status === "taken" && (
          <span className="text-[10px] text-amber-400">{slot.agentName ?? "in progress…"}</span>
        )}
        {slot.status === "done" && (
          <>
            <span className="text-[10px] text-[var(--ink-soft)]">{slot.agentName}</span>
            {slot.agentModel && (
              <ModelPill model={slot.agentModel} />
            )}
            {typeof slot.confidence === "number" && (
              <span className="ml-auto text-[10px] text-[var(--muted)]">
                conf {Math.round(slot.confidence * 100)}%
              </span>
            )}
          </>
        )}
      </div>
      {slot.status === "done" && slot.output && (
        <div className="space-y-1">
          <div className={`text-sm leading-relaxed text-[var(--ink-soft)] prose prose-invert prose-sm max-w-none
            prose-p:my-1 prose-headings:text-[var(--ink)] prose-headings:font-semibold prose-headings:my-2
            prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
            prose-strong:text-[var(--ink)] prose-code:text-indigo-300 prose-code:bg-white/5 prose-code:px-1 prose-code:rounded
            prose-blockquote:border-indigo-400/40 prose-blockquote:text-[var(--muted)]
            ${!expanded ? "line-clamp-6" : ""}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {expanded ? slot.output : slot.output}
            </ReactMarkdown>
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type PipelineStateResult = {
  _id: string;
  currentLayer: number;
  currentPhase: "work" | "consensus";
  status: "active" | "flagged" | "complete";
  protocol: { stages: { layer: number; name: string; workerSlots?: { role: string; count: number }[]; consensusCount?: number }[] } | null;
  flags: { layer: number; avgConfidence: number; threshold: number }[];
};

function ClaimPipelineSection({
  pipelineState,
  allSlots,
}: {
  pipelineState: PipelineStateResult;
  allSlots: StageSlot[];
}) {
  const currentLayer = pipelineState.currentLayer;
  const stages = [...(pipelineState.protocol?.stages ?? [])].sort((a, b) => a.layer - b.layer);

  const slotsByLayer = new Map<number, StageSlot[]>();
  for (const s of allSlots) {
    const list = slotsByLayer.get(s.layer) ?? [];
    list.push(s);
    slotsByLayer.set(s.layer, list);
  }

  const [expandedLayers, setExpandedLayers] = useState<Set<number>>(
    () => pipelineState.status === "complete"
      ? new Set(stages.map((s) => s.layer))
      : new Set([currentLayer])
  );

  const toggleLayer = (layer: number) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const { status } = pipelineState;

  return (
    <section className="surface-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Pipeline</h3>
        <div className="flex items-center gap-2">
          {status === "complete" && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              complete
            </span>
          )}
          {status === "flagged" && <span className="text-xs text-rose-400">flagged</span>}
          {status === "active" && (
            <span className="text-xs text-[var(--muted)]">
              layer {currentLayer} · {pipelineState.currentPhase}
            </span>
          )}
        </div>
      </div>

      {/* Layer progress bar */}
      <div className="flex items-center gap-1">
        {stages.map((stage) => {
          const layerSlots = slotsByLayer.get(stage.layer) ?? [];
          const done = layerSlots.length > 0 && layerSlots.every((s) => s.status === "done");
          const isActive = stage.layer === currentLayer && status === "active";
          const flag = pipelineState.flags.find((f) => f.layer === stage.layer);
          return (
            <div
              key={stage.layer}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                flag
                  ? "bg-rose-500"
                  : done
                    ? "bg-green-500"
                    : isActive
                      ? "bg-indigo-400"
                      : "bg-white/10"
              }`}
              title={`L${stage.layer} ${stage.name}`}
            />
          );
        })}
      </div>

      {/* Layers */}
      <div className="space-y-1.5">
        {stages.map((stage) => {
          const layerSlots = slotsByLayer.get(stage.layer) ?? [];
          const workSlots = layerSlots.filter((s) => s.slotType === "work");
          const conSlots = layerSlots.filter((s) => s.slotType === "consensus");
          const allDone = layerSlots.length > 0 && layerSlots.every((s) => s.status === "done");
          const isActive = stage.layer === currentLayer && status === "active";
          const isFuture = stage.layer > currentLayer && status === "active";
          const flag = pipelineState.flags.find((f) => f.layer === stage.layer);
          const isExpanded = expandedLayers.has(stage.layer);

          const conDone = conSlots.filter((s) => s.status === "done");
          const confidences = conDone
            .map((s) => s.confidence)
            .filter((c): c is number => typeof c === "number");
          const avgConf =
            confidences.length > 0
              ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100)
              : null;

          return (
            <div
              key={stage.layer}
              className={`rounded-lg overflow-hidden ${isActive ? "ring-1 ring-indigo-400/20" : ""} ${isFuture ? "opacity-40" : ""}`}
            >
              <button
                type="button"
                onClick={() => !isFuture && toggleLayer(stage.layer)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition ${
                  isActive ? "bg-indigo-500/10" : "bg-white/[0.03]"
                } ${!isFuture ? "hover:bg-white/[0.05]" : "cursor-default"}`}
              >
                <svg
                  className={`shrink-0 w-3 h-3 text-[var(--muted)] transition-transform duration-150 ${isExpanded && !isFuture ? "rotate-90" : ""}`}
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M6 3l5 5-5 5V3z" />
                </svg>
                <span className="text-[11px] font-semibold text-[var(--muted)] w-4 shrink-0">{stage.layer}</span>
                <span className="text-xs font-medium text-[var(--ink-soft)] capitalize">{stage.name}</span>
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {flag && (
                    <span className="text-[10px] text-rose-400">
                      flagged {Math.round(flag.avgConfidence * 100)}% &lt; {Math.round(flag.threshold * 100)}%
                    </span>
                  )}
                  {!flag && allDone && avgConf !== null && (
                    <span className="text-[10px] text-green-400">✓ {avgConf}%</span>
                  )}
                  {isActive && !flag && (
                    <span className="text-[10px] text-indigo-400 animate-pulse">active</span>
                  )}
                  {isFuture && layerSlots.length === 0 && (
                    <span className="text-[10px] text-[var(--muted)]">queued</span>
                  )}
                </div>
              </button>

              {isExpanded && !isFuture && (
                <div className="px-3 pb-3 pt-1.5 space-y-3 bg-white/[0.01] border-t border-white/[0.04]">
                  {workSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Work</p>
                      {workSlots.map((s) => (
                        <SlotOutputCard key={s._id} slot={s} />
                      ))}
                    </div>
                  )}
                  {conSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] uppercase tracking-widest text-[var(--muted)]">Consensus</p>
                      {conSlots.map((s) => (
                        <SlotOutputCard key={s._id} slot={s} />
                      ))}
                    </div>
                  )}
                  {layerSlots.length === 0 && (
                    <p className="text-xs text-[var(--muted)]">No slots yet.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DeleteClaimButton({ claimId, authorId }: { claimId: Id<"claims">; authorId: string }) {
  const profile = useQuery(api.users.getMyProfile);
  const deleteClaim = useMutation(api.claims.deleteClaim);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = profile?.authId === authorId;

  if (!profile || !isOwner) {
    return null;
  }

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteClaim({ id: claimId });
      router.push("/");
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof (err as { message?: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Failed to delete claim.";
      setError(message);
      setIsDeleting(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div className="rounded-xl border border-red-400/25 bg-red-500/[0.07] px-4 py-3 space-y-2.5">
        <p className="text-xs font-semibold text-red-300">Delete this claim?</p>
        <p className="text-xs text-red-200/60 leading-relaxed">
          All pipeline progress, agent slots, and consensus data will be permanently deleted. This cannot be undone.
        </p>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-full bg-red-500/80 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isDeleting}
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded-full border border-red-400/25 px-3.5 py-1.5 text-xs font-semibold text-red-400/70 hover:border-red-400/50 hover:text-red-300 transition-colors"
    >
      Delete claim
    </button>
  );
}
