/**
 * Manage the Instagram post schedule.
 *
 *   npm run social -- preview [file]   read the schedule file, show who/when + the live caption (writes nothing)
 *   npm run social -- add [file]       same, then save each line as a DRAFT post
 *   npm run social -- list             upcoming and recent posts with their status
 *   npm run social -- approve <id|all> let a DRAFT go out when it is due
 *   npm run social -- unapprove <id>   put an APPROVED post back to DRAFT
 *   npm run social -- cancel <id>      delete a post that hasn't gone out
 *   npm run social -- plan [--days 14] [--start YYYY-MM-DD] [--time 08:00] [--order fewest|top] [--include-mondays] [--include-unrated]
 *                                      propose one player per day into social/plan.txt for you to review, then `add` it
 *   npm run social -- weekly [YYYY-MM-DD]  preview a week's top-5 scorers post (default: the last completed week)
 *   npm run social -- publish          show what is due right now (posts nothing)
 *   npm run social -- publish --live   actually post what is due (needs SOCIAL_PUBLISH_ENABLED=true)
 *   npm run social -- retry <id>       re-queue a FAILED post (check Instagram first that it didn't go out)
 *
 * Schedule file (default social/schedule.txt), one post per line, times in Vancouver:
 *   2026-10-23 09:00 | Sam Reinhart
 *   2026-10-24 09:00 | Aleksander Barkov | optional custom caption
 *   2026-10-25 09:00 | Elias Pettersson (D)     <- add the position when two players share a name
 *
 * Runs against whatever database .env points at (production, when the Turso
 * variables are set).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { rankedCandidates } from "../src/lib/social-planner";
import { buildWeeklyCaption, getWeeklyLeaders, lastCompletedWeekStart, todayInSocialTz, weekdayOf } from "../src/lib/social-weekly";
import { publishingEnabled, runDuePosts } from "../src/lib/social-publisher";
import {
  SOCIAL_TZ,
  buildCaption,
  findPlayersByName,
  formatWhen,
  getPlayerSnapshot,
  zonedToUtc,
} from "../src/lib/social";

const DEFAULT_FILE = "social/schedule.txt";

type Line = { n: number; when: Date; name: string; caption: string | null };

function parseFile(path: string): { lines: Line[]; errors: string[] } {
  const lines: Line[] = [];
  const errors: string[] = [];
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((raw, i) => {
      const text = raw.trim();
      if (!text || text.startsWith("#")) return;
      const [when, name, ...rest] = text.split("|").map((s) => s.trim());
      const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})$/.exec(when ?? "");
      if (!m || !name) {
        errors.push(`line ${i + 1}: expected "YYYY-MM-DD HH:MM | Player Name" — got "${text}"`);
        return;
      }
      const date = zonedToUtc(m[1], m[2].padStart(5, "0"));
      if (Number.isNaN(date.getTime())) {
        errors.push(`line ${i + 1}: "${when}" isn't a real date/time`);
        return;
      }
      lines.push({ n: i + 1, when: date, name, caption: rest.join(" | ").trim() || null });
    });
  return { lines, errors };
}

async function resolveLines(path: string) {
  const { lines, errors } = parseFile(path);
  const resolved: { line: Line; playerId: string }[] = [];
  for (const line of lines) {
    const posTag = /^(.*?)\s*\((C|LW|RW|D|G)\)$/i.exec(line.name);
    const lookup = posTag ? posTag[1] : line.name;
    let matches = await findPlayersByName(lookup);
    if (posTag) matches = matches.filter((p) => p.position === posTag[2].toUpperCase());
    if (matches.length === 0) {
      errors.push(`line ${line.n}: no active player named "${line.name}"`);
    } else if (matches.length > 1) {
      const options = matches.map((p) => `${p.name} ${p.position}·${p.teamId} (${p.id})`).join("; ");
      errors.push(`line ${line.n}: "${line.name}" matches ${matches.length} players (${options}) — add the position, e.g. "${line.name} (${matches[0].position})"`);
    } else {
      resolved.push({ line, playerId: matches[0].id });
    }
  }
  return { resolved, errors };
}

async function showPreview(path: string) {
  const { resolved, errors } = await resolveLines(path);
  const now = Date.now();
  for (const { line, playerId } of resolved) {
    const snap = await getPlayerSnapshot(playerId);
    if (!snap) continue;
    console.log(`\n${formatWhen(line.when)}  ·  ${snap.firstName} ${snap.lastName}  (${snap.position} · ${snap.teamId ?? "—"})`);
    if (line.when.getTime() < now) console.log("  ! this time is in the past");
    console.log("  " + (line.caption ?? buildCaption(snap)).replace(/\n/g, "\n  "));
  }
  if (errors.length) {
    console.log("\nProblems:");
    errors.forEach((e) => console.log("  - " + e));
  }
  console.log(`\n${resolved.length} ready, ${errors.length} with problems. Times are ${SOCIAL_TZ}.`);
  return { resolved, errors };
}

async function add(path: string) {
  const { resolved, errors } = await showPreview(path);
  if (errors.length) {
    console.log("\nNothing saved — fix the problems above first.");
    process.exitCode = 1;
    return;
  }
  let created = 0;
  let skipped = 0;
  for (const { line, playerId } of resolved) {
    const existing = await prisma.socialPost.findFirst({
      where: { playerId, channel: "instagram", scheduledFor: line.when },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.socialPost.create({
      data: { playerId, scheduledFor: line.when, captionOverride: line.caption },
    });
    created++;
  }
  console.log(`\nSaved ${created} draft${created === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} already scheduled` : ""}.`);
  console.log('Nothing posts until you approve: npm run social -- approve all');
}


function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}

/**
 * One player per day. Candidates are players with a hand-drawn pixel portrait
 * who aren't already scheduled or posted. Default order is fewest ratings
 * first (they need votes most); --order top starts from the best-rated.
 * Mondays are skipped because that day carries the weekly top-5 post.
 */
