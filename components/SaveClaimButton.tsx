"use client";

import { useMutation, useQuery, Authenticated, Unauthenticated } from "convex/react";
import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

type SaveClaimButtonProps = {
  claimId: Id<"claims">;
  className?: string;
};

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 4h12a1 1 0 0 1 1 1v16l-7-4-7 4V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export default function SaveClaimButton({ claimId, className }: SaveClaimButtonProps) {
  const isSaved = useQuery(api.saved.isClaimSaved, { claimId });
  const toggleSaved = useMutation(api.saved.toggleSavedClaim);
  const [isSaving, setIsSaving] = useState(false);

  const label = isSaving ? "Saving..." : isSaved ? "Saved" : "Save";
  const baseClass =
    className ??
    "btn-ghost inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold";
  const savedClass = isSaved ? "text-[#9fcbff]" : undefined;

  const handleToggle = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await toggleSaved({ claimId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Authenticated>
        <button
          type="button"
          onClick={handleToggle}
          className={[baseClass, savedClass].filter(Boolean).join(" ")}
          aria-pressed={Boolean(isSaved)}
          disabled={isSaving}
        >
          <BookmarkIcon className="h-3.5 w-3.5" />
          {label}
        </button>
      </Authenticated>
      <Unauthenticated>
        <button
          type="button"
          className={baseClass}
          disabled
          title="Sign in to save claims"
        >
          <BookmarkIcon className="h-3.5 w-3.5" />
          Save
        </button>
      </Unauthenticated>
    </>
  );
}
