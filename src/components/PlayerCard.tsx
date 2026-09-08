import Link from "next/link";
import Image from "next/image";
import { NetBarTrack, OverallBarDisplay, BarColor } from "./AttributeBar";
import { StatusBadge } from "./StatusBadge";
import { formatRating, type AttributeBar, type OverallBar } from "@/lib/scoring";
import { Attribute, AttributeCategory, ATTRIBUTE_LABELS, attributesForPosition, Position } from "@/lib/attributes";
import { pixelProfileForName } from "@/lib/pixel-profiles";

function AttrCell({ attribute, bar }: { attribute: Attribute; bar: AttributeBar | undefined }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-[var(--color-fg-faint)]">
        <span className="truncate">{ATTRIBUTE_LABELS[attribute]}</span>
        <span className="shrink-0 tabular-nums text-[var(--color-fg-muted)]">
          {formatRating(bar?.net ?? 0)}
        </span>
      </div>
      <NetBarTrack direction={bar?.direction ?? "zero"} pct={bar?.pct ?? 0} height="h-1" />
    </div>
  );
}

// General deliberately uses the plain "vote" color (same as Overall) rather
// than a fixed category color — see AttributeBar.tsx.
const CATEGORY_ROWS: { key: AttributeCategory; label: string; color: BarColor }[] = [
  { key: "general", label: "General", color: "vote" },
  { key: "offense", label: "Offense", color: "offense" },
  { key: "defense", label: "Defense", color: "defense" },
];

function CategoryCell({ label, color, bar }: { label: string; color: BarColor; bar: OverallBar | undefined }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-[var(--color-fg-faint)]">
        <span className="truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-[var(--color-fg-muted)]">
          {formatRating(bar?.value ?? 0)}
        </span>
      </div>
      <NetBarTrack direction={bar?.direction ?? "zero"} pct={bar?.pct ?? 0} height="h-1.5" color={color} />
    </div>
  );
}

export function PlayerCard({
  id,
  name,
  position,
  teamId,
  headshotUrl,
  status,
  overall,
  attributeBars,
  categoryBars,
  rank,
  windowStats,
  statWindow,
}: {
  id: string;
  name: string;
  position: string;
  teamId: string | null;
  headshotUrl: string | null;
  status: "ACTIVE" | "RETIRED" | "INJURED";
  overall: OverallBar;
  attributeBars?: Record<string, AttributeBar>;
  categoryBars?: Partial<Record<AttributeCategory, OverallBar>>;
  rank?: number;
  /** Real NHL G/A/P for the active window; hidden on narrow cards where there's no room. */
  windowStats?: { goals: number; assists: number; points: number } | null;
  statWindow?: "all" | "month" | "week";
}) {
  const statTitle =
    statWindow === "week"
      ? "Goals · assists · points this week"
      : statWindow === "month"
        ? "Goals · assists · points this month"
        : "Goals · assists · points this season";
  const isGoalie = position === "G";
  const attrs = attributeBars && isGoalie ? attributesForPosition(position as Position) : [];
  // On a narrow card the first name collapses to an initial so the surname always fits.
  const spaceIdx = name.lastIndexOf(" ");
  const shortName = spaceIdx > 0 ? `${name[0]}. ${name.slice(spaceIdx + 1)}` : name;
  const portrait = pixelProfileForName(name) ?? headshotUrl;

  return (
    <Link
      href={`/players/${id}`}
      prefetch={false}
      className="group @container flex flex-col rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] p-3 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 sm:p-4"
    >
      <div className="flex items-center gap-2.5 @[25rem]:gap-4 sm:gap-3">
        {rank !== undefined && (
          <span className="w-6 shrink-0 text-center font-display text-lg font-bold tabular-nums text-[var(--color-fg-faint)]">
            {rank}
          </span>
        )}
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] transition-colors group-hover:border-[var(--color-accent)] sm:h-12 sm:w-12">
          {portrait && (
            <Image src={portrait} alt="" fill sizes="48px" className="object-cover" unoptimized />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-[var(--color-fg)]">
              <span className="@[25rem]:hidden">{shortName}</span>
              <span className="hidden @[25rem]:inline">{name}</span>
            </span>
            <StatusBadge status={status} />
          </div>
          <p className="truncate text-xs text-[var(--color-fg-muted)]">
            {position}
            {teamId ? ` · ${teamId}` : ""}
          </p>
          {windowStats && (
            <span
              title={statTitle}
              className="mt-1 hidden w-max items-center gap-1 rounded-none border border-[var(--color-border)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--color-fg-muted)] @[27rem]:inline-flex"
            >
              {windowStats.goals} G
              <span className="text-[var(--color-fg-faint)]">·</span>
              {windowStats.assists} A
              <span className="text-[var(--color-fg-faint)]">·</span>
              <span className="font-semibold text-[var(--color-fg)]">{windowStats.points} P</span>
            </span>
          )}
        </div>
        {/* Narrow cards get a slimmer bar + smaller number so the name keeps its space. */}
        <div className="w-20 shrink-0 @[25rem]:w-44">
          <div className="flex items-center gap-1.5 @[25rem]:hidden">
            <div className="flex-1">
              <NetBarTrack direction={overall.direction} pct={overall.pct} height="h-1.5" />
            </div>
            <span className="shrink-0 font-display text-sm font-bold tabular-nums text-[var(--color-fg)]">
              {formatRating(overall.value)}
            </span>
          </div>
          <div className="hidden @[25rem]:block">
            <OverallBarDisplay direction={overall.direction} pct={overall.pct} value={overall.value} />
          </div>
        </div>
      </div>

      {/* Expands in place on hover — pushes rows below it down instead of
          floating over them, so nothing else in the list gets covered. Rows
          stay in the DOM (grid-rows 0fr→1fr) rather than toggling display,
          so both the height and the fade below can actually transition. */}
      {((isGoalie && attributeBars && attrs.length > 0) || (!isGoalie && categoryBars)) && (
        <div
          className="grid grid-rows-[0fr] will-change-[grid-template-rows] transition-[grid-template-rows] duration-300 ease-in-out group-hover:grid-rows-[1fr] group-focus-visible:grid-rows-[1fr]"
          aria-hidden="true"
        >
          <div className="overflow-hidden">
            <div className="pt-2 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100 group-focus-visible:opacity-100 sm:pt-3">
              {isGoalie ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {attrs.map((a) => (
                    <AttrCell key={a} attribute={a} bar={attributeBars![a]} />
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {CATEGORY_ROWS.map((row) => (
                    <CategoryCell key={row.key} label={row.label} color={row.color} bar={categoryBars?.[row.key]} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Link>
  );
}
