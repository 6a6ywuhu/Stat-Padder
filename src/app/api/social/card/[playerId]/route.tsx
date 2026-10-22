import { ImageResponse } from "next/og";
import { getPlayerSnapshot } from "@/lib/social";
import { formatRating } from "@/lib/scoring";
import { pixelProfileFor } from "@/lib/pixel-profiles";
import { CARD_COLORS, CARD_H as H, CARD_W as W, loadCardFont, portraitDataUri, respondWithCard } from "@/lib/social-image";

export const runtime = "nodejs";

const { ink: INK, muted: MUTED, line: LINE, red: RED, green: GREEN } = CARD_COLORS;

/** 1080×1350 "rate this player" card for Instagram. Public data only. PNG by default, JPEG with ?format=jpg. */
export async function GET(req: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const [snap, font] = await Promise.all([getPlayerSnapshot(playerId), loadCardFont()]);
  if (!snap) return new Response("Player not found", { status: 404 });

  const origin = new URL(req.url).origin;
  const portrait = await portraitDataUri(
    pixelProfileFor(snap.firstName, snap.lastName, snap.position) ?? snap.headshotUrl,
    origin
  );

  const ratings = snap.ratings;
  const overall = snap.overall === null ? "—" : formatRating(snap.overall);
  const name = `${snap.firstName} ${snap.lastName}`;
  const meta = `${snap.position}${snap.teamId ? ` · ${snap.teamId}` : ""}`;
  const cta = `YOUR VOTE MOVES THIS — RATE ${snap.firstName.toUpperCase()}`;
  const countLine =
    ratings === 0
      ? "No ratings yet — be the first"
      : `${ratings} ${ratings === 1 ? "rating" : "ratings"} so far`;

  const image = new ImageResponse(
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
            fontSize: Math.min(52, Math.floor(1680 / cta.length)),
            letterSpacing: 4,
            borderRadius: 6,
            justifyContent: "center",
            whiteSpace: "nowrap",
          }}
        >
          {cta}
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 34, letterSpacing: 10, color: MUTED }}>
          STATPADDER.CA
        </div>
      </div>
    ),
    { width: W, height: H, fonts: [{ name: "Jersey 10", data: font, style: "normal", weight: 400 }] }
  );

  return respondWithCard(image, new URL(req.url).searchParams.get("format") === "jpg");
}
