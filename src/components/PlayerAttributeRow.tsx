"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "@phosphor-icons/react";
import { NetBarTrack, BarColor } from "./AttributeBar";
import type { Direction } from "@/lib/scoring";

export function PlayerAttributeRow({
  playerId,
  attribute,
  label,
  direction,
  pct,
  positiveVotes,
  negativeVotes,
  net,
  color,
}: {
  playerId: string;
  attribute: string;
  label: string;
  direction: Direction;
  pct: number;
  positiveVotes: number;
  negativeVotes: number;
  net: number;
  color?: BarColor;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vote(value: 1 | -1) {
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, attribute, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Vote failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — vote not recorded.");
    } finally {
      setPending(false);
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
              disabled={pending}
              onClick={() => vote(-1)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-none border-2 border-[var(--color-negative)]/50 text-[var(--color-negative)] transition-all hover:border-[var(--color-negative)] hover:bg-[var(--color-negative)]/10 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Minus size={11} weight="bold" />
            </button>
            <button
              type="button"
              aria-label={`Upvote ${label}`}
              disabled={pending}
              onClick={() => vote(1)}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-none border-2 border-[var(--color-positive)]/50 text-[var(--color-positive)] transition-all hover:border-[var(--color-positive)] hover:bg-[var(--color-positive)]/10 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Plus size={11} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <NetBarTrack direction={direction} pct={pct} color={color} />

      {error && <p className="mt-1 text-xs text-[var(--color-negative)]">{error}</p>}

      <div className="mt-0.5 flex justify-between text-[10px] text-[var(--color-fg-faint)]">
        <span>{negativeVotes} down</span>
        <span>{positiveVotes} up</span>
      </div>
    </div>
  );
}
