import { publishingEnabled, runDuePosts } from "@/lib/social-publisher";
import { verifyAccount } from "@/lib/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called on a schedule by Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET set the route
 * refuses everything. Until SOCIAL_PUBLISH_ENABLED=true it only reports
 * what it would post.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const dryRun = !publishingEnabled();
  const out = await runDuePosts({ dryRun });
  // On a dry run, also prove the Instagram connection works without posting.
  const account = dryRun ? await verifyAccount() : undefined;
  return Response.json({ dryRun, ...(account ? { account } : {}), ...out });
}
