"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
   *  derived from the live count. */
  direction?: Direction;
  pct: number;
  positiveVotes: number;
  negativeVotes: number;
  net?: number;
  color?: BarColor;
}) {
  const router = useRouter();

  // Counts committed on the server when this row first mounted, plus the
  // votes made here since. Displaying `max(currentServerCount, seed + local)`
  // means an optimistic vote shows instantly and never snaps backward — a
  // background refresh that hasn't caught up yet just loses the max().
  const seedPos = useRef(positiveVotes).current;
  const seedNeg = useRef(negativeVotes).current;
  const [optUp, setOptUp] = useState(0);
  const [optDown, setOptDown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pos = Math.max(positiveVotes, seedPos + optUp);
  const neg = Math.max(negativeVotes, seedNeg + optDown);
  const net = pos - neg;

  const serverNet = positiveVotes - negativeVotes;
  const shownDirection: Direction = net > 0 ? "positive" : net < 0 ? "negative" : "zero";
  // pct is proportional to net within the comparison group, and one vote
  // doesn't move the group's max — so scaling the server pct by the net
  // ratio tracks the real bar until a refresh reconciles it exactly.
  const shownPct =
    net === 0
      ? 0
      : serverNet !== 0 && Math.sign(net) === Math.sign(serverNet)
        ? Math.max(3, Math.min(100, pct * (net / serverNet)))
        : Math.max(3, Math.min(100, Math.abs(net) * 6));

  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      if (inFlight.current === 0) router.refresh();
    }, 800);
  }

  async function vote(value: 1 | -1) {
    setError(null);
    inFlight.current += 1;
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
    } finally {
      inFlight.current -= 1;
      scheduleRefresh();
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
