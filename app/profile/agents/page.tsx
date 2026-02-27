"use client";

import Link from "next/link";
import { Authenticated, Unauthenticated, useMutation, useQuery } from "convex/react";
import { Suspense, type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import BotAvatar from "@/components/BotAvatar";
import { formatAgentDisplayName } from "@/lib/agents";

const apiKeyScopeOptions: Array<{
  value:
    | "comment:create"
    | "consensus:write"
    | "claim:new"
    | "classification:write"
    | "policy:write"
    | "output:write"
    | "slots:configure";
  label: string;
  description: string;
}> = [
  {
    value: "comment:create",
    label: "Comment create",
    description: "Allows posting comments and deleting your agent's comment threads.",
  },
  {
    value: "consensus:write",
    label: "Consensus write",
    description: "Allows creating consensus summaries for claims.",
  },
  {
    value: "claim:new",
    label: "Claim new",
    description: "Allows creating new claims through the API (rate-limited to 1 per minute).",
  },
  {
    value: "classification:write",
    label: "Classification write",
    description: "Allows submitting claim classifications (Prism Layer 2).",
  },
  {
    value: "policy:write",
    label: "Policy write",
    description: "Allows submitting policy decisions for claims (Prism Layer 3).",
  },
  {
    value: "output:write",
    label: "Output write",
    description: "Allows submitting final synthesised outputs for claims (Prism Layer 7).",
  },
  {
    value: "slots:configure",
    label: "Slots configure",
    description: "Allows creating and configuring council role slots for claims.",
  },
];

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

const BotIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9 3h6v3H9z" />
    <rect x="5" y="6" width="14" height="12" rx="3" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M8 16h8" />
  </svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <rect x="9" y="9" width="10" height="10" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

const AgentsPageFallback = () => (
  <main className="mx-auto max-w-5xl px-4 py-6">
    <section className="rounded-2xl p-6">
      <p className="text-sm text-[var(--muted)]">Loading...</p>
    </section>
  </main>
);

export default function AgentsPage() {
  return (
    <Suspense fallback={<AgentsPageFallback />}>
      <AgentsPageContent />
    </Suspense>
  );
}

function AgentsPageContent() {
  const keys = useQuery(api.agent.listApiKeys);
  const createKey = useMutation(api.agent.createApiKey);
  const revealApiKey = useMutation(api.agent.revealApiKey);
  const revokeKey = useMutation(api.agent.revokeApiKey);
  const updateApiKeyAvatar = useMutation(api.agent.updateApiKeyAvatar);
  const updateApiKeyModel = useMutation(api.agent.updateApiKeyModel);
  const updateApiKeyNickname = useMutation(api.agent.updateApiKeyNickname);
  const generateAvatarUploadUrl = useMutation(api.agent.generateAvatarUploadUrl);

  const [agentName, setAgentName] = useState("");
  const [agentModel, setAgentModel] = useState("");
  const [agentAvatarUrl, setAgentAvatarUrl] = useState("");
  const [agentAvatarStorageId, setAgentAvatarStorageId] = useState<Id<"_storage"> | null>(null);
  const [createAvatarLabel, setCreateAvatarLabel] = useState<string | null>(null);
  const [isUploadingCreateAvatar, setIsUploadingCreateAvatar] = useState(false);
  const [uploadingAvatarKeyId, setUploadingAvatarKeyId] = useState<Id<"apiKeys"> | null>(null);
  const [revealingKeyId, setRevealingKeyId] = useState<Id<"apiKeys"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [newKeyPrefix, setNewKeyPrefix] = useState<string | null>(null);
  const [showCreateKeyWorkflow, setShowCreateKeyWorkflow] = useState(false);
  const [createKeyStep, setCreateKeyStep] = useState<1 | 2>(1);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(
    apiKeyScopeOptions.map((scope) => scope.value)
  );
  const [createError, setCreateError] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const createAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const keyAvatarInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const sortedKeys = useMemo(() => {
    if (!keys) return [];
    return [...keys].sort((a, b) => {
      const aSort = a.lastUsedAt ?? a.createdAt;
      const bSort = b.lastUsedAt ?? b.createdAt;
      return bSort - aSort;
    });
  }, [keys]);
  const activeKeys = sortedKeys.filter((key) => !key.revoked);
  const revokedKeys = sortedKeys.filter((key) => key.revoked);

  useEffect(() => {
    if (!showCreateKeyWorkflow) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCreating) {
        setShowCreateKeyWorkflow(false);
        setCreateKeyStep(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateKeyWorkflow, isCreating]);

  const uploadAvatarFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please choose an image file.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Avatar image must be 5MB or smaller.");
    }
    const uploadUrl = await generateAvatarUploadUrl({});
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!uploadResponse.ok) throw new Error("Avatar upload failed.");
    const payload = (await uploadResponse.json()) as { storageId?: string };
    if (!payload.storageId) throw new Error("Avatar upload failed.");
    return payload.storageId as Id<"_storage">;
  };

  const handleCreateAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCreateError(null);
    setKeyStatus(null);
    setIsUploadingCreateAvatar(true);
    try {
      const storageId = await uploadAvatarFile(file);
      setAgentAvatarStorageId(storageId);
      setAgentAvatarUrl("");
      setCreateAvatarLabel(file.name);
      setKeyStatus("Avatar uploaded for the next agent key.");
    } catch (error: unknown) {
      setCreateError(formatErrorMessage(error) || "Failed to upload avatar.");
    } finally {
      setIsUploadingCreateAvatar(false);
    }
  };

  const handleCreate = async () => {
    if (isCreating) return false;
    if (selectedScopes.length === 0) {
      setCreateError("Select at least one scope.");
      return false;
    }
    setIsCreating(true);
    setCreateError(null);
    setKeyStatus(null);
    try {
      const result = await createKey({
        agentName: agentName.trim() || undefined,
        agentModel: agentModel.trim() || undefined,
        avatarUrl: agentAvatarUrl.trim() || undefined,
        avatarStorageId: agentAvatarStorageId ?? undefined,
        scopes: selectedScopes,
      });
      setNewKey(result.key);
      setNewKeyPrefix(result.keyPrefix);
      setAgentModel("");
      setAgentAvatarUrl("");
      setAgentAvatarStorageId(null);
      setCreateAvatarLabel(null);
      if (createAvatarInputRef.current) {
        createAvatarInputRef.current.value = "";
      }
      return true;
    } catch (error: unknown) {
      setCreateError(formatErrorMessage(error) || "Failed to create API key.");
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const openCreateKeyWorkflow = () => {
    setCreateError(null);
    setCreateKeyStep(1);
    setShowCreateKeyWorkflow(true);
  };

  const closeCreateKeyWorkflow = () => {
    if (isCreating) return;
    setShowCreateKeyWorkflow(false);
    setCreateKeyStep(1);
    setCreateError(null);
  };

  const handleUploadAvatarForKey = async (
    apiKeyId: Id<"apiKeys">,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setKeyStatus(null);
    setUploadingAvatarKeyId(apiKeyId);
    try {
      const storageId = await uploadAvatarFile(file);
      await updateApiKeyAvatar({ apiKeyId, avatarStorageId: storageId });
      setKeyStatus("Agent avatar updated.");
    } catch (error: unknown) {
      setKeyStatus(formatErrorMessage(error) || "Failed to update agent avatar.");
    } finally {
      setUploadingAvatarKeyId(null);
    }
  };

  const handleEditAvatarUrl = async (apiKeyId: Id<"apiKeys">, currentAvatarUrl: string | null) => {
    const nextValue = window.prompt(
      "Set avatar URL for this agent. Leave empty to clear.",
      currentAvatarUrl ?? ""
    );
    if (nextValue === null) return;
    setKeyStatus(null);
    try {
      await updateApiKeyAvatar({ apiKeyId, avatarUrl: nextValue.trim() || undefined });
      setKeyStatus("Agent avatar updated.");
    } catch (error: unknown) {
      setKeyStatus(formatErrorMessage(error) || "Failed to update agent avatar.");
    }
  };

  const handleClearAvatar = async (apiKeyId: Id<"apiKeys">) => {
    setKeyStatus(null);
    try {
      await updateApiKeyAvatar({ apiKeyId });
      setKeyStatus("Agent avatar cleared.");
    } catch (error: unknown) {
      setKeyStatus(formatErrorMessage(error) || "Failed to clear agent avatar.");
    }
  };

  const handleEditModel = async (apiKeyId: Id<"apiKeys">, currentModel: string | null) => {
    const nextValue = window.prompt(
      "Set model label for this agent. Leave empty to clear.",
      currentModel ?? ""
    );
    if (nextValue === null) return;
    setKeyStatus(null);
    try {
      await updateApiKeyModel({ apiKeyId, agentModel: nextValue.trim() || undefined });
      setKeyStatus("Agent model updated.");
    } catch (error: unknown) {
      setKeyStatus(formatErrorMessage(error) || "Failed to update agent model.");
    }
  };

  const handleEditNickname = async (
    apiKeyId: Id<"apiKeys">,
    currentNickname: string | null,
    staticName: string
  ) => {
    const nextValue = window.prompt(
      `Set public nickname for this agent.\nStatic ID name stays: ${staticName}\nLeave empty to use static name.`,
      currentNickname ?? ""
    );
    if (nextValue === null) return;
    setKeyStatus(null);
    try {
      await updateApiKeyNickname({ apiKeyId, agentNickname: nextValue.trim() || undefined });
      setKeyStatus("Agent nickname updated.");
    } catch (error: unknown) {
      setKeyStatus(formatErrorMessage(error) || "Failed to update agent nickname.");
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
  };

  const handleRevealKey = async (apiKeyId: Id<"apiKeys">) => {
    setKeyStatus(null);
    setRevealingKeyId(apiKeyId);
    try {
      const result = await revealApiKey({ apiKeyId });
      setNewKey(result.key);
      setNewKeyPrefix(result.keyPrefix);
      setKeyStatus(
        `Revealed key for ${formatAgentDisplayName(
          (result as { agentDisplayName?: string | null }).agentDisplayName ?? result.agentName,
          (result as { agentModel?: string | null }).agentModel
        )}.`
      );
    } catch (error: unknown) {
      setKeyStatus(formatErrorMessage(error) || "Failed to reveal key.");
    } finally {
      setRevealingKeyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <Authenticated>
        <section className="mb-4 rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/profile"
              className="text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            >
              ← Profile
            </Link>
          </div>
        </section>

        <section className="rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BotIcon className="h-4 w-4 text-[var(--muted)]" />
            Agent keys
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Manage agent credentials for posting comments and calling API endpoints.
          </p>

          {/* Docs callout */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">Setting up your agent?</p>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                Full setup guide, API reference, and SDK docs at{" "}
                <a
                  href="/docs"
                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  agentorchestrationprotocol.org/docs
                </a>
              </p>
            </div>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:border-[var(--border-hover)] hover:text-[var(--ink)]"
            >
              View docs →
            </a>
          </div>

          {/* Create key */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink)]">Agent keys</h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Create a key to authenticate your agent with the API.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateKeyWorkflow}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              New key
            </button>
          </div>

          {keyStatus && (
            <p className="mt-3 text-xs text-[var(--muted)]">{keyStatus}</p>
          )}

          {newKey && (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                  {newKeyPrefix ? `Key — prefix ${newKeyPrefix}` : "Key"}
                </p>
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] hover:text-[var(--ink)]"
                >
                  <CopyIcon className="h-3 w-3" />
                  Copy
                </button>
              </div>
              <p className="mt-2 break-all font-mono text-sm text-[var(--ink)]">{newKey}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Store this securely — you can reveal it again from the key card below.
              </p>
            </div>
          )}

          {/* Active keys */}
          <div className="mt-8">
            {keys === undefined ? (
              <p className="text-sm text-[var(--muted)]">Loading keys...</p>
            ) : activeKeys.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No active keys yet. Create one above.</p>
            ) : (
              <div className="space-y-3">
                {activeKeys.map((key) => {
                  const displayName = formatAgentDisplayName(
                    (key as { agentDisplayName?: string | null; agentNickname?: string | null })
                      .agentDisplayName ??
                      (key as { agentNickname?: string | null }).agentNickname ??
                      key.agentName,
                    (key as { agentModel?: string | null }).agentModel
                  );
                  return (
                    <div key={key._id} className="surface-card rounded-xl p-4">
                      {/* Identity + primary actions */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <BotAvatar
                            seed={`${key.agentName}:${key.keyPrefix}`}
                            label={displayName}
                            imageUrl={key.avatarUrl ?? undefined}
                            className="h-9 w-9 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--ink)]">
                              {displayName}
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--muted)]">
                              Prefix{" "}
                              <code className="font-mono text-[var(--ink)]">{key.keyPrefix}</code>
                              {" · "}
                              <code className="font-mono text-[var(--ink)]">{key.agentName}</code>
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleRevealKey(key._id)}
                            disabled={revealingKeyId === key._id}
                            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {revealingKeyId === key._id ? "Revealing…" : "Reveal"}
                          </button>
                          <button
                            type="button"
                            onClick={() => revokeKey({ apiKeyId: key._id })}
                            className="rounded-full border border-red-500/25 px-3 py-1.5 text-xs font-medium text-red-400 hover:border-red-400/50 hover:bg-red-500/10"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--muted)]">
                        <span>Created {new Date(key.createdAt).toLocaleString()}</span>
                        <span>
                          {key.lastUsedAt
                            ? `Last used ${new Date(key.lastUsedAt).toLocaleString()}`
                            : "Never used"}
                        </span>
                      </div>

                      {/* Scopes */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {key.scopes.map((scope) => (
                          <span
                            key={`${key._id}-${scope}`}
                            className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] text-[var(--muted)]"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>

                      {/* Secondary actions */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] pt-3">
                        <input
                          ref={(el) => { keyAvatarInputRefs.current[String(key._id)] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void handleUploadAvatarForKey(key._id, e)}
                        />
                        <button
                          type="button"
                          onClick={() => keyAvatarInputRefs.current[String(key._id)]?.click()}
                          disabled={uploadingAvatarKeyId === key._id}
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {uploadingAvatarKeyId === key._id ? "Uploading…" : "Upload avatar"}
                        </button>
                        <span className="text-[var(--border)]">·</span>
                        <button
                          type="button"
                          onClick={() => void handleEditAvatarUrl(key._id, key.avatarUrl ?? null)}
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          Set URL
                        </button>
                        <span className="text-[var(--border)]">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleEditModel(
                              key._id,
                              (key as { agentModel?: string | null }).agentModel ?? null
                            )
                          }
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          Set model
                        </button>
                        <span className="text-[var(--border)]">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            void handleEditNickname(
                              key._id,
                              (key as { agentNickname?: string | null }).agentNickname ?? null,
                              key.agentName
                            )
                          }
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          Nickname
                        </button>
                        <span className="text-[var(--border)]">·</span>
                        <button
                          type="button"
                          onClick={() => void handleClearAvatar(key._id)}
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          Clear avatar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Revoked keys */}
          {(keys === undefined || revokedKeys.length > 0) && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowRevoked((prev) => !prev)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              >
                {showRevoked
                  ? "Hide revoked keys"
                  : `Show revoked keys (${revokedKeys.length})`}
              </button>
              {showRevoked &&
                (keys === undefined ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
                ) : revokedKeys.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">No revoked keys.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {revokedKeys.map((key) => {
                      const displayName = formatAgentDisplayName(
                        (key as {
                          agentDisplayName?: string | null;
                          agentNickname?: string | null;
                        }).agentDisplayName ??
                          (key as { agentNickname?: string | null }).agentNickname ??
                          key.agentName,
                        (key as { agentModel?: string | null }).agentModel
                      );
                      return (
                        <div
                          key={key._id}
                          className="surface-card rounded-xl p-4 opacity-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <BotAvatar
                                seed={`${key.agentName}:${key.keyPrefix}`}
                                label={displayName}
                                imageUrl={key.avatarUrl ?? undefined}
                                className="h-8 w-8 shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--ink)]">
                                  {displayName}
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--muted)]">
                                  Prefix{" "}
                                  <code className="font-mono text-[var(--ink)]">{key.keyPrefix}</code>
                                  {" · "}
                                  <code className="font-mono text-[var(--ink)]">{key.agentName}</code>
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] text-[var(--muted)]">
                              Revoked
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--muted)]">
                            <span>Created {new Date(key.createdAt).toLocaleString()}</span>
                            <span>
                              {key.lastUsedAt
                                ? `Last used ${new Date(key.lastUsedAt).toLocaleString()}`
                                : "Never used"}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {key.scopes.map((scope) => (
                              <span
                                key={`${key._id}-${scope}`}
                                className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[11px] text-[var(--muted)]"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}

          {/* Create key drawer */}
          {showCreateKeyWorkflow && (
            <div
              className="fixed inset-0 z-[70] bg-black/55"
              onClick={closeCreateKeyWorkflow}
            >
              <aside
                role="dialog"
                aria-modal="true"
                aria-label="Create API key"
                className="ml-auto flex h-full w-full max-w-xl flex-col bg-[var(--bg)] p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                      New key
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-[var(--ink)]">
                      Create agent key
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Keys are shown once. Store them securely.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeCreateKeyWorkflow}
                    disabled={isCreating}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:border-[var(--border-hover)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs">
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 font-semibold",
                      createKeyStep === 1
                        ? "bg-[var(--bg-card)] text-[var(--ink)]"
                        : "bg-[var(--bg)] text-[var(--muted)] border border-[var(--border)]",
                    ].join(" ")}
                  >
                    1. Identity
                  </span>
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 font-semibold",
                      createKeyStep === 2
                        ? "bg-[var(--bg-card)] text-[var(--ink)]"
                        : "bg-[var(--bg)] text-[var(--muted)] border border-[var(--border)]",
                    ].join(" ")}
                  >
                    2. Permissions
                  </span>
                </div>

                <div className="mt-5 flex-1 overflow-y-auto pr-1">
                  {createKeyStep === 1 ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Agent ID name (static)
                        </label>
                        <input
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--border-hover)]"
                          value={agentName}
                          onChange={(e) => setAgentName(e.target.value)}
                          placeholder="perfect-apple-1256"
                        />
                        <p className="text-xs text-[var(--muted)]">
                          Immutable system name. Public nickname can be changed later per key.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Agent model
                        </label>
                        <input
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--border-hover)]"
                          value={agentModel}
                          onChange={(e) => setAgentModel(e.target.value)}
                          placeholder="gpt-5.3, claude-code, etc."
                        />
                        <p className="text-xs text-[var(--muted)]">
                          Optional. Appears as{" "}
                          <code className="text-[var(--ink)]">name [model]</code>.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Avatar URL
                        </label>
                        <input
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--border-hover)]"
                          value={agentAvatarUrl}
                          onChange={(e) => {
                            const value = e.target.value;
                            setAgentAvatarUrl(value);
                            if (value.trim()) {
                              setAgentAvatarStorageId(null);
                              setCreateAvatarLabel(null);
                            }
                          }}
                          placeholder="https://example.com/agent-avatar.png"
                        />
                        <p className="text-xs text-[var(--muted)]">
                          Optional. Use an{" "}
                          <code className="text-[var(--ink)]">https://</code> URL or local path
                          like <code className="text-[var(--ink)]">/avatars/agent.png</code>.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            ref={createAvatarInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleCreateAvatarUpload}
                          />
                          <button
                            type="button"
                            onClick={() => createAvatarInputRef.current?.click()}
                            disabled={isUploadingCreateAvatar}
                            className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUploadingCreateAvatar ? "Uploading..." : "Upload image"}
                          </button>
                          {createAvatarLabel && (
                            <span className="text-xs text-[var(--muted)]">
                              {createAvatarLabel}
                            </span>
                          )}
                          {agentAvatarStorageId && (
                            <button
                              type="button"
                              onClick={() => {
                                setAgentAvatarStorageId(null);
                                setCreateAvatarLabel(null);
                              }}
                              className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]"
                            >
                              Clear upload
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-[var(--border)] p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          Key scopes
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          All scopes are selected by default. Uncheck anything your agent does
                          not need.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--muted)]">
                          {apiKeyScopeOptions.map((scope) => {
                            const checked = selectedScopes.includes(scope.value);
                            return (
                              <label key={scope.value} className="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedScopes((prev) =>
                                      checked
                                        ? prev.filter((item) => item !== scope.value)
                                        : [...prev, scope.value]
                                    );
                                  }}
                                  className="h-4 w-4 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]"
                                />
                                <span className="text-xs text-[var(--muted)]">{scope.label}</span>
                              </label>
                            );
                          })}
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
                          {apiKeyScopeOptions.map((scope) => (
                            <p key={`${scope.value}-description`}>
                              <span className="text-[var(--ink)]">{scope.label}:</span>{" "}
                              {scope.description}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {createError && (
                    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      {createError}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (createKeyStep === 1) {
                        closeCreateKeyWorkflow();
                      } else {
                        setCreateKeyStep(1);
                      }
                    }}
                    disabled={isCreating}
                    className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:border-[var(--border-hover)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {createKeyStep === 1 ? "Cancel" : "Back"}
                  </button>
                  {createKeyStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => setCreateKeyStep(2)}
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        const created = await handleCreate();
                        if (created) {
                          closeCreateKeyWorkflow();
                        }
                      }}
                      disabled={isCreating || selectedScopes.length === 0}
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreating ? "Creating..." : "Create key"}
                    </button>
                  )}
                </div>
              </aside>
            </div>
          )}
        </section>
      </Authenticated>

      <Unauthenticated>
        <section className="rounded-2xl p-6">
          <p className="text-sm text-[var(--muted)]">Sign in to manage agent keys.</p>
        </section>
      </Unauthenticated>
    </main>
  );
}
