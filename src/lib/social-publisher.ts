import { prisma } from "./prisma";
import { buildCaption, getPlayerSnapshot } from "./social";
import { addDays, buildWeeklyCaption, getWeeklyLeaders, lastCompletedWeekStart, todayInSocialTz, weekdayOf } from "./social-weekly";
import { dailyAutoEnabled, rankedCandidates } from "./social-planner";
import { zonedToUtc } from "./social";
import { publishMedia, publishStory, refreshTokenIfDue } from "./instagram";

/** Posts per run — a catch-up after a missed day shouldn't flood the feed. */
const MAX_PER_RUN = 3;
/** A post this far past its slot is not sent; it's flagged so a human re-schedules it. */
const STALE_AFTER_MS = 36 * 3600 * 1000;

/** The Monday leaders post is automatic unless SOCIAL_WEEKLY_ENABLED=false. */
export function weeklyEnabled(): boolean {
  return process.env.SOCIAL_WEEKLY_ENABLED !== "false";
}

/** Stories are off unless SOCIAL_STORIES_ENABLED=true. */
export function storiesEnabled(): boolean {
  return process.env.SOCIAL_STORIES_ENABLED === "true";
}

export function publishingEnabled(): boolean {
  return process.env.SOCIAL_PUBLISH_ENABLED === "true";
}

function siteUrl(): string {
  // statpadder.ca redirects to www; Meta needs a direct, public URL.
  return (process.env.SOCIAL_SITE_URL ?? "https://www.statpadder.ca").replace(/\/$/, "");
}

/** The post's first slide, on a 9:16 canvas, as an Instagram Story. */
export function storyUrls(imageUrls: string[]): string[] {
  return imageUrls.slice(0, 1).map((u) => `${u}${u.includes("?") ? "&" : "?"}story=1`);
}

/**
 * Posts the first slide as a Story. Stories are a bonus to the feed post, so a
 * failure here is recorded on the row and never turns a posted feed post into
 * a failed one (or causes it to be re-sent).
 */
export async function postStories(postId: string, imageUrls: string[]): Promise<{ ids: string[]; error?: string }> {
  const ids: string[] = [];
  let error: string | undefined;
  for (const url of storyUrls(imageUrls)) {
    try {
      ids.push(await publishStory(url));
    } catch (e) {
      error = ((e as Error).message ?? "unknown error").slice(0, 300);
      break;
    }
  }
  await prisma.socialPost.update({
    where: { id: postId },
    data: { storyIds: ids.length ? ids.join(",") : null, storyError: error ?? null },
  });
  return { ids, error };
}

/** The feed image URL(s) for a post, rebuilt from its row. */
export function imageUrlsFor(post: { kind: string; playerId: string | null; weekStart: string | null }, stamp: number): string[] {
  const site = siteUrl();
  if (post.kind === "WEEKLY") return [`${site}/api/social/weekly-card?week=${post.weekStart}&format=jpg&t=${stamp}`];
  return [1, 2].map((n) => `${site}/api/social/card/${post.playerId}?format=jpg&slide=${n}&t=${stamp}`);
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

  // Other days: if nothing is already lined up for today, pick the next player automatically.
  const todayYmd = todayInSocialTz(now);
  if (dailyAutoEnabled() && weekdayOf(todayYmd) !== 1) {
    const lined = await prisma.socialPost.findFirst({
      where: {
        kind: "PLAYER",
        status: { not: "DRAFT" },
        scheduledFor: { gte: zonedToUtc(todayYmd, "00:00"), lt: zonedToUtc(addDays(todayYmd, 1), "00:00") },
      },
    });
    if (!lined) {
      const next = (await rankedCandidates("fewest"))[0];
      if (!next) {
        results.push({ id: "-", player: "Daily player", action: "skipped", detail: "no eligible rated player left to post — waiting for more ratings" });
      } else {
        if (!opts.dryRun) {
          await prisma.socialPost.create({ data: { kind: "PLAYER", playerId: next.id, scheduledFor: now, status: "APPROVED" } });
        }
        results.push({
          id: "-",
          player: `${next.firstName} ${next.lastName}`,
          action: opts.dryRun ? "would post" : "scheduled",
          detail: "auto-picked for today",
        });
      }
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
    let imageUrls: string[];
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
      imageUrls = [`${siteUrl()}/api/social/weekly-card?week=${post.weekStart}&format=jpg&t=${now.getTime()}`];
    } else {
      const snap = post.playerId ? await getPlayerSnapshot(post.playerId) : null;
      if (!snap) {
        if (!opts.dryRun) await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", error: "Player not found" } });
        results.push({ id: post.id, player: label, action: "failed", detail: "player not found" });
        continue;
      }
      caption = post.captionOverride ?? buildCaption(snap);
      // Slide 1: the card front with ratings; slide 2: the back with NHL stats.
      imageUrls = [1, 2].map((n) => `${siteUrl()}/api/social/card/${post.playerId}?format=jpg&slide=${n}&t=${now.getTime()}`);
    }

    if (opts.dryRun) {
      results.push({ id: post.id, player: label, action: "would post", caption, imageUrl: imageUrls.join("\n     ") });
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
      const mediaId = await publishMedia({ imageUrls, caption });
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { status: "POSTED", externalId: mediaId, postedAt: new Date(), error: null },
      });
      if (storiesEnabled()) {
        const stories = await postStories(post.id, imageUrls);
        results.push({
          id: post.id,
          player: label,
          action: "posted",
          detail: `${mediaId} · ${stories.ids.length} ${stories.ids.length === 1 ? "story" : "stories"}${stories.error ? ` (stories stopped: ${stories.error})` : ""}`,
        });
      } else {
        results.push({ id: post.id, player: label, action: "posted", detail: mediaId });
      }
    } catch (e) {
      const message = ((e as Error).message ?? "unknown error").slice(0, 500);
      await prisma.socialPost.update({ where: { id: post.id }, data: { status: "FAILED", error: message } });
      results.push({ id: post.id, player: label, action: "failed", detail: message });
    }
  }

  return { results, token };
}
