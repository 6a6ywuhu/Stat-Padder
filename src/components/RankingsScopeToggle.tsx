"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
  { key: "players", label: "Players", path: "/rankings" },
  { key: "teams", label: "Teams", path: "/team-rankings" },
] as const;

/** [Players] [Teams] switcher shared by the two ranking pages; carries the time window across. */
export function RankingsScopeToggle({ active }: { active: "players" | "teams" }) {
  const win = useSearchParams().get("window");
  const suffix = win === "week" || win === "month" ? `?window=${win}` : "";

  return (
    <div
      className="inline-flex divide-x-2 divide-[var(--color-border-strong)] overflow-hidden rounded-none border-2 border-[var(--color-border-strong)]"
      role="tablist"
      aria-label="Ranking scope"
    >
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={`${t.path}${suffix}`}
          replace
          role="tab"
          aria-selected={active === t.key}
          className={`px-2.5 py-1 font-display text-sm font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:py-1.5 ${
            active === t.key
              ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
