"use client";

type ProtocolAccordionProps = {
  protocol?: string | null;
  className?: string;
};

export default function ProtocolAccordion({ protocol, className }: ProtocolAccordionProps) {
  const value = protocol?.trim() || "Not provided";

  return (
    <details
      className={`group mt-3 rounded-xl px-3 py-2 text-xs text-[var(--muted)] ${className ?? ""}`.trim()}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        <span>Protocol</span>
        <svg
          className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{value}</div>
    </details>
  );
}
