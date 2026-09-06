import {
  Attribute,
  attributesForPosition,
  AttributeCategory,
  ATTRIBUTE_CATEGORIES,
  BOOSTER_ATTRIBUTES,
  isGoaliePosition,
  Position,
} from "./attributes";

export type VoteCounts = { pos: number; neg: number };
export type PlayerVoteMap = Record<string, VoteCounts>; // keyed by attribute

export function emptyVoteMap(attributes: Attribute[]): PlayerVoteMap {
  const map: PlayerVoteMap = {};
  for (const a of attributes) map[a] = { pos: 0, neg: 0 };
  return map;
}

export function netScore(counts: VoteCounts | undefined): number {
  if (!counts) return 0;
  return counts.pos - counts.neg;
}

export function totalVotes(voteMap: PlayerVoteMap): number {
  return Object.values(voteMap).reduce((sum, c) => sum + c.pos + c.neg, 0);
}

/** Overall = average of the position's attribute net scores (positive - negative). */
export function overallScore(voteMap: PlayerVoteMap, position: Position): number {
  const attrs = attributesForPosition(position);
  const total = attrs.reduce((sum, a) => sum + netScore(voteMap[a]), 0);
  return attrs.length ? total / attrs.length : 0;
}

/**
 * A skater category's score (General/Offense/Defense) = average of
 * that category's 3 attribute net scores — same idea as overallScore, just
 * scoped to one category instead of all 9. These still all roll into
 * Overall the normal way; this is a second, narrower average alongside it,
 * not a replacement track (unlike boosters, which never feed Overall).
 */
export function categoryScore(voteMap: PlayerVoteMap, attrs: Attribute[]): number {
  if (attrs.length === 0) return 0;
  const total = attrs.reduce((sum, a) => sum + netScore(voteMap[a]), 0);
  return total / attrs.length;
}

/** Average of the booster (Potential/Leadership) net scores. */
export function boosterScore(voteMap: PlayerVoteMap): number {
  const total = BOOSTER_ATTRIBUTES.reduce((sum, b) => sum + netScore(voteMap[b]), 0);
  return BOOSTER_ATTRIBUTES.length ? total / BOOSTER_ATTRIBUTES.length : 0;
}

export type Direction = "positive" | "negative" | "zero";

/**
 * A single up/down votes cancel out into one net bar — an upvote and a
 * downvote offset each other, and both directions share the same scale
 * (this attribute's own net range across the group), rather than each
 * color being sized against its own separate max.
 */
export type AttributeBar = {
  direction: Direction;
  pct: number; // 0-100
  positiveVotes: number;
  negativeVotes: number;
  net: number;
};

export type OverallBar = {
  direction: Direction;
  pct: number; // 0-100
  value: number;
};

export function directionAndPct(value: number, maxPositive: number, mostNegative: number): { direction: Direction; pct: number } {
  if (value > 0) {
    return { direction: "positive", pct: maxPositive > 0 ? (value / maxPositive) * 100 : 0 };
  }
  if (value < 0) {
    return { direction: "negative", pct: mostNegative < 0 ? (value / mostNegative) * 100 : 0 };
  }
  return { direction: "zero", pct: 0 };
}

export type ScoredPlayer<T> = {
  player: T;
  voteMap: PlayerVoteMap;
  position: Position;
  attributeBars: Record<string, AttributeBar>;
  /** Potential/Leadership — universal, never part of Overall, never shown in the rankings hover preview. */
  boosterBars: Record<string, AttributeBar>;
  overall: OverallBar;
  overallValue: number;
  /** General/Offense/Defense summary bars — skaters only, empty for goalies. */
  categoryBars: Partial<Record<AttributeCategory, OverallBar>>;
  /** Single combined Potential+Leadership bar, alongside the two individual boosterBars. */
  boosterBar: OverallBar;
  totalVotes: number;
};

/**
 * Computes per-attribute and overall bars for every player in a comparison
 * group, scaled relative to the max within that same group (per spec
 * section 4). Callers pass in whichever group is currently active — either
 * the player's own position, or a cross-position filtered set.
 */
