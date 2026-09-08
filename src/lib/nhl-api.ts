/**
 * Thin client for the unofficial NHL Web API and Stats API (spec section
 * 12/13). These are undocumented public endpoints with no rate-limit
 * guarantees, so every call here supports an opt-in Next.js revalidate
 * window and callers should prefer the cached DB copy over calling these
 * directly from a page.
 */

const WEB_API = "https://api-web.nhle.com/v1";
const STATS_API = "https://api.nhle.com/stats/rest/en";

async function getJson<T>(url: string, revalidateSeconds?: number): Promise<T> {
  const res = await fetch(url, {
    ...(revalidateSeconds !== undefined
      ? { next: { revalidate: revalidateSeconds } }
      : {}),
  });
  if (!res.ok) {
    throw new Error(`NHL API request failed (${res.status}): ${url}`);
  }
  return res.json() as Promise<T>;
}

export type NhlStandingsTeam = {
  teamAbbrev: { default: string };
  teamName: { default: string };
  teamCommonName?: { default: string };
  placeName?: { default: string };
  conferenceName: string;
  divisionName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  /** The NHL's own standings position within each scope — already tiebroken. */
  leagueSequence: number;
  conferenceSequence: number;
  divisionSequence: number;
  streakCode?: string; // "W" | "L" | "OT"
  streakCount?: number;
  l10Wins?: number;
  l10Losses?: number;
  l10OtLosses?: number;
};

export async function getStandingsNow(revalidateSeconds = 3600) {
  const data = await getJson<{ standings: NhlStandingsTeam[] }>(
    `${WEB_API}/standings/now`,
    revalidateSeconds
  );
  return data.standings;
}

export type NhlSeason = {
  id: number;
  standingsStart: string;
  standingsEnd: string;
};

export async function getSeasons(revalidateSeconds = 86400) {
  const data = await getJson<{ seasons: NhlSeason[]; currentDate: string }>(
    `${WEB_API}/standings-season`,
    revalidateSeconds
  );
  return data;
}

/**
 * Auto-detects the "current" season id (spec section 8: "auto-detecting
 * the current season rather than hardcoding a season ID"). If today falls
 * within a season's window, use that season; otherwise (off-season) fall
 * back to the most recently completed season so stats pages aren't empty.
 */
export async function getCurrentSeasonId(): Promise<number> {
  const { seasons, currentDate } = await getSeasons();
  const today = new Date(currentDate);

  const inProgress = seasons.find((s) => {
    const start = new Date(s.standingsStart);
    const end = new Date(s.standingsEnd);
    return today >= start && today <= end;
  });
  if (inProgress) return inProgress.id;

  const completed = seasons
    .filter((s) => new Date(s.standingsEnd) <= today)
    .sort((a, b) => new Date(b.standingsEnd).getTime() - new Date(a.standingsEnd).getTime());
  if (completed.length) return completed[0].id;

  // Fallback: latest known season id.
  return Math.max(...seasons.map((s) => s.id));
}

export type NhlRosterPlayer = {
  id: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
  positionCode: string;
  heightInInches: number;
  weightInPounds: number;
  birthDate: string;
  birthCountry: string;
};

export type NhlRoster = {
  forwards: NhlRosterPlayer[];
  defensemen: NhlRosterPlayer[];
  goalies: NhlRosterPlayer[];
};

export async function getRoster(teamAbbrev: string, revalidateSeconds = 21600) {
  return getJson<NhlRoster>(`${WEB_API}/roster/${teamAbbrev}/current`, revalidateSeconds);
}

export type NhlSkaterSubSeason = {
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  shots: number;
  shootingPctg: number;
};

export type NhlGoalieSubSeason = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAvg: number;
  savePctg: number;
  shutouts: number;
};

export type NhlPlayerLanding = {
  playerId: number;
  isActive: boolean;
  currentTeamAbbrev?: string;
  position: string;
  headshot: string;
  sweaterNumber?: number;
  heightInInches: number;
  weightInPounds: number;
  birthDate: string;
  birthCountry: string;
  featuredStats?: {
    season: number;
    regularSeason?: { subSeason?: Partial<NhlSkaterSubSeason & NhlGoalieSubSeason> };
  };
};

export async function getPlayerLanding(nhlId: number, revalidateSeconds = 3600) {
  return getJson<NhlPlayerLanding>(`${WEB_API}/player/${nhlId}/landing`, revalidateSeconds);
}

export type NhlSkaterSummaryRow = {
  playerId: number;
  skaterFullName: string;
  positionCode: string;
  teamAbbrevs: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  penaltyMinutes: number;
  shots: number;
  shootingPct: number;
  timeOnIcePerGame: number;
};

export type StatSortKey = { property: string; direction: "ASC" | "DESC" };

/**
 * The stats REST API ignores a plain `sort=property` value (it silently
 * returns results in an unspecified order) — it only sorts when `sort` is a
 * JSON-encoded array of {property, direction} objects.
 */
