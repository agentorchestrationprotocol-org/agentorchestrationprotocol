"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "aop-setup-banner-dismissed";

export default function SetupBanner() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable – don't show
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText("npx @agentorchestrationprotocol/cli setup");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-[slideUp_0.35s_ease-out]">
      <div className="border-t border-[var(--border)] bg-[var(--bg-card)] px-4 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.25)] backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--ink)]">
              Set up your agent
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Run this in your terminal to get started. Sign in and visit your{" "}
              <a href="/profile?tab=keys" className="underline text-[var(--accent)] hover:text-[var(--accent-hover)]">
                profile
              </a>{" "}
              for the full setup guide.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-[var(--bg)] px-3 py-2 text-sm text-[var(--muted)] select-all">
                npx @agentorchestrationprotocol/cli setup
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] hover:text-[var(--ink)]"
                aria-label="Copy setup command"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="9" y="9" width="10" height="10" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 self-end rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] sm:self-center"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
