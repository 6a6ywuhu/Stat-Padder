"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SKATER_POSITIONS, POSITION_LABELS, SkaterPosition } from "@/lib/attributes";

export function PositionFilterBar({
  activeType,
  selectedPositions,
  basePath = "/rankings",
}: {
  activeType: "skaters" | "goalies";
  selectedPositions: SkaterPosition[];
  basePath?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function linkFor(overrides: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return `${pathname ?? basePath}${qs ? `?${qs}` : ""}`;
  }

  // No positions explicitly picked = show every skater, with no button
  // highlighted. Picking any position(s) filters down to just those.
  function positionsHref(next: SkaterPosition[]) {
    if (next.length === 0) return linkFor({ position: null, cross: null });
    return linkFor({ position: next.join(","), cross: null });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full border border-[var(--color-border)] p-0.5">
        <Link
          href={linkFor({ type: "skaters", position: null, cross: null })}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeType === "skaters" ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          }`}
        >
          Skaters
        </Link>
        <Link
          href={linkFor({ type: "goalies", position: null, cross: null })}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeType === "goalies" ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          }`}
        >
          Goalies
        </Link>
      </div>

      {activeType === "skaters" && (
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by position">
          {SKATER_POSITIONS.map((pos) => {
            const active = selectedPositions.includes(pos);
            const next = active ? selectedPositions.filter((p) => p !== pos) : [...selectedPositions, pos];
            return (
              <Link
                key={pos}
                href={positionsHref(next)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
                    : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                }`}
              >
                {POSITION_LABELS[pos]}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
