import { prisma } from "./prisma";
import { getPlayerLanding, NhlSeasonTotal } from "./nhl-api";
import { ATTRIBUTE_LABELS, GOALIE_ATTRIBUTES, SKATER_ATTRIBUTES } from "./attributes";

/**
 * Stats-based STARTING ratings, so a player's card has real-looking bars before
 * anyone has voted. They are stored as ordinary AttributeVote rows from one
 * synthetic voter, tagged so they can be told apart and removed in one query.
 * Every real vote dilutes them (the first real vote already carries half the
 * weight), and anything that counts "ratings" excludes them, so the site never
 * claims a seeded baseline as a community rating.
 */

export const SEED_VOTER_KEY = "seed:stats-v1";
/** Backdated so homepage "risers since Monday" and the week/month windows ignore them. */
export const SEED_CREATED_AT = new Date("2026-09-01T12:00:00Z");

export function isSeedKey(voterKey: string): boolean {
  return voterKey.startsWith("seed:");
}

const clamp = (n: number, lo = -100, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Saturating curve: 0 per-game → −15, a strong rate → mid-80s. */
const lift = (perGame: number, k: number) => clamp(110 * (1 - Math.exp(-k * perGame)) - 15);

/** Small stable per-attribute wobble so bars aren't all identical. */
function wobble(playerId: string, attr: string, spread = 6): number {
  const h = [...`${playerId}:${attr}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (h % (2 * spread + 1)) - spread;
}

export type SkaterLine = { gp: number; goals: number; assists: number; points: number; plusMinus: number };
export type GoalieLine = { gp: number; savePctg: number; gaa: number };

/** Ratings from per-game production: scoring drives the offensive bars, plus/minus the defensive ones. */
export function skaterSeed(playerId: string, line: SkaterLine, position: string): Record<string, number> {
  const g = line.gp;
  const base = lift(line.points / g, 1.6);
  const pm = line.plusMinus / g;
  const defBoost = position === "D" ? 12 : 0;
  const raw: Record<string, number> = {
    control: base,
    playmaking: lift(line.assists / g, 3.0),
    shooting: lift(line.goals / g, 3.6),
    sense: base * 0.8 + clamp(pm * 30, -15, 15) + 8,
    mobility: base * 0.75 + 10,
    strength: 35 + (base - 35) * 0.4,
    anticipation: (position === "D" ? 45 : 30) + base * 0.3 + pm * 40,
    disruption: (position === "D" ? 40 : 28) + defBoost * 0.5 + pm * 30,
    coverage: (position === "D" ? 42 : 30) + base * 0.2 + pm * 35,
  };
  return Object.fromEntries(SKATER_ATTRIBUTES.map((a) => [a, clamp(raw[a] + wobble(playerId, a))]));
}

/** Goalies: save percentage dominates, goals-against average adjusts. */
export function goalieSeed(playerId: string, line: GoalieLine): Record<string, number> {
  const sv = clamp(30 + (line.savePctg - 0.9) * 2000);
  const gaa = clamp(60 - (line.gaa - 2.6) * 40);
  const base = 0.7 * sv + 0.3 * gaa;
  return Object.fromEntries(GOALIE_ATTRIBUTES.map((a) => [a, clamp(base + wobble(playerId, a, 5))]));
}

type Totals = Partial<NhlSeasonTotal>;

/** Sums the player's last two NHL regular seasons (the current one may be only a few games old). */
export async function loadSeedStats(
  nhlId: number,
  position: string
): Promise<{ skater?: SkaterLine; goalie?: GoalieLine } | null> {
  const landing = await getPlayerLanding(nhlId).catch(() => null);
  if (!landing) return null;
  const seasons = (landing.seasonTotals ?? []).filter((t) => t.leagueAbbrev === "NHL" && t.gameTypeId === 2);
  const lastTwo = new Set(seasons.map((t) => t.season).sort().slice(-2));
  const rows: Totals[] = seasons.filter((t) => lastTwo.has(t.season));
  const gp = rows.reduce((s, t) => s + (t.gamesPlayed ?? 0), 0);
  if (gp < 10) return null; // too little to say anything

  if (position === "G") {
    const w = (f: (t: Totals) => number) => rows.reduce((s, t) => s + f(t) * (t.gamesPlayed ?? 0), 0) / gp;
    return { goalie: { gp, savePctg: w((t) => t.savePctg ?? 0.9), gaa: w((t) => t.goalsAgainstAvg ?? 2.8) } };
  }
  const sum = (k: "goals" | "assists" | "points" | "plusMinus") => rows.reduce((s, t) => s + (t[k] ?? 0), 0);
  return { skater: { gp, goals: sum("goals"), assists: sum("assists"), points: sum("points"), plusMinus: sum("plusMinus") } };
}

export async function seedValuesFor(
  player: { id: string; nhlId: number; position: string }
): Promise<Record<string, number> | null> {
  const stats = await loadSeedStats(player.nhlId, player.position);
  if (!stats) return null;
  return stats.goalie ? goalieSeed(player.id, stats.goalie) : skaterSeed(player.id, stats.skater!, player.position);
}

/** Writes one seed submission for a player (skipped if they already have one). */
export async function writeSeed(playerId: string, values: Record<string, number>): Promise<boolean> {
  const exists = await prisma.attributeVote.findFirst({ where: { playerId, voterKey: SEED_VOTER_KEY }, select: { id: true } });
  if (exists) return false;
  await prisma.attributeVote.createMany({
    data: Object.entries(values).map(([attribute, value]) => ({
      playerId,
      attribute,
      value,
      submissionId: `seed-${playerId}`,
      voterKey: SEED_VOTER_KEY,
      voterToken: SEED_VOTER_KEY,
      voterHash: "seed",
      userId: null,
      localDay: "2026-09-01",
      createdAt: SEED_CREATED_AT,
    })),
  });
  return true;
}

export async function removeAllSeeds(): Promise<number> {
  return (await prisma.attributeVote.deleteMany({ where: { voterKey: { startsWith: "seed:" } } })).count;
}

export function describeSeed(values: Record<string, number>): string {
  return Object.entries(values)
    .map(([a, v]) => `${ATTRIBUTE_LABELS[a as keyof typeof ATTRIBUTE_LABELS] ?? a} ${v}`)
    .join(", ");
}
