"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SkaterPosition } from "@/lib/attributes";

/** The skater positions that live behind the Forwards toggle (D is its own pill). */
const FORWARD_POSITIONS: SkaterPosition[] = ["C", "LW", "RW"];

function pillClass(active: boolean) {
  return `whitespace-nowrap rounded-none text-sm font-medium transition-colors ${
    active
      ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
      : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
  }`;
}

/**
 * Position pills, unlike Skaters/Goalies, are multi-select — several can be
 * active at once. A solid dark fill on every one of them reads as heavy,
 * and full rounding on each makes adjacent selected pills look like
 * separate bubbles bumping into each other rather than one filter. Active
 * pills instead get a soft fill, and only round the outer edge of a run of
 * consecutive selected positions — the touching edge between two selected
 * neighbors goes square, so they merge into a single continuous shape.
 */
function positionPillClass(active: boolean, roundLeft: boolean, roundRight: boolean) {
  const rounding = !active
    ? "rounded-none"
    : roundLeft && roundRight
      ? "rounded-none"
      : roundLeft
        ? "rounded-none"
        : roundRight
          ? "rounded-none"
          : "";
  return `whitespace-nowrap text-sm font-medium transition-colors ${rounding} ${
    active
      ? "bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent-text-strong)]"
      : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
  }`;
}

function rowClass(active: boolean) {
  return `rounded-none px-2.5 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-[var(--color-accent)]/15 font-semibold text-[var(--color-accent-text-strong)]"
      : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
  }`;
}

/** `compact` is for the mobile-only row (below `sm`) — a smaller size than the desktop pills. */
function standaloneClass(active: boolean, compact = false) {
  return `rounded-none border-2 font-medium transition-colors ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
    active
      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
      : "border-[var(--color-border-strong)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)]"
  }`;
}

const EASE = "cubic-bezier(0.65, 0, 0.35, 1)"; // easeInOutCubic — symmetric, smooth both ways
const DURATION = "duration-[400ms]";

/**
 * Forwards is the permanent, always-visible pill — clicking it toggles the
 * C / LW / RW reveal and selects "all forwards" as a group (`?position=F`),
 * which is distinct from picking all three individually. While the group is
 * on, the sub-pills stay unlit; picking any one of them drops the group for
 * explicit mode, and once all three are picked that way Forwards is no
 * longer the active pill. Defense and Goalies are separate buttons to the
 * right. Defense is a skater sub-group that stacks with a Forwards
 * selection; Goalies vote on a different attribute set and stay mutually
 * exclusive with skaters.
 */
