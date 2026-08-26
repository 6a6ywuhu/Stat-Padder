import type { Direction } from "@/lib/scoring";

/**
 * The track always paints the full light→saturated gradient across its
 * entire width; a grey "cover" slides in from the right to hide whatever
 * portion isn't filled. That way a short bar only reveals the pale start
 * of the gradient, and a long bar reveals all the way to the deep, fully
 * saturated color — length and color intensity reinforce the same signal
 * instead of length alone carrying it.
 */
function gradientFor(direction: Direction): string | undefined {
  if (direction === "positive") {
    return "linear-gradient(90deg, var(--color-positive-light), var(--color-positive))";
  }
  if (direction === "negative") {
    return "linear-gradient(90deg, var(--color-negative-light), var(--color-negative))";
  }
  return undefined;
}

export function NetBarTrack({
  direction,
  pct,
  height = "h-2",
}: {
  direction: Direction;
  pct: number;
  height?: string;
}) {
  const width = direction === "zero" ? 0 : Math.max(0, Math.min(100, pct));
  const gradient = gradientFor(direction);
  return (
    <div
      className={`${height} flex w-full overflow-hidden rounded-full bg-[var(--color-empty)]/40`}
      style={gradient ? { backgroundImage: gradient } : undefined}
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
}: {
  direction: Direction;
  pct: number;
  value: number;
}) {
  const width = direction === "zero" ? 0 : Math.max(0, Math.min(100, pct));
  const gradient = gradientFor(direction);
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-3 flex-1 overflow-hidden rounded-full bg-[var(--color-empty)]/40"
        style={gradient ? { backgroundImage: gradient } : undefined}
      >
        <div className="h-full shrink-0 transition-[width] duration-300" style={{ width: `${width}%` }} />
        <div className="h-full flex-1 bg-[var(--color-empty)]" />
      </div>
      <span className="w-12 shrink-0 text-right font-display text-lg font-bold tabular-nums text-[var(--color-fg)]">
        {value > 0 ? "+" : ""}
        {value.toFixed(1)}
      </span>
    </div>
  );
}