async function plan() {
  const days = Number(flag("days") ?? 14);
  const time = flag("time") ?? "08:00";
  const order = flag("order") ?? "fewest";
  const includeMondays = process.argv.includes("--include-mondays");
  let day = flag("start") ?? addDaysYmd(todayInSocialTz(), 1);

  const players = await prisma.player.findMany({
    where: { status: { in: ["ACTIVE", "INJURED"] } },
    select: { id: true, firstName: true, lastName: true, position: true },
  });
  const includeUnrated = process.argv.includes("--include-unrated");
  const candidates = (await rankedCandidates(order === "top" ? "top" : "fewest", { includeUnrated })).map((c) => ({ ...c, n: c.votes }));

  const names = new Map<string, number>();
  for (const p of players) names.set(`${p.firstName} ${p.lastName}`, (names.get(`${p.firstName} ${p.lastName}`) ?? 0) + 1);

  const lines: string[] = [];
  const shown: string[] = [];
  for (const p of candidates) {
    if (lines.length >= days) break;
    while (!includeMondays && weekdayOf(day) === 1) day = addDaysYmd(day, 1);
    const full = `${p.firstName} ${p.lastName}`;
    const tag = (names.get(full) ?? 0) > 1 ? ` (${p.position})` : "";
    lines.push(`${day} ${time} | ${full}${tag}`);
    shown.push(`${day}  ${full.padEnd(24)} ${p.position}  ${p.n === 0 ? "no ratings" : `${p.n} rating${p.n === 1 ? "" : "s"}`}`);
    day = addDaysYmd(day, 1);
  }
  if (!lines.length) return console.log("No unscheduled rated players with pixel portraits left (add --include-unrated to include players nobody has rated).");

  writeFileSync(
    "social/plan.txt",
    `# Proposed daily posts (${order === "top" ? "best-rated first" : "fewest ratings first"}). Edit freely, then: npm run social -- add social/plan.txt\n${lines.join("\n")}\n`
  );
  console.log(shown.join("\n"));
  console.log(`\nWrote ${lines.length} lines to social/plan.txt${includeMondays ? "" : " (Mondays skipped — the weekly top-5 post goes out then)"}.`);
  console.log("Review/reorder it, then: npm run social -- add social/plan.txt   and   npm run social -- approve all");
}

