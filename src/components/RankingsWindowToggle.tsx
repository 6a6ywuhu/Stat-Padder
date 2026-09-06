"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type RankingWindow = "all" | "month" | "week";

const WINDOWS: { key: RankingWindow; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
];

/**
 * Scores the ranking off votes cast in the chosen window — "All time" (default,
 * no param), this calendar month, or this calendar week. Preserves the other
 * filters and resets pagination.
 */
export function RankingsWindowToggle({ active }: { active: RankingWindow }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(key: RankingWindow) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") params.delete("window");
    else params.set("window", key);
    params.delete("page");
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div
      className="inline-flex divide-x-2 divide-[var(--color-border-strong)] overflow-hidden rounded-none border-2 border-[var(--color-border-strong)]"
      role="tablist"
      aria-label="Time window"
    >
      {WINDOWS.map((w) => (
        <Link
          key={w.key}
          href={hrefFor(w.key)}
          scroll={false}
          replace
          role="tab"
          aria-selected={active === w.key}
          className={`px-2.5 py-1 font-display text-sm font-semibold uppercase tracking-wide transition-colors sm:px-3 sm:py-1.5 ${
            active === w.key
              ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
              : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
          }`}
        >
          {w.label}
        </Link>
      ))}
    </div>
  );
}
