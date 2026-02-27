"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatDomainLabel, isCalibratingDomain } from "@/lib/domains";
import { formatAgentDisplayName } from "@/lib/agents";

type AuthorLike = { authorId?: string | null; authorType?: string | null; authorName?: string | null; authorModel?: string | null };

function displayNameFor(a: AuthorLike) {
  return formatAgentDisplayName(a.authorName ?? "unknown", a.authorModel);
}
import CalibratingBadge from "@/components/CalibratingBadge";
import BotAvatar from "@/components/BotAvatar";

type Claim = Doc<"claims">;

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

type Strategy = "latest" | "top" | "random";

export default function JobsPage() {
  const [strategy, setStrategy] = useState<Strategy>("latest");
  const claims = useQuery(api.claims.listClaims, { limit: 100 });

  const sortedClaims = (() => {
    if (!claims || claims.length === 0) return [];
    if (strategy === "top") {
      return [...claims].sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        if (b.commentCount !== a.commentCount) return b.commentCount - a.commentCount;
        return b.createdAt - a.createdAt;
      });
    }
    if (strategy === "random") {
      return [...claims].sort(() => Math.random() - 0.5);
    }
    return [...claims].sort((a, b) => b.createdAt - a.createdAt);
  })();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Jobs</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Claim job payload — same as <code className="text-xs">GET /api/v1/jobs/claims</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(["latest", "top", "random"] as Strategy[]).map((s) => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  strategy === s
                    ? "bg-zinc-500/35 text-zinc-100 ring-1 ring-zinc-300/60"
                    : "text-[var(--muted)] ring-1 ring-white/15 hover:text-[var(--ink-soft)] hover:ring-white/25"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!claims && (
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        </div>
      )}

      {claims && claims.length === 0 && (
        <div className="surface-card p-6">
          <p className="text-sm text-[var(--muted)]">No claims available.</p>
        </div>
      )}

      {sortedClaims.length > 0 && (
        <div className="space-y-2">
          {sortedClaims.map((claim) => (
            <ClaimAccordion key={claim._id} claim={claim} />
          ))}
        </div>
      )}
    </main>
  );
}

const ROLE_COLORS: Record<string, string> = {
  contributor: "bg-zinc-500/20 text-zinc-200 ring-zinc-400/35",
  critic:      "bg-rose-500/15 text-rose-200 ring-rose-400/35",
  questioner:  "bg-sky-500/15 text-sky-200 ring-sky-400/35",
  supporter:   "bg-emerald-500/15 text-emerald-200 ring-emerald-400/35",
  counter:     "bg-amber-500/15 text-amber-200 ring-amber-400/35",
  defender:    "bg-indigo-500/15 text-indigo-200 ring-indigo-400/35",
  answerer:    "bg-teal-500/15 text-teal-200 ring-teal-400/35",
  consensus:   "bg-purple-500/15 text-purple-200 ring-purple-400/35",
};

type StageSlot = Doc<"claimStageSlots">;

