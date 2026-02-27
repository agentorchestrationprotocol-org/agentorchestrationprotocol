"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Authenticated, Unauthenticated, useAction, useMutation, useQuery } from "convex/react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const HumanIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="7" r="3" />
    <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
  </svg>
);

const BotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 3h6v3H9z" />
    <rect x="5" y="6" width="14" height="12" rx="3" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M8 16h8" />
  </svg>
);

const MetaMaskIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 35 33" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M32.9 1L19.4 10.9l2.5-5.9L32.9 1z" opacity=".8" />
    <path
      d="M2.1 1l13.4 10-2.4-6L2.1 1zM28 23.5l-3.6 5.5 7.7 2.1 2.2-7.5-6.3-.1zM.7 23.6 2.9 31l7.7-2.1-3.6-5.5-6.3.2z"
      opacity=".8"
    />
    <path
      d="m10.4 14.5-2.1 3.2 7.5.3-.3-8-5.1 4.5zM24.6 14.5l-5.2-4.6-.2 8.1 7.5-.3-2.1-3.2zM10.6 29l4.5-2.2-3.9-3-.6 5.2zM19.9 26.8l4.5 2.2-.6-5.2-3.9 3z"
      opacity=".8"
    />
  </svg>
);

const formatErrorMessage = (error: unknown) => {
  const raw =
    typeof (error as { message?: string })?.message === "string"
      ? (error as { message: string }).message
      : String(error ?? "");
  const cleaned = raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/Server Error\s*/gi, "")
    .replace(/Uncaught Error:\s*/gi, "")
    .replace(/Error:\s*/gi, "")
    .replace(/\[Request ID:[^\]]+\]\s*/gi, "")
    .replace(/\s+at handler.*$/gi, "")
    .replace(/\s+Called by client.*$/gi, "")
    .trim();
  const firstLine = cleaned.split("\n")[0]?.trim();
  const base = firstLine || cleaned;
  if (base.toLowerCase() === "you are not an admin.") {
    return "You are not an admin. Contact admin@agentorchestrationprotocol.org to gain access.";
  }
  return base;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const formatLatency = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "n/a" : `${Math.round(value)} ms`;

type ProfileTab = "profile" | "wallet" | "stats" | "moderation" | "observability";

const profileTabs: Array<{ id: ProfileTab; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "wallet", label: "Wallet" },
  { id: "stats", label: "Stats" },
  { id: "moderation", label: "Moderation" },
  { id: "observability", label: "Observability" },
];

const ProfilePageFallback = () => (
  <main className="mx-auto max-w-5xl px-4 py-6">
    <section className="rounded-2xl p-6">
      <p className="text-sm text-[var(--muted)]">Loading profile...</p>
    </section>
  </main>
);

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfilePageFallback />}>
      <ProfilePageContent />
    </Suspense>
  );
}

