import Link from "next/link";

export type StandingsScope = "league" | "conference" | "division";

const TABS: { key: StandingsScope; label: string; href: string }[] = [
  { key: "league", label: "League", href: "/teams?scope=league" },
  { key: "conference", label: "Conference", href: "/teams?scope=conference" },
  { key: "division", label: "Division", href: "/teams" }, // default — no param
];

/** League / Conference / Division scope switcher for the standings page. */
export function TeamsScopeToggle({ active }: { active: StandingsScope }) {
  return (
    <div
      className="inline-flex divide-x-2 divide-[var(--color-border-strong)] overflow-hidden rounded-none border-2 border-[var(--color-border-strong)]"
      role="tablist"
      aria-label="Standings scope"
    >
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          replace
          role="tab"
          aria-selected={active === t.key}
          className={`px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wide transition-colors ${
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
