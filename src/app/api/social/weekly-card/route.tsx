import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { formatRating } from "@/lib/scoring";
import { pixelProfileFor } from "@/lib/pixel-profiles";
import { getWeeklyLeaders, lastCompletedWeekStart } from "@/lib/social-weekly";
import { CARD_COLORS, CARD_H as H, CARD_W as W, loadCardFont, portraitDataUri, respondWithCard } from "@/lib/social-image";

export const runtime = "nodejs";

const { ink: INK, muted: MUTED, line: LINE, red: RED, green: GREEN } = CARD_COLORS;

/**
 * 1080×1350 "top 5 scorers of the week" card. ?week=YYYY-MM-DD (the Monday)
 * defaults to the last completed Mon–Sun week; ?format=jpg for Instagram.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const week = url.searchParams.get("week") ?? lastCompletedWeekStart();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return new Response("Bad week", { status: 400 });

  const [weekly, font] = await Promise.all([getWeeklyLeaders(week), loadCardFont()]);
  if (!weekly) return new Response("Fewer than five skaters played that week", { status: 404 });

  const heads = await prisma.player.findMany({
    where: { id: { in: weekly.rows.flatMap((r) => (r.playerId ? [r.playerId] : [])) } },
    select: { id: true, headshotUrl: true },
  });
  const headshot = new Map(heads.map((h) => [h.id, h.headshotUrl]));
  const origin = url.origin;
  const portraits = await Promise.all(
    weekly.rows.map((r) =>
      portraitDataUri(
        pixelProfileFor(r.firstName, r.lastName, r.position) ?? (r.playerId ? headshot.get(r.playerId) ?? null : null),
        origin
      )
    )
  );

  const image = new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: CARD_COLORS.bg,
          color: INK,
          fontFamily: "Jersey 10",
          padding: "56px 60px 52px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 34, letterSpacing: 12, color: MUTED }}>LAST WEEK&apos;S</div>
            <div style={{ display: "flex", fontSize: 92, lineHeight: 1 }}>TOP 5 SCORERS</div>
          </div>
          <div style={{ display: "flex", fontSize: 50, color: RED, paddingBottom: 6 }}>{weekly.label}</div>
        </div>
        <div style={{ display: "flex", height: 3, background: LINE, marginTop: 18 }} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-around" }}>
          {weekly.rows.map((r, i) => {
            const name = `${r.firstName} ${r.lastName}`;
            return (
              <div
                key={r.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 14px",
                  background: i % 2 === 0 ? "rgba(0,0,0,0.04)" : "transparent",
                }}
              >
                <div style={{ display: "flex", width: 56, justifyContent: "flex-end", fontSize: 60, lineHeight: 1, color: RED }}>
                  {r.rank}
                </div>
                <div
                  style={{
                    display: "flex",
                    width: 128,
                    height: 128,
                    marginLeft: 16,
                    border: `3px solid ${LINE}`,
                    borderRadius: 6,
                    background: "#e6efec",
                    overflow: "hidden",
                  }}
                >
                  {portraits[i] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portraits[i]!} width={122} height={122} style={{ width: 122, height: 122, objectFit: "cover", imageRendering: "pixelated" }} alt="" />
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 20, overflow: "hidden" }}>
                  <div style={{ display: "flex", fontSize: Math.min(40, Math.floor(640 / name.length)), lineHeight: 1.05, whiteSpace: "nowrap" }}>
                    {name}
                  </div>
                  <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, color: MUTED, marginTop: 4 }}>
                    {r.position} · {r.team}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 116 }}>
                  <div style={{ display: "flex", fontSize: 64, lineHeight: 1 }}>{r.points}</div>
                  <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, color: MUTED }}>PTS</div>
                  <div style={{ display: "flex", fontSize: 22, color: MUTED }}>{`${r.goals}G ${r.assists}A`}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 84 }}>
                  <div style={{ display: "flex", fontSize: 50, lineHeight: 1 }}>{r.gamesPlayed}</div>
                  <div style={{ display: "flex", fontSize: 22, letterSpacing: 5, color: MUTED }}>GP</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 132 }}>
                  <div style={{ display: "flex", fontSize: 58, lineHeight: 1, color: r.overall === null ? LINE : GREEN }}>
                    {r.overall === null ? "—" : formatRating(r.overall)}
                  </div>
                  <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: MUTED }}>
                    {r.overall === null ? "UNRATED" : "OVERALL"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "18px 40px",
            background: RED,
            color: "#ffffff",
            fontSize: 46,
            letterSpacing: 4,
            borderRadius: 6,
            whiteSpace: "nowrap",
          }}
        >
          RATE THEM ALL — STATPADDER.CA
        </div>
      </div>
    ),
    { width: W, height: H, fonts: [{ name: "Jersey 10", data: font, style: "normal", weight: 400 }] }
  );

  return respondWithCard(image, url.searchParams.get("format") === "jpg");
}
