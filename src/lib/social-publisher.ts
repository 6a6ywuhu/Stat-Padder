import { prisma } from "./prisma";
import { buildCaption, getPlayerSnapshot } from "./social";
import { buildWeeklyCaption, getWeeklyLeaders, lastCompletedWeekStart, todayInSocialTz, weekdayOf } from "./social-weekly";
import { publishPhoto, refreshTokenIfDue } from "./instagram";

/** Posts per run — a catch-up after a missed day shouldn't flood the feed. */
const MAX_PER_RUN = 3;
/** A post this far past its slot is not sent; it's flagged so a human re-schedules it. */
const STALE_AFTER_MS = 36 * 3600 * 1000;

/** The Monday leaders post is automatic unless SOCIAL_WEEKLY_ENABLED=false. */
export function weeklyEnabled(): boolean {
  return process.env.SOCIAL_WEEKLY_ENABLED !== "false";
}

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
  action: "would post" | "posted" | "failed" | "stale" | "skipped" | "scheduled";
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

  // Mondays: queue last week's top-5 post once (the week is complete by then).
  if (weeklyEnabled() && weekdayOf(todayInSocialTz(now)) === 1) {
    const weekStart = lastCompletedWeekStart(now);
    const exists = await prisma.socialPost.findFirst({ where: { kind: "WEEKLY", weekStart } });
    if (!exists) {
      if (!opts.dryRun) {
        await prisma.socialPost.create({
          data: { kind: "WEEKLY", weekStart, scheduledFor: now, status: "APPROVED" },
        });
      }
      results.push({ id: "-", player: `Weekly top 5 (${weekStart})`, action: opts.dryRun ? "would post" : "scheduled", detail: "queued for this run" });
    }
  }

  const due = await prisma.socialPost.findMany({
    where: { status: "APPROVED", channel: "instagram", scheduledFor: { lte: now } },
    include: { player: { select: { firstName: true, lastName: true } } },
    orderBy: { scheduledFor: "asc" },
  });

  let handled = 0;
  for (const post of due) {
    const label = post.kind === "WEEKLY" ? `Weekly top 5 (${post.weekStart})` : `${post.player?.firstName} ${post.player?.lastName}`;

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

    let caption: string;
    let imageUrl: string;
    if (post.kind === "WEEKLY") {
      const weekly = post.weekStart ? await getWeeklyLeaders(post.weekStart).catch(() => null) : null;
      if (!weekly) {
        if (!opts.dryRun) {
          await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", error: "No weekly leaders: fewer than 5 skaters played, or the NHL stats were unavailable" } });
        }
        results.push({ id: post.id, player: label, action: "failed", detail: "no weekly leaders available" });
        continue;
      }
      caption = post.captionOverride ?? buildWeeklyCaption(weekly);
      imageUrl = `${siteUrl()}/api/social/weekly-card?week=${post.weekStart}&format=jpg&t=${now.getTime()}`;
    } else {
      const snap = post.playerId ? await getPlayerSnapshot(post.playerId) : null;
      if (!snap) {
        if (!opts.dryRun) await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", error: "Player not found" } });
        results.push({ id: post.id, player: label, action: "failed", detail: "player not found" });
        continue;
      }
      caption = post.captionOverride ?? buildCaption(snap);
      imageUrl = `${siteUrl()}/api/social/card/${post.playerId}?format=jpg&t=${now.getTime()}`;
    }

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
