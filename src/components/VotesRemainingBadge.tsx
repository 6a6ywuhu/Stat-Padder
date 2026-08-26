"use client";

import { useVotesRemaining } from "./VotesRemainingProvider";
import { formatCountdown } from "@/lib/format";

export function VotesRemainingBadge() {
  const { status } = useVotesRemaining();

  if (!status) {
    return <div className="h-8 w-28 shrink-0 animate-pulse rounded-full bg-[var(--color-bg-subtle)]" aria-hidden="true" />;
  }

  const pct = status.limit > 0 ? Math.max(0, Math.min(100, (status.used / status.limit) * 100)) : 0;
  const exhausted = status.remaining <= 0;
  // eslint-disable-next-line react-hooks/purity -- countdown display; reading the clock is the point
  const resetInMs = status.resetAt ? new Date(status.resetAt).getTime() - Date.now() : 0;
  const resetLabel = resetInMs > 0 ? formatCountdown(resetInMs) : "midnight";

  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5"
      title={`${status.used}/${status.limit} votes used today — resets in ${resetLabel}`}
    >
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--color-empty)]/40">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            exhausted ? "bg-[var(--color-negative)]" : "bg-[var(--color-fg)]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-xs font-medium tabular-nums text-[var(--color-fg-muted)]">
        {status.used}/{status.limit} votes
      </span>
    </div>
  );
}
