"use client";

import { useState } from "react";
import { NetBarTrack, BarColor } from "./AttributeBar";
import { RATING_SCALE, type Direction } from "@/lib/scoring";

type Value = -5 | -1 | 1 | 5;

const STOPS: { value: Value; label: string; tone: "neg" | "pos" }[] = [
  { value: -5, label: "−5", tone: "neg" },
  { value: -1, label: "−1", tone: "neg" },
  { value: 1, label: "+1", tone: "pos" },
  { value: 5, label: "+5", tone: "pos" },
];

function toneClasses(tone: "neg" | "pos") {
  if (tone === "neg")
    return "border-[var(--color-negative)]/45 text-[var(--color-negative)] hover:border-[var(--color-negative)] hover:bg-[var(--color-negative)]/10";
  return "border-[var(--color-positive)]/45 text-[var(--color-positive)] hover:border-[var(--color-positive)] hover:bg-[var(--color-positive)]/10";
}

export function PlayerAttributeRow({
  playerId,
  attribute,
  label,
  mean,
  votes,
  positiveVotes,
  negativeVotes,
  color,
}: {
  playerId: string;
  attribute: string;
  label: string;
  /** Server mean vote value for this attribute, −5 … +5. */
  mean: number;
  /** Server vote count. */
  votes: number;
  positiveVotes: number;
  negativeVotes: number;
  color?: BarColor;
}) {
  // Fold this session's clicks into the server mean so the bar and number
  // move the instant you click; the POST just persists in the background.
  // No router.refresh() — the exact figure reconciles on the next load.
  const [optSum, setOptSum] = useState(0);
  const [optCount, setOptCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const liveTotal = votes + optCount;
  const shownMean = liveTotal > 0 ? (mean * votes + optSum) / liveTotal : 0;
  const shownDirection: Direction =
    shownMean > 0.001 ? "positive" : shownMean < -0.001 ? "negative" : "zero";
  const shownPct = Math.max(0, Math.min(100, (Math.abs(shownMean) / RATING_SCALE) * 100));

  async function vote(value: Value) {
    setError(null);
    setOptSum((s) => s + value);
    setOptCount((c) => c + 1);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, attribute, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Vote failed.");
        setOptSum((s) => s - value);
        setOptCount((c) => Math.max(0, c - 1));
      }
    } catch {
      setError("Network error — vote not recorded.");
      setOptSum((s) => s - value);
      setOptCount((c) => Math.max(0, c - 1));
    }
  }

  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--color-fg)]">{label}</span>
        <div className="flex items-center gap-2.5">
          <span className="w-10 text-right text-sm font-semibold tabular-nums text-[var(--color-fg-muted)]">
            {shownMean > 0 ? "+" : ""}
            {shownMean.toFixed(1)}
          </span>
          <div className="flex items-center gap-1" role="group" aria-label={`Rate ${label}`}>
            {STOPS.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-label={`${label}: ${
                  s.value > 0 ? "good" : "poor"
                }${Math.abs(s.value) === 5 ? " (strong)" : ""}`}
                onClick={() => vote(s.value)}
                className={`flex h-8 min-w-[2.25rem] cursor-pointer items-center justify-center rounded-none border-2 px-1.5 text-sm font-bold leading-none transition-all active:scale-90 ${toneClasses(
                  s.tone
                )}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <NetBarTrack direction={shownDirection} pct={shownPct} color={color} />

      {error && <p className="mt-1 text-xs text-[var(--color-negative)]">{error}</p>}

      <div className="mt-1 flex justify-between text-[10px] text-[var(--color-fg-faint)]">
        <span>{negativeVotes} low</span>
        <span>
          {liveTotal} {liveTotal === 1 ? "vote" : "votes"}
        </span>
        <span>{positiveVotes} high</span>
      </div>
    </div>
  );
}
