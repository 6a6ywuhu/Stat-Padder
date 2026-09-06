"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WindowSnapshot, SnapshotPlayer, RankWindow } from "@/lib/rankings-snapshot";
import { SkaterPosition } from "@/lib/attributes";
import { PositionFilterBar } from "@/components/PositionFilterBar";
import { RankingsScopeToggle } from "@/components/RankingsScopeToggle";
import { RankingsWindowToggle } from "@/components/RankingsWindowToggle";
import { RankingsSearch } from "@/components/RankingsSearch";
import { PlayerCard } from "@/components/PlayerCard";
import { Pagination } from "@/components/Pagination";
import { BackButton } from "@/components/BackButton";

const PAGE_SIZE = 25;
const VALID: SkaterPosition[] = ["C", "LW", "RW", "D"];

function parseRawPositions(raw: string | null): SkaterPosition[] {
  const picked = (raw ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is SkaterPosition => (VALID as string[]).includes(p));
  return Array.from(new Set(picked));
}

/**
 * The rankings list runs entirely in the browser off a static snapshot —
 * filter / window / sort / search / paginate are instant, no server
 * round-trip. The default window ships with the page; month/week are
 * fetched once from /api/rankings and cached in state.
 */
export function RankingsClient({ initial }: { initial: WindowSnapshot }) {
  const sp = useSearchParams();

  const type = sp.get("type") === "goalies" ? "goalies" : "skaters";
  const windowParam = sp.get("window");
  const rankWindow: RankWindow =
    windowParam === "week" || windowParam === "month" ? windowParam : "all";
  const rawPositions = sp.get("position");
  const forwardsGroup =
    type === "skaters" && (rawPositions ?? "").split(",").some((s) => s.trim() === "F");
  const selectedPositions = type === "goalies" ? [] : parseRawPositions(rawPositions);
  const query = (sp.get("q") ?? "").trim().toLowerCase();
  const pageParam = parseInt(sp.get("page") ?? "1", 10) || 1;

  const [windows, setWindows] = useState<Partial<Record<RankWindow, WindowSnapshot>>>({
    all: initial,
  });

  useEffect(() => {
    if (rankWindow === "all" || windows[rankWindow]) return;
    let cancelled = false;
    fetch(`/api/rankings?window=${rankWindow}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: WindowSnapshot | null) => {
        if (!cancelled && data) setWindows((w) => ({ ...w, [rankWindow]: data }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rankWindow, windows]);

  const win = windows[rankWindow];

  const { pageItems, totalPages, page, matchCount } = useMemo(() => {
    if (!win) return { pageItems: [], totalPages: 1, page: 1, matchCount: -1 };
    const base: SnapshotPlayer[] = type === "goalies" ? win.goalies : win.skaters;

    const wanted = new Set<string>([
      ...selectedPositions,
      ...(forwardsGroup ? ["C", "LW", "RW"] : []),
    ]);
    const filtered =
      type === "goalies" || wanted.size === 0
        ? base
        : base.filter((p) => wanted.has(p.position));

    const sorted = [...filtered].sort((a, b) => {
      const d = b.overall.value - a.overall.value;
      if (d !== 0) return d;
      const v = b.totalVotes - a.totalVotes;
      if (v !== 0) return v;
      return (a.teamCity ?? "").localeCompare(b.teamCity ?? "");
    });

    const ranked = sorted.map((s, i) => ({ p: s, rank: i + 1 }));
    const matches = query
      ? ranked.filter(({ p }) => p.name.toLowerCase().includes(query))
      : ranked;

    const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    const page = Math.min(totalPages, Math.max(1, pageParam));
    return {
      pageItems: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      totalPages,
      page,
      matchCount: matches.length,
    };
  }, [win, type, selectedPositions, forwardsGroup, query, pageParam]);

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    if (sp.get("type")) params.set("type", sp.get("type")!);
    if (rawPositions) params.set("position", rawPositions);
    if (sp.get("q")) params.set("q", sp.get("q")!);
    if (windowParam) params.set("window", windowParam);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/rankings${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-4">
        <BackButton />
      </div>
      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Rankings</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        A community-voted rating system for NHL players and teams.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <RankingsScopeToggle active="players" />
        <RankingsWindowToggle active={rankWindow} />
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <PositionFilterBar
          activeType={type}
          selectedPositions={selectedPositions}
          forwardsGroup={forwardsGroup}
        />
        <div className="w-full sm:ml-auto sm:w-72">
          <RankingsSearch />
        </div>
      </div>

      <div className="mt-6 space-y-2 sm:space-y-3">
        {!win && (
          <p className="rounded-none border-2 border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center text-sm text-[var(--color-fg-muted)] sm:p-6">
            Loading…
          </p>
        )}
        {matchCount === 0 && (
          <p className="rounded-none border-2 border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center text-sm text-[var(--color-fg-muted)] sm:p-6">
            {query
              ? `No players in this group match “${sp.get("q")?.trim()}”.`
              : "No players found in this group yet."}
          </p>
        )}
        {pageItems.map(({ p, rank }) => (
          <PlayerCard
            key={p.id}
            id={p.id}
            name={p.name}
            position={p.position}
            teamId={p.teamId}
            headshotUrl={p.headshotUrl}
            status={p.status}
            overall={p.overall}
            attributeBars={p.attributeBars}
            categoryBars={p.categoryBars}
            rank={rank}
            windowStats={win?.stats[p.nhlId] ?? null}
            statWindow={rankWindow}
          />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </div>
  );
}
