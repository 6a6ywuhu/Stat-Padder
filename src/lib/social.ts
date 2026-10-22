import { prisma } from "./prisma";
import { scorePlayerUncached } from "./group-scores";
import { countRatingsForPlayer } from "./votes";
import { formatRating } from "./scoring";
import { Position, SKATER_POSITIONS, SkaterPosition } from "./attributes";

export const SOCIAL_TZ = "America/Vancouver";

/** Ratings needed before a post quotes the Overall number as meaningful. */
const MIN_RATINGS_TO_QUOTE = 5;

export type PlayerSnapshot = {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  teamId: string | null;
  teamName: string | null;
  headshotUrl: string | null;
  /** Distinct Submit actions on this player — the "N ratings" the site shows. */
  ratings: number;
  /** Null when nobody has rated them yet. */
  overall: number | null;
};

/** Live numbers for one player — the single source for both the card image and the caption. */
export async function getPlayerSnapshot(playerId: string): Promise<PlayerSnapshot | null> {
  const player = await prisma.player.findUnique({ where: { id: playerId }, include: { team: true } });
  if (!player) return null;

  const isGoalie = player.position === "G";
  const [scored, ratings] = await Promise.all([
    scorePlayerUncached(
      player.id,
      isGoalie ? { kind: "goalie" } : { kind: "skater", positions: SKATER_POSITIONS as SkaterPosition[] },
      player.status === "RETIRED" ? ["RETIRED"] : ["ACTIVE", "INJURED"]
    ),
    countRatingsForPlayer(player.id),
  ]);

  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position as Position,
    teamId: player.teamId,
    teamName: player.team?.name ?? null,
    headshotUrl: player.headshotUrl,
    ratings,
    overall: ratings > 0 && scored ? scored.overallValue : null,
  };
}

/** Auto-written caption, using the numbers as they are right now. */
export function buildCaption(s: PlayerSnapshot): string {
  const full = `${s.firstName} ${s.lastName}`;
  const n = s.ratings;

  let hook: string;
  if (n === 0 || s.overall === null) {
    hook = `Nobody on Stat Padder has rated ${s.lastName} yet. Be the first.`;
  } else if (n < MIN_RATINGS_TO_QUOTE) {
    hook = `Only ${n} ${n === 1 ? "rating" : "ratings"} on ${full} so far, so your vote would move the number a lot.`;
  } else {
    hook = `The community has ${full} at ${formatRating(s.overall)} Overall across ${n} ratings. Right or wrong?`;
  }

  const teamTag = s.teamName ? `#${s.teamName.replace(/[^A-Za-z0-9]/g, "")}` : "";
  const tags = ["#NHL", "#statpadder", "#NHLrankings", teamTag].filter(Boolean).join(" ");

  return [
    hook,
    "",
    "Rate every skill from −100 to +100. No signup needed to start. statpadder.ca (link in bio)",
    "",
    tags,
  ].join("\n");
}

/** Lowercase, accent-free, letters and digits only — for forgiving name matching. */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export type PlayerMatch = { id: string; name: string; position: string; teamId: string | null };

/** Active players whose full name matches (ignoring accents, case, punctuation). */
export async function findPlayersByName(name: string): Promise<PlayerMatch[]> {
  const target = normName(name);
  if (!target) return [];
  const all = await prisma.player.findMany({
    where: { status: { in: ["ACTIVE", "INJURED"] } },
    select: { id: true, firstName: true, lastName: true, position: true, teamId: true },
  });
  return all
    .filter((p) => normName(`${p.firstName} ${p.lastName}`) === target)
    .map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, teamId: p.teamId }));
}

function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - at.getTime();
}

/** A wall-clock date + time in `timeZone` (default Vancouver) as a UTC Date. */
export function zonedToUtc(date: string, time: string, timeZone: string = SOCIAL_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let utc = guess - tzOffsetMs(new Date(guess), timeZone);
  utc = guess - tzOffsetMs(new Date(utc), timeZone); // re-check across a DST boundary
  return new Date(utc);
}

export function formatWhen(d: Date, timeZone: string = SOCIAL_TZ): string {
  return d.toLocaleString("en-CA", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
