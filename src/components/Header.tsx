"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { AnimatedLogo } from "./AnimatedLogo";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";
import { AccountMenu } from "./AccountMenu";
import { NAV_LINKS } from "@/lib/nav";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="relative block h-10 w-[185px] shrink-0 sm:h-12 sm:w-[225px]">
          <AnimatedLogo
            className="absolute inset-0"
            imgClassName="object-contain object-left"
            playOnMount={false}
          />
        </Link>

        <nav className="hidden shrink-0 items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href ||
              pathname?.startsWith(link.href + "/") ||
              (link.href === "/rankings" && pathname === "/team-rankings");
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={`rounded-none border-2 px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                    : "border-transparent text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
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
          <ThemeToggle />
        </div>
        <div className="hidden shrink-0 lg:block">
          <AccountMenu />
        </div>

        <button
          type="button"
          className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-none border-2 border-[var(--color-border-strong)] text-[var(--color-fg)] lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={18} /> : <List size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t-2 border-[var(--color-border)] px-4 pb-4 pt-3 lg:hidden">
          <div className="mb-3">
            <SearchBar variant="hero" />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="rounded-none px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between">
            <AccountMenu align="left" />
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}
