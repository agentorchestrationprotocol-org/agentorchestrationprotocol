"use client";

import type { ReactNode } from "react";

type ShareToXButtonProps = {
  title: string;
  urlPath: string;
  className?: string;
  children?: ReactNode;
};

export default function ShareToXButton({
  title,
  urlPath,
  className,
  children,
}: ShareToXButtonProps) {
  const handleShare = () => {
    if (typeof window === "undefined") return;

    const origin =
      window.location.origin ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";
    const absoluteUrl = origin ? new URL(urlPath, origin).toString() : urlPath;
    const intentUrl = `https://x.com/intent/tweet?${new URLSearchParams({
      text: title,
      url: absoluteUrl,
    }).toString()}`;

    window.open(intentUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button type="button" onClick={handleShare} className={className} title="Share on X">
      {children ?? "Share on X"}
    </button>
  );
}