function ProfilePageContent() {
  const searchParams = useSearchParams();
  const profile = useQuery(api.users.getMyProfile);
  const access = useQuery(api.users.getMyAccess);
  const syncMyUser = useAction(api.users.syncMyUser);
  const updateProfile = useMutation(api.users.updateMyProfile);
  const ensureAlias = useMutation(api.users.ensureMyAlias);
  const keys = useQuery(api.agent.listApiKeys);
  const linkWallet = useMutation(api.sbt.linkWallet);
  const claimTokens = useMutation(api.sbt.claimTokens);
  const retryMintSBT = useMutation(api.sbt.retryMintSBT);
  const aopTokenAddress = useQuery(api.sbt.getAopTokenAddress);
  const setClaimModeration = useMutation(api.claims.setClaimModeration);
  const setCommentModeration = useMutation(api.comments.setCommentModeration);
  const resolveModerationReport = useMutation(api.claims.resolveModerationReport);

  const [alias, setAlias] = useState("");
  const [prefersAnonymous, setPrefersAnonymous] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [claimBasescanWallet, setClaimBasescanWallet] = useState<string | null>(null);
  const [moderationStatusFilter, setModerationStatusFilter] = useState<"open" | "resolved">(
    "open"
  );
  const [moderationStatus, setModerationStatus] = useState<string | null>(null);
  const [moderationBusyId, setModerationBusyId] = useState<string | null>(null);
  const hasEnsuredAlias = useRef(false);

  const isModerationAdmin = !!access?.isModerationAdmin;
  const visibleTabs = isModerationAdmin
    ? profileTabs
    : profileTabs.filter((tab) => tab.id !== "moderation" && tab.id !== "observability");

  const rawTab = searchParams.get("tab");
  const activeTab: ProfileTab =
    rawTab === "wallet" ||
    rawTab === "stats" ||
    rawTab === "profile" ||
    rawTab === "moderation" ||
    rawTab === "observability"
      ? ((rawTab === "moderation" || rawTab === "observability") && !isModerationAdmin
          ? "profile"
          : rawTab)
      : "profile";

  const leaderboard = useQuery(api.rewards.getLeaderboard, { limit: 100 });

  const myRank = useMemo(() => {
    if (!leaderboard || !profile?._id) return null;
    const idx = leaderboard.findIndex((u) => u._id === profile._id);
    return idx === -1 ? null : idx + 1;
  }, [leaderboard, profile]);

  const activeKeyCount = useMemo(
    () => (keys ? keys.filter((k) => !k.revoked).length : null),
    [keys]
  );

  const totalEarned = (profile?.tokenBalance ?? 0) + (profile?.tokenClaimed ?? 0);

  const moderationQueue = useQuery(
    api.claims.listModerationQueue,
    isModerationAdmin ? { status: moderationStatusFilter, limit: 100 } : "skip"
  );
  const moderationActions = useQuery(
    api.claims.listModerationActions,
    isModerationAdmin ? { limit: 50 } : "skip"
  );
  const observabilityDashboard = useQuery(
    api.observability.getApiDashboard,
    isModerationAdmin ? { hours: 24 } : "skip"
  );
  const observabilityAlerts = useQuery(
    api.observability.getAlertRulesStatus,
    isModerationAdmin ? {} : "skip"
  );
  const recentErrors = useQuery(
    api.observability.listRecentErrors,
    isModerationAdmin ? { limit: 25 } : "skip"
  );

  useEffect(() => {
    if (!profile) return;
    setAlias(profile.alias ?? "");
    setPrefersAnonymous(profile.prefersAnonymous ?? false);
  }, [profile]);

  useEffect(() => {
    if (!profile || hasEnsuredAlias.current) return;
    if (!profile.alias?.trim()) {
      hasEnsuredAlias.current = true;
      void ensureAlias();
    }
  }, [profile, ensureAlias]);

  const hasSyncedUser = useRef(false);
  useEffect(() => {
    if (profile !== null || hasSyncedUser.current) return;
    hasSyncedUser.current = true;
    void syncMyUser({});
  }, [profile, syncMyUser]);

  const handleSaveProfile = async () => {
    setProfileStatus(null);
    setIsSavingProfile(true);
    try {
      await updateProfile({ alias: alias.trim(), prefersAnonymous });
      setProfileStatus("Profile updated.");
    } catch (error: unknown) {
      setProfileStatus(formatErrorMessage(error) || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleConnectAndLink = async () => {
    if (walletBusy) return;
    setWalletBusy(true);
    setWalletStatus(null);
    try {
      const ethereum = (
        window as unknown as {
          ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
          };
        }
      ).ethereum;
      if (!ethereum) {
        setWalletStatus("MetaMask not detected. Install the MetaMask browser extension first.");
        return;
      }
      // Always show the account picker so the user can choose which address to link.
      await ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
      const address = accounts[0];
      if (!address) {
        setWalletStatus("No account selected.");
        return;
      }
      const result = await linkWallet({ walletAddress: address });
      setWalletStatus(
        result.alreadyLinked ? "Wallet already linked." : "Wallet linked — SBT minting..."
      );
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code === 4001) {
        setWalletStatus("Connection cancelled.");
      } else {
        const msg = (err as { message?: string })?.message ?? "";
        if (msg.includes("already linked to another account")) {
          setWalletStatus("That wallet is linked to a different account. Pick a different address.");
        } else {
          setWalletStatus(msg || "Failed to connect wallet.");
        }
      }
    } finally {
      setWalletBusy(false);
    }
  };

  const handleClaim = async () => {
    if (walletBusy) return;
    setWalletBusy(true);
    setWalletStatus(null);
    setClaimBasescanWallet(null);
    try {
      const result = await claimTokens({});
      setWalletStatus(
        `Claiming ${(result as { claiming: number }).claiming} AOP tokens on-chain...`
      );
      setClaimBasescanWallet(profile?.walletAddress ?? null);
    } catch (err: unknown) {
      setWalletStatus((err as { message?: string })?.message ?? "Failed to claim tokens.");
    } finally {
      setWalletBusy(false);
    }
  };

  const handleRetryMint = async () => {
    if (walletBusy) return;
    setWalletBusy(true);
    setWalletStatus(null);
    try {
      await retryMintSBT({});
      setWalletStatus("Minting SBT...");
    } catch (err: unknown) {
      setWalletStatus((err as { message?: string })?.message ?? "Failed to mint.");
    } finally {
      setWalletBusy(false);
    }
  };

  const handleAddAopToMetaMask = async () => {
    const ethereum = (
      window as unknown as {
        ethereum?: {
          request: (args: { method: string; params?: unknown }) => Promise<unknown>;
        };
      }
    ).ethereum;
    if (!ethereum) {
      setWalletStatus("MetaMask not detected. Install the MetaMask browser extension first.");
      return;
    }
    if (!aopTokenAddress) {
      setWalletStatus("Token contract address not available.");
      return;
    }
    try {
      await ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: aopTokenAddress,
            symbol: "AOP",
            decimals: 18,
          },
        },
      });
    } catch (err: unknown) {
      const code = (err as { code?: number }).code;
      if (code !== 4001) {
        setWalletStatus((err as { message?: string })?.message ?? "Failed to add token.");
      }
    }
  };

  const handleResolveReport = async (reportId: Id<"moderationReports">) => {
    const note = window.prompt("Optional resolution note", "");
    if (note === null) return;
    setModerationStatus(null);
    setModerationBusyId(String(reportId));
    try {
      await resolveModerationReport({ reportId, note: note.trim() || undefined });
      setModerationStatus("Report resolved.");
    } catch (error: unknown) {
      setModerationStatus(formatErrorMessage(error) || "Failed to resolve report.");
    } finally {
      setModerationBusyId(null);
    }
  };

  const handleModerateClaim = async (
    reportId: Id<"moderationReports">,
    claimId: Id<"claims">,
    isHidden: boolean,
    reasonCategory?: string | null
  ) => {
    const note = window.prompt(
      isHidden ? "Optional note for hiding this claim" : "Optional note for unhiding this claim",
      ""
    );
    if (note === null) return;
    setModerationStatus(null);
    setModerationBusyId(String(reportId));
    try {
      await setClaimModeration({
        claimId,
        isHidden,
        reasonCategory: reasonCategory ?? undefined,
        note: note.trim() || undefined,
        reportId,
      });
      setModerationStatus(isHidden ? "Claim hidden." : "Claim unhidden.");
    } catch (error: unknown) {
      setModerationStatus(formatErrorMessage(error) || "Failed to update claim moderation.");
    } finally {
      setModerationBusyId(null);
    }
  };

  const handleModerateComment = async (
    reportId: Id<"moderationReports">,
    commentId: Id<"comments">,
    isHidden: boolean,
    reasonCategory?: string | null
  ) => {
    const note = window.prompt(
      isHidden
        ? "Optional note for hiding this comment subtree"
        : "Optional note for unhiding this comment subtree",
      ""
    );
    if (note === null) return;
    setModerationStatus(null);
    setModerationBusyId(String(reportId));
    try {
      await setCommentModeration({
        commentId,
        isHidden,
        reasonCategory: reasonCategory ?? undefined,
        note: note.trim() || undefined,
        reportId,
      });
      setModerationStatus(isHidden ? "Comment subtree hidden." : "Comment subtree unhidden.");
    } catch (error: unknown) {
      setModerationStatus(formatErrorMessage(error) || "Failed to update comment moderation.");
    } finally {
      setModerationBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Authenticated>
        {/* Tab nav */}
        <section className="mb-6 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="inline-flex min-w-full gap-1.5 rounded-full bg-[var(--bg-card)] p-1">
              {visibleTabs.map((tab) => {
                const isActive = tab.id === activeTab;
                const href = tab.id === "profile" ? "/profile" : `/profile?tab=${tab.id}`;
                return (
                  <Link
                    key={tab.id}
                    href={href}
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-[var(--bg)] text-[var(--ink)]"
                        : "text-[var(--muted)] hover:text-[var(--ink)]",
                    ].join(" ")}
                  >
                    {tab.label}
                  </Link>
                );
              })}
              </div>
            </div>
            {profile?.email && (
              <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--muted)]">
                {profile.email}
              </span>
            )}
          </div>
        </section>

        {/* Profile tab */}
        {activeTab === "profile" && (
          <section className="rounded-2xl p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <HumanIcon className="h-4 w-4 text-[var(--muted)]" />
              Your profile
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Your public posts will use your username unless you post as anonymous.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Username
                </label>
                <input
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--border-hover)]"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="perfect-apple-1256"
                />
                <p className="text-xs text-[var(--muted)]">
                  2–40 characters. Leave blank for an auto-generated username.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Privacy
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={prefersAnonymous}
                    onChange={(e) => setPrefersAnonymous(e.target.checked)}
                    className="h-4 w-4 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]"
                  />
                  <span>Always post as anonymous</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProfile ? "Saving..." : "Save profile"}
              </button>
              {profileStatus && (
                <span className="text-xs text-[var(--muted)]">{profileStatus}</span>
              )}
            </div>

            {/* Manage agents card */}
            <div className="mt-8">
              <Link
                href="/profile/agents"
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
              >
                <div className="flex items-center gap-3">
                  <BotIcon className="h-5 w-5 text-[var(--muted)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">Manage agents</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {activeKeyCount === null
                        ? "Loading..."
                        : `${activeKeyCount} active key${activeKeyCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm text-[var(--muted)]">→</span>
              </Link>
            </div>
          </section>
        )}

        {/* Wallet tab */}
        {activeTab === "wallet" && (
          <section className="rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[var(--ink)]">Wallet & tokens</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Your on-chain identity. Wallet and SBT are account-level.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {/* Wallet */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Wallet
                </p>
                {profile?.walletAddress ? (
                  <div className="mt-3 flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 break-all font-mono text-xs text-[var(--ink)]">
                      {profile.walletAddress}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.clipboard.writeText(profile.walletAddress ?? "")
                      }
                      className="shrink-0 rounded border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)] hover:border-[var(--border-hover)] hover:text-[var(--ink)]"
                    >
                      Copy
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <p className="text-xs text-[var(--muted)]">Not linked</p>
                    <button
                      type="button"
                      onClick={() => void handleConnectAndLink()}
                      disabled={walletBusy}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#f6851b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#e2761b] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <MetaMaskIcon className="h-3.5 w-3.5 fill-white" />
                      {walletBusy ? "Connecting..." : "Connect MetaMask"}
                    </button>
                  </div>
                )}
              </div>

              {/* SBT */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  SBT
                </p>
                {profile?.sbtTokenId !== undefined ? (
                  <a
                    href={`https://basescan.org/token/0x2159931B9aD760e57cb6078EF7e9f44f72a95155?a=${profile.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-semibold text-[var(--accent)] hover:underline"
                  >
                    Token #{profile.sbtTokenId}
                  </a>
                ) : profile?.walletAddress ? (
                  <div className="mt-3">
                    <p className="text-xs text-[var(--muted)]">Not minted</p>
                    <button
                      type="button"
                      disabled={walletBusy}
                      onClick={() => void handleRetryMint()}
                      className="mt-2 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {walletBusy ? "..." : "Mint SBT"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[var(--muted)]">Link wallet first</p>
                )}
              </div>

              {/* AOP balance */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  AOP balance
                </p>
                <p className="mt-3 text-sm font-semibold text-[var(--ink)]">
                  {profile?.tokenBalance ?? 0} AOP claimable
                </p>
                {(profile?.tokenClaimed ?? 0) > 0 && (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {profile?.tokenClaimed} AOP claimed on-chain
                  </p>
                )}
                {profile?.walletAddress && (profile?.tokenBalance ?? 0) > 0 && !["pending","confirming"].includes(profile?.tokenClaimStatus ?? "") && (
                  <button
                    type="button"
                    onClick={() => void handleClaim()}
                    disabled={walletBusy}
                    className="mt-3 rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {walletBusy ? "Claiming..." : `Claim ${profile.tokenBalance} AOP`}
                  </button>
                )}
                {aopTokenAddress && (
                  <button
                    type="button"
                    onClick={() => void handleAddAopToMetaMask()}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--muted)] hover:border-[var(--border-hover)] hover:text-[var(--ink)]"
                  >
                    <MetaMaskIcon className="h-3 w-3" />
                    Add AOP to MetaMask
                  </button>
                )}
              </div>
            </div>

            {/* Claim progress */}
            {profile?.tokenClaimStatus && (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Claim progress
                </p>
                <div className="mt-3 flex items-center gap-0">
                  {[
                    { key: "pending", label: "Queued" },
                    { key: "confirming", label: "Confirming" },
                    { key: "confirmed", label: "Confirmed" },
                  ].map((step, i) => {
                    const statusOrder = ["pending", "confirming", "confirmed", "failed"];
                    const currentIdx = statusOrder.indexOf(profile.tokenClaimStatus ?? "");
                    const stepIdx = statusOrder.indexOf(step.key);
                    const done = currentIdx > stepIdx;
                    const active = currentIdx === stepIdx && profile.tokenClaimStatus !== "failed";
                    return (
                      <div key={step.key} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div className={[
                            "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold",
                            done ? "bg-[var(--accent)] text-white"
                              : active ? "border-2 border-[var(--accent)] text-[var(--accent)]"
                              : "border border-[var(--border)] text-[var(--muted)]",
                          ].join(" ")}>
                            {done ? "✓" : i + 1}
                          </div>
                          <p className={[
                            "mt-1 text-[10px]",
                            done || active ? "text-[var(--ink)]" : "text-[var(--muted)]",
                          ].join(" ")}>
                            {step.label}
                          </p>
                        </div>
                        {i < 2 && (
                          <div className={[
                            "mb-3 h-px w-8",
                            done ? "bg-[var(--accent)]" : "bg-[var(--border)]",
                          ].join(" ")} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {profile.tokenClaimStatus === "failed" && (
                  <p className="mt-2 text-xs text-red-500">Transaction failed — tokens restored to your balance.</p>
                )}
                {profile.tokenClaimStatus === "confirming" && (
                  <p className="mt-2 text-xs text-[var(--muted)]">Waiting for Base network confirmation...</p>
                )}
                {profile.tokenTxHash && (
                  <a
                    href={`https://basescan.org/tx/${profile.tokenTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block font-mono text-[10px] text-[var(--accent)] hover:underline"
                  >
                    {profile.tokenTxHash.slice(0, 12)}...{profile.tokenTxHash.slice(-8)} →
                  </a>
                )}
              </div>
            )}

            {walletStatus && (
              <p className="mt-4 text-xs text-[var(--muted)]">{walletStatus}</p>
            )}
          </section>
        )}

        {/* Stats tab */}
        {activeTab === "stats" && (
          <section className="rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[var(--ink)]">Stats</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Your contribution overview.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Total AOP earned
                </p>
                <p className="mt-3 text-3xl font-bold text-[var(--ink)]">
                  {totalEarned.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {profile?.tokenBalance ?? 0} claimable · {profile?.tokenClaimed ?? 0} on-chain
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Leaderboard rank
                </p>
                <p className="mt-3 text-3xl font-bold text-[var(--ink)]">
                  {leaderboard === undefined ? "..." : myRank !== null ? `#${myRank}` : "—"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {leaderboard !== undefined && myRank !== null
                    ? `out of ${leaderboard.length} ranked`
                    : "earn AOP to appear on the leaderboard"}
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Agent keys
                </p>
                <p className="mt-3 text-3xl font-bold text-[var(--ink)]">
                  {activeKeyCount ?? "..."}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">active keys</p>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/leaderboard"
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                View leaderboard →
              </Link>
            </div>
          </section>
        )}

        {/* Moderation tab (admin only) */}
        {activeTab === "moderation" && isModerationAdmin && (
          <section className="rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[var(--ink)]">Moderation queue</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Review reports, hide or unhide content, and resolve moderation tickets.
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Hidden claims and comments are excluded from feed, detail, and public API responses.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModerationStatusFilter("open")}
                className={
                  moderationStatusFilter === "open" ? "chip text-[var(--ink)]" : "chip"
                }
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setModerationStatusFilter("resolved")}
                className={
                  moderationStatusFilter === "resolved" ? "chip text-[var(--ink)]" : "chip"
                }
              >
                Resolved
              </button>
              {moderationStatus && (
                <span className="ml-2 text-xs text-[var(--muted)]">{moderationStatus}</span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {moderationQueue === undefined ? (
                <p className="text-sm text-[var(--muted)]">Loading moderation queue...</p>
              ) : moderationQueue.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No reports in this queue.</p>
              ) : (
                moderationQueue.map((report) => {
                  const reportId = report._id;
                  const isBusy = moderationBusyId === String(reportId);
                  const target = report.target;
                  const targetIsHidden = !!target?.isHidden;
                  const claimId = report.claimId;
                  const commentId = report.commentId;

                  return (
                    <article
                      key={report._id}
                      className="rounded-xl border border-[var(--border)] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <span className="rounded-full bg-[var(--bg)] px-2 py-1 uppercase tracking-wide">
                          {report.targetType}
                        </span>
                        <span className="rounded-full bg-[var(--bg)] px-2 py-1 uppercase tracking-wide">
                          {report.reasonCategory}
                        </span>
                        <span>{new Date(report.createdAt).toLocaleString()}</span>
                        <span>Reporter {report.reporterEmail ?? report.reporterAuthId}</span>
                        {report.status === "resolved" && report.reviewedAt && (
                          <span>
                            Reviewed {new Date(report.reviewedAt).toLocaleString()}
                            {report.reviewedByAuthId ? ` by ${report.reviewedByAuthId}` : ""}
                          </span>
                        )}
                      </div>

                      {report.details && (
                        <p className="mt-2 text-sm text-[var(--ink-soft)]">{report.details}</p>
                      )}

                      {target ? (
                        <div className="mt-3 rounded-lg bg-[var(--bg-card)] p-3">
                          {target.kind === "claim" ? (
                            <>
                              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                                Claim
                              </p>
                              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                                {target.title}
                              </p>
                              <p className="mt-1 line-clamp-3 text-sm text-[var(--ink-soft)]">
                                {target.body}
                              </p>
                              <p className="mt-2 text-xs text-[var(--muted)]">
                                Author {target.authorName} ·{" "}
                                {target.isHidden ? "Hidden" : "Visible"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                                Comment
                              </p>
                              <p className="mt-1 line-clamp-4 text-sm text-[var(--ink-soft)]">
                                {target.body}
                              </p>
                              <p className="mt-2 text-xs text-[var(--muted)]">
                                Author {target.authorName} ·{" "}
                                {target.isHidden ? "Hidden" : "Visible"}
                              </p>
                            </>
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-[var(--muted)]">
                          Target content no longer exists.
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {target &&
                          report.status === "open" &&
                          report.targetType === "claim" &&
                          claimId && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleModerateClaim(
                                  reportId,
                                  claimId,
                                  !targetIsHidden,
                                  report.reasonCategory
                                )
                              }
                              disabled={isBusy}
                              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {targetIsHidden ? "Unhide claim" : "Hide claim"}
                            </button>
                          )}
                        {target &&
                          report.status === "open" &&
                          report.targetType === "comment" &&
                          commentId && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleModerateComment(
                                  reportId,
                                  commentId,
                                  !targetIsHidden,
                                  report.reasonCategory
                                )
                              }
                              disabled={isBusy}
                              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {targetIsHidden ? "Unhide subtree" : "Hide subtree"}
                            </button>
                          )}
                        {report.status === "open" && (
                          <button
                            type="button"
                            onClick={() => void handleResolveReport(reportId)}
                            disabled={isBusy}
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Resolve
                          </button>
                        )}
                      </div>

                      {report.reviewNote && (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          Review note: {report.reviewNote}
                        </p>
                      )}
                    </article>
                  );
                })
              )}
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Recent moderation actions
              </h3>
              {moderationActions === undefined ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Loading action log...</p>
              ) : moderationActions.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">No moderation actions yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {moderationActions.map((action) => (
                    <div
                      key={action._id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]"
                    >
                      <span className="rounded-full bg-[var(--bg)] px-2 py-1 uppercase tracking-wide">
                        {action.action}
                      </span>
                      <span className="rounded-full bg-[var(--bg)] px-2 py-1 uppercase tracking-wide">
                        {action.targetType}
                      </span>
                      {action.reasonCategory && <span>{action.reasonCategory}</span>}
                      <span>{new Date(action.createdAt).toLocaleString()}</span>
                      <span>By {action.actorEmail ?? action.actorAuthId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Observability tab (admin only) */}
        {activeTab === "observability" && isModerationAdmin && (
          <section className="rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[var(--ink)]">Observability</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Baseline production telemetry for API health, failures, and abuse signals.
            </p>

            <div className="mt-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Alert rules
              </h3>
              {observabilityAlerts === undefined ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Loading alert rules...</p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {observabilityAlerts.rules.map((rule) => (
                    <article
                      key={rule.id}
                      className="rounded-xl border border-[var(--border)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--ink)]">{rule.label}</p>
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            rule.triggered
                              ? "bg-[var(--bg)] text-[var(--ink)]"
                              : "bg-[var(--bg-card)] text-[var(--muted)]",
                          ].join(" ")}
                        >
                          {rule.triggered ? "triggered" : "normal"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {rule.currentCount} events / {rule.windowMinutes}m (threshold{" "}
                        {rule.threshold})
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Owner: {rule.owner}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{rule.escalation}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                API latency and error rates (last 24h)
              </h3>
              {observabilityDashboard === undefined ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Loading API metrics...</p>
              ) : (
                <>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-[var(--border)] p-3">
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Requests
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
                        {observabilityDashboard.summary.requestCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] p-3">
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        5xx Error Rate
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
                        {formatPercent(observabilityDashboard.summary.serverErrorRate)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] p-3">
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        P95 Latency
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[var(--ink)]">
                        {formatLatency(observabilityDashboard.summary.p95LatencyMs)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {observabilityDashboard.criticalEndpoints.map((endpoint) => (
                      <div
                        key={`${endpoint.method}:${endpoint.route}`}
                        className="rounded-lg border border-[var(--border)] px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                            {endpoint.method}
                          </span>
                          <code className="text-xs font-semibold text-[var(--ink)]">
                            {endpoint.route}
                          </code>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
                          <span>{endpoint.requestCount} req</span>
                          <span>{formatPercent(endpoint.serverErrorRate)} 5xx</span>
                          <span>P95 {formatLatency(endpoint.p95LatencyMs)}</span>
                          <span>Auth fail {endpoint.authFailureCount}</span>
                          <span>429 {endpoint.rateLimitCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Recent errors
              </h3>
              {recentErrors === undefined ? (
                <p className="mt-2 text-sm text-[var(--muted)]">Loading error feed...</p>
              ) : recentErrors.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">No errors captured.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentErrors.map((event) => (
                    <div
                      key={event._id}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-[var(--muted)]">
                        <span className="rounded-full bg-[var(--bg)] px-2 py-1 uppercase tracking-wide">
                          {event.source}
                        </span>
                        {event.errorCode && <span>{event.errorCode}</span>}
                        {event.statusCode && <span>HTTP {event.statusCode}</span>}
                        {event.route && (
                          <code className="text-[var(--ink)]">{event.route}</code>
                        )}
                        <span>{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                      {event.message && (
                        <p className="mt-1 line-clamp-2 text-[var(--ink-soft)]">
                          {event.message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Sign out — always visible at bottom */}
        <div className="mt-8 px-1">
          <Link
            href="/sign-out"
            prefetch={false}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Sign out
          </Link>
        </div>
      </Authenticated>

      <Unauthenticated>
        <section className="rounded-2xl p-6">
          <p className="text-sm text-[var(--muted)]">Sign in to manage agent keys.</p>
        </section>
      </Unauthenticated>
    </main>
  );
}
