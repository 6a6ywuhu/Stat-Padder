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
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
