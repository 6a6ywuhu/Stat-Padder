import { prisma } from "./prisma";
import { attributesForPosition, isBoosterAttribute, Position } from "./attributes";

export type Granularity = "day" | "week" | "month";

export type HistorySeries = "overall" | string; // "overall" or an attribute key

export type HistoryPoint = { bucket: string; value: number };

function bucketKey(date: Date, granularity: Granularity): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (granularity === "month") return `${y}-${m}`;
  if (granularity === "week") return isoWeekKey(date);
  return `${y}-${m}-${d}`;
}

/** ISO-8601 week key, e.g. "2026-W35" — weeks start Monday; week 1 holds the year's first Thursday. */
function isoWeekKey(date: Date): string {
  const thursday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  thursday.setDate(thursday.getDate() - ((thursday.getDay() + 6) % 7) + 3); // Thursday of this week
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
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
