import { prisma } from "./prisma";
import { scorePlayerUncached } from "./group-scores";
import { countRatingsForPlayer } from "./votes";
import { formatRating } from "./scoring";
import { ATTRIBUTE_LABELS, GOALIE_ATTRIBUTES, Position, SKATER_POSITIONS, SkaterPosition } from "./attributes";

export const SOCIAL_TZ = "America/Vancouver";

/** Ratings needed before a post quotes the Overall number as meaningful. */
const MIN_RATINGS_TO_QUOTE = 5;

export type PlayerSnapshot = {
  id: string;
  nhlId: number;
  teamFullName: string | null;
  teamColors: { primary: string; secondary: string } | null;
  /** Skaters: General / Offense / Defense scores; null until someone rates them. */
  categories: { general: number | null; offense: number | null; defense: number | null } | null;
  /** Goalies: the six goalie attributes; null until someone rates them. */
  goalieAttributes: { label: string; value: number | null }[] | null;
  firstName: string;
  lastName: string;
  position: string;
  teamId: string | null;
  teamName: string | null;
  headshotUrl: string | null;
  /** Real community ratings (distinct Submit actions) — the "N ratings" the site shows. */
  ratings: number;
  /** Null when there is nothing at all to show. */
  overall: number | null;
  /** True when the numbers come only from a stats-based starting rating, with no community rating yet. */
  baselineOnly: boolean;
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

  // Real ratings, or a stats-based starting rating standing in for them.
  const rated = !!scored && scored.totalVotes > 0;
  const cat = (k: "general" | "offense" | "defense") => (rated ? scored!.categoryBars[k]?.value ?? null : null);

  return {
    id: player.id,
    nhlId: player.nhlId,
    teamFullName: player.team ? `${player.team.city} ${player.team.name}` : null,
    teamColors: player.team ? { primary: player.team.primaryColor, secondary: player.team.secondaryColor } : null,
    categories: isGoalie ? null : { general: cat("general"), offense: cat("offense"), defense: cat("defense") },
    goalieAttributes: isGoalie
      ? GOALIE_ATTRIBUTES.map((a) => ({ label: ATTRIBUTE_LABELS[a], value: rated ? scored!.attributeBars[a]?.net ?? null : null }))
      : null,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position as Position,
    teamId: player.teamId,
    teamName: player.team?.name ?? null,
    headshotUrl: player.headshotUrl,
    ratings,
    overall: rated ? scored!.overallValue : null,
    baselineOnly: rated && ratings === 0,
  };
}

/** A team's hashtags: its nickname and city + nickname, e.g. #stars #dallasstars. */
export function teamHashtags(nickname: string | null, fullName: string | null): string[] {
  const tags = [nickname, fullName].filter((x): x is string => !!x).map((x) => `#${normName(x)}`);
  return [...new Set(tags)];
}

/**
 * Auto-written caption, using the numbers as they are right now. It never says
 * how many people have rated — the post image already shows that.
 */
export function buildCaption(s: PlayerSnapshot): string {
  const full = `${s.firstName} ${s.lastName}`;

  let hook: string;
  if (s.overall === null) {
    hook = `Nobody on Stat Padder has rated ${s.lastName} yet. Be the first.`;
  } else if (s.baselineOnly) {
    hook = `${full}'s stats-based starting rating is ${formatRating(s.overall)} Overall. Think it's right? Be the first to rate.`;
  } else if (s.ratings < MIN_RATINGS_TO_QUOTE) {
    hook = `The community has ${full} at ${formatRating(s.overall)} Overall so far, and your vote moves that number a lot.`;
  } else {
    hook = `The community has ${full} at ${formatRating(s.overall)} Overall. Right or wrong?`;
  }

  const tags = [...teamHashtags(s.teamName, s.teamFullName), "#NHL", "#statpadder", "#NHLrankings"].join(" ");

  return [
    hook,
    "",
    `Swipe for ${s.lastName}'s stats →`,
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
