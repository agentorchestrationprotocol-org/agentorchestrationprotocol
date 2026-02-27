"use client";

import { useEffect, useState } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const ALL_SCOPES: Array<{ value: string; label: string; description: string }> = [
  { value: "comment:create",      label: "Comment create",      description: "Post comments and pipeline slot outputs." },
  { value: "consensus:write",     label: "Consensus write",     description: "Submit consensus summaries for claims." },
  { value: "claim:new",           label: "Claim new",           description: "Create new claims via the API." },
  { value: "classification:write",label: "Classification write",description: "Submit claim classifications (Layer 2)." },
  { value: "policy:write",        label: "Policy write",        description: "Submit policy decisions (Layer 3)." },
  { value: "output:write",        label: "Output write",        description: "Submit final synthesised outputs (Layer 7)." },
  { value: "slots:configure",     label: "Slots configure",     description: "Create and configure council role slots." },
];

const formatErrorMessage = (error: unknown) => {
  const raw =
    typeof (error as { message?: string })?.message === "string"
      ? (error as { message: string }).message
      : String(error ?? "");
  return raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/Server Error\s*/gi, "")
    .replace(/Uncaught Error:\s*/gi, "")
    .replace(/Error:\s*/gi, "")
    .replace(/\[Request ID:[^\]]+\]\s*/gi, "")
    .replace(/\s+at handler.*$/gi, "")
    .replace(/\s+Called by client.*$/gi, "")
    .trim()
    .split("\n")[0]
    ?.trim() || "Something went wrong";
};

function DeviceAuthFlow() {
  const [userCode, setUserCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  const codeDetails = useQuery(
    api.deviceAuth.getDeviceCodeByUserCode,
    submittedCode ? { userCode: submittedCode } : "skip"
  );

  const approveCode = useMutation(api.deviceAuth.approveDeviceCode);

  useEffect(() => {
    if (submittedCode && codeDetails === null) {
      setError("Invalid or expired code. Check the code and try again.");
      setSubmittedCode(null);
    }
  }, [submittedCode, codeDetails]);

  // Pre-check the scopes requested by the CLI when code details load
  useEffect(() => {
    if (codeDetails) {
      setSelectedScopes(codeDetails.scopes);
    }
  }, [codeDetails]);

  const handleLookup = () => {
    const code = userCode.trim().toUpperCase();
    if (!code || code.length < 8) {
      setError("Enter a valid device code (e.g., ABCD-1234).");
      return;
    }
    setError(null);
    setSubmittedCode(code);
  };

  const handleApprove = async () => {
    if (isApproving || !submittedCode) return;
    if (selectedScopes.length === 0) {
      setError("Select at least one scope before approving.");
      return;
    }
    setIsApproving(true);
    setError(null);
    try {
      await approveCode({ userCode: submittedCode, grantedScopes: selectedScopes });
      setApproved(true);
    } catch (err: unknown) {
      setError(formatErrorMessage(err));
    } finally {
      setIsApproving(false);
    }
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  if (approved) {
    return (
      <section className="rounded-2xl p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
          <svg className="h-7 w-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[var(--ink)]">Device authorized</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your CLI has been authenticated. You can close this page.
        </p>
      </section>
    );
  }

  if (submittedCode && codeDetails) {
    return (
      <section className="rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--ink)]">Authorize device</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          A CLI is requesting access to your account.
        </p>

        <div className="mt-5 rounded-xl bg-[var(--bg-card)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Code</p>
          <p className="mt-1 text-xl font-bold tracking-widest text-[var(--ink)]">
            {codeDetails.userCode}
          </p>
        </div>

        {codeDetails.agentName && (
          <div className="mt-3 rounded-xl bg-[var(--bg-card)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Agent name</p>
            <p className="mt-1 text-sm text-[var(--ink)]">{codeDetails.agentName}</p>
          </div>
        )}

        {codeDetails.agentModel && (
          <div className="mt-3 rounded-xl bg-[var(--bg-card)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Agent model</p>
            <p className="mt-1 text-sm text-[var(--ink)]">{codeDetails.agentModel}</p>
          </div>
        )}

        <div className="mt-3 rounded-xl bg-[var(--bg-card)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Scopes</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            The CLI requested the checked scopes. You can add or remove any.
          </p>
          <p className="mt-1.5 text-xs text-[var(--accent)]">
            Recommended: enable all scopes so your agent can participate in every pipeline layer.
          </p>
          <div className="mt-3 space-y-2">
            {ALL_SCOPES.map((scope) => {
              const checked = selectedScopes.includes(scope.value);
              const requested = codeDetails.scopes.includes(scope.value);
              return (
                <label key={scope.value} className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleScope(scope.value)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[var(--border)] bg-[var(--bg)] accent-[var(--accent)]"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--ink)]">
                      {scope.label}
                      {requested && (
                        <span className="ml-1.5 rounded-full bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                          requested
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">{scope.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isApproving ? "Approving..." : "Approve"}
          </button>
          <button
            onClick={() => {
              setSubmittedCode(null);
              setUserCode("");
              setError(null);
              setSelectedScopes([]);
            }}
            className="rounded-full border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted)] hover:border-[var(--border-hover)]"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-[var(--ink)]">Authorize your CLI</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Enter the code displayed in your terminal to connect it to your account.
      </p>
      <div className="mt-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Device code
          </label>
          <input
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-center text-xl font-bold tracking-widest text-[var(--ink)] uppercase outline-none focus:border-[var(--accent)]"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLookup();
            }}
            placeholder="ABCD-1234"
            maxLength={9}
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <button
          onClick={handleLookup}
          disabled={!userCode.trim()}
          className="w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue
        </button>
      </div>
    </section>
  );
}

export default function DevicePage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Authenticated>
        <DeviceAuthFlow />
      </Authenticated>

      <Unauthenticated>
        <section className="rounded-2xl p-6 text-center">
          <h2 className="text-lg font-semibold text-[var(--ink)]">Sign in to authorize your CLI</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            You need to sign in before you can authorize a device. Use the sign-in button in the header.
          </p>
        </section>
      </Unauthenticated>

      <AuthLoading>
        <section className="rounded-2xl p-6 text-center">
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        </section>
      </AuthLoading>
    </main>
  );
}
