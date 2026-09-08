import type { NextConfig } from "next";

// A few pages read searchParams / dynamic params, so Next renders them
// per-request and sends `Cache-Control: no-store` to the browser. Their
// output has no per-user content, so also tell the CDN to hold the
// rendered response per-URL for a short window and serve stale while it
// refreshes. `CDN-Cache-Control` is the standard header (Vercel);
// `Netlify-CDN-Cache-Control` is the Netlify equivalent. Both are
// CDN-only and don't affect Next's no-store to the client.
const EDGE_CACHE = "public, s-maxage=120, stale-while-revalidate=600";
const NETLIFY_EDGE_CACHE = "public, durable, s-maxage=120, stale-while-revalidate=600";

const edgeCacheHeaders = [
  { key: "CDN-Cache-Control", value: EDGE_CACHE },
  { key: "Netlify-CDN-Cache-Control", value: NETLIFY_EDGE_CACHE },
];

// Hand-drawn portraits and brand art are content-addressed by name and
// only ever change when we ship a new file, so let the browser keep them
// for a year instead of revalidating on every navigation.
const IMMUTABLE_ASSET = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "assets.nhle.com" }],
  },
  async headers() {
    return [
      { source: "/player-stats", headers: edgeCacheHeaders },
      { source: "/teams", headers: edgeCacheHeaders },
      { source: "/teams/:abbrev", headers: edgeCacheHeaders },
      // /players/:id is deliberately NOT here — after you vote, a refresh
      // has to show your vote, and a CDN hold would keep serving the
      // pre-vote copy for the window.
      { source: "/players/:id/history", headers: edgeCacheHeaders },
      { source: "/pixel-profiles/:path*", headers: [{ key: "Cache-Control", value: IMMUTABLE_ASSET }] },
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: IMMUTABLE_ASSET }] },
    ];
  },
};

export default nextConfig;