export function PositionFilterBar({
  activeType,
  selectedPositions,
  forwardsGroup = false,
  basePath = "/rankings",
}: {
  activeType: "skaters" | "goalies";
  selectedPositions: SkaterPosition[];
  /** `?position=F` is set — Forwards picked as a whole, no individual position drilled into. */
  forwardsGroup?: boolean;
  basePath?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const forwardsPreExpanded =
    activeType === "skaters" &&
    (forwardsGroup || FORWARD_POSITIONS.some((p) => selectedPositions.includes(p)));
  const [open, setOpen] = useState(forwardsPreExpanded);
  const effectiveOpen = open && activeType === "skaters";

  function linkFor(overrides: Record<string, string | null>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return `${pathname ?? basePath}${qs ? `?${qs}` : ""}`;
  }

  // Builds a `?type=skaters` link. `group` adds the "F" token (Forwards as a
  // whole); `positions` are the explicitly-picked ones. Nothing at all
  // clears the param — every skater, nothing highlighted.
  function positionsHref(group: boolean, positions: SkaterPosition[]) {
    const parts = [...(group ? ["F"] : []), ...Array.from(new Set(positions))];
    return linkFor({ type: "skaters", position: parts.length ? parts.join(",") : null, cross: null });
  }

  const isSkaters = activeType === "skaters";
  const forwardsActive = isSkaters && forwardsGroup;
  const defenseActive = isSkaters && selectedPositions.includes("D");
  const pickedForwards = selectedPositions.filter((p) => FORWARD_POSITIONS.includes(p));
  const nonForward = selectedPositions.filter((p) => !FORWARD_POSITIONS.includes(p));

  const forwardsHref = positionsHref(!forwardsActive, nonForward);
  const defenseHref = positionsHref(
    forwardsActive,
    defenseActive ? pickedForwards : [...pickedForwards, "D"]
  );
  const goaliesHref = linkFor({ type: "goalies", position: null, cross: null });

  return (
    <>
      {/* sm and up: forward positions slide out to the right, in the same bubble as Forwards. */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <div
          className="flex w-fit items-center rounded-none border-2 border-[var(--color-border-strong)] p-0.5"
          role="group"
          aria-label="Filter by position"
        >
          <Link
            href={forwardsHref}
            scroll={false}
            replace
            onClick={() => setOpen((v) => !v)}
            aria-expanded={effectiveOpen}
            aria-pressed={forwardsActive}
            className={`${pillClass(forwardsActive)} px-3 py-1.5`}
          >
            Forwards
          </Link>

          {/* One clip for the whole C/LW/RW row: the pills are laid out once
              at natural width (w-max) and a max-width track wipes them in as a
              single unit, so a close cleanly reverses the same motion. */}
          <div
            className={`overflow-hidden ${DURATION} ${effectiveOpen ? "max-w-[18rem]" : "max-w-0"}`}
            style={{ transitionProperty: "max-width", transitionTimingFunction: EASE }}
          >
            <div
              className={`flex w-max items-center ${DURATION} ${effectiveOpen ? "opacity-100 delay-100" : "opacity-0"}`}
              style={{ transitionProperty: "opacity", transitionTimingFunction: EASE }}
            >
              {FORWARD_POSITIONS.map((pos, i) => {
                const active = selectedPositions.includes(pos);
                const nextForwards = active
                  ? pickedForwards.filter((p) => p !== pos)
                  : [...pickedForwards, pos];
                const prevActive = i > 0 && selectedPositions.includes(FORWARD_POSITIONS[i - 1]);
                const nextActive =
                  i < FORWARD_POSITIONS.length - 1 &&
                  selectedPositions.includes(FORWARD_POSITIONS[i + 1]);
                return (
                  <Link
                    key={pos}
                    href={positionsHref(false, [...nextForwards, ...nonForward])}
                    scroll={false}
                    replace
                    tabIndex={effectiveOpen ? 0 : -1}
                    aria-hidden={!effectiveOpen}
                    aria-pressed={active}
                    className={`${positionPillClass(active, !prevActive, !nextActive)} px-3 py-1.5`}
                  >
                    {pos}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <Link
          href={defenseHref}
          scroll={false}
          replace
          aria-pressed={defenseActive}
          className={standaloneClass(defenseActive)}
        >
          Defense
        </Link>
        <Link href={goaliesHref} scroll={false} replace className={standaloneClass(activeType === "goalies")}>
          Goalies
        </Link>
      </div>

      {/* Below sm: the three pills stay together on one row; the forward
          positions drop down as a vertical list beneath the whole row, so
          the list's width never pushes Defense away from Forwards. */}
      <div className="sm:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={forwardsHref}
            scroll={false}
            replace
            onClick={() => setOpen((v) => !v)}
            aria-expanded={effectiveOpen}
            aria-pressed={forwardsActive}
            className={
              forwardsActive
                ? "inline-block rounded-none border-2 border-[var(--color-accent)] bg-[var(--color-accent)] px-2.5 py-1 text-xs font-medium text-[var(--color-accent-fg)]"
                : "inline-block rounded-none border-2 border-[var(--color-border-strong)] px-2.5 py-1 text-xs font-medium text-[var(--color-fg-muted)]"
            }
          >
            Forwards
          </Link>
          <Link
            href={defenseHref}
            scroll={false}
            replace
            aria-pressed={defenseActive}
            className={standaloneClass(defenseActive, true)}
          >
            Defense
          </Link>
          <Link href={goaliesHref} scroll={false} replace className={standaloneClass(activeType === "goalies", true)}>
            Goalies
          </Link>
        </div>

        <div
          className={`grid overflow-hidden ${DURATION} ${effectiveOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
          style={{ transitionProperty: "grid-template-rows", transitionTimingFunction: EASE }}
        >
          <div className="overflow-hidden">
            <div className="mt-2 flex w-fit flex-col gap-0.5 rounded-none border-2 border-[var(--color-border-strong)] p-1" role="group" aria-label="Filter by position">
              {FORWARD_POSITIONS.map((pos) => {
                const active = selectedPositions.includes(pos);
                const nextForwards = active
                  ? pickedForwards.filter((p) => p !== pos)
                  : [...pickedForwards, pos];
                return (
                  <Link
                    key={pos}
                    href={positionsHref(false, [...nextForwards, ...nonForward])}
                    scroll={false}
                    replace
                    tabIndex={effectiveOpen ? 0 : -1}
                    aria-hidden={!effectiveOpen}
                    aria-pressed={active}
                    className={`block ${rowClass(active)}`}
                  >
                    {pos}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
