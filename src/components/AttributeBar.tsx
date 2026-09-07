import type { Direction } from "@/lib/scoring";

/** "vote" = the usual green/red positive-negative semantic — General and
 *  Booster both use this too (deliberately styled the same as Overall).
 *  Offense/Defense are fixed identity colors (see globals.css) that stay
 *  the same hue regardless of whether the value is positive or negative —
 *  length still carries magnitude, color carries "which category" instead
 *  of "good/bad." */
export type BarColor = "vote" | "offense" | "defense";

const CATEGORY_GRADIENTS: Record<Exclude<BarColor, "vote">, string> = {
  offense: "linear-gradient(90deg, var(--color-cat-offense-light), var(--color-cat-offense))",
  defense: "linear-gradient(90deg, var(--color-cat-defense-light), var(--color-cat-defense))",
};

/**
 * The track always paints the full light→saturated gradient across its
 * entire width; a grey "cover" slides in from the right to hide whatever
 * portion isn't filled. That way a short bar only reveals the pale start
 * of the gradient, and a long bar reveals all the way to the deep, fully
 * saturated color — length and color intensity reinforce the same signal
 * instead of length alone carrying it.
 *
 * Negative always reads as the yellow→red "bad" gradient, in every
 * category — the Offense/Defense identity colors only stand in for a
 * positive value; a negative one is a negative one regardless of column.
 */
function gradientFor(direction: Direction, color: BarColor): string | undefined {
  if (direction === "zero") return undefined;
  if (direction === "negative") {
    return "linear-gradient(90deg, var(--color-negative-light), var(--color-negative))";
  }
  if (color !== "vote") return CATEGORY_GRADIENTS[color];
  return "linear-gradient(90deg, var(--color-positive-light), var(--color-positive))";
}

/** Thin dividers every 22px, drawn *under* the color gradient as a second
 *  background layer — an "HP bar" tick read, purely decorative, so it can't
 *  affect the width math the actual vote data drives below it. Spaced wide
 *  enough that a full-width bar reads as a handful of chunky segments,
 *  not a dense field of slices. */
const SEGMENT_TICKS =
  "repeating-linear-gradient(90deg, transparent 0, transparent 21px, var(--color-bg) 21px, var(--color-bg) 22px)";

function trackStyle(gradient: string | undefined): React.CSSProperties | undefined {
  if (!gradient) return undefined;
  return { backgroundImage: `${SEGMENT_TICKS}, ${gradient}` };
}

export function NetBarTrack({
  direction,
  pct,
  height = "h-1.5",
  color = "vote",
}: {
  direction: Direction;
  pct: number;
  height?: string;
  color?: BarColor;
}) {
  const width = direction === "zero" ? 0 : Math.max(0, Math.min(100, pct));
  const gradient = gradientFor(direction, color);
  return (
    <div
      className={`${height} flex w-full overflow-hidden rounded-none bg-[var(--color-empty)]/40`}
      style={trackStyle(gradient)}
    >
      <div className="h-full shrink-0 transition-[width] duration-300" style={{ width: `${width}%` }} />
      <div className="h-full flex-1 bg-[var(--color-empty)]" />
    </div>
  );
}

export function OverallBarDisplay({
  direction,
  pct,
  value,
  color = "vote",
}: {
  direction: Direction;
  pct: number;
  value: number;
  color?: BarColor;
}) {
  const width = direction === "zero" ? 0 : Math.max(0, Math.min(100, pct));
  const gradient = gradientFor(direction, color);
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-2.5 flex-1 overflow-hidden rounded-none bg-[var(--color-empty)]/40"
        style={trackStyle(gradient)}
      >
        <div className="h-full shrink-0 transition-[width] duration-300" style={{ width: `${width}%` }} />
        <div className="h-full flex-1 bg-[var(--color-empty)]" />
      </div>
      <span className="w-10 shrink-0 text-right font-display text-base font-bold tabular-nums text-[var(--color-fg)]">
        {value > 0 ? "+" : ""}
        {value.toFixed(1)}
      </span>
    </div>
  );
}