export function computeGroupScores<T extends { id: string }>(
  entries: { player: T; voteMap: PlayerVoteMap; position: Position }[]
): ScoredPlayer<T>[] {
  if (entries.length === 0) return [];

  const attrs = attributesForPosition(entries[0].position);

  const maxPositiveNetByAttr: Record<string, number> = {};
  const mostNegativeNetByAttr: Record<string, number> = {};
  for (const a of attrs) {
    maxPositiveNetByAttr[a] = 0;
    mostNegativeNetByAttr[a] = 0;
  }

  // Boosters (Potential/Leadership) are scored the same way, but tracked
  // entirely separately from attrs — they never feed into overallScore.
  const maxPositiveNetByBooster: Record<string, number> = {};
  const mostNegativeNetByBooster: Record<string, number> = {};
  for (const b of BOOSTER_ATTRIBUTES) {
    maxPositiveNetByBooster[b] = 0;
    mostNegativeNetByBooster[b] = 0;
  }

  // Category summaries (General/Offense/Defense) only apply to skaters —
  // a goalie's voteMap has no "sense"/"strength"/etc, so computing these for
  // goalies would silently average in a bunch of zeros for attributes they
  // don't have.
  const isSkaterGroup = !isGoaliePosition(entries[0].position);
  const maxPositiveByCategory: Partial<Record<AttributeCategory, number>> = {};
  const mostNegativeByCategory: Partial<Record<AttributeCategory, number>> = {};
  if (isSkaterGroup) {
    for (const cat of ATTRIBUTE_CATEGORIES) {
      maxPositiveByCategory[cat.key] = 0;
      mostNegativeByCategory[cat.key] = 0;
    }
  }

  const overallByPlayer = new Map<string, number>();
  let maxPositiveOverall = 0;
  let mostNegativeOverall = 0; // most negative = smallest (closest to -Infinity)

  const categoryByPlayer = new Map<string, Partial<Record<AttributeCategory, number>>>();

  const boosterByPlayer = new Map<string, number>();
  let maxPositiveBooster = 0;
  let mostNegativeBooster = 0;

  for (const entry of entries) {
    for (const a of attrs) {
      const net = netScore(entry.voteMap[a]);
      if (net > maxPositiveNetByAttr[a]) maxPositiveNetByAttr[a] = net;
      if (net < mostNegativeNetByAttr[a]) mostNegativeNetByAttr[a] = net;
    }
    for (const b of BOOSTER_ATTRIBUTES) {
      const net = netScore(entry.voteMap[b]);
      if (net > maxPositiveNetByBooster[b]) maxPositiveNetByBooster[b] = net;
      if (net < mostNegativeNetByBooster[b]) mostNegativeNetByBooster[b] = net;
    }
    const overall = overallScore(entry.voteMap, entry.position);
    overallByPlayer.set(entry.player.id, overall);
    if (overall > maxPositiveOverall) maxPositiveOverall = overall;
    if (overall < mostNegativeOverall) mostNegativeOverall = overall;

    if (isSkaterGroup) {
      const perCategory: Partial<Record<AttributeCategory, number>> = {};
      for (const cat of ATTRIBUTE_CATEGORIES) {
        const score = categoryScore(entry.voteMap, cat.attributes);
        perCategory[cat.key] = score;
        if (score > (maxPositiveByCategory[cat.key] ?? 0)) maxPositiveByCategory[cat.key] = score;
        if (score < (mostNegativeByCategory[cat.key] ?? 0)) mostNegativeByCategory[cat.key] = score;
      }
      categoryByPlayer.set(entry.player.id, perCategory);
    }

    const booster = boosterScore(entry.voteMap);
    boosterByPlayer.set(entry.player.id, booster);
    if (booster > maxPositiveBooster) maxPositiveBooster = booster;
    if (booster < mostNegativeBooster) mostNegativeBooster = booster;
  }

  return entries.map((entry) => {
    const attributeBars: Record<string, AttributeBar> = {};
    for (const a of attrs) {
      const c = entry.voteMap[a] ?? { pos: 0, neg: 0 };
      const net = netScore(c);
      attributeBars[a] = {
        ...directionAndPct(net, maxPositiveNetByAttr[a], mostNegativeNetByAttr[a]),
        positiveVotes: c.pos,
        negativeVotes: c.neg,
        net,
      };
    }

    const boosterBars: Record<string, AttributeBar> = {};
    for (const b of BOOSTER_ATTRIBUTES) {
      const c = entry.voteMap[b] ?? { pos: 0, neg: 0 };
      const net = netScore(c);
      boosterBars[b] = {
        ...directionAndPct(net, maxPositiveNetByBooster[b], mostNegativeNetByBooster[b]),
        positiveVotes: c.pos,
        negativeVotes: c.neg,
        net,
      };
    }

    const overallValue = overallByPlayer.get(entry.player.id) ?? 0;
    const overall: OverallBar = {
      ...directionAndPct(overallValue, maxPositiveOverall, mostNegativeOverall),
      value: overallValue,
    };

    const categoryBars: Partial<Record<AttributeCategory, OverallBar>> = {};
    if (isSkaterGroup) {
      const perCategory = categoryByPlayer.get(entry.player.id) ?? {};
      for (const cat of ATTRIBUTE_CATEGORIES) {
        const value = perCategory[cat.key] ?? 0;
        categoryBars[cat.key] = {
          ...directionAndPct(value, maxPositiveByCategory[cat.key] ?? 0, mostNegativeByCategory[cat.key] ?? 0),
          value,
        };
      }
    }

    const boosterValue = boosterByPlayer.get(entry.player.id) ?? 0;
    const boosterBar: OverallBar = {
      ...directionAndPct(boosterValue, maxPositiveBooster, mostNegativeBooster),
      value: boosterValue,
    };

    return {
      player: entry.player,
      voteMap: entry.voteMap,
      position: entry.position,
      attributeBars,
      boosterBars,
      overall,
      overallValue,
      categoryBars,
      boosterBar,
      totalVotes: totalVotes(entry.voteMap),
    };
  });
}

/**
 * Sort by a numeric score, breaking ties by total vote count (higher wins),
 * then by an optional final tiebreak (e.g. team city, A-Z) so players with
 * no votes at all land in a stable, meaningful order instead of whatever
 * order the database happened to return them in.
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
