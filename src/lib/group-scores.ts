import { prisma } from "./prisma";
import { getVoteMapsForPlayers } from "./votes";
import { computeGroupScores, ScoredPlayer } from "./scoring";
import { Position, SKATER_POSITIONS, SkaterPosition } from "./attributes";
import type { Player, PlayerStatus, Team } from "@prisma/client";

export type PlayerWithTeam = Player & { team: Team | null };

export type GroupSelector =
  | { kind: "skater"; positions: SkaterPosition[] }
  | { kind: "goalie" };

/**
 * Fetches every player in the requested comparison group (spec section 5)
 * along with their vote aggregates, and scores them relative to each
 * other. Used by both the rankings page and the player profile page so a
 * given set of positions always means the same comparison group everywhere.
 */
export async function getScoredGroup(
  selector: GroupSelector,
  statuses: PlayerStatus[] = ["ACTIVE", "INJURED"]
): Promise<ScoredPlayer<PlayerWithTeam>[]> {
  const positions: Position[] = selector.kind === "goalie" ? ["G"] : selector.positions;
  if (positions.length === 0) return [];

  const players = await prisma.player.findMany({
    where: { position: { in: positions }, status: { in: statuses } },
    include: { team: true },
  });

  const voteMaps = await getVoteMapsForPlayers(players.map((p) => p.id));

  const entries = players.map((p) => ({
    player: p,
    voteMap: voteMaps[p.id] ?? {},
    position: p.position as Position,
  }));

  return computeGroupScores(entries);
}

const VALID_SKATER_POSITIONS: SkaterPosition[] = ["C", "LW", "RW", "D"];

/**
 * Parses a comma-separated `positions` param as-is — an empty result means
 * "nothing explicitly picked yet", which callers doing UI (button
 * highlighting) should treat differently from callers doing data queries.
 */
export function parseRawSkaterPositions(raw: string | undefined): SkaterPosition[] {
  const requested = (raw ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p): p is SkaterPosition => (VALID_SKATER_POSITIONS as string[]).includes(p));
  return Array.from(new Set(requested));
}

/** Same as the raw parse, but empty/invalid resolves to "all" for querying. */
export function parseSkaterPositions(raw: string | undefined): SkaterPosition[] {
  const explicit = parseRawSkaterPositions(raw);
  return explicit.length > 0 ? explicit : SKATER_POSITIONS;
}

export function selectorFromParams(type: string | undefined, positions: string | undefined): GroupSelector {
  if (type === "goalies") return { kind: "goalie" };
  return { kind: "skater", positions: parseSkaterPositions(positions) };
}
