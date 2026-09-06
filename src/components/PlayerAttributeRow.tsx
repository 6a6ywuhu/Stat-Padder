"use client";

import { useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { NetBarTrack, BarColor } from "./AttributeBar";
import type { Direction } from "@/lib/scoring";

export function PlayerAttributeRow({
  playerId,
  attribute,
  label,
  pct,
  positiveVotes,
  negativeVotes,
  color,
}: {
  playerId: string;
  attribute: string;
  label: string;
  /** Kept for API compatibility with callers; the bar direction is now
   *  derived from the live optimistic count. */
  direction?: Direction;
  pct: number;
  positiveVotes: number;
  negativeVotes: number;
  net?: number;
  color?: BarColor;
}) {
  // Seeded from the server render, then updated optimistically so a click
  // lands instantly — the POST just persists it in the background.
  const [pos, setPos] = useState(positiveVotes);
  const [neg, setNeg] = useState(negativeVotes);
  const [error, setError] = useState<string | null>(null);

  const net = pos - neg;
  // Nudge the bar toward the new value without the group-scaled pct the
  // server computes — it reconciles exactly on the next page load.
  const shownDirection: Direction = net > 0 ? "positive" : net < 0 ? "negative" : "zero";
  const shownPct =
    net === 0 ? 0 : Math.max(4, Math.min(100, pct === 0 ? 12 : pct));

  async function vote(value: 1 | -1) {
    setError(null);
    if (value === 1) setPos((p) => p + 1);
    else setNeg((n) => n + 1);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, attribute, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Vote failed.");
        if (value === 1) setPos((p) => p - 1);
        else setNeg((n) => n - 1);
      }
    } catch {
      setError("Network error — vote not recorded.");
      if (value === 1) setPos((p) => p - 1);
      else setNeg((n) => n - 1);
    }
  }

  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tabular-nums text-[var(--color-fg-muted)]">
            {net > 0 ? "+" : ""}
            {net}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Downvote ${label}`}
              onClick={() => vote(-1)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-none border-2 border-[var(--color-negative)]/50 text-[var(--color-negative)] transition-all hover:border-[var(--color-negative)] hover:bg-[var(--color-negative)]/10 active:scale-90"
            >
              <Minus size={11} weight="bold" />
            </button>
            <button
              type="button"
              aria-label={`Upvote ${label}`}
              onClick={() => vote(1)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-none border-2 border-[var(--color-positive)]/50 text-[var(--color-positive)] transition-all hover:border-[var(--color-positive)] hover:bg-[var(--color-positive)]/10 active:scale-90"
            >
              <Plus size={11} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <NetBarTrack direction={shownDirection} pct={shownPct} color={color} />

      {error && <p className="mt-1 text-xs text-[var(--color-negative)]">{error}</p>}

      <div className="mt-0.5 flex justify-between text-[10px] text-[var(--color-fg-faint)]">
        <span>{neg} down</span>
        <span>{pos} up</span>
      </div>
    </div>
  );
}
