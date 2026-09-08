import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import { PlayerVoteMap, EMPTY_COUNTS } from "./scoring";

/** How many distinct players an un-signed-in browser may vote on, ever. */
export const ANON_PLAYER_LIMIT = 10;

/**
 * Live tallies per (player, attribute). The write path keeps exactly one
 * row per (voter, player, attribute), so a plain aggregate is the score.
 * `since` restricts to submissions on/after that moment (week/month views).
 */
export async function getVoteMapsForPlayers(
  playerIds: string[],
  since?: Date
): Promise<Record<string, PlayerVoteMap>> {
  if (playerIds.length === 0) return {};

  const where = {
    playerId: { in: playerIds },
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [totals, positives, negatives] = await Promise.all([
    prisma.attributeVote.groupBy({
      by: ["playerId", "attribute"],
      where,
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.attributeVote.groupBy({
      by: ["playerId", "attribute"],
      where: { ...where, value: { gt: 0 } },
      _count: { _all: true },
    }),
    prisma.attributeVote.groupBy({
      by: ["playerId", "attribute"],
      where: { ...where, value: { lt: 0 } },
      _count: { _all: true },
    }),
  ]);

  const result: Record<string, PlayerVoteMap> = {};
  for (const id of playerIds) result[id] = {};

  const bucket = (playerId: string, attribute: string) => {
    const map = result[playerId] ?? (result[playerId] = {});
    return map[attribute] ?? (map[attribute] = { ...EMPTY_COUNTS });
  };

  for (const row of totals) {
    const b = bucket(row.playerId, row.attribute);
    b.sum = row._sum.value ?? 0;
    b.total = row._count._all;
  }
  for (const row of positives) bucket(row.playerId, row.attribute).pos = row._count._all;
  for (const row of negatives) bucket(row.playerId, row.attribute).neg = row._count._all;

  return result;
}

export async function getVoteMapForPlayer(playerId: string): Promise<PlayerVoteMap> {
  return (await getVoteMapsForPlayers([playerId]))[playerId] ?? {};
}

// --- Submitting a vote --------------------------------------------------

export type VoterIdentity = {
  voterToken: string;
  voterHash: string;
  userId: string | null;
};

/** Whether this voter may submit for this player right now, and why not. */
export type VoterState = {
  canVote: boolean;
  reason?: "anon-already-voted" | "anon-limit" | "voted-today";
  /** distinct players this browser has voted on while signed out */
  anonPlayersUsed: number;
  anonLimit: number;
  signedIn: boolean;
};

export async function getVoterState(
  playerId: string,
  identity: VoterIdentity,
  localDay: string
): Promise<VoterState> {
  const anonLimit = ANON_PLAYER_LIMIT;

  if (identity.userId) {
    const today = await prisma.attributeVote.findFirst({
      where: { playerId, userId: identity.userId, localDay },
      select: { id: true },
    });
    return {
      canVote: !today,
      reason: today ? "voted-today" : undefined,
      anonPlayersUsed: 0,
      anonLimit,
      signedIn: true,
    };
  }

  const anonRows = await prisma.attributeVote.findMany({
    where: { voterToken: identity.voterToken, userId: null },
    select: { playerId: true },
    distinct: ["playerId"],
  });
  const anonPlayersUsed = anonRows.length;
  const alreadyThis = anonRows.some((r) => r.playerId === playerId);

  return {
    canVote: !alreadyThis && anonPlayersUsed < anonLimit,
    reason: alreadyThis ? "anon-already-voted" : anonPlayersUsed >= anonLimit ? "anon-limit" : undefined,
    anonPlayersUsed,
    anonLimit,
    signedIn: false,
  };
}

/**
 * Replace this voter's vote on this player with `values` (attribute →
 * −100…+100). Deletes their prior rows for the player first — and, when
 * signed in, also clears any votes this same browser cast on the player
 * while signed out.
 */
export async function recordSubmission(params: {
  playerId: string;
  values: Record<string, number>;
  identity: VoterIdentity;
  localDay: string;
}) {
  const { playerId, values, identity, localDay } = params;
  const voterKey = identity.userId ?? identity.voterToken;
  const submissionId = randomUUID();

  const rows = Object.entries(values).map(([attribute, value]) => ({
    playerId,
    attribute,
    value: Math.max(-100, Math.min(100, Math.round(value))),
    submissionId,
    voterKey,
    voterToken: identity.voterToken,
    voterHash: identity.voterHash,
    userId: identity.userId,
    localDay,
  }));

  await prisma.$transaction([
    prisma.attributeVote.deleteMany({ where: { playerId, voterKey } }),
    ...(identity.userId
      ? [
          prisma.attributeVote.deleteMany({
            where: { playerId, voterToken: identity.voterToken, userId: null },
          }),
        ]
      : []),
    prisma.attributeVote.createMany({ data: rows }),
  ]);

  return { submissionId, count: rows.length };
}
