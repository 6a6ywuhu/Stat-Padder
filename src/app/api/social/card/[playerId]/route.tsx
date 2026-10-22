import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { scorePlayerUncached } from "@/lib/group-scores";
import { countRatingsForPlayer } from "@/lib/votes";
import { formatRating } from "@/lib/scoring";
import { pixelProfileFor } from "@/lib/pixel-profiles";
import { SKATER_POSITIONS, Position, SkaterPosition } from "@/lib/attributes";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;

const INK = "#10201d";
const MUTED = "#4c625d";
const LINE = "#bdd1ca";
const RED = "#e11d16";
const GREEN = "#157a3d";

async function loadFont(): Promise<Buffer> {
  return readFile(join(process.cwd(), "src", "assets", "Jersey10-Regular.ttf"));
}

async function portraitDataUri(src: string | null, origin: string): Promise<string | null> {
  if (!src) return null;
  try {
    const url = src.startsWith("http") ? src : `${origin}${src}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** 1080×1350 "rate this player" card for Instagram. Public data only. */
export async function GET(req: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const player = await prisma.player.findUnique({ where: { id: playerId }, include: { team: true } });
  if (!player) return new Response("Player not found", { status: 404 });

  const position = player.position as Position;
  const isGoalie = position === "G";

  const [scored, ratings, font] = await Promise.all([
    scorePlayerUncached(
      player.id,
      isGoalie
        ? { kind: "goalie" }
        : { kind: "skater", positions: SKATER_POSITIONS as SkaterPosition[] },
      player.status === "RETIRED" ? ["RETIRED"] : ["ACTIVE", "INJURED"]
    ),
    countRatingsForPlayer(player.id),
    loadFont(),
  ]);

  const origin = new URL(req.url).origin;
  const portrait = await portraitDataUri(
    pixelProfileFor(player.firstName, player.lastName, player.position) ?? player.headshotUrl,
    origin
  );

  const hasVotes = ratings > 0 && scored;
  const overall = hasVotes ? formatRating(scored.overallValue) : "—";
  const name = `${player.firstName} ${player.lastName}`;
  const meta = `${player.position}${player.team ? ` · ${player.team.id}` : ""}`;
  const countLine =
    ratings === 0
      ? "No ratings yet — be the first"
      : `${ratings} ${ratings === 1 ? "rating" : "ratings"} so far`;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "#f1f6f4",
          color: INK,
          fontFamily: "Jersey 10",
          padding: "64px 80px 56px",
        }}
      >
        <div style={{ display: "flex", fontSize: 38, letterSpacing: 14, color: MUTED }}>RATE THIS PLAYER</div>

        <div
          style={{
            display: "flex",
            marginTop: 30,
            width: 540,
            height: 540,
            border: `6px solid ${LINE}`,
            borderRadius: 10,
            background: "#e6efec",
            overflow: "hidden",
          }}
        >
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portrait}
              width={528}
              height={528}
              style={{ width: 528, height: 528, objectFit: "cover", imageRendering: "pixelated" }}
              alt=""
            />
          )}
        </div>

        <div style={{ display: "flex", marginTop: 36, fontSize: name.length > 18 ? 88 : 104, lineHeight: 1 }}>
          {name}
        </div>
        <div style={{ display: "flex", marginTop: 12, fontSize: 38, letterSpacing: 12, color: MUTED }}>{meta}</div>

        <div style={{ display: "flex", alignItems: "center", marginTop: 34, gap: 28 }}>
          <div style={{ display: "flex", fontSize: 38, letterSpacing: 8, color: MUTED }}>COMMUNITY OVERALL</div>
          <div style={{ display: "flex", fontSize: 108, lineHeight: 1, color: GREEN }}>{overall}</div>
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 36, letterSpacing: 4, color: MUTED }}>{countLine}</div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            padding: "20px 44px",
            background: RED,
            color: "#ffffff",
            fontSize: 52,
            letterSpacing: 4,
            borderRadius: 6,
          }}
        >
          {`YOUR VOTE MOVES THIS — RATE ${player.firstName.toUpperCase()}`}
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 34, letterSpacing: 10, color: MUTED }}>
          STATPADDER.CA
        </div>
      </div>
    ),
    { width: W, height: H, fonts: [{ name: "Jersey 10", data: font, style: "normal", weight: 400 }] }
  );
}
