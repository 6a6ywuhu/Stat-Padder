"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "@phosphor-icons/react";
import { NetBarTrack } from "./AttributeBar";
import { useVotesRemaining } from "./VotesRemainingProvider";
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
}: {
  playerId: string;
  attribute: string;
  label: string;
  direction: Direction;
  pct: number;
  positiveVotes: number;
  negativeVotes: number;
  net: number;
}) {
  const router = useRouter();
  const { status, applyVoteResult } = useVotesRemaining();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outOfVotes = status !== null && status.remaining <= 0;
  const disabled = pending || outOfVotes;

  async function vote(value: 1 | -1) {
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, attribute, value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Vote failed.");
        if (typeof data.remaining === "number") applyVoteResult(data.remaining, status?.limit ?? 30);
        return;
      }
      applyVoteResult(data.remaining, data.limit);
      router.refresh();
    } catch {
      setError("Network error — vote not recorded.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="py-3">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tabular-nums text-[var(--color-fg-muted)]">
            {net > 0 ? "+" : ""}
            {net}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Downvote ${label}`}
              disabled={disabled}
              onClick={() => vote(-1)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-negative)] transition-colors hover:bg-[var(--color-negative)]/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Minus size={14} weight="bold" />
            </button>
            <button
              type="button"
              aria-label={`Upvote ${label}`}
              disabled={disabled}
              onClick={() => vote(1)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-positive)] transition-colors hover:bg-[var(--color-positive)]/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Plus size={14} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <NetBarTrack direction={direction} pct={pct} />

      {error && <p className="mt-1 text-xs text-[var(--color-negative)]">{error}</p>}

      <div className="mt-1 flex justify-between text-[11px] text-[var(--color-fg-faint)]">
        <span>{positiveVotes} up</span>
        <span>{negativeVotes} down</span>
      </div>
    </div>
  );
}
