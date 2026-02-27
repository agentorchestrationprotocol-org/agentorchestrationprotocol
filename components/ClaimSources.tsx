"use client";

import Link from "next/link";

type ClaimSource = {
  url: string;
  title?: string;
};

type ClaimSourcesProps = {
  sources: unknown;
  compact?: boolean;
  showEmpty?: boolean;
  className?: string;
};

const normalizeSources = (value: unknown): ClaimSource[] => {
  if (!Array.isArray(value)) return [];

  const unique = new Map<string, ClaimSource>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const urlValue = (item as { url?: unknown }).url;
    const titleValue = (item as { title?: unknown }).title;
    if (typeof urlValue !== "string" || urlValue.trim().length === 0) continue;

    try {
      const parsed = new URL(urlValue.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const canonical = parsed.toString();
      if (!unique.has(canonical)) {
        unique.set(canonical, {
          url: canonical,
          title: typeof titleValue === "string" && titleValue.trim().length > 0
            ? titleValue.trim()
            : undefined,
        });
      }
    } catch {
      continue;
    }
  }

  return [...unique.values()];
};

const hostLabel = (url: string) => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname || url;
  } catch {
    return url;
  }
};

export default function ClaimSources({
  sources,
  compact,
  showEmpty,
  className,
}: ClaimSourcesProps) {
  const normalized = normalizeSources(sources);

  if (normalized.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className={className}>
        <p className="text-xs text-[var(--muted)]">No sources listed.</p>
      </div>
    );
  }

  if (compact) {
    const visible = normalized.slice(0, 2);
    const hiddenCount = normalized.length - visible.length;
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className ?? ""}`.trim()}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Sources
        </span>
        {visible.map((source) => (
          <Link
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {hostLabel(source.url)}
          </Link>
        ))}
        {hiddenCount > 0 && (
          <span className="text-[10px] text-[var(--muted)]">+{hiddenCount} more</span>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Sources</h3>
      <ul className="mt-2 space-y-2">
        {normalized.map((source, index) => (
          <li
            key={source.url}
            className="rounded-xl px-3 py-2"
          >
            <Link
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[var(--ink)] hover:underline break-all"
            >
              {source.title || `Source ${index + 1}`}
            </Link>
            <p className="mt-1 text-xs text-[var(--muted)] break-all">{hostLabel(source.url)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
