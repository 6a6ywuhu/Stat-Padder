# Stat Padder

A public site for voting +1/−1 on individual skill attributes for NHL players — skaters
(Mobility, Shooting, Control, Sense, Strength, Playmaking) and goalies (Mobility, Blocker,
Glove, Tracking, Rebound Control, Positioning) separately. No signup required.

## Stack

- **Next.js 16** (App Router, TypeScript) — pages, API routes, and the admin panel all live
  in one app.
- **Prisma + SQLite** for local dev. No Postgres/Docker was available in the build
  environment, so this runs on a local `dev.db` file for now. Moving to Postgres later is a
  two-line change: set `provider = "postgresql"` in `prisma/schema.prisma`, point
  `DATABASE_URL` at a real database, and run `npm run db:migrate`. The schema doesn't use any
  SQLite-only types, so nothing else needs to change.
- **Tailwind CSS v4** with a grayscale design-token system (`src/app/globals.css`) and
  per-team color accents layered on top (`src/data/team-colors.ts`).
- Real player/team/stat data comes live from the unofficial NHL Web API and Stats API —
  see `src/lib/nhl-api.ts`.

## Getting started

```bash
npm install
npm run db:migrate   # creates prisma/dev.db and applies the schema
npm run sync          # pulls all 32 teams + current rosters from the NHL API
npm run dev
```

Copy `.env.example` to `.env` and fill in real values before deploying — a placeholder
`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `VOTER_HASH_SALT` are already in `.env` for
local dev only.

## How voting works

- Each attribute has independent + / − buttons (not a single thumbs-style vote).
- One vote per attribute per 24 hours, on a rolling window from your last vote on that
  specific attribute — tracked via a cookie/localStorage token (`src/components/VoterBootstrap.tsx`),
  with a secondary IP+UA hash abuse guard (`src/lib/voter.ts`) that never blocks votes, only
  flags spikes into the admin report queue (`src/lib/votes.ts`).
- Buttons disable immediately on click, before the server confirms, so a slow network can't
  cause a double-vote.
- Every individual vote is stored (not just running totals) — this is what makes the rolling
  cooldown, spike detection, and reporting possible.

## Comparison groups & scoring

`src/lib/scoring.ts` and `src/lib/group-scores.ts` hold the whole scoring model: per-attribute
green/red bars scaled against the current comparison group's max, the Overall bar (average of
the six attribute net scores, green if positive / red if negative, scaled against the group's
best positive or worst negative), and vote-count tiebreaking. The comparison group is either a
single position or, via the "Compare across positions" toggle, all four skater positions
combined — goalies are always their own group and never mix with skaters.

## Admin

`/admin` is unlinked anywhere in the UI and excluded from indexing (`src/app/robots.ts`).
It's gated by `ADMIN_PASSWORD` (a plain env var — intentionally simple for v1, per spec).
From there you can resolve/dismiss reports (both user-filed data issues and auto-flagged vote
spikes), manually fix a player's name/team/status, and trigger a data sync on demand. Manual
edits are overwritten by the next sync for any field the sync touches — there's no field
locking in v1.

## Known gaps / good next steps

- **Legends page is empty until players are marked Retired.** The NHL roster API only returns
  current rosters, so retired players aren't in the database yet. Either mark a few current
  greats as `RETIRED` via `/admin` for testing, or extend `src/lib/sync-nhl-data.ts` with a
  small hand-picked list of historical `nhlId`s (the player-landing endpoint works fine for
  retired players too).
- **"Recent major changes" and "most searched players"** on the landing page are explicitly
  deferred in the spec (section 14) and aren't built yet — they need vote-history-diffing and
  search-tracking respectively.
- **Daily sync isn't scheduled.** `npm run sync` and the admin "Sync now" button both work;
  wiring either to a cron job / scheduled task is the last step for production.
