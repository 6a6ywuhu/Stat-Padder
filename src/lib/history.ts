import { prisma } from "./prisma";
import { attributesForPosition, isBoosterAttribute, Position } from "./attributes";
import { getScoredGroup, GroupSelector, PlayerWithTeam } from "./group-scores";
import { ScoredPlayer } from "./scoring";

export type Granularity = "day" | "month" | "year";

export type HistorySeries = "overall" | string; // "overall" or an attribute key

export type HistoryPoint = { bucket: string; value: number };

function bucketKey(date: Date, granularity: Granularity): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (granularity === "year") return `${y}`;
  if (granularity === "month") return `${y}-${m}`;
  return `${y}-${m}-${d}`;
}

/**
 * Cumulative-net history for one player, either a single attribute or
 * "overall" (the running average of that position's 6 core attributes —
 * boosters never factor in, same rule as the live Overall score). One
 * point per bucket that actually saw a vote; no gap-filling between them.
 */
export async function getPlayerHistory(
  playerId: string,
  position: Position,
  series: HistorySeries,
  granularity: Granularity
): Promise<HistoryPoint[]> {
  const isOverall = series === "overall";
  const coreAttrs = attributesForPosition(position);
  const attrsToFetch = isOverall ? coreAttrs : [series];

  const votes = await prisma.attributeVote.findMany({
    where: { playerId, attribute: { in: attrsToFetch } },
    select: { attribute: true, value: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (votes.length === 0) return [];

  const runningNet = new Map<string, number>();
  for (const a of attrsToFetch) runningNet.set(a, 0);

  const byBucket = new Map<string, number>();

  for (const vote of votes) {
    runningNet.set(vote.attribute, (runningNet.get(vote.attribute) ?? 0) + vote.value);

    const value = isOverall
      ? coreAttrs.reduce((sum, a) => sum + (runningNet.get(a) ?? 0), 0) / coreAttrs.length
      : (runningNet.get(series) ?? 0);

    byBucket.set(bucketKey(vote.createdAt, granularity), value);
  }

  return Array.from(byBucket.entries())
    .map(([bucket, value]) => ({ bucket, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

export function isValidHistorySeries(series: string, position: Position): boolean {
  if (series === "overall") return true;
  return attributesForPosition(position).includes(series as never) || isBoosterAttribute(series);
}

// Categorical palette for comparing multiple players on one chart — kept
// clear of the site's semantic pure-red/pure-green (those mean
// negative/positive elsewhere, not "which player is this line").
const CHART_PALETTE = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#f97316", // orange
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#8b5cf6", // violet
  "#d946ef", // fuchsia
];

export type MultiPlayerSeries = {
  playerId: string;
  name: string;
  color: string;
  points: (number | null)[];
};

export type MultiPlayerHistory = {
  buckets: string[];
  series: MultiPlayerSeries[];
};

function valueForRanking(s: ScoredPlayer<PlayerWithTeam>, series: HistorySeries): number {
  if (series === "overall") return s.overallValue;
  return s.attributeBars[series]?.net ?? s.boosterBars[series]?.net ?? 0;
}

/**
 * Ranks the current comparison group by the chosen series (Overall or one
 * attribute), takes the top N, and fetches each of their histories on the
 * same bucket timeline — forward-filling between a player's own votes so
 * the lines are comparable, but never before their first vote (gaps stay
 * gaps, they aren't invented as zero).
 */
export async function getTopPlayersHistory(
  selector: GroupSelector,
  series: HistorySeries,
  granularity: Granularity,
  limit = 10
): Promise<MultiPlayerHistory> {
  const scored = await getScoredGroup(selector);
  if (scored.length === 0) return { buckets: [], series: [] };

  const top = [...scored]
    .sort((a, b) => valueForRanking(b, series) - valueForRanking(a, series) || b.totalVotes - a.totalVotes)
    .slice(0, limit);

  const perPlayerHistory = await Promise.all(
    top.map((s) => getPlayerHistory(s.player.id, s.position, series, granularity))
  );

  const bucketSet = new Set<string>();
  for (const history of perPlayerHistory) for (const point of history) bucketSet.add(point.bucket);
  const buckets = Array.from(bucketSet).sort();

  const chartSeries: MultiPlayerSeries[] = top.map((s, i) => {
    const historyByBucket = new Map(perPlayerHistory[i].map((p) => [p.bucket, p.value]));
    let last: number | null = null;
    const points = buckets.map((bucket) => {
      if (historyByBucket.has(bucket)) last = historyByBucket.get(bucket)!;
      return last;
    });
    return {
      playerId: s.player.id,
      name: `${s.player.firstName} ${s.player.lastName}`,
      color: CHART_PALETTE[i % CHART_PALETTE.length],
      points,
    };
  });

  return { buckets, series: chartSeries };
}