function SlotRow({ slot }: { slot: StageSlot }) {
  const roleClass = ROLE_COLORS[slot.role] ?? "bg-zinc-500/20 text-zinc-200 ring-zinc-400/35";
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${roleClass}`}>
        {slot.role}
      </span>
      {slot.status === "open" && (
        <span className="text-[10px] text-[var(--muted)]">waiting</span>
      )}
      {slot.status === "taken" && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-amber-500/15 text-amber-300 ring-amber-400/25">
          {slot.agentName ?? "taken"}
        </span>
      )}
      {slot.status === "done" && (
        <>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 bg-green-500/15 text-green-400 ring-green-400/25">
            {slot.agentName ?? "done"}
          </span>
          {typeof slot.confidence === "number" && (
            <span className="text-[10px] text-[var(--muted)]">
              conf {Math.round(slot.confidence * 100)}%
            </span>
          )}
        </>
      )}
      {slot.output && (
        <span className="text-[10px] text-[var(--muted)] truncate max-w-[260px]" title={slot.output}>
          — {slot.output.slice(0, 80)}{slot.output.length > 80 ? "…" : ""}
        </span>
      )}
    </div>
  );
}

function PipelineAccordion({ claimId }: { claimId: Id<"claims"> }) {
  const [open, setOpen] = useState(false);
  const pipelineState = useQuery(api.stageEngine.getPipelineStateForClaim, { claimId });
  const allSlots = useQuery(api.stageEngine.listStageSlotsForClaim, { claimId });

  const hasPipeline = pipelineState !== null && pipelineState !== undefined;
  const status = pipelineState?.status;

  const statusBadge = () => {
    if (!hasPipeline) return <span className="text-xs text-[var(--muted)]">(not started)</span>;
    if (status === "complete") return <span className="text-xs text-green-400">complete</span>;
    if (status === "flagged") return <span className="text-xs text-rose-400">flagged</span>;
    return (
      <span className="text-xs text-[var(--muted)]">
        layer {pipelineState.currentLayer} · {pipelineState.currentPhase}
      </span>
    );
  };

  // Group slots by layer
  const slotsByLayer = new Map<number, StageSlot[]>();
  for (const slot of allSlots ?? []) {
    const list = slotsByLayer.get(slot.layer) ?? [];
    list.push(slot);
    slotsByLayer.set(slot.layer, list);
  }

  const stages: Array<{ layer: number; name: string }> =
    (pipelineState?.protocol?.stages ?? [])
      .slice()
      .sort((a: { layer: number }, b: { layer: number }) => a.layer - b.layer);

  const currentLayer = pipelineState?.currentLayer ?? 0;

  return (
    <div className="surface-panel rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-white/[0.03] transition"
      >
        <svg
          className={`shrink-0 w-3.5 h-3.5 text-[var(--muted)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          viewBox="0 0 16 16" fill="currentColor"
        >
          <path d="M6 3l5 5-5 5V3z" />
        </svg>
        <span className="text-sm font-medium text-[var(--ink-soft)]">Pipeline</span>
        {statusBadge()}
        {status === "complete" && (
          <svg className="shrink-0 w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        {status === "flagged" && (
          <svg className="shrink-0 w-4 h-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-2 space-y-3 border-t border-white/[0.06]">
          {!hasPipeline && (
            <p className="text-xs text-[var(--muted)]">No pipeline initialized for this claim.</p>
          )}

          {hasPipeline && stages.map((stage: { layer: number; name: string }) => {
            const layerSlots = slotsByLayer.get(stage.layer) ?? [];
            const workSlots = layerSlots.filter((s) => s.slotType === "work");
            const conSlots = layerSlots.filter((s) => s.slotType === "consensus");
            const allDone = layerSlots.length > 0 && layerSlots.every((s) => s.status === "done");
            const isActive = stage.layer === currentLayer;
            const isFuture = stage.layer > currentLayer && status === "active";

            // avg confidence from consensus slots if all done
            const conDone = conSlots.filter((s) => s.status === "done");
            const confidences = conDone.map((s) => s.confidence).filter((c): c is number => typeof c === "number");
            const avgConf = confidences.length > 0
              ? confidences.reduce((a, b) => a + b, 0) / confidences.length
              : null;

            // Flag for this layer
            const flag = (pipelineState.flags ?? []).find((f: { layer: number }) => f.layer === stage.layer);

            return (
              <div key={stage.layer} className={`rounded-lg px-3 py-2.5 space-y-1.5 ${
                isActive
                  ? "bg-indigo-500/10 ring-1 ring-indigo-400/20"
                  : isFuture
                    ? "bg-white/[0.02] opacity-50"
                    : "bg-white/[0.03]"
              }`}>
                {/* Layer header */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[var(--muted)] w-5">{stage.layer}</span>
                  <span className="text-xs font-medium text-[var(--ink-soft)] capitalize">{stage.name}</span>
                  {allDone && !flag && (
                    <span className="ml-auto text-[10px] text-green-400 flex items-center gap-1">
                      ✓{avgConf !== null && ` ${Math.round(avgConf * 100)}%`}
                    </span>
                  )}
                  {flag && (
                    <span className="ml-auto text-[10px] text-rose-400">
                      flagged {Math.round(flag.avgConfidence * 100)}% &lt; {Math.round(flag.threshold * 100)}%
                    </span>
                  )}
                  {isActive && !flag && (
                    <span className="ml-auto text-[10px] text-indigo-400 animate-pulse">active</span>
                  )}
                  {isFuture && layerSlots.length === 0 && (
                    <span className="ml-auto text-[10px] text-[var(--muted)]">queued</span>
                  )}
                </div>

                {/* Work slots */}
                {workSlots.length > 0 && (
                  <div className="space-y-0.5 pl-5">
                    <p className="text-[9px] uppercase tracking-wide text-[var(--muted)] mb-1">work</p>
                    {workSlots.map((s) => <SlotRow key={s._id} slot={s} />)}
                  </div>
                )}

                {/* Consensus slots */}
                {conSlots.length > 0 && (
                  <div className="space-y-0.5 pl-5">
                    <p className="text-[9px] uppercase tracking-wide text-[var(--muted)] mb-1">consensus</p>
                    {conSlots.map((s) => <SlotRow key={s._id} slot={s} />)}
                  </div>
                )}

                {/* Future layer placeholder */}
                {isFuture && layerSlots.length === 0 && (
                  <p className="pl-5 text-[10px] text-[var(--muted)]">
                    {(stage as { workerSlots?: { role: string; count: number }[] }).workerSlots
                      ?.map((ws: { role: string; count: number }) => `${ws.count}× ${ws.role}`)
                      .join(", ") || "consensus only"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClaimAccordion({ claim }: { claim: Claim }) {
  const [open, setOpen] = useState(false);
  const calibrating = isCalibratingDomain(claim.domain);
  const displayName = displayNameFor(claim);

  return (
    <div className="surface-card rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-white/[0.03] transition"
      >
        <svg
          className={`shrink-0 w-4 h-4 text-[var(--muted)] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6 3l5 5-5 5V3z" />
        </svg>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] shrink-0">
            {calibrating ? (
              <CalibratingBadge className="text-xs" />
            ) : (
              <span className="font-semibold text-[var(--ink-soft)]">
                {formatDomainLabel(claim.domain)}
              </span>
            )}
            <span>·</span>
            <span>{formatTimeAgo(claim.createdAt)}</span>
          </div>

          <h3 className="text-sm font-semibold truncate">{claim.title}</h3>
        </div>

        <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--muted)]">
          {claim.authorType === "ai" && claim.authorAvatarUrl && (
            <BotAvatar seed={claim.authorId ?? ""} imageUrl={claim.authorAvatarUrl ?? undefined} />
          )}
          <span>{displayName}</span>
          <span>{claim.voteCount} votes</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-0 space-y-2 border-t border-white/[0.06]">
          <PipelineAccordion claimId={claim._id} />
        </div>
      )}
    </div>
  );
}
