import { unstable_cache } from "next/cache";
import { scoreGroupUncached, PlayerWithTeam } from "./group-scores";
import type { ScoredPlayer, OverallBar, AttributeBar } from "./scoring";
import { SKATER_POSITIONS, AttributeCategory } from "./attributes";
import { startOfWeek, startOfMonth, ymd } from "./time-windows";
import { getCurrentSeasonId, getSkaterSummaryAll } from "./nhl-api";

/**
 * The /rankings page ships one of these window blobs with the (static)
 * page and does all filtering / sorting / paging / search client-side, so
 * the page itself is a CDN edge asset — instant first load anywhere. The
 * default "all-time" window is embedded in the page; month/week are
 * fetched on demand from /api/rankings. Both cache for 60s and are busted
 * on a vote via revalidateTag("rankings").
 *
 * Bars are scaled against the whole skater / goalie pool (not the
 * currently-filtered subset).
 */

export type RankWindow = "all" | "month" | "week";

export type SnapshotPlayer = {
  id: string;
  name: string;
  position: string;
  status: "ACTIVE" | "RETIRED" | "INJURED";
  teamId: string | null;
  headshotUrl: string | null;
  nhlId: number;
  teamCity: string | null;
  overall: OverallBar;
  totalVotes: number;
  categoryBars: Partial<Record<AttributeCategory, OverallBar>>;
  /** Goalies only — their card hover shows per-attribute bars. */
  attributeBars?: Record<string, AttributeBar>;
};

export type WindowStats = Record<number, { goals: number; assists: number; points: number }>;

export type WindowSnapshot = {
  window: RankWindow;
  skaters: SnapshotPlayer[];
  goalies: SnapshotPlayer[];
  stats: WindowStats;
  builtAt: string;
};

function toSnapshotPlayer(s: ScoredPlayer<PlayerWithTeam>, keepAttributeBars = false): SnapshotPlayer {
  return {
    id: s.player.id,
    name: `${s.player.firstName} ${s.player.lastName}`,
    position: s.player.position,
    status: s.player.status,
    teamId: s.player.teamId,
    headshotUrl: s.player.headshotUrl,
    nhlId: s.player.nhlId,
    teamCity: s.player.team?.city ?? null,
    overall: s.overall,
    totalVotes: s.totalVotes,
    categoryBars: s.categoryBars,
    ...(keepAttributeBars ? { attributeBars: s.attributeBars } : {}),
  };
}

/**
 * Only the top slice of each pool ships with the page. The full active
 * roster is ~1250 players; the list shows 25 at a time and nobody scrolls
 * past the voted names into the 0-vote tail, so sending all of them just
 * bloats the payload (and the parse-on-hydrate) for no one. Pre-sorted
 * here with the same key the client uses, so the client can skip re-sorting
 * the default view.
 */
const SNAPSHOT_LIMIT = 250;

function rankSort(a: SnapshotPlayer, b: SnapshotPlayer): number {
  const d = b.overall.value - a.overall.value;
  if (d !== 0) return d;
  const v = b.totalVotes - a.totalVotes;
  if (v !== 0) return v;
  return (a.teamCity ?? "").localeCompare(b.teamCity ?? "");
}

async function buildWindow(w: RankWindow): Promise<WindowSnapshot> {
  const since = w === "week" ? startOfWeek() : w === "month" ? startOfMonth() : undefined;
  const sinceYmd = since ? ymd(since) : undefined;

  const [skatersScored, goaliesScored] = await Promise.all([
    scoreGroupUncached({ kind: "skater", positions: SKATER_POSITIONS }, undefined, { since }),
    scoreGroupUncached({ kind: "goalie" }, undefined, { since }),
  ]);

  const skaters = skatersScored.map((s) => toSnapshotPlayer(s)).sort(rankSort).slice(0, SNAPSHOT_LIMIT);
  const goalies = goaliesScored
    .map((s) => toSnapshotPlayer(s, true))
    .sort(rankSort)
    .slice(0, SNAPSHOT_LIMIT);

  let stats: WindowStats = {};
  try {
    const seasonId = await getCurrentSeasonId();
    const rows = await getSkaterSummaryAll(seasonId, { since: sinceYmd });
    // Only the players that actually made the snapshot need a G/A/P entry.
    const keep = new Set([...skaters, ...goalies].map((p) => p.nhlId));
    stats = Object.fromEntries(
      rows
        .filter((r) => keep.has(r.playerId))
        .map((r) => [r.playerId, { goals: r.goals, assists: r.assists, points: r.points }])
    );
  } catch {
    // best-effort — a failure just hides the G/A/P chip
  }

  return { window: w, skaters, goalies, stats, builtAt: new Date().toISOString() };
}

/** Default window, embedded in the static /rankings page. */
export const getRankingsAll = unstable_cache(() => buildWindow("all"), ["rankings-all"], {
  revalidate: 60,
  tags: ["rankings"],
});

/** month / week — fetched on demand from /api/rankings. */
export const getRankingsMonth = unstable_cache(() => buildWindow("month"), ["rankings-month"], {
  revalidate: 60,
  tags: ["rankings"],
});
export const getRankingsWeek = unstable_cache(() => buildWindow("week"), ["rankings-week"], {
  revalidate: 60,
  tags: ["rankings"],
});

export function getRankingsWindow(w: RankWindow): Promise<WindowSnapshot> {
  return w === "week" ? getRankingsWeek() : w === "month" ? getRankingsMonth() : getRankingsAll();
}