async function weekly(arg?: string) {
  const week = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : lastCompletedWeekStart();
  const w = await getWeeklyLeaders(week);
  if (!w) return console.log(`Week of ${week}: fewer than five skaters played, so no post.`);
  console.log(`Week of ${w.weekStart} → ${w.weekEnd}\n`);
  console.log(buildWeeklyCaption(w));
  console.log(`\nCard: /api/social/weekly-card?week=${w.weekStart}   (add &format=jpg for the Instagram version)`);
}

async function list() {
  const posts = await prisma.socialPost.findMany({
    include: { player: { select: { firstName: true, lastName: true } } },
    orderBy: { scheduledFor: "asc" },
    take: 60,
  });
  if (!posts.length) return console.log("No posts scheduled.");
  for (const p of posts) {
    const extra = p.error ? `  error: ${p.error}` : p.externalId ? `  id: ${p.externalId}` : "";
    console.log(
      `${p.status.padEnd(8)} ${formatWhen(p.scheduledFor).padEnd(26)} ${(p.kind === "WEEKLY" ? `Weekly top 5 (${p.weekStart})` : `${p.player?.firstName} ${p.player?.lastName}`).padEnd(24)} ${p.id}${extra}`
    );
  }
}

async function setStatus(id: string, from: string[], to: string) {
  if (id === "all") {
    const r = await prisma.socialPost.updateMany({ where: { status: { in: from } }, data: { status: to } });
    return console.log(`${r.count} post${r.count === 1 ? "" : "s"} → ${to}`);
  }
  const r = await prisma.socialPost.updateMany({ where: { id, status: { in: from } }, data: { status: to } });
  console.log(r.count ? `${id} → ${to}` : `No ${from.join("/")} post with id ${id}`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case "preview":
      await showPreview(arg ?? DEFAULT_FILE);
      break;
    case "add":
      await add(arg ?? DEFAULT_FILE);
      break;
    case "list":
      await list();
      break;
    case "approve":
      if (!arg) throw new Error("approve needs a post id, or 'all'");
      await setStatus(arg, ["DRAFT"], "APPROVED");
      break;
    case "unapprove":
      if (!arg) throw new Error("unapprove needs a post id");
      await setStatus(arg, ["APPROVED"], "DRAFT");
      break;
    case "plan":
      await plan();
      break;
    case "weekly":
      await weekly(arg);
      break;
    case "retry":
      if (!arg) throw new Error("retry needs a post id");
      await setStatus(arg, ["FAILED"], "APPROVED");
      break;
    case "publish": {
      const live = process.argv.includes("--live");
      if (live && !publishingEnabled()) throw new Error("Refusing to post: set SOCIAL_PUBLISH_ENABLED=true first.");
      const { results, token } = await runDuePosts({ dryRun: !live });
      console.log(live ? "LIVE run" : "DRY run — nothing is posted");
      if (token) console.log("token:", token);
      if (!results.length) console.log("Nothing due.");
      for (const r of results) {
        console.log(`\n${r.action.toUpperCase()}  ${r.player}  ${r.id}${r.detail ? `  (${r.detail})` : ""}`);
        if (r.imageUrl) console.log("  image:", r.imageUrl);
        if (r.caption) console.log("  " + r.caption.replace(/\n/g, "\n  "));
      }
      break;
    }
    case "cancel": {
      if (!arg) throw new Error("cancel needs a post id");
      const r = await prisma.socialPost.deleteMany({ where: { id: arg, status: { in: ["DRAFT", "APPROVED", "FAILED"] } } });
      console.log(r.count ? `Deleted ${arg}` : `No cancellable post with id ${arg}`);
      break;
    }
    default:
      console.log("Commands: preview [file] | add [file] | list | approve <id|all> | unapprove <id> | cancel <id> | retry <id> | plan | weekly [date] | publish [--live]");
  }
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
