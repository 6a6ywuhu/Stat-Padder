import { revalidateTag } from "next/cache";
import { runSync } from "@/lib/sync-nhl-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Nightly NHL roster sync (see vercel.json): keeps every player's team and
 * position current after trades and call-ups. Only updates roster details and
 * adds new players — never touches votes or admin-set injury statuses. Vercel
 * Cron sends `Authorization: Bearer $CRON_SECRET`; without it the route refuses.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let first;
  try {
    first = await runSync();
  } catch (err) {
    // Usually the NHL rate-limiting us; tomorrow night's run will try again.
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
  let failedTeams = first.failedTeams;
  let retried = 0;
  // The NHL's API sometimes rate-limits a few teams; give those one more try after a pause.
  if (failedTeams.length > 0) {
    await sleep(5000);
    retried = failedTeams.length;
    failedTeams = (await runSync(failedTeams)).failedTeams;
  }

  revalidateTag("rankings", "max");
  return Response.json({ teamsSynced: first.teamsSynced, playersSynced: first.playersSynced, retriedTeams: retried, stillFailed: failedTeams });
}
