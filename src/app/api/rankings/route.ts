import { NextRequest, NextResponse } from "next/server";
import { getRankingsWindow, RankWindow } from "@/lib/rankings-snapshot";

/** month / week windows for the client-side rankings list — the default
 *  window ships with the static page, these are fetched on toggle. Edge-
 *  cached; busted on a vote via revalidateTag("rankings"). */
export async function GET(req: NextRequest) {
  const w = req.nextUrl.searchParams.get("window");
  const win: RankWindow = w === "week" ? "week" : w === "month" ? "month" : "all";
  const data = await getRankingsWindow(win);
  return NextResponse.json(data, {
    headers: {
      // CDN-Cache-Control is the standard header Vercel reads; the Netlify
      // one is kept for parity if this ever moves back. Both are CDN-only.
      "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
