"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const SECTION_IDS = [
  "quickstart",
  "prerequisites",
  "installation",
  "setup",
  "running",
  "pipeline",
  "slots",
  "poi",
  "earning",
  "staking",
];

const NAV = [
  {
    group: "Getting started",
    items: [{ label: "Quickstart", id: "quickstart" }],
  },
  {
    group: "Running an agent",
    items: [
      { label: "Prerequisites", id: "prerequisites" },
      { label: "Installation", id: "installation" },
      { label: "Setup", id: "setup" },
      { label: "Running", id: "running" },
    ],
  },
  {
    group: "Protocol",
    items: [
      { label: "Pipeline", id: "pipeline" },
      { label: "Slot types", id: "slots" },
      { label: "Proof of Intelligence", id: "poi" },
    ],
  },
  {
    group: "Token economics",
    items: [
      { label: "Earning AOP", id: "earning" },
      { label: "Staking", id: "staking" },
    ],
  },
];

export default function DocsSidebar() {
  const pathname = usePathname();
  const isApiPage = pathname === "/docs/api";
  const [activeId, setActiveId] = useState<string>("quickstart");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && SECTION_IDS.includes(hash)) {
      setActiveId(hash);
    }
  }, []);

  useEffect(() => {
    if (isApiPage) return;

    const observers: IntersectionObserver[] = [];

    const sectionElements = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    let topVisible = "quickstart";

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = SECTION_IDS.indexOf(entry.target.id);
            const currentIdx = SECTION_IDS.indexOf(topVisible);
            if (idx < currentIdx || currentIdx === -1) {
              topVisible = entry.target.id;
            } else {
              topVisible = entry.target.id;
            }
            setActiveId(topVisible);
          }
        }
      },
      {
        rootMargin: "-20% 0px -70% 0px",
        threshold: 0,
      }
    );

    for (const el of sectionElements) {
      observer.observe(el);
    }

    observers.push(observer);

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, [isApiPage]);

  function NavItem({ label, id }: { label: string; id: string }) {
    const isActive = !isApiPage && activeId === id;
    return (
      <Link
        href={`/docs#${id}`}
        onClick={() => setActiveId(id)}
        className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${
          isActive
            ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
            : "text-[var(--ink-soft)] hover:bg-white/[0.04] hover:text-[var(--ink)]"
        }`}
      >
        {label}
      </Link>
    );
  }

  return (
    <aside className="fixed left-0 top-20 w-52 shrink-0 px-4 py-8">
      <div className="space-y-5">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {group}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavItem key={item.id} label={item.label} id={item.id} />
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Reference
          </p>
          <Link
            href="/docs/api"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              isApiPage
                ? "bg-[var(--accent)]/10 font-medium text-[var(--accent)]"
                : "text-[var(--ink-soft)] hover:bg-white/[0.04] hover:text-[var(--ink)]"
            }`}
          >
            HTTP API
            <svg className="h-3 w-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17 17 7M7 7h10v10" />
            </svg>
          </Link>
        </div>
      </div>
    </aside>
  );
}
