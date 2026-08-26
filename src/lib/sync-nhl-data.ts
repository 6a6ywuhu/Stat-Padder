/**
 * Syncs teams and rosters from the live NHL API into the local database
 * (spec section 12). Safe to re-run: teams/players are upserted by their
 * stable NHL keys, and vote history is untouched because votes reference
 * our internal player.id, not any synced field. Shared by the CLI script
 * (npm run sync) and the admin "sync now" action.
 */
import { Position } from "@prisma/client";
import { prisma } from "./prisma";
import { getStandingsNow, getRoster, NhlRosterPlayer } from "./nhl-api";
import { TEAM_COLORS, teamLogoUrl } from "@/data/team-colors";

function mapPosition(code: string): Position {
  return ({ C: "C", L: "LW", R: "RW", D: "D", G: "G" } as Record<string, Position>)[code] ?? "C";
}

async function upsertTeam(abbrev: string, name: string, city: string, conference: string, division: string) {
  const colors = TEAM_COLORS[abbrev] ?? { primary: "#6B7280", secondary: "#374151" };
  const data = {
    name,
    city,
    conference,
    division,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    logoLight: teamLogoUrl(abbrev, "light"),
    logoDark: teamLogoUrl(abbrev, "dark"),
  };
  await prisma.team.upsert({ where: { id: abbrev }, create: { id: abbrev, ...data }, update: data });
}

async function upsertRosterPlayer(p: NhlRosterPlayer, teamAbbrev: string, positionCode: string) {
  const data = {
    firstName: p.firstName.default,
    lastName: p.lastName.default,
    position: mapPosition(positionCode),
    status: "ACTIVE" as const,
    teamId: teamAbbrev,
    headshotUrl: p.headshot,
    heightInches: p.heightInInches,
    weightPounds: p.weightInPounds,
    birthDate: p.birthDate,
    birthCountry: p.birthCountry,
  };
  await prisma.player.upsert({ where: { nhlId: p.id }, create: { nhlId: p.id, ...data }, update: data });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getRosterWithRetry(abbrev: string, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await getRoster(abbrev, 0);
    } catch (err) {
      if (i === attempts - 1) throw err;
      await sleep(1500 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

export type SyncResult = {
  teamsSynced: number;
  playersSynced: number;
  failedTeams: string[];
};

export async function runSync(onlyAbbrevs: string[] = []): Promise<SyncResult> {
  const filter = onlyAbbrevs.map((a) => a.toUpperCase());
  const standings = await getStandingsNow(0);
  const abbrevs = Array.from(new Set(standings.map((s) => s.teamAbbrev.default))).filter(
    (a) => filter.length === 0 || filter.includes(a)
  );

  for (const team of standings) {
    const abbrev = team.teamAbbrev.default;
    if (filter.length > 0 && !filter.includes(abbrev)) continue;
    const city = team.placeName?.default ?? "";
    const name = team.teamCommonName?.default ?? team.teamName.default.replace(`${city} `, "");
    await upsertTeam(abbrev, name, city, team.conferenceName, team.divisionName);
  }

  let totalPlayers = 0;
  const failedTeams: string[] = [];
  for (const abbrev of abbrevs) {
    try {
      const roster = await getRosterWithRetry(abbrev);
      for (const p of roster.forwards) {
        await upsertRosterPlayer(p, abbrev, p.positionCode);
        totalPlayers++;
      }
      for (const p of roster.defensemen) {
        await upsertRosterPlayer(p, abbrev, "D");
        totalPlayers++;
      }
      for (const p of roster.goalies) {
        await upsertRosterPlayer(p, abbrev, "G");
        totalPlayers++;
      }
    } catch {
      failedTeams.push(abbrev);
    }
    await sleep(300);
  }

  return { teamsSynced: abbrevs.length, playersSynced: totalPlayers, failedTeams };
}
