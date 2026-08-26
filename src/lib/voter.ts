import { createHash, randomUUID } from "crypto";
import { NextRequest } from "next/server";

export const VOTER_TOKEN_COOKIE = "sp_voter";
const VOTER_TOKEN_MAX_AGE = 60 * 60 * 24 * 365 * 2; // 2 years

const HASH_SALT = process.env.VOTER_HASH_SALT || "stat-padder-dev-salt";

/**
 * Reads the voter token from the request cookie, or mints a new one.
 * Returns both the token and whether it was newly created (so the caller
 * can set the cookie on the response).
 */
export function readOrCreateVoterToken(req: NextRequest): {
  token: string;
  isNew: boolean;
} {
  const existing = req.cookies.get(VOTER_TOKEN_COOKIE)?.value;
  if (existing) return { token: existing, isNew: false };
  return { token: randomUUID(), isNew: true };
}

export function voterTokenCookieOptions() {
  return {
    name: VOTER_TOKEN_COOKIE,
    maxAge: VOTER_TOKEN_MAX_AGE,
    httpOnly: false, // client also mirrors this into localStorage for cooldown UI
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * Lightweight abuse guard: hash of IP + User-Agent. Not full device
 * fingerprinting — just enough to notice one source hammering votes across
 * many voter tokens.
 */
export function voterHash(req: NextRequest): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${ip}::${ua}::${HASH_SALT}`).digest("hex");
}

/**
 * Voting budget: a shared pool of votes usable on any attribute, on any
 * player, rather than a per-attribute cooldown. Resets on the calendar day
 * (midnight, server local time) — see getDailyVoteStatus in votes.ts.
 */
export const DAILY_VOTE_LIMIT = 30;
