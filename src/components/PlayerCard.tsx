import Link from "next/link";
import Image from "next/image";
import { NetBarTrack, OverallBarDisplay } from "./AttributeBar";
import { StatusBadge } from "./StatusBadge";
import type { AttributeBar, OverallBar } from "@/lib/scoring";
import { ATTRIBUTE_LABELS, attributesForPosition, Position } from "@/lib/attributes";

export function PlayerCard({
  id,
  name,
  position,
  teamId,
  headshotUrl,
  status,
  overall,
  attributeBars,
  rank,
}: {
  id: string;
  name: string;
  position: string;
  teamId: string | null;
  headshotUrl: string | null;
  status: "ACTIVE" | "RETIRED" | "INJURED";
  overall: OverallBar;
  attributeBars?: Record<string, AttributeBar>;
  rank?: number;
}) {
  const attrs = attributeBars ? attributesForPosition(position as Position) : [];

  return (
    <Link
      href={`/players/${id}`}
      className="group flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-subtle)]"
    >
      <div className="flex items-center gap-4">
        {rank !== undefined && (
          <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-[var(--color-fg-faint)]">
            {rank}
          </span>
        )}
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
          {headshotUrl && (
            <Image src={headshotUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-[var(--color-fg)]">{name}</span>
            <StatusBadge status={status} />
          </div>
          <p className="text-xs text-[var(--color-fg-muted)]">
            {position}
            {teamId ? ` · ${teamId}` : ""}
          </p>
        </div>
        <div className="w-32 shrink-0">
          <OverallBarDisplay direction={overall.direction} pct={overall.pct} value={overall.value} />
        </div>
      </div>

      {/* Expands in place on hover — pushes rows below it down instead of
          floating over them, so nothing else in the list gets covered. Rows
          stay in the DOM (grid-rows 0fr→1fr) rather than toggling display,
          so both the height and the fade below can actually transition. */}
      {attributeBars && attrs.length > 0 && (
        <div
          className="grid grid-rows-[0fr] will-change-[grid-template-rows] transition-[grid-template-rows] duration-300 ease-in-out group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]"
          aria-hidden="true"
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-3 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100 group-focus-visible:opacity-100 sm:grid-cols-3">
            {attrs.map((a) => {
              const bar = attributeBars[a];
              return (
                <div key={a} className="min-w-0">
                  <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-[var(--color-fg-faint)]">
                    <span className="truncate">{ATTRIBUTE_LABELS[a]}</span>
                    <span className="shrink-0 tabular-nums text-[var(--color-fg-muted)]">
                      {bar && bar.net > 0 ? "+" : ""}
                      {bar?.net ?? 0}
                    </span>
                  </div>
                  <NetBarTrack direction={bar?.direction ?? "zero"} pct={bar?.pct ?? 0} height="h-1" />
                </div>
              );
            })}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}
