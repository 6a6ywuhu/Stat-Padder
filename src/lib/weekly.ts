import { prisma } from "./prisma";
import { getPlayerGameLogNow, getClubScheduleSeasonNow } from "./nhl-api";
import { getVoteMapsForPlayers } from "./votes";
import { getTeamRankings } from "./team-scores";
import { overallScore } from "./scoring";
import type { Position } from "./attributes";
import { startOfWeek, ymd } from "./time-windows";

export type WeeklySkaterStats = {
  kind: "skater";
  gp: number;
  goals: number;
  assists: number;
  points: number;
};

export type WeeklyGoalieStats = {
  kind: "goalie";
  gp: number;
  wins: number;
  losses: number; // regulation + OT losses folded together
  /** saves / shots against across the week, or null if the goalie faced no shots. */
  savePct: number | null;
};

export type WeeklyStatLine = WeeklySkaterStats | WeeklyGoalieStats;

export type WeeklyTeamStats = {
  gp: number;
  wins: number;
  losses: number;
  otl: number; // OT / shootout losses — the modern stand-in for a tie
};

export type WeeklyPlayer = {
  id: string;
  name: string;
  position: string;
  teamAbbrev: string | null;
  headshotUrl: string | null;
  /** how much this player's overall rating rose since Monday, in rating points */
  delta: number;
  stats: WeeklyStatLine | null;
};

export type WeeklyTeam = {
  id: string;
  city: string;
  name: string;
  logoLight: string;
  logoDark: string;
  /** The team's community Overall rating (same figure as /team-rankings). */
  overall: number | null;
  stats: WeeklyTeamStats | null;
};

export type WeeklyLeaders = {
  players: WeeklyPlayer[];
  teams: WeeklyTeam[];
  /** Start of the current calendar week (Monday 00:00, server local time). */
  weekStart: string;
};

const LEADERBOARD_SIZE = 5;

/** Sum a player's on-ice production for games played since Monday. */
async function weeklyPlayerStats(
  nhlId: number,
  position: string,
  weekStartYmd: string
): Promise<WeeklyStatLine | null> {
  try {
    const { gameLog } = await getPlayerGameLogNow(nhlId);
    const week = gameLog.filter((g) => g.gameDate >= weekStartYmd);

    if (position === "G") {
      let saves = 0;
      let shotsAgainst = 0;
      let wins = 0;
      let losses = 0;
      for (const g of week) {
        shotsAgainst += g.shotsAgainst ?? 0;
        saves += (g.shotsAgainst ?? 0) - (g.goalsAgainst ?? 0);
        if (g.decision === "W") wins++;
        else if (g.decision === "L" || g.decision === "O") losses++;
      }
      return {
        kind: "goalie",
        gp: week.length,
        wins,
        losses,
        savePct: shotsAgainst > 0 ? saves / shotsAgainst : null,
      };
    }

    return {
      kind: "skater",
      gp: week.length,
      goals: week.reduce((s, g) => s + (g.goals ?? 0), 0),
      assists: week.reduce((s, g) => s + (g.assists ?? 0), 0),
      points: week.reduce((s, g) => s + (g.points ?? 0), 0),
    };
  } catch {
    return null;
  }
}

/** A team's completed-game record since Monday. */
async function weeklyTeamStats(abbrev: string, weekStartYmd: string): Promise<WeeklyTeamStats | null> {
  try {
    const { games } = await getClubScheduleSeasonNow(abbrev);
    let wins = 0;
    let losses = 0;
    let otl = 0;
    for (const g of games) {
      if (g.gameDate < weekStartYmd) continue;
      if (g.gameType !== 2 && g.gameType !== 3) continue;
      if (g.gameState !== "OFF" && g.gameState !== "FINAL") continue;
      const home = g.homeTeam.abbrev === abbrev;
      const us = home ? g.homeTeam.score : g.awayTeam.score;
      const them = home ? g.awayTeam.score : g.homeTeam.score;
      if (us == null || them == null) continue;
      if (us > them) wins++;
      else if (g.gameOutcome?.lastPeriodType === "OT" || g.gameOutcome?.lastPeriodType === "SO") otl++;
      else losses++;
    }
    return { gp: wins + losses + otl, wins, losses, otl };
  } catch {
    return null;
  }
}

/**
 * Home-page boards:
 *  - players: biggest risers since Monday — `delta` is how much the
 *    community's Overall for that player has climbed since the week's
 *    start, `overall(now) − overall(as of Monday 00:00)`.
 *  - teams: the top teams by current community Overall rating.
 * Both are annotated with the real on-ice week from the NHL API.
 * Retired players are excluded, matching the rest of the site.
 *
 * Uncached on purpose — it reads votes straight from the DB so the home
 * page's own `revalidate` is the only thing bounding how often it runs.
 * The NHL stat lookups inside keep their own fetch cache.
 */
export async function getWeeklyLeaders(): Promise<WeeklyLeaders> {
  const weekStart = startOfWeek();
  const weekStartYmd = ymd(weekStart);

  // Only players that got at least one new rating this week can have moved.
  const touched = await prisma.attributeVote.groupBy({
    by: ["playerId"],
    where: { createdAt: { gte: weekStart } },
  });
  const touchedIds = touched.map((r) => r.playerId);

  const voted = await prisma.player.findMany({
    where: { id: { in: touchedIds }, status: { in: ["ACTIVE", "INJURED"] } },
    include: { team: true },
  });
  const ids = voted.map((p) => p.id);

  const [nowMaps, priorMaps] = await Promise.all([
    getVoteMapsForPlayers(ids),
    getVoteMapsForPlayers(ids, { before: weekStart }),
  ]);

  const deltaByPlayer = new Map<string, number>();
  for (const p of voted) {
    const now = overallScore(nowMaps[p.id] ?? {}, p.position as Position);
    const prior = overallScore(priorMaps[p.id] ?? {}, p.position as Position);
    deltaByPlayer.set(p.id, now - prior);
  }

  const topPlayers = voted
    .map((p) => ({ player: p, delta: deltaByPlayer.get(p.id) ?? 0 }))
    .filter((x) => x.delta > 0.05)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, LEADERBOARD_SIZE);

  // Team board = the top teams by community Overall rating (the same
  // figure the /team-rankings page shows), highest first.
  const topTeams = (await getTeamRankings())
    .slice()
    .sort((a, b) => (b.overall ?? -Infinity) - (a.overall ?? -Infinity))
    .slice(0, LEADERBOARD_SIZE)
    .map((r) => ({ team: r.team, overall: r.overall }));

  const [playerStats, teamStats] = await Promise.all([
    Promise.all(topPlayers.map((x) => weeklyPlayerStats(x.player.nhlId, x.player.position, weekStartYmd))),
    Promise.all(topTeams.map((x) => weeklyTeamStats(x.team.id, weekStartYmd))),
  ]);

  const players: WeeklyPlayer[] = topPlayers.map((x, i) => ({
    id: x.player.id,
    name: `${x.player.firstName} ${x.player.lastName}`,
    position: x.player.position,
    teamAbbrev: x.player.team?.id ?? null,
    headshotUrl: x.player.headshotUrl,
    delta: x.delta,
    stats: playerStats[i],
  }));

  const teams: WeeklyTeam[] = topTeams.map((x, i) => ({
    id: x.team.id,
    city: x.team.city,
    name: x.team.name,
    logoLight: x.team.logoLight,
    logoDark: x.team.logoDark,
    overall: x.overall,
    stats: teamStats[i],
  }));

  return { players, teams, weekStart: weekStart.toISOString() };
}
