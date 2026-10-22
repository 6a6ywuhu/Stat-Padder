import { prisma } from "./prisma";
import { getCurrentSeasonId, getSkaterSummary } from "./nhl-api";
import { scoreGroupUncached } from "./group-scores";
import { SKATER_POSITIONS } from "./attributes";
import { formatRating } from "./scoring";
import { SOCIAL_TZ } from "./social";

/** Last week's top scorers, ready to render as a card and write as a caption. */
export type WeeklyRow = {
  rank: number;
  firstName: string;
  lastName: string;
  position: string;
  team: string;
  points: number;
  goals: number;
  assists: number;
  gamesPlayed: number;
  /** Community Overall, or null when nobody has rated them yet. */
  overall: number | null;
  /** Stat Padder player id when we know them (used for the portrait). */
  playerId: string | null;
};

export type WeeklyLeaders = {
  /** Monday of the week, "YYYY-MM-DD". */
  weekStart: string;
  /** Sunday of the week, "YYYY-MM-DD". */
  weekEnd: string;
  /** e.g. "OCT 12–18" */
  label: string;
  rows: WeeklyRow[];
};

const DAY = 24 * 3600 * 1000;

function ymdParts(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function addDays(ymd: string, n: number): string {
  const { y, m, d } = ymdParts(ymd);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY).toISOString().slice(0, 10);
}

/** Today's calendar date in Vancouver, "YYYY-MM-DD". */
export function todayInSocialTz(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SOCIAL_TZ }).format(now);
}

/** 0 = Sunday … 6 = Saturday, for a "YYYY-MM-DD" date. */
export function weekdayOf(ymd: string): number {
  const { y, m, d } = ymdParts(ymd);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The Monday that starts the most recent *completed* Mon–Sun week. */
export function lastCompletedWeekStart(now: Date = new Date()): string {
  const today = todayInSocialTz(now);
  const sinceMonday = (weekdayOf(today) + 6) % 7; // Mon=0 … Sun=6
  return addDays(today, -sinceMonday - 7);
}

export function weekEndOf(weekStart: string): string {
  return addDays(weekStart, 6);
}

export function weekLabel(weekStart: string): string {
  const a = ymdParts(weekStart);
  const b = ymdParts(weekEndOf(weekStart));
  const month = (m: number) => new Date(Date.UTC(2000, m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
  return a.m === b.m ? `${month(a.m)} ${a.d}–${b.d}` : `${month(a.m)} ${a.d} – ${month(b.m)} ${b.d}`;
}

/**
 * The week's top five skaters by points (ties broken by goals), with their
 * games played that week and their current community Overall. Returns null
 * when fewer than five skaters played — an off week isn't worth a post.
 */
export async function getWeeklyLeaders(weekStart: string): Promise<WeeklyLeaders | null> {
  const weekEnd = weekEndOf(weekStart);
  const season = await getCurrentSeasonId();
  const { data } = await getSkaterSummary(season, { limit: 5, since: weekStart, until: weekEnd });
  if (data.length < 5) return null;

  const dbPlayers = await prisma.player.findMany({
    where: { nhlId: { in: data.map((r) => r.playerId) } },
    select: { id: true, nhlId: true, firstName: true, lastName: true, position: true },
  });
  const byNhl = new Map(dbPlayers.map((p) => [p.nhlId, p]));

  // One pass over the skater pool gives everyone's Overall; unrated players read as null.
  const pool = await scoreGroupUncached({ kind: "skater", positions: SKATER_POSITIONS });
  const overallById = new Map(pool.map((s) => [s.player.id, s.totalVotes > 0 ? s.overallValue : null]));

  const rows: WeeklyRow[] = data.map((r, i) => {
    const db = byNhl.get(r.playerId);
    const [first, ...rest] = r.skaterFullName.split(" ");
    return {
      rank: i + 1,
      firstName: db?.firstName ?? first,
      lastName: db?.lastName ?? rest.join(" "),
      position: db?.position ?? r.positionCode,
      team: r.teamAbbrevs.split(",").pop()!.trim(),
      points: r.points,
      goals: r.goals,
      assists: r.assists,
      gamesPlayed: r.gamesPlayed,
      overall: db ? overallById.get(db.id) ?? null : null,
      playerId: db?.id ?? null,
    };
  });

  return { weekStart, weekEnd, label: weekLabel(weekStart), rows };
}

export function buildWeeklyCaption(w: WeeklyLeaders): string {
  const lines = w.rows.map((r) => {
    const overall = r.overall === null ? "not rated yet" : `community Overall ${formatRating(r.overall)}`;
    return `${r.rank}. ${r.firstName} ${r.lastName} — ${r.points} PTS in ${r.gamesPlayed} GP (${overall})`;
  });
  return [
    `The NHL's top 5 scorers last week (${w.label.replace("–", "-")}), and how the Stat Padder community rates them:`,
    "",
    ...lines,
    "",
    "Do the ratings match the production? Rate every skill from −100 to +100. No signup needed to start. statpadder.ca (link in bio)",
    "",
    "#NHL #statpadder #NHLrankings #hockey",
  ].join("\n");
}
