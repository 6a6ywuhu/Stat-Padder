/**
 * Syncs teams and rosters from the live NHL API into the local database
 * (spec section 12). Safe to re-run: teams/players are upserted by their
 * stable NHL keys, and vote history is untouched because votes reference
 * our internal player.id, not any synced field. Shared by the CLI script
 * (npm run sync) and the admin "sync now" action.
 */
import { Position } from "./db-enums";
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
    teamId: teamAbbrev,
    headshotUrl: p.headshot,
    heightInches: p.heightInInches,
    weightPounds: p.weightInPounds,
    birthDate: p.birthDate,
    birthCountry: p.birthCountry,
  };
  // status is intentionally omitted from `update`: the NHL roster endpoint
  // has no injury data, so an admin-set INJURED status (src/app/admin) must
  // survive a re-sync instead of being reset to ACTIVE every time.
  await prisma.player.upsert({
    where: { nhlId: p.id },
    create: { nhlId: p.id, status: "ACTIVE", ...data },
    update: data,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await sleep(1500 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

const getRosterWithRetry = (abbrev: string) => withRetry(() => getRoster(abbrev, 0));

/** Run `fn` over `items` with at most `concurrency` in flight at once. */
async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export type SyncResult = {
  teamsSynced: number;
  playersSynced: number;
  failedTeams: string[];
};

export async function runSync(onlyAbbrevs: string[] = []): Promise<SyncResult> {
  const filter = onlyAbbrevs.map((a) => a.toUpperCase());
  const standings = await withRetry(() => getStandingsNow(0));
  const abbrevs = Array.from(new Set(standings.map((s) => s.teamAbbrev.default))).filter(
    (a) => filter.length === 0 || filter.includes(a)
  );

  await Promise.all(
    standings
      .filter((team) => filter.length === 0 || filter.includes(team.teamAbbrev.default))
      .map((team) => {
        const abbrev = team.teamAbbrev.default;
        const commonName = team.teamCommonName?.default ?? "";
        const fullName = team.teamName.default;
        // Most teams' placeName is a clean city, but the Islanders and Rangers
        // come through as "NY Islanders" / "NY Rangers". The full team name is
        // reliable ("New York Rangers"), so derive the city by stripping the
        // common name off the end and only fall back to placeName otherwise.
        const city =
          commonName && fullName.endsWith(` ${commonName}`)
            ? fullName.slice(0, -(commonName.length + 1))
            : team.placeName?.default ?? "";
        const name = commonName || fullName.replace(`${city} `, "");
        return upsertTeam(abbrev, name, city, team.conferenceName, team.divisionName);
      })
  );

  let totalPlayers = 0;
  const failedTeams: string[] = [];

  // 6 rosters in flight at once — fast enough to finish inside a serverless
  // function's timeout, gentle enough on the unofficial NHL API.
  await mapPool(abbrevs, 6, async (abbrev) => {
    try {
      const roster = await getRosterWithRetry(abbrev);
      const entries: [NhlRosterPlayer, string][] = [
        ...roster.forwards.map((p) => [p, p.positionCode] as [NhlRosterPlayer, string]),
        ...roster.defensemen.map((p) => [p, "D"] as [NhlRosterPlayer, string]),
        ...roster.goalies.map((p) => [p, "G"] as [NhlRosterPlayer, string]),
      ];
      await Promise.all(entries.map(([p, pos]) => upsertRosterPlayer(p, abbrev, pos)));
      totalPlayers += entries.length;
    } catch {
      failedTeams.push(abbrev);
    }
  });

  return { teamsSynced: abbrevs.length, playersSynced: totalPlayers, failedTeams };
}
