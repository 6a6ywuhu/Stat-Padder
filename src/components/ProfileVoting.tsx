"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NetBarTrack, OverallBarDisplay, BarColor } from "./AttributeBar";
import { formatRating, type Direction } from "@/lib/scoring";

export type VoteAttr = { key: string; label: string; color: BarColor };
export type VoteSection =
  | { kind: "flat"; attrs: VoteAttr[] }
  | { kind: "categories"; cats: { key: string; label: string; color: BarColor; attrs: VoteAttr[] }[] };

export type CommunityBar = {
  /** community mean, −100 … +100 — the starting point for a new rating */
  value: number;
};

const RATING_SCALE = 100;

function barOf(value: number): { direction: Direction; pct: number } {
  const pct = Math.max(0, Math.min(100, Math.abs(value)));
  return { direction: value > 0 ? "positive" : value < 0 ? "negative" : "zero", pct };
}

function meanOf(vals: Record<string, number>, keys: string[]): number {
  if (keys.length === 0) return 0;
  return keys.reduce((s, k) => s + (vals[k] ?? 0), 0) / keys.length;
}

function localDayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type VoterState = {
  canVote: boolean;
  reason?: "anon-already-voted" | "anon-limit" | "voted-today";
  anonPlayersUsed: number;
  anonLimit: number;
  signedIn: boolean;
};

const STEP_BUTTONS: { delta: number; label: string }[] = [
  { delta: -10, label: "−10" },
  { delta: -1, label: "−1" },
  { delta: 1, label: "+1" },
  { delta: 10, label: "+10" },
];

