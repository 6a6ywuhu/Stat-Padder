import { getTeamRankings, columnBars, TOP_SKATERS, TOP_GOALIES } from "@/lib/team-scores";
import { startOfWeek, startOfMonth } from "@/lib/time-windows";
import { RankingsScopeToggle } from "@/components/RankingsScopeToggle";
import { RankingsWindowToggle, RankingWindow } from "@/components/RankingsWindowToggle";
import { TeamRankingsTable, TeamRow } from "@/components/TeamRankingsTable";
import { BackButton } from "@/components/BackButton";

export const metadata = { title: "Team Rankings — Stat Padder" };

export default async function TeamRankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const sp = await searchParams;
  const rankWindow: RankingWindow =
    sp.window === "week" || sp.window === "month" ? sp.window : "all";
  const since =
    rankWindow === "week" ? startOfWeek() : rankWindow === "month" ? startOfMonth() : undefined;

  const rankings = await getTeamRankings({ since });

  // Bars are scaled per column across all 32 teams, independent of sort order.
  const columns = {
    overall: columnBars(rankings.map((r) => r.overall)),
    offense: columnBars(rankings.map((r) => r.offense)),
    defense: columnBars(rankings.map((r) => r.defense)),
    goalie: columnBars(rankings.map((r) => r.goalie)),
  };

  const rows: TeamRow[] = rankings.map((r, i) => ({
    teamId: r.team.id,
    city: r.team.city,
    name: r.team.name,
    logoLight: r.team.logoLight,
    logoDark: r.team.logoDark,
    incomplete: r.incomplete,
    scores: { overall: r.overall, offense: r.offense, defense: r.defense, goalie: r.goalie },
    bars: {
      overall: columns.overall[i],
      offense: columns.offense[i],
      defense: columns.defense[i],
      goalie: columns.goalie[i],
    },
    topOffense: r.topOffense,
    topDefense: r.topDefense,
    topGoalies: r.topGoalies,
  }));

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
