import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { getVoteMapsForPlayers } from "./votes";
import { categoryScore, directionAndPct, meanScore, Direction, PlayerVoteMap } from "./scoring";
import { ATTRIBUTE_CATEGORIES, GOALIE_ATTRIBUTES, Position, SkaterAttribute } from "./attributes";
import type { Team } from "@prisma/client";

const cat = (key: "general" | "offense" | "defense"): SkaterAttribute[] =>
  ATTRIBUTE_CATEGORIES.find((c) => c.key === key)!.attributes;

const GENERAL_ATTRS = cat("general"); // mobility, sense, strength
const OFFENSE_ATTRS = cat("offense"); // control, shooting, playmaking
const DEFENSE_ATTRS = cat("defense"); // anticipation, disruption, coverage

/** How many players feed each team-level category score. */
export const TOP_SKATERS = 15;
export const TOP_GOALIES = 2;

/** Team Overall is a weighted blend of the three category scores. When a
 *  category has no players (e.g. no goalies), its weight is dropped and
 *  the rest are renormalised, so a partial team still scores on the same
 *  scale (and is flagged `incomplete`). */
export const OVERALL_WEIGHTS = { offense: 0.4, defense: 0.4, goalie: 0.2 } as const;

export type Contributor = { id: string; name: string; position: Position; value: number };

export type TeamRanking = {
  team: Team;
  offense: number | null;
  defense: number | null;
  goalie: number | null;
  overall: number | null;
  /** true when one of offense/defense/goalie has no players to average (so Overall is a partial mean). */
  incomplete: boolean;
  topOffense: Contributor[];
  topDefense: Contributor[];
  topGoalies: Contributor[];
};

// --- Step 1: per-player composites (raw net-vote averages, no group scaling) ---

/** average(Mobility, Sense, Strength) */
const playerGeneral = (vm: PlayerVoteMap) => categoryScore(vm, GENERAL_ATTRS);

/** average(General Score, average(the 3 offensive stats)) — General is 50%, the trio is 50%. */
const playerOffenseComposite = (vm: PlayerVoteMap) =>
  (playerGeneral(vm) + categoryScore(vm, OFFENSE_ATTRS)) / 2;

/** Same shape as offense, with the defensive trio. */
const playerDefenseComposite = (vm: PlayerVoteMap) =>
  (playerGeneral(vm) + categoryScore(vm, DEFENSE_ATTRS)) / 2;

/** average(all 6 goalie stats) — no General blend; goalies have their own pool. */
const playerGoalieComposite = (vm: PlayerVoteMap) => {
  const total = GOALIE_ATTRIBUTES.reduce((sum, a) => sum + meanScore(vm[a]), 0);
  return GOALIE_ATTRIBUTES.length ? total / GOALIE_ATTRIBUTES.length : 0;
};

const mean = (nums: number[]): number | null =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

/**
 * Scores every team per the Team Rankings spec:
 *   Team Offense/Defense = mean of the team's top-{TOP_SKATERS} skaters by that
 *     composite (the two lists are independent — a player can be in both).
 *   Team Goalie = mean of the top-{TOP_GOALIES} goalie composites.
 *   Team Overall = weighted blend of those three (see OVERALL_WEIGHTS:
 *     offense 40%, defense 40%, goalie 20%). Missing a category (e.g. no
 *     goalies) => `incomplete` and the remaining weights are renormalised
 *     rather than scoring the gap as a 0.
 * Only ACTIVE/INJURED players count, matching the rest of the site. Pass
 * `since` to score off votes cast in that window only (week/month views),
 * or `before` to score the ratings as they stood at a past moment.
 */
export async function computeTeamRankings(
  opts: { since?: Date; before?: Date } = {}
): Promise<TeamRanking[]> {
  const [teams, players] = await Promise.all([
    prisma.team.findMany(),
    prisma.player.findMany({
      where: { status: { in: ["ACTIVE", "INJURED"] }, teamId: { not: null } },
      select: { id: true, firstName: true, lastName: true, position: true, teamId: true },
    }),
  ]);

  const voteMaps = await getVoteMapsForPlayers(players.map((p) => p.id), {
    since: opts.since,
    before: opts.before,
  });

  const rosters = new Map<string, typeof players>();
  for (const p of players) {
    const list = rosters.get(p.teamId!) ?? [];
    list.push(p);
    rosters.set(p.teamId!, list);
  }

  return teams.map((team) => {
    const roster = rosters.get(team.id) ?? [];
    const contributor = (p: (typeof players)[number], value: number): Contributor => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      position: p.position as Position,
      value,
    });

    const skaters = roster.filter((p) => p.position !== "G");
    const goalies = roster.filter((p) => p.position === "G");

    const byValueDesc = (a: Contributor, b: Contributor) => b.value - a.value;
    const rankedOffense = skaters
      .map((p) => contributor(p, playerOffenseComposite(voteMaps[p.id] ?? {})))
      .sort(byValueDesc);
    const rankedDefense = skaters
      .map((p) => contributor(p, playerDefenseComposite(voteMaps[p.id] ?? {})))
      .sort(byValueDesc);
    const rankedGoalies = goalies
      .map((p) => contributor(p, playerGoalieComposite(voteMaps[p.id] ?? {})))
      .sort(byValueDesc);

    const topOffense = rankedOffense.slice(0, TOP_SKATERS);
    const topDefense = rankedDefense.slice(0, TOP_SKATERS);
    const topGoalies = rankedGoalies.slice(0, TOP_GOALIES);

    const offense = mean(topOffense.map((c) => c.value));
    const defense = mean(topDefense.map((c) => c.value));
    const goalie = mean(topGoalies.map((c) => c.value));

    const weighted: [value: number, weight: number][] = [
      offense !== null ? [offense, OVERALL_WEIGHTS.offense] : null,
      defense !== null ? [defense, OVERALL_WEIGHTS.defense] : null,
      goalie !== null ? [goalie, OVERALL_WEIGHTS.goalie] : null,
    ].filter((p): p is [number, number] => p !== null);
    const weightSum = weighted.reduce((s, [, w]) => s + w, 0);
    const overall = weightSum
      ? weighted.reduce((s, [v, w]) => s + v * w, 0) / weightSum
      : null;

    return {
      team,
      offense,
      defense,
      goalie,
      overall,
      incomplete: offense === null || defense === null || goalie === null,
      topOffense,
      topDefense,
      topGoalies,
    };
  });
}

/**
 * Cached wrapper — same reasoning as getScoredGroup. Scoring every team
 * from the whole player pool is identical for all visitors in a given
 * window; memoise it for 90s rather than per-request.
 */
export const getTeamRankings: typeof computeTeamRankings = unstable_cache(
  computeTeamRankings,
  ["team-rankings"],
  { revalidate: 90 }
);

/**
 * Direction + fill percentage for one score column, scaled to that column's
 * own range across every team (same convention as the player rankings bars).
 */
export function columnBars(values: (number | null)[]): { direction: Direction; pct: number }[] {
  return values.map((v) => (v === null ? { direction: "zero", pct: 0 } : directionAndPct(v)));
}