export function ProfileVoting({
  playerId,
  section,
  boosters,
  community,
}: {
  playerId: string;
  section: VoteSection;
  boosters: VoteAttr[];
  /** keyed by attribute, incl. boosters */
  community: Record<string, CommunityBar>;
}) {
  const router = useRouter();

  const allAttrs = useMemo<VoteAttr[]>(() => {
    const list =
      section.kind === "flat" ? section.attrs : section.cats.flatMap((c) => c.attrs);
    return [...list, ...boosters];
  }, [section, boosters]);

  const coreKeys = useMemo(
    () => (section.kind === "flat" ? section.attrs : section.cats.flatMap((c) => c.attrs)).map((a) => a.key),
    [section]
  );

  const startValues = useMemo(() => {
    const v: Record<string, number> = {};
    for (const a of allAttrs) v[a.key] = Math.round(community[a.key]?.value ?? 0);
    return v;
  }, [allAttrs, community]);

  const [mode, setMode] = useState<"view" | "vote">("view");
  const [values, setValues] = useState<Record<string, number>>(startValues);
  const [voter, setVoter] = useState<VoterState | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = mode === "vote" ? values : startValues;
  const overall = meanOf(display, coreKeys);

  async function enterVoteMode() {
    setError(null);
    setValues(startValues);
    setMode("vote");
    setLoadingState(true);
    try {
      const res = await fetch(
        `/api/votes?playerId=${encodeURIComponent(playerId)}&localDay=${localDayString()}`
      );
      setVoter(res.ok ? await res.json() : null);
    } catch {
      setVoter(null);
    } finally {
      setLoadingState(false);
    }
  }

  function bump(key: string, delta: number) {
    setValues((v) => ({ ...v, [key]: Math.max(-100, Math.min(100, (v[key] ?? 0) + delta)) }));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, localDay: localDayString(), values }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't submit your rating.");
        if (data?.state) setVoter(data.state);
        return;
      }
      setMode("view");
      router.refresh();
    } catch {
      setError("Network error — your rating wasn't submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  const canInteract = mode === "vote" && !loadingState && voter?.canVote;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-[var(--color-fg)]">
          {mode === "vote" ? "Rate this player" : "Attribute Ratings"}
        </h2>
        {mode === "view" ? (
          <button
            type="button"
            onClick={enterVoteMode}
            className="btn-hero-chip cursor-pointer"
          >
            Rate this player
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode("view");
              setError(null);
            }}
            className="btn-hero-chip cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Overall */}
      <div className="mb-4 rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] p-2.5 sm:p-3">
        <div className="mb-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
            {mode === "vote" ? "Overall (your rating)" : "Overall"}
          </p>
        </div>
        <OverallBarDisplay {...barOf(overall)} value={Math.round(overall * 10) / 10} prominent />
      </div>

      {mode === "vote" && (
        <VoteStatus voter={voter} loading={loadingState} />
      )}

      {/* Attribute rows */}
      {section.kind === "flat" ? (
        <div className="divide-y divide-[var(--color-border)] rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 sm:px-4">
          {section.attrs.map((a) => (
            <AttrRow
              key={a.key}
              attr={a}
              mode={mode}
              value={display[a.key] ?? 0}
              interactive={!!canInteract}
              onBump={bump}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
          {section.cats.map((cat) => (
            <div key={cat.key}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
                {cat.label}
              </h3>
              <div className="mb-1.5 rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] p-2 sm:p-2.5">
                <OverallBarDisplay
                  {...barOf(meanOf(display, cat.attrs.map((a) => a.key)))}
                  value={Math.round(meanOf(display, cat.attrs.map((a) => a.key)) * 10) / 10}
                  color={cat.color}
                />
              </div>
              <div className="divide-y divide-[var(--color-border)] rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 sm:px-4">
                {cat.attrs.map((a) => (
                  <AttrRow
                    key={a.key}
                    attr={a}
                    mode={mode}
                    value={display[a.key] ?? 0}
                    interactive={!!canInteract}
                    onBump={bump}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Boosters */}
      <div className="mt-6">
        <h3 className="mb-2 font-display text-lg font-bold text-[var(--color-fg)]">Booster Attributes</h3>
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          {boosters.map((b) => (
            <div
              key={b.key}
              className="rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 sm:px-4"
            >
              <AttrRow
                attr={b}
                mode={mode}
                value={display[b.key] ?? 0}
                interactive={!!canInteract}
                onBump={bump}
              />
            </div>
          ))}
        </div>
      </div>

      {mode === "vote" && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canInteract || submitting}
            onClick={submit}
            className="btn-pixel cursor-pointer border-2 border-[var(--color-accent)] bg-[var(--color-card)] px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-[var(--color-fg)] transition-colors hover:bg-[var(--color-accent)]/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit rating"}
          </button>
          {error && <p className="text-sm text-[var(--color-negative)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

function VoteStatus({ voter, loading }: { voter: VoterState | null; loading: boolean }) {
  if (loading) {
    return <p className="mb-3 text-sm text-[var(--color-fg-muted)]">Checking your rating status…</p>;
  }
  if (!voter) return null;

  if (!voter.canVote) {
    const msg =
      voter.reason === "voted-today"
        ? "You've already rated this player today — come back tomorrow to change it."
        : voter.reason === "anon-already-voted"
          ? "You've already rated this player."
          : "You've rated 10 players without an account.";
    return (
      <div className="mb-3 rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-fg-muted)]">
        {msg}{" "}
        {!voter.signedIn && (
          <Link href="/login" className="font-medium text-[var(--color-accent-text)] underline underline-offset-2">
            Sign in
          </Link>
        )}
        {!voter.signedIn && " to rate more players and change your ratings."}
      </div>
    );
  }

  if (!voter.signedIn) {
    return (
      <p className="mb-3 text-sm text-[var(--color-fg-muted)]">
        You&apos;ve rated {voter.anonPlayersUsed} of {voter.anonLimit} players.{" "}
        <Link href="/login" className="font-medium text-[var(--color-accent-text)] underline underline-offset-2">
          Sign in
        </Link>{" "}
        to rate more and to change your ratings.
      </p>
    );
  }

  return null;
}

function AttrRow({
  attr,
  mode,
  value,
  interactive,
  onBump,
}: {
  attr: VoteAttr;
  mode: "view" | "vote";
  value: number;
  interactive: boolean;
  onBump: (key: string, delta: number) => void;
}) {
  const bar = barOf(value);
  return (
    <div className="py-2">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-[var(--color-fg)]">{attr.label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-fg-muted)]">
          {formatRating(value)}
        </span>
      </div>

      {mode === "vote" && (
        <div
          className="mb-1.5 flex items-center gap-1.5"
          role="group"
          aria-label={`Rate ${attr.label}`}
        >
          {STEP_BUTTONS.map((b) => (
            <button
              key={b.delta}
              type="button"
              disabled={!interactive}
              aria-label={`${attr.label} ${b.delta > 0 ? "up" : "down"} ${Math.abs(b.delta)}`}
              onClick={() => onBump(attr.key, b.delta)}
              className={`flex h-7 flex-1 cursor-pointer items-center justify-center rounded-none border-2 text-xs font-bold leading-none transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                b.delta > 0
                  ? "border-[var(--color-positive)]/45 text-[var(--color-positive)] hover:border-[var(--color-positive)] hover:bg-[var(--color-positive)]/10"
                  : "border-[var(--color-negative)]/45 text-[var(--color-negative)] hover:border-[var(--color-negative)] hover:bg-[var(--color-negative)]/10"
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}

      <NetBarTrack direction={bar.direction} pct={bar.pct} color={attr.color} />
    </div>
  );
}