function encodeSort(sort: StatSortKey[]): string {
  return encodeURIComponent(JSON.stringify(sort));
}

// gameTypeId=2 restricts to regular-season games. Without it the API
// silently combines regular season + playoff rows into one, which inflates
// gamesPlayed (and every counting stat) well past the ~82-game season max
// for teams with deep playoff runs.
// `since` ("YYYY-MM-DD") narrows the aggregate to games on or after that date —
// the stats API honours `gameDate` inside the cayenne expression, so week/month
// point totals come back in one query instead of per-player game logs.
function regularSeasonExp(seasonId: number, since?: string): string {
  const base = `seasonId=${seasonId} and gameTypeId=2`;
  return encodeURIComponent(since ? `${base} and gameDate>="${since}"` : base);
}

export async function getSkaterSummary(
  seasonId: number,
  {
    limit = 100,
    start = 0,
    since,
    sort = [{ property: "points", direction: "DESC" }, { property: "goals", direction: "DESC" }],
  }: { limit?: number; start?: number; since?: string; sort?: StatSortKey[] } = {}
) {
  const url = `${STATS_API}/skater/summary?limit=${limit}&start=${start}&sort=${encodeSort(sort)}&cayenneExp=${regularSeasonExp(seasonId, since)}`;
  const data = await getJson<{ data: NhlSkaterSummaryRow[]; total: number }>(url, 3600);
  return data;
}

/** Every skater's summary row (the API caps each page at 100), optionally windowed by `since`. */
export async function getSkaterSummaryAll(
  seasonId: number,
  { since }: { since?: string } = {}
): Promise<NhlSkaterSummaryRow[]> {
  // Page 1 tells us the row count; fetch the rest concurrently rather than
  // walking ~13 pages one blocking request at a time.
  const first = await getSkaterSummary(seasonId, { limit: 100, start: 0, since });
  const total = Math.min(first.total ?? first.data.length, 2000);
  if (total <= 100) return first.data;

  const starts: number[] = [];
  for (let start = 100; start < total; start += 100) starts.push(start);
  const pages = await Promise.all(
    starts.map((start) => getSkaterSummary(seasonId, { limit: 100, start, since }))
  );
  return [first.data, ...pages.map((p) => p.data)].flat();
}

export type NhlGoalieSummaryRow = {
  playerId: number;
  goalieFullName: string;
  teamAbbrevs: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  goalsAgainstAverage: number;
  savePct: number;
  shutouts: number;
};

export async function getGoalieSummary(
  seasonId: number,
  {
    limit = 100,
    start = 0,
    sort = [{ property: "wins", direction: "DESC" }],
  }: { limit?: number; start?: number; sort?: StatSortKey[] } = {}
) {
  const url = `${STATS_API}/goalie/summary?limit=${limit}&start=${start}&sort=${encodeSort(sort)}&cayenneExp=${regularSeasonExp(seasonId)}`;
  const data = await getJson<{ data: NhlGoalieSummaryRow[]; total: number }>(url, 3600);
  return data;
}

/**
 * One row per game the player appeared in, current season. Skater rows carry
 * goals/assists/points; goalie rows carry decision + shots/goals against.
 * Used to slice out "this week" totals for the home-page leaderboards.
 */
export type NhlPlayerGameLogEntry = {
  gameId: number;
  gameDate: string; // "YYYY-MM-DD"
  teamAbbrev: string;
  homeRoadFlag: "H" | "R";
  opponentAbbrev: string;
  // skater
  goals?: number;
  assists?: number;
  points?: number;
  shots?: number;
  // goalie
  gamesStarted?: number;
  decision?: "W" | "L" | "O" | null;
  shotsAgainst?: number;
  goalsAgainst?: number;
  savePctg?: number;
  shutouts?: number;
};

export async function getPlayerGameLogNow(nhlId: number, revalidateSeconds = 1800) {
  const data = await getJson<{ seasonId: number; gameTypeId: number; gameLog: NhlPlayerGameLogEntry[] }>(
    `${WEB_API}/player/${nhlId}/game-log/now`,
    revalidateSeconds
  );
  return data;
}

export type NhlScheduleGame = {
  id: number;
  gameDate: string; // "YYYY-MM-DD"
  gameType: number; // 2 = regular season, 3 = playoffs
  gameState: string; // "OFF" | "FINAL" | "FUT" | "LIVE" | ...
  homeTeam: { abbrev: string; score?: number };
  awayTeam: { abbrev: string; score?: number };
  gameOutcome?: { lastPeriodType: "REG" | "OT" | "SO" };
};

export async function getClubScheduleSeasonNow(teamAbbrev: string, revalidateSeconds = 1800) {
  const data = await getJson<{ games: NhlScheduleGame[] }>(
    `${WEB_API}/club-schedule-season/${teamAbbrev}/now`,
    revalidateSeconds
  );
  return data;
}
