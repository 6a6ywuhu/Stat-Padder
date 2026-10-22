import { getCurrentSeasonId, getPlayerLanding, NhlSeasonTotal } from "./nhl-api";
import { getPlayerSnapshot, PlayerSnapshot } from "./social";

/** Everything the two hockey-card slides show: live ratings plus NHL stats and bio. */

export type StatRow = { label: string; team: string; cells: string[]; current: boolean };

export type CardStats = {
  jersey: number | null;
  bio: string[];
  /** Column headings for `StatRow.cells`. */
  columns: string[];
  /** The last few NHL regular seasons (oldest first), then a CAREER row. */
  rows: StatRow[];
  /** Heading for the big numbers: "THIS SEASON", or "LAST SEASON · 25–26" before their first game. */
  featuredLabel: string;
  /** The big numbers under that heading. */
  thisSeason: { label: string; value: string }[];
};

export type CardData = {
  snap: PlayerSnapshot;
  isGoalie: boolean;
  /** Null if the NHL stats service was unreachable. */
  stats: CardStats | null;
};

const SKATER_COLS = ["GP", "G", "A", "P", "+/-"];
const GOALIE_COLS = ["GP", "W", "L", "OTL", "GAA", "SV%"];

function seasonLabel(season: number): string {
  const s = String(season);
  return `${s.slice(2, 4)}–${s.slice(6, 8)}`;
}

function signed(n: number | undefined): string {
  if (n === undefined) return "—";
  return n > 0 ? `+${n}` : String(n);
}

function num(n: number | undefined): string {
  return n === undefined ? "—" : String(n);
}

function gaa(n: number | undefined): string {
  return n === undefined ? "—" : n.toFixed(2);
}

function svp(n: number | undefined): string {
  return n === undefined ? "—" : n.toFixed(3).replace(/^0/, "");
}

function cellsFor(t: Partial<NhlSeasonTotal>, goalie: boolean): string[] {
  return goalie
    ? [num(t.gamesPlayed), num(t.wins), num(t.losses), num(t.otLosses), gaa(t.goalsAgainstAvg), svp(t.savePctg)]
    : [num(t.gamesPlayed), num(t.goals), num(t.assists), num(t.points), signed(t.plusMinus)];
}

function height(inches: number): string {
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

async function loadStats(snap: PlayerSnapshot, isGoalie: boolean): Promise<CardStats | null> {
  try {
    const [landing, season] = await Promise.all([getPlayerLanding(snap.nhlId), getCurrentSeasonId()]);

    const history = (landing.seasonTotals ?? [])
      .filter((t) => t.leagueAbbrev === "NHL" && t.gameTypeId === 2)
      .slice(-4);
    const rows: StatRow[] = history.map((t) => ({
      label: seasonLabel(t.season),
      team: (t.teamCommonName?.default ?? "").toUpperCase(),
      cells: cellsFor(t, isGoalie),
      current: t.season === season,
    }));
    const career = landing.careerTotals?.regularSeason;
    if (career && rows.length) rows.push({ label: "CAREER", team: "NHL", cells: cellsFor(career, isGoalie), current: false });

    const current = landing.featuredStats?.season === season ? landing.featuredStats?.regularSeason?.subSeason : undefined;
    const lastRow = history.length ? history[history.length - 1] : undefined;
    // Before a player's first game of the year, show their most recent season instead of dashes.
    const sub: Partial<NhlSeasonTotal> | undefined = current ?? lastRow;
    const featuredLabel = current || !lastRow ? "THIS SEASON" : `LAST SEASON · ${seasonLabel(lastRow.season)}`;
    const thisSeason = isGoalie
      ? [
          { label: "GP", value: num(sub?.gamesPlayed) },
          { label: "WINS", value: num(sub?.wins) },
          { label: "GAA", value: gaa(sub?.goalsAgainstAvg) },
          { label: "SV%", value: svp(sub?.savePctg) },
        ]
      : [
          { label: "GP", value: num(sub?.gamesPlayed) },
          { label: "GOALS", value: num(sub?.goals) },
          { label: "ASSISTS", value: num(sub?.assists) },
          { label: "POINTS", value: num(sub?.points) },
        ];

    const bio = [
      `HT ${height(landing.heightInInches)}`,
      `WT ${landing.weightInPounds} LB`,
      `${isGoalie ? "CATCHES" : "SHOOTS"} ${landing.shootsCatches ?? "—"}`,
      `BORN ${landing.birthDate.slice(0, 4)} · ${(landing.birthCity?.default ?? "").toUpperCase()}${landing.birthCity ? ", " : ""}${landing.birthCountry}`,
    ];
    if (landing.draftDetails) {
      bio.push(`DRAFT ${landing.draftDetails.year} R${landing.draftDetails.round} #${landing.draftDetails.overallPick}`);
    }

    return {
      jersey: landing.sweaterNumber ?? null,
      bio,
      columns: isGoalie ? GOALIE_COLS : SKATER_COLS,
      rows,
      featuredLabel,
      thisSeason,
    };
  } catch {
    return null;
  }
}

export async function getCardData(playerId: string): Promise<CardData | null> {
  const snap = await getPlayerSnapshot(playerId);
  if (!snap) return null;
  const isGoalie = snap.position === "G";
  return { snap, isGoalie, stats: await loadStats(snap, isGoalie) };
}
