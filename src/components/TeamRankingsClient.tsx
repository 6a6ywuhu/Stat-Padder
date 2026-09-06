"use client";

import { useSearchParams } from "next/navigation";
import type { TeamRankingsSnapshot } from "@/lib/team-rankings-snapshot";
import { TOP_SKATERS, TOP_GOALIES } from "@/lib/team-scores";
import { RankingsScopeToggle } from "@/components/RankingsScopeToggle";
import { RankingsWindowToggle, RankingWindow } from "@/components/RankingsWindowToggle";
import { TeamRankingsTable } from "@/components/TeamRankingsTable";
import { BackButton } from "@/components/BackButton";

export function TeamRankingsClient({ snapshot }: { snapshot: TeamRankingsSnapshot }) {
  const sp = useSearchParams();
  const w = sp.get("window");
  const rankWindow: RankingWindow = w === "week" || w === "month" ? w : "all";
  const rows = snapshot[rankWindow];

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
        <RankingsScopeToggle active="teams" />
        <RankingsWindowToggle active={rankWindow} />
      </div>

      <div className="mt-6">
        <TeamRankingsTable rows={rows} topSkaters={TOP_SKATERS} topGoalies={TOP_GOALIES} />
      </div>
    </div>
  );
}
