import { prisma } from "./prisma";
import { getPlayerGameLogNow, getClubScheduleSeasonNow } from "./nhl-api";
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
  net: number;
  stats: WeeklyStatLine | null;
};

export type WeeklyTeam = {
  id: string;
  city: string;
  name: string;
  logoLight: string;
  logoDark: string;
  net: number;
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
 * Top movers since Monday, by net upvotes (up − down) across every attribute,
 * each annotated with that player's / team's real on-ice week from the NHL
 * API. Teams sum the net of their own ACTIVE/INJURED roster. Retired players
 * (and their votes) are excluded, matching the rest of the site.
 */
export async function getWeeklyLeaders(): Promise<WeeklyLeaders> {
  const weekStart = startOfWeek();
  const weekStartYmd = ymd(weekStart);

  const rows = await prisma.attributeVote.groupBy({
    by: ["playerId", "value"],
    where: { createdAt: { gte: weekStart } },
    _count: { _all: true },
  });

  const netByPlayer = new Map<string, number>();
  for (const row of rows) {
    const delta = row.value > 0 ? row._count._all : -row._count._all;
    netByPlayer.set(row.playerId, (netByPlayer.get(row.playerId) ?? 0) + delta);
  }

  const voted = await prisma.player.findMany({
    where: { id: { in: [...netByPlayer.keys()] }, status: { in: ["ACTIVE", "INJURED"] } },
    include: { team: true },
  });

  const topPlayers = voted
    .map((p) => ({ player: p, net: netByPlayer.get(p.id) ?? 0 }))
    .filter((x) => x.net > 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, LEADERBOARD_SIZE);

  const netByTeam = new Map<string, number>();
  for (const p of voted) {
    if (!p.teamId) continue;
    netByTeam.set(p.teamId, (netByTeam.get(p.teamId) ?? 0) + (netByPlayer.get(p.id) ?? 0));
  }

  // Unlike players (only risers are worth surfacing), the team board always
  // shows the top 5, even a team sitting at net <= 0 — so the board doesn't
  // shrink to just 2-3 rows on a quiet week. If fewer than 5 teams had any
  // vote activity at all, backfill with other teams (net 0) so it's always
  // a full 5 rows.
  const teamRecords = await prisma.team.findMany({ where: { id: { in: [...netByTeam.keys()] } } });
  let topTeams = teamRecords
    .map((t) => ({ team: t, net: netByTeam.get(t.id) ?? 0 }))
    .sort((a, b) => b.net - a.net)
    .slice(0, LEADERBOARD_SIZE);

  if (topTeams.length < LEADERBOARD_SIZE) {
    const filler = await prisma.team.findMany({
      where: { id: { notIn: topTeams.map((x) => x.team.id) } },
      orderBy: [{ city: "asc" }, { name: "asc" }],
      take: LEADERBOARD_SIZE - topTeams.length,
    });
    topTeams = [...topTeams, ...filler.map((t) => ({ team: t, net: 0 }))];
  }

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
    net: x.net,
    stats: playerStats[i],
  }));

  const teams: WeeklyTeam[] = topTeams.map((x, i) => ({
    id: x.team.id,
    city: x.team.city,
    name: x.team.name,
    logoLight: x.team.logoLight,
    logoDark: x.team.logoDark,
    net: x.net,
    stats: teamStats[i],
  }));

  return { players, teams, weekStart: weekStart.toISOString() };
}
