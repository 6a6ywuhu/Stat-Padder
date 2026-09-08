import {
  Attribute,
  attributesForPosition,
  AttributeCategory,
  ATTRIBUTE_CATEGORIES,
  BOOSTER_ATTRIBUTES,
  isGoaliePosition,
  Position,
} from "./attributes";

/**
 * Per-attribute vote tally. Every live vote carries a value in −100 … +100
 * (one voter's rating); the displayed score is the plain mean `sum / total`
 * (0 when nobody has voted). `pos` / `neg` are just the sign counts, kept
 * for the caption under each bar.
 */
export type VoteCounts = { pos: number; neg: number; sum: number; total: number };
export type PlayerVoteMap = Record<string, VoteCounts>; // keyed by attribute

export const EMPTY_COUNTS: VoteCounts = { pos: 0, neg: 0, sum: 0, total: 0 };

export function emptyVoteMap(attributes: Attribute[]): PlayerVoteMap {
  const map: PlayerVoteMap = {};
  for (const a of attributes) map[a] = { ...EMPTY_COUNTS };
  return map;
}

export type Direction = "positive" | "negative" | "zero";

/** Votes and every derived score live on this scale; a mean of ±100 fills
 *  the bar. */
export const RATING_SCALE = 100;

/** Mean vote value for one attribute, in [−100, 100]. */
export function meanScore(counts: VoteCounts | undefined): number {
  if (!counts || counts.total === 0) return 0;
  return counts.sum / counts.total;
}

/** Total votes cast across every attribute in the map. */
export function totalVotes(voteMap: PlayerVoteMap): number {
  return Object.values(voteMap).reduce((sum, c) => sum + c.total, 0);
}

/** Overall = mean of the position's attribute means, in [−100, 100]. */
export function overallScore(voteMap: PlayerVoteMap, position: Position): number {
  const attrs = attributesForPosition(position);
  const total = attrs.reduce((sum, a) => sum + meanScore(voteMap[a]), 0);
  return attrs.length ? total / attrs.length : 0;
}

/** A skater category's score (General/Offense/Defense) = mean of that
 *  category's 3 attribute means. */
export function categoryScore(voteMap: PlayerVoteMap, attrs: Attribute[]): number {
  if (attrs.length === 0) return 0;
  const total = attrs.reduce((sum, a) => sum + meanScore(voteMap[a]), 0);
  return total / attrs.length;
}

/** Mean of the booster (Potential/Leadership) means. */
export function boosterScore(voteMap: PlayerVoteMap): number {
  const total = BOOSTER_ATTRIBUTES.reduce((sum, b) => sum + meanScore(voteMap[b]), 0);
  return BOOSTER_ATTRIBUTES.length ? total / BOOSTER_ATTRIBUTES.length : 0;
}

export type AttributeBar = {
  direction: Direction;
  pct: number; // 0-100, = |mean| capped at RATING_SCALE
  positiveVotes: number;
  negativeVotes: number;
  votes: number;
  net: number; // the mean vote value, −100 … +100 (name kept for callers)
};

export type OverallBar = {
  direction: Direction;
  pct: number; // 0-100
  value: number; // −100 … +100
};

/** Maps a score in [−RATING_SCALE, RATING_SCALE] to a direction + an
 *  absolute bar width — no longer relative to the rest of the group. */
export function directionAndPct(value: number): { direction: Direction; pct: number } {
  const pct = Math.max(0, Math.min(100, Math.round((Math.abs(value) / RATING_SCALE) * 1000) / 10));
  if (value > 0) return { direction: "positive", pct };
  if (value < 0) return { direction: "negative", pct };
  return { direction: "zero", pct: 0 };
}

export type ScoredPlayer<T> = {
  player: T;
  position: Position;
  attributeBars: Record<string, AttributeBar>;
  /** Potential/Leadership — universal, never part of Overall. */
  boosterBars: Record<string, AttributeBar>;
  overall: OverallBar;
  overallValue: number;
  /** General/Offense/Defense summary bars — skaters only, empty for goalies. */
  categoryBars: Partial<Record<AttributeCategory, OverallBar>>;
  /** Single combined Potential+Leadership bar. */
  boosterBar: OverallBar;
  totalVotes: number;
};

function barFor(counts: VoteCounts | undefined): AttributeBar {
  const c = counts ?? EMPTY_COUNTS;
  const mean = meanScore(c);
  return {
    ...directionAndPct(mean),
    positiveVotes: c.pos,
    negativeVotes: c.neg,
    votes: c.total,
    net: Math.round(mean * 10) / 10,
  };
}

function overallBarFor(value: number): OverallBar {
  return { ...directionAndPct(value), value: Math.round(value * 10) / 10 };
}

/**
 * Scores every player in a comparison group. Each bar is an absolute read
 * of that player's mean vote; the group is passed in only so callers get
 * one call per pool (rankings) or per player (profile).
 */
export function computeGroupScores<T extends { id: string }>(
  entries: { player: T; voteMap: PlayerVoteMap; position: Position }[]
): ScoredPlayer<T>[] {
  if (entries.length === 0) return [];

  const attrs = attributesForPosition(entries[0].position);
  const isSkaterGroup = !isGoaliePosition(entries[0].position);

  return entries.map((entry) => {
    const attributeBars: Record<string, AttributeBar> = {};
    for (const a of attrs) attributeBars[a] = barFor(entry.voteMap[a]);

    const boosterBars: Record<string, AttributeBar> = {};
    for (const b of BOOSTER_ATTRIBUTES) boosterBars[b] = barFor(entry.voteMap[b]);

    const overallValue = overallScore(entry.voteMap, entry.position);

    const categoryBars: Partial<Record<AttributeCategory, OverallBar>> = {};
    if (isSkaterGroup) {
      for (const cat of ATTRIBUTE_CATEGORIES) {
        categoryBars[cat.key] = overallBarFor(categoryScore(entry.voteMap, cat.attributes));
      }
    }

    return {
      player: entry.player,
      position: entry.position,
      attributeBars,
      boosterBars,
      overall: overallBarFor(overallValue),
      overallValue,
      categoryBars,
      boosterBar: overallBarFor(boosterScore(entry.voteMap)),
      totalVotes: totalVotes(entry.voteMap),
    };
  });
}

/**
 * Sort by a numeric score, breaking ties by total vote count (higher wins),
 * then by an optional final tiebreak (e.g. team city, A-Z) so players with
 * no votes at all land in a stable, meaningful order.
 */
export function sortWithVoteTiebreak<T>(
  items: ScoredPlayer<T>[],
  scoreOf: (s: ScoredPlayer<T>) => number,
  finalTiebreakOf?: (s: ScoredPlayer<T>) => string
): ScoredPlayer<T>[] {
  return [...items].sort((a, b) => {
    const diff = scoreOf(b) - scoreOf(a);
    if (diff !== 0) return diff;
    const voteDiff = b.totalVotes - a.totalVotes;
    if (voteDiff !== 0) return voteDiff;
    if (finalTiebreakOf) return finalTiebreakOf(a).localeCompare(finalTiebreakOf(b));
    return 0;
  });
}
