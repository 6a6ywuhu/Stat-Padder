import { prisma } from "./prisma";
import { buildCaption, getPlayerSnapshot } from "./social";
import { publishPhoto, refreshTokenIfDue } from "./instagram";

/** Posts per run — a catch-up after a missed day shouldn't flood the feed. */
const MAX_PER_RUN = 3;
/** A post this far past its slot is not sent; it's flagged so a human re-schedules it. */
const STALE_AFTER_MS = 36 * 3600 * 1000;

export function publishingEnabled(): boolean {
  return process.env.SOCIAL_PUBLISH_ENABLED === "true";
}

function siteUrl(): string {
  // statpadder.ca redirects to www; Meta needs a direct, public URL.
  return (process.env.SOCIAL_SITE_URL ?? "https://www.statpadder.ca").replace(/\/$/, "");
}

export type RunResult = {
  id: string;
  player: string;
  action: "would post" | "posted" | "failed" | "stale" | "skipped";
  detail?: string;
  caption?: string;
  imageUrl?: string;
};

/**
 * Sends every APPROVED post that is due. With `dryRun` it only reports what
 * it would do and changes nothing. A post is claimed (APPROVED → POSTING)
 * before any call to Instagram, so two overlapping runs can never both post
 * it, and a failure is never retried automatically — a half-finished post
 * could otherwise go out twice.
 */
export async function runDuePosts(opts: { dryRun: boolean; now?: Date }): Promise<{ results: RunResult[]; token?: string }> {
  const now = opts.now ?? new Date();
  const results: RunResult[] = [];
  let token: string | undefined;

  if (!opts.dryRun) {
    token = (await refreshTokenIfDue().catch((e: Error) => ({ refreshed: false, note: e.message }))).note;
  }

  const due = await prisma.socialPost.findMany({
    where: { status: "APPROVED", channel: "instagram", scheduledFor: { lte: now } },
    include: { player: { select: { firstName: true, lastName: true } } },
    orderBy: { scheduledFor: "asc" },
  });

  let handled = 0;
  for (const post of due) {
    const label = `${post.player.firstName} ${post.player.lastName}`;

    if (now.getTime() - post.scheduledFor.getTime() > STALE_AFTER_MS) {
      if (!opts.dryRun) {
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: "FAILED", error: "Missed its time slot — re-schedule it if you still want it posted." },
        });
      }
      results.push({ id: post.id, player: label, action: "stale", detail: "more than 36h overdue" });
      continue;
    }
    if (handled >= MAX_PER_RUN) {
      results.push({ id: post.id, player: label, action: "skipped", detail: "per-run limit; goes out next run" });
      continue;
    }
    handled++;

    const snap = await getPlayerSnapshot(post.playerId);
    if (!snap) {
      if (!opts.dryRun) await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", error: "Player not found" } });
      results.push({ id: post.id, player: label, action: "failed", detail: "player not found" });
      continue;
    }

    const caption = post.captionOverride ?? buildCaption(snap);
    const imageUrl = `${siteUrl()}/api/social/card/${post.playerId}?format=jpg&t=${now.getTime()}`;

    if (opts.dryRun) {
      results.push({ id: post.id, player: label, action: "would post", caption, imageUrl });
      continue;
    }

    const claimed = await prisma.socialPost.updateMany({
      where: { id: post.id, status: "APPROVED" },
      data: { status: "POSTING" },
    });
    if (claimed.count === 0) {
      results.push({ id: post.id, player: label, action: "skipped", detail: "already being handled" });
      continue;
    }

    try {
      const mediaId = await publishPhoto({ imageUrl, caption });
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "POSTED", externalId: mediaId, postedAt: new Date(), error: null },
      });
      results.push({ id: post.id, player: label, action: "posted", detail: mediaId });
    } catch (e) {
      const message = ((e as Error).message ?? "unknown error").slice(0, 500);
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", error: message } });
      results.push({ id: post.id, player: label, action: "failed", detail: message });
    }
  }

  return { results, token };
}
