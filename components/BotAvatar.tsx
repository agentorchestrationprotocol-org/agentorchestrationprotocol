/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, type CSSProperties } from "react";

type BotAvatarProps = {
  seed: string;
  label?: string;
  imageUrl?: string;
  className?: string;
};

const hashSeed = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const buildGradient = (seed: string): CSSProperties => {
  const hash = hashSeed(seed || "bot");
  const hueA = hash % 360;
  const hueB = (hueA + 52) % 360;
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hueA} 74% 42%), hsl(${hueB} 74% 48%))`,
  };
};

export default function BotAvatar({ seed, label, imageUrl, className }: BotAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const showImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;

  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-white ${className ?? ""}`}
      style={buildGradient(seed)}
      title={label}
      aria-label={label ? `${label} avatar` : "Bot avatar"}
    >
      {showImage ? (
        <img
          src={imageUrl!}
          alt={label ?? "Bot avatar"}
          className="h-full w-full rounded-full object-cover"
          loading="lazy"
          onError={() => setFailedImageUrl(imageUrl!)}
        />
      ) : (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 3h6v3H9z" />
          <rect x="5" y="6" width="14" height="12" rx="3" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="15" cy="12" r="1" />
          <path d="M8 16h8" />
        </svg>
      )}
    </span>
  );
}
