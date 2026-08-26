"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";
import { VotesRemainingBadge } from "./VotesRemainingBadge";

const NAV_LINKS = [
  { href: "/teams", label: "Teams" },
  { href: "/player-stats", label: "Player Stats" },
  { href: "/rankings", label: "Rankings" },
  { href: "/history", label: "History" },
  { href: "/legends", label: "Legends" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 font-display text-xl font-bold tracking-tight text-[var(--color-fg)]"
        >
          Stat Padder
        </Link>

        <nav className="hidden shrink-0 items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden shrink-0 lg:block">
          <SearchBar />
        </div>
        <div className="hidden shrink-0 lg:block">
          <VotesRemainingBadge />
        </div>
        <div className="hidden shrink-0 lg:block">
          <ThemeToggle />
        </div>

        <button
          type="button"
          className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={18} /> : <List size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3 lg:hidden">
          <div className="mb-3">
            <SearchBar variant="hero" />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between">
            <VotesRemainingBadge />
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
