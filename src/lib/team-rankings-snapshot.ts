import { unstable_cache } from "next/cache";
import { computeTeamRankings, columnBars } from "./team-scores";
import { startOfWeek, startOfMonth } from "./time-windows";
import type { TeamRow } from "@/components/TeamRankingsTable";

/**
 * All three windows of team-ranking rows, precomputed. 32 teams is small,
 * so the whole thing ships with the (static) /team-rankings page and the
 * window toggle is instant client-side. Refreshes every 60s; busted on a
 * vote via revalidateTag("rankings").
 */
export type TeamRankingsSnapshot = {
  all: TeamRow[];
  month: TeamRow[];
  week: TeamRow[];
};

async function buildWindowRows(since: Date | undefined): Promise<TeamRow[]> {
  const rankings = await computeTeamRankings({ since });

  // Bars are scaled per column across all 32 teams, independent of sort order.
  const columns = {
    overall: columnBars(rankings.map((r) => r.overall)),
    offense: columnBars(rankings.map((r) => r.offense)),
    defense: columnBars(rankings.map((r) => r.defense)),
    goalie: columnBars(rankings.map((r) => r.goalie)),
  };

  return rankings.map((r, i) => ({
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
}

async function buildSnapshot(): Promise<TeamRankingsSnapshot> {
  const [all, month, week] = await Promise.all([
    buildWindowRows(undefined),
    buildWindowRows(startOfMonth()),
    buildWindowRows(startOfWeek()),
  ]);
  return { all, month, week };
}

export const getTeamRankingsSnapshot = unstable_cache(buildSnapshot, ["team-rankings-snapshot"], {
  revalidate: 60,
  tags: ["rankings"],
});
