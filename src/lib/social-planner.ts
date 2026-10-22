import { prisma } from "./prisma";
import { pixelProfileFor } from "./pixel-profiles";

export type Candidate = { id: string; firstName: string; lastName: string; position: string; votes: number };

/** The daily post picks itself unless SOCIAL_DAILY_AUTO=false. */
export function dailyAutoEnabled(): boolean {
  return process.env.SOCIAL_DAILY_AUTO !== "false";
}

/** Stable pseudo-shuffle, so equal candidates mix positions and teams rather than running A–Z. */
function hash(id: string): number {
  return [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
}

/**
 * Players eligible for a daily post, best pick first. Eligible = active, has a
 * hand-drawn pixel portrait, and has never had a post of their own (any status,
 * so a failed post is never silently re-picked). "fewest" puts the least-rated
 * first, since they need votes most; "top" starts from the most-voted.
 */
export async function rankedCandidates(order: "fewest" | "top" = "fewest"): Promise<Candidate[]> {
  const used = new Set(
    (await prisma.socialPost.findMany({ where: { kind: "PLAYER", playerId: { not: null } }, select: { playerId: true } })).map((p) => p.playerId!)
  );
  const players = await prisma.player.findMany({
    where: { status: { in: ["ACTIVE", "INJURED"] } },
    select: { id: true, firstName: true, lastName: true, position: true },
  });
  const votes = await prisma.attributeVote.groupBy({ by: ["playerId"], _count: { _all: true } });
  const voteCount = new Map(votes.map((v) => [v.playerId, v._count._all]));

  return players
    .filter((p) => !used.has(p.id) && pixelProfileFor(p.firstName, p.lastName, p.position))
    .map((p) => ({ ...p, votes: voteCount.get(p.id) ?? 0 }))
    .sort((a, b) => (order === "top" ? b.votes - a.votes : a.votes - b.votes) || hash(a.id) - hash(b.id));
}
