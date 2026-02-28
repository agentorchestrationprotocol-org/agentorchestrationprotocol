"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Authenticated, Unauthenticated } from "convex/react";
import { useEffect, useState } from "react";

function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.6 2.6 0 1 1 4.8 1.3c-.5.8-1.4 1.3-2 1.9-.5.4-.8 1-.8 1.6" />
      <circle cx="12" cy="17.1" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ProfileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.2c0-3.5 2.9-6.2 6.5-6.2s6.5 2.7 6.5 6.2" />
    </svg>
  );
}

function CreateIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export default function AppHeader() {
  const [searchInput, setSearchInput] = useState(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/") {
      return "";
    }
    return new URLSearchParams(window.location.search).get("q") ?? "";
  });
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    const trimmed = searchInput.trim();
    const nextUrl = trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/";
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === nextUrl) {
      return;
    }

    const handle = window.setTimeout(() => {
      router.replace(nextUrl);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [pathname, router, searchInput]);

  const submitSearch = () => {
    const trimmed = searchInput.trim();
    router.push(trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/");
  };

  return (
    <header className="sticky top-0 z-50 bg-[#090f18e8] backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl">
            <Image
              src="/aop.png"
              alt="AOP Logo"
              width={22}
              height={22}
              className="h-5 w-5 object-contain"
              unoptimized
            />
          </span>
          <div className="hidden sm:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">AOP</p>
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2">
            <svg className="h-4 w-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="w-full bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              placeholder="Search claims, protocols, domains..."
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitSearch();
                }
              }}
            />
            {searchInput.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  if (pathname !== "/") {
                    router.push("/");
                  }
                }}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/leaderboard"
            className="btn-secondary hidden sm:inline-flex h-9 items-center gap-1.5 rounded-full px-3"
            aria-label="Leaderboard"
            title="Leaderboard"
          >
            <svg className="h-3.5 w-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 20h16v2H4zM4 14h4v6H4zM10 10h4v10h-4zM16 6h4v14h-4z" />
            </svg>
            <span className="text-xs font-semibold text-[var(--ink)]">Leaderboard</span>
          </Link>

          <Authenticated>
            <>
              <Link
                href="/create"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-b from-[#63abff] to-[#2f86f8] px-3.5 text-sm font-semibold text-white shadow-[0_3px_10px_rgba(36,119,224,0.32)] transition-all hover:brightness-105 hover:shadow-[0_5px_14px_rgba(36,119,224,0.36)] active:scale-[0.98]"
              >
                <CreateIcon className="h-3.5 w-3.5" />
                <span>Create</span>
              </Link>
              <Link
                href="/profile"
                className="btn-secondary inline-flex h-9 items-center gap-2 rounded-full px-3"
                aria-label="Profile"
              >
                <ProfileIcon className="h-4 w-4 text-[var(--muted)]" />
                <span className="text-xs font-semibold text-[var(--ink)]">Profile</span>
              </Link>
              <Link
                href="/docs"
                className="btn-secondary hidden h-9 items-center rounded-full px-3 text-xs font-semibold text-[var(--ink)] sm:flex"
              >
                Docs
              </Link>
              <Link
                href="/about"
                className="btn-secondary hidden h-9 items-center rounded-full px-3 text-xs font-semibold text-[var(--ink)] sm:flex"
              >
                About
              </Link>
            </>
          </Authenticated>

          <Unauthenticated>
            <>
              <Link
                href="/docs"
                className="btn-secondary hidden h-9 items-center rounded-full px-3 text-xs font-semibold text-[var(--ink)] sm:flex"
              >
                Docs
              </Link>
              <Link
                href="/about"
                className="btn-secondary hidden h-9 items-center rounded-full px-3 text-xs font-semibold text-[var(--ink)] sm:flex"
              >
                About
              </Link>
              <Link href="/sign-in" prefetch={false} className="btn-primary px-4 py-2">
                Sign in
              </Link>
              <Link href="/sign-up" prefetch={false} className="btn-secondary hidden px-4 py-2 sm:inline-flex">
                Sign up
              </Link>
            </>
          </Unauthenticated>
        </div>
      </div>

    </header>
  );
}
