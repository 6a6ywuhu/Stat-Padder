import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { getVoteMapsForPlayers } from "./votes";
import { computeGroupScores, ScoredPlayer } from "./scoring";
import { Position, SKATER_POSITIONS, SkaterPosition } from "./attributes";
import type { PlayerStatus } from "./db-enums";

/** Only the player/team fields the rankings + profile pages actually read.
 *  Kept deliberately narrow: the full row for a cross-position pool is
 *  ~700 players and blew past unstable_cache's 2 MB per-entry limit. */
const PLAYER_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  nhlId: true,
  position: true,
  status: true,
  teamId: true,
  headshotUrl: true,
  team: {
    select: {
      id: true,
      name: true,
      city: true,
      primaryColor: true,
      secondaryColor: true,
    },
  },
} as const;

export type PlayerWithTeam = {
  id: string;
  firstName: string;
  lastName: string;
  nhlId: number;
  position: string;
  status: PlayerStatus;
  teamId: string | null;
  headshotUrl: string | null;
  team: {
    id: string;
    name: string;
    city: string;
    primaryColor: string;
    secondaryColor: string;
  } | null;
};

export type GroupSelector =
  | { kind: "skater"; positions: SkaterPosition[] }
  | { kind: "goalie" };

/**
 * Fetches every player in the requested comparison group (spec section 5)
 * along with their vote aggregates, and scores them relative to each
 * other. Used by both the rankings page and the player profile page so a
 * given set of positions always means the same comparison group everywhere.
 */
export async function scoreGroupUncached(
  selector: GroupSelector,
  statuses: PlayerStatus[] = ["ACTIVE", "INJURED"],
  opts: { since?: Date } = {}
): Promise<ScoredPlayer<PlayerWithTeam>[]> {
  const positions: Position[] = selector.kind === "goalie" ? ["G"] : selector.positions;
  if (positions.length === 0) return [];

  // position / status are plain TEXT columns since the move off Postgres
  // enums, so Prisma types them as `string`; narrow back to the unions the
  // rest of the code works with.
  const players = (await prisma.player.findMany({
    where: { position: { in: positions }, status: { in: statuses } },
    select: PLAYER_FIELDS,
  })) as PlayerWithTeam[];

  const voteMaps = await getVoteMapsForPlayers(players.map((p) => p.id), opts.since);

  const entries = players.map((p) => ({
    player: p,
    voteMap: voteMaps[p.id] ?? {},
    position: p.position as Position,
  }));

  return computeGroupScores(entries);
}

/**
 * Cached wrapper. The rankings and team pages read `searchParams`, so Next
 * renders them per-request rather than from the CDN — but the DB read +
 * scoring here is identical for everyone in a given window, so memoise it
 * for 90s instead of re-running the whole pool score on every hit. Keyed
 * on the arguments (selector / statuses / `since`).
 */
export const getScoredGroup: typeof scoreGroupUncached = unstable_cache(
  scoreGroupUncached,
  ["scored-group"],
  // Tagged "rankings" so a vote's revalidateTag() also drops this — the
  // player page's attribute bars come from here, and they need to reflect
  // a fresh vote, not sit on the 90s window.
  { revalidate: 90, tags: ["rankings"] }
);

/**
 * One player's scored result, relative to a comparison group. The profile
 * page needs a single player's bars, but those bars are scaled against the
 * whole group, so the group still has to be scored internally — we just
 * don't cache the whole array. The cross-position skater pool serialises
 * to ~2 MB, over `unstable_cache`'s per-entry limit, so `getScoredGroup`
 * for that selector silently fails to cache and recomputes on every view.
 * Caching the single ScoredPlayer instead (a few KB) actually sticks.
 */
async function scorePlayerUncached(
  playerId: string,
  selector: GroupSelector,
  statuses: PlayerStatus[] = ["ACTIVE", "INJURED"]
): Promise<ScoredPlayer<PlayerWithTeam> | null> {
  const group = await scoreGroupUncached(selector, statuses);
  return group.find((g) => g.player.id === playerId) ?? null;
}

export const getScoredPlayer: typeof scorePlayerUncached = unstable_cache(
  scorePlayerUncached,
  ["scored-player"],
  { revalidate: 90, tags: ["rankings"] }
);

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
