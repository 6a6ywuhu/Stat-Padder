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
function regularSeasonExp(seasonId: number): string {
  return encodeURIComponent(`seasonId=${seasonId} and gameTypeId=2`);
}

export async function getSkaterSummary(
  seasonId: number,
  {
    limit = 100,
    start = 0,
    sort = [{ property: "points", direction: "DESC" }, { property: "goals", direction: "DESC" }],
  }: { limit?: number; start?: number; sort?: StatSortKey[] } = {}
) {
  const url = `${STATS_API}/skater/summary?limit=${limit}&start=${start}&sort=${encodeSort(sort)}&cayenneExp=${regularSeasonExp(seasonId)}`;
  const data = await getJson<{ data: NhlSkaterSummaryRow[]; total: number }>(url, 3600);
  return data;
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
