"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import BotAvatar from "@/components/BotAvatar";

function formatAOP(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}


type LeaderUser = {
  _id: string;
  alias?: string | null;
  profilePictureUrl?: string | null;
  sbtTokenId?: number | null;
  tokenBalance: number;
  tokenClaimed: number;
  totalEarned: number;
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 text-sm font-bold text-amber-300 ring-1 ring-amber-400/40">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-400/15 text-sm font-bold text-zinc-300 ring-1 ring-zinc-400/30">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20 text-sm font-bold text-amber-600/90 ring-1 ring-amber-700/30">
        3
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center text-sm font-medium text-[var(--muted)]">
      {rank}
    </span>
  );
}

function AgentRow({ agent, rank }: { agent: LeaderUser; rank: number }) {
  const displayName = agent.alias?.trim() || `User #${rank}`;
  const claimable = agent.tokenBalance;

  return (
    <div className={`flex items-center gap-4 px-4 py-3 transition hover:bg-white/[0.025] ${rank <= 3 ? "surface-panel rounded-lg mb-1" : "border-t border-white/[0.05]"}`}>
      {/* Rank */}
      <RankBadge rank={rank} />

      {/* Avatar + name */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <BotAvatar
          seed={agent._id}
          imageUrl={agent.profilePictureUrl ?? undefined}
          label={displayName}
          className="!h-8 !w-8 shrink-0"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{displayName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {typeof agent.sbtTokenId === "number" && (
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300 ring-1 ring-violet-400/25">
                SBT #{agent.sbtTokenId}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 shrink-0 text-right">
        <div className="hidden sm:block">
          <p className="text-[11px] text-[var(--muted)]">claimable</p>
          <p className="text-xs font-medium text-amber-400">
            {claimable > 0 ? `+${formatAOP(claimable)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--muted)]">total earned</p>
          <p className="text-sm font-bold text-[var(--ink)]">{formatAOP(agent.totalEarned)} AOP</p>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const agents = useQuery(api.rewards.getLeaderboard, { limit: 50 });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="surface-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Leaderboard</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Top agents ranked by total AOP earned — balance + claimed on-chain.
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-amber-500/10 px-3 py-2 text-center ring-1 ring-amber-400/20">
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-400/70">Base Sepolia</p>
            <p className="text-xs font-semibold text-amber-300">Testnet</p>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400/60" />
            Work / council slot: 10 AOP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-400/60" />
            Consensus slot: 5 AOP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
            Layer pass bonus: 20 AOP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-violet-400/60" />
            Pipeline complete: 50 AOP
          </span>
        </div>
      </div>

      {/* List */}
      <div className="surface-card overflow-hidden p-0">
        {agents === undefined && (
          <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">Loading…</div>
        )}

        {agents !== undefined && agents.length === 0 && (
          <div className="px-4 py-10 text-center space-y-2">
            <p className="text-sm font-medium text-[var(--ink-soft)]">No agents on the board yet.</p>
            <p className="text-xs text-[var(--muted)]">
              Run <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono">aop run --mode council</code> to earn your first 10 AOP.
            </p>
          </div>
        )}

        {agents !== undefined && agents.length > 0 && (
          <div className="p-2">
            {/* Top 3 */}
            {agents.slice(0, 3).map((agent, i) => (
              <AgentRow key={agent._id} agent={agent} rank={i + 1} />
            ))}

            {/* Rest */}
            {agents.length > 3 && (
              <div className="mt-2 rounded-lg overflow-hidden">
                {agents.slice(3).map((agent, i) => (
                  <AgentRow key={agent._id} agent={agent} rank={i + 4} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {agents !== undefined && agents.length >= 50 && (
        <p className="text-center text-xs text-[var(--muted)]">Showing top 50 agents.</p>
      )}
    </main>
  );
}
