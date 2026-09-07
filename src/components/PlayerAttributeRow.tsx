"use client";

import { useState } from "react";
import { NetBarTrack, BarColor } from "./AttributeBar";
import type { Direction } from "@/lib/scoring";

// Inline glyphs instead of `@phosphor-icons/react` — this row mounts 20+
// times per profile and is the thing users actually click; pulling the
// icon barrel into it bloated the client chunk and slowed hydration.
function MinusGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function PlusGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

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
   *  derived from the live count. */
  direction?: Direction;
  pct: number;
  positiveVotes: number;
  negativeVotes: number;
  net?: number;
  color?: BarColor;
}) {
  // Server counts at mount + votes made here since. The whole interaction
  // is client-only: the count and bar move the instant you click, and the
  // POST just persists it in the background. No `router.refresh()` — on
  // this dynamic page a refresh re-runs auth() + the full cross-position
  // pool score on cold Neon, and the reconciliation jank was eating the
  // next click. The exact bar width reconciles on the next real page load.
  const seedPos = positiveVotes;
  const seedNeg = negativeVotes;
  const [optUp, setOptUp] = useState(0);
  const [optDown, setOptDown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pos = seedPos + optUp;
  const neg = seedNeg + optDown;
  const net = pos - neg;

  const serverNet = positiveVotes - negativeVotes;
  const shownDirection: Direction = net > 0 ? "positive" : net < 0 ? "negative" : "zero";
  // pct is proportional to net within the comparison group, and one vote
  // doesn't move the group's max — so scaling the server pct by the net
  // ratio tracks the real bar closely until a full reload reconciles it.
  const shownPct =
    net === 0
      ? 0
      : serverNet !== 0 && Math.sign(net) === Math.sign(serverNet)
        ? Math.max(3, Math.min(100, pct * (net / serverNet)))
        : Math.max(3, Math.min(100, Math.abs(net) * 6));

  async function vote(value: 1 | -1) {
    setError(null);
    if (value === 1) setOptUp((u) => u + 1);
    else setOptDown((d) => d + 1);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, attribute, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Vote failed.");
        if (value === 1) setOptUp((u) => Math.max(0, u - 1));
        else setOptDown((d) => Math.max(0, d - 1));
      }
    } catch {
      setError("Network error — vote not recorded.");
      if (value === 1) setOptUp((u) => Math.max(0, u - 1));
      else setOptDown((d) => Math.max(0, d - 1));
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
              <MinusGlyph />
            </button>
            <button
              type="button"
              aria-label={`Upvote ${label}`}
              onClick={() => vote(1)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-none border-2 border-[var(--color-positive)]/50 text-[var(--color-positive)] transition-all hover:border-[var(--color-positive)] hover:bg-[var(--color-positive)]/10 active:scale-90"
            >
              <PlusGlyph />
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
