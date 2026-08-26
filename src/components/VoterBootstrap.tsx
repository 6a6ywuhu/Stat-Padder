"use client";

import { useEffect } from "react";

const COOKIE_NAME = "sp_voter";
const LOCAL_KEY = "sp_voter_token";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

/**
 * Ensures a voter token exists before the user's first vote (layered
 * cookie + localStorage identification, spec section 3). Runs once on
 * mount; the vote API also mints a token as a fallback if this somehow
 * didn't run, so it's a redundant guarantee rather than a hard dependency.
 */
export function VoterBootstrap() {
  useEffect(() => {
    const fromCookie = readCookie(COOKIE_NAME);
    const fromLocal = localStorage.getItem(LOCAL_KEY);
    const token = fromCookie || fromLocal || crypto.randomUUID();

    if (!fromCookie) writeCookie(COOKIE_NAME, token);
    if (fromLocal !== token) localStorage.setItem(LOCAL_KEY, token);
  }, []);

  return null;
}
