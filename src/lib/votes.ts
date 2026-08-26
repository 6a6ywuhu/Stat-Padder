import { prisma } from "./prisma";
import { PlayerVoteMap } from "./scoring";
import { Attribute, BoosterAttribute } from "./attributes";
import { DAILY_VOTE_LIMIT } from "./voter";

/** Vote maps for many players in one query — used by rankings/comparison pages. */
export async function getVoteMapsForPlayers(
  playerIds: string[]
): Promise<Record<string, PlayerVoteMap>> {
  if (playerIds.length === 0) return {};

  const rows = await prisma.attributeVote.groupBy({
    by: ["playerId", "attribute", "value"],
    where: { playerId: { in: playerIds } },
    _count: { _all: true },
  });

  const result: Record<string, PlayerVoteMap> = {};
  for (const id of playerIds) result[id] = {};

  for (const row of rows) {
    const map = result[row.playerId] ?? (result[row.playerId] = {});
    const bucket = map[row.attribute] ?? (map[row.attribute] = { pos: 0, neg: 0 });
    if (row.value > 0) bucket.pos += row._count._all;
    else bucket.neg += row._count._all;
  }

  return result;
}

export async function getVoteMapForPlayer(playerId: string): Promise<PlayerVoteMap> {
  const maps = await getVoteMapsForPlayers([playerId]);
  return maps[playerId] ?? {};
}

export type DailyVoteStatus = {
  used: number;
  remaining: number;
  limit: number;
  /** Midnight tonight (server local time) — when today's budget refills. */
  resetAt: string;
};

function startOfTomorrow(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** How many votes the voter has cast since midnight, against their daily budget. */
export async function getDailyVoteStatus(voterToken: string | undefined): Promise<DailyVoteStatus> {
  const resetAt = startOfTomorrow();
  const since = new Date(resetAt.getTime() - 24 * 60 * 60 * 1000); // midnight this morning

  if (!voterToken) {
    return { used: 0, remaining: DAILY_VOTE_LIMIT, limit: DAILY_VOTE_LIMIT, resetAt: resetAt.toISOString() };
  }

  const used = await prisma.attributeVote.count({ where: { voterToken, createdAt: { gte: since } } });

  return {
    used,
    remaining: Math.max(0, DAILY_VOTE_LIMIT - used),
    limit: DAILY_VOTE_LIMIT,
    resetAt: resetAt.toISOString(),
  };
}

const SPIKE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const SPIKE_THRESHOLD = 40; // votes on one player/attribute within the window
const SPIKE_REPORT_COOLDOWN_MS = 60 * 60 * 1000; // don't re-flag the same combo within an hour

export async function recordVoteAndCheckSpike(params: {
  playerId: string;
  attribute: Attribute | BoosterAttribute;
  value: 1 | -1;
  voterToken: string;
  voterHash: string;
}) {
  await prisma.attributeVote.create({
    data: {
      playerId: params.playerId,
      attribute: params.attribute,
      value: params.value,
      voterToken: params.voterToken,
      voterHash: params.voterHash,
    },
  });

  const since = new Date(Date.now() - SPIKE_WINDOW_MS);
  const recentCount = await prisma.attributeVote.count({
    where: { playerId: params.playerId, attribute: params.attribute, createdAt: { gte: since } },
  });

  if (recentCount < SPIKE_THRESHOLD) return;

  const recentReportCutoff = new Date(Date.now() - SPIKE_REPORT_COOLDOWN_MS);
  const existingOpenReport = await prisma.report.findFirst({
    where: {
      type: "VOTE_SPIKE",
      playerId: params.playerId,
      status: "OPEN",
      createdAt: { gte: recentReportCutoff },
      metaJson: { contains: `"attribute":"${params.attribute}"` },
    },
  });
  if (existingOpenReport) return;

  await prisma.report.create({
    data: {
      type: "VOTE_SPIKE",
      playerId: params.playerId,
      message: `Abnormal vote volume on "${params.attribute}": ${recentCount} votes in the last ${SPIKE_WINDOW_MS / 60000} minutes.`,
      metaJson: JSON.stringify({ attribute: params.attribute, windowMinutes: SPIKE_WINDOW_MS / 60000, count: recentCount }),
    },
  });
}
