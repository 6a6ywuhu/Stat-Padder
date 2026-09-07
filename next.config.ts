import type { NextConfig } from "next";

// /rankings and /team-rankings are now fully static (they ship a snapshot
// and filter client-side). These remaining pages still read searchParams /
// dynamic params, so Next renders them per-request and sends
// `Cache-Control: no-store`. Their output has no per-user content, so tell
// Netlify's CDN to cache the rendered response per-URL for a short window
// and serve stale while it refreshes. `Netlify-CDN-Cache-Control` is read
// only by Netlify's CDN and stripped before the response reaches the
// browser, so it doesn't affect Next's own no-store to the client.
const EDGE_CACHE = "public, durable, s-maxage=120, stale-while-revalidate=600";
// Shorter window for the player profile, whose attribute bars move on every
// vote — the voter sees their own vote instantly (optimistic UI); this just
// bounds how stale the bars can look to everyone else.
const PROFILE_EDGE_CACHE = "public, durable, s-maxage=30, stale-while-revalidate=300";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "assets.nhle.com" }],
  },
  async headers() {
    return [
      {
        source: "/player-stats",
        headers: [{ key: "Netlify-CDN-Cache-Control", value: EDGE_CACHE }],
      },
      {
        source: "/teams/:abbrev",
        headers: [{ key: "Netlify-CDN-Cache-Control", value: EDGE_CACHE }],
      },
      {
        // The profile page is per-request (reads searchParams + auth), but
        // its output has no per-user content beyond the favourite heart —
        // which nobody's set (no accounts in use). Cache the rendered page
        // per-URL at the edge so clicking through the rankings is instant;
        // a vote's revalidateTag("rankings") doesn't reach this, so it just
        // rides the short s-maxage window.
        source: "/players/:id",
        headers: [{ key: "Netlify-CDN-Cache-Control", value: PROFILE_EDGE_CACHE }],
      },
      {
        source: "/players/:id/history",
        headers: [{ key: "Netlify-CDN-Cache-Control", value: EDGE_CACHE }],
      },
    ];
  },
};

export default nextConfig;
