"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { domainCategories, formatDomainLabel, isCalibratingDomain } from "@/lib/domains";
import CalibratingBadge from "@/components/CalibratingBadge";

type RouteParams = {
  claimId: string;
};

const REQUIRED_TOTAL = 100;

const formatTimeAgo = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function ClaimCalibrationPage() {
  const params = useParams<RouteParams>();
  const claimId = params?.claimId as string;

  const claim = useQuery(api.claims.getClaim, {
    id: claimId as Id<"claims">,
  });
  const latestCalibration = useQuery(api.calibrations.getLatestForClaim, {
    claimId: claimId as Id<"claims">,
  });
  const saveCalibration = useMutation(api.calibrations.saveCalibration);

  const allDomains = useMemo(
    () => domainCategories.flatMap((category) => category.domains.map((domain) => domain.name)),
    []
  );

  const buildEmptyScores = useCallback(
    () => Object.fromEntries(allDomains.map((domain) => [domain, 0])) as Record<string, number>,
    [allDomains]
  );

  const [scores, setScores] = useState<Record<string, number>>(() => buildEmptyScores());
  const [openCategories, setOpenCategories] = useState<string[]>([
    domainCategories[0]?.name ?? "",
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!latestCalibration) return;
    const nextScores = buildEmptyScores();
    latestCalibration.scores.forEach((item: any) => {
      nextScores[item.domain] = item.score;
    });
    setScores(nextScores);
  }, [latestCalibration, buildEmptyScores]);

  const total = useMemo(() => {
    return Object.values(scores).reduce((sum, value) => sum + value, 0);
  }, [scores]);

  const remaining = REQUIRED_TOTAL - total;
  const canSave = total === REQUIRED_TOTAL && !isSaving;

  const handleScoreChange = (domain: string, value: string) => {
    const parsed = Number(value);
    const nextValue = Number.isFinite(parsed)
      ? Math.max(0, Math.min(100, Math.round(parsed)))
      : 0;
    setScores((prev) => ({ ...prev, [domain]: nextValue }));
  };

  const toggleCategory = (name: string) => {
    setOpenCategories((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const handleReset = () => {
    setScores(buildEmptyScores());
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (total !== REQUIRED_TOTAL) {
      setErrorMessage("Total must be 100 before saving.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = Object.entries(scores)
        .filter(([, score]) => score > 0)
        .map(([domain, score]) => ({ domain, score }));
      await saveCalibration({
        claimId: claimId as Id<"claims">,
        scores: payload,
      });
      setStatusMessage("Calibration saved.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save calibration.");
    } finally {
      setIsSaving(false);
    }
  };

  if (claim === undefined) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 animate-fade-in">
          <p className="text-sm text-[var(--muted)]">Loading claim...</p>
        </div>
      </main>
    );
  }

  if (!claim) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
          <p className="text-sm text-[var(--muted)]">Claim not found.</p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-card)]"
          >
            Back to feed
          </Link>
        </div>
      </main>
    );
  }

  const calibrating = isCalibratingDomain(claim.domain);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {calibrating ? (
            <CalibratingBadge className="text-xs uppercase tracking-wide" />
          ) : (
            <Link
              href={`/d/${claim.domain}`}
              className="text-xs uppercase tracking-wide text-[var(--muted)] hover:text-[var(--ink)]"
            >
              {formatDomainLabel(claim.domain)}
            </Link>
          )}
          <h1 className="text-xl font-semibold">Claim calibration</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/d/${claim.domain}/${claim._id}`}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
          >
            Back to claim
          </Link>
          <Link
            href="/"
            className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
          >
            Back to feed
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Claim</p>
            <h2 className="text-lg font-semibold">{claim.title}</h2>
          </div>
          {latestCalibration && (
            <div className="text-xs text-[var(--muted)]">
              Last saved {formatTimeAgo(latestCalibration.createdAt)} by {latestCalibration.editorName}
            </div>
          )}
        </div>
        <p className="mt-3 text-sm text-[var(--muted)] whitespace-pre-line">{claim.body}</p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Domain certainty
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Distribute 100 points across domains to represent confidence.
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              total === REQUIRED_TOTAL
                ? "bg-[var(--bg)] text-[var(--ink)]"
                : "bg-[var(--bg)] text-[var(--muted)]"
            }`}
          >
            Total {total}/100
            {remaining !== 0 && <span className="ml-2">({remaining > 0 ? "+" : ""}{remaining})</span>}
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {errorMessage}
          </div>
        )}
        {statusMessage && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {statusMessage}
          </div>
        )}

        <div className="space-y-4">
          {domainCategories.map((category) => {
            const isOpen = openCategories.includes(category.name);
            return (
              <div key={category.name} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.name)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-[var(--ink)]">{category.name}</span>
                  <span className="text-xs text-[var(--muted)]">{isOpen ? "Hide" : "Show"}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
                    {category.domains.map((domain) => (
                      <div key={domain.name} className="flex flex-wrap items-center gap-3">
                        <span className="text-sm text-[var(--ink)]">d/{domain.name}</span>
                        <div className="ml-auto flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={scores[domain.name] ?? 0}
                            onChange={(event) => handleScoreChange(domain.name, event.target.value)}
                            className="w-20 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-right text-sm text-[var(--ink)] outline-none focus:border-[var(--border-hover)]"
                          />
                          <span className="text-xs text-[var(--muted)]">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold hover:border-[var(--border-hover)] hover:bg-[var(--bg-card)]"
          >
            Reset
          </button>
          <Authenticated>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save calibration"}
            </button>
          </Authenticated>
          <Unauthenticated>
            <span className="text-xs text-[var(--muted)]">Sign in to save calibration.</span>
          </Unauthenticated>
        </div>
      </section>
    </main>
  );
}
