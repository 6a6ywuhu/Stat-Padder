import type { ReactNode } from "react";
import type { CardData } from "./social-card-data";
import { formatRating } from "./scoring";
import { POSITION_LABELS, Position } from "./attributes";
import { readableTextColor } from "./contrast";
import { CARD_COLORS, CARD_H as H, CARD_W as W } from "./social-image";

/**
 * The two hockey-card slides: a front (ratings) and a back (stats). Written for
 * Satori, so every element is display:flex and styles stay within what it supports.
 */

const { ink: INK, muted: MUTED, red: RED, green: GREEN } = CARD_COLORS;
const STOCK = "#f4eedd"; // card stock
const PAPER = "#fffdf6";
const EMPTY = "#dcd8c8";

const BAR_COLORS: Record<string, [string, string]> = {
  green: ["#74a319", "#157a3d"],
  blue: ["#0891b2", "#1d4ed8"],
  purple: ["#c026d3", "#7e22ce"],
};

function rgba(hex: string, a: number): string {
  const c = hex.replace("#", "");
  return `rgba(${parseInt(c.slice(0, 2), 16)},${parseInt(c.slice(2, 4), 16)},${parseInt(c.slice(4, 6), 16)},${a})`;
}

function teamColors(d: CardData) {
  const primary = d.snap.teamColors?.primary ?? "#10201d";
  return { primary, fg: readableTextColor(primary) };
}

/**
 * Instagram Stories are 9:16. The card sits centred on a dark ground, clear of
 * the app's top and bottom bars. The API can't attach a link to a Story, so the
 * margins carry a plain-text pointer to the new feed post instead.
 */
export const STORY_H = 1920;
export function storyFrame(card: ReactNode, ground: string = INK) {
  const margin = (H === 1350 ? STORY_H - H : 0) / 2;
  const text = { display: "flex", fontFamily: "Jersey 10", color: STOCK, letterSpacing: 7 } as const;
  return (
    <div style={{ width: W, height: STORY_H, display: "flex", flexDirection: "column", alignItems: "center", background: ground }}>
      <div style={{ display: "flex", height: margin, alignItems: "flex-end", justifyContent: "center", paddingBottom: 26 }}>
        <div style={{ ...text, fontSize: 38 }}>↑  NEW POST  ·  TAP OUR NAME TO SEE IT</div>
      </div>
      {card}
      <div style={{ display: "flex", height: margin, alignItems: "flex-start", justifyContent: "center", paddingTop: 30 }}>
        <div style={{ ...text, fontSize: 34, opacity: 0.75 }}>STATPADDER.CA</div>
      </div>
    </div>
  );
}

/** The card itself: team-colour edge, ink keyline, stock face, thin inner rule. */
function frame(primary: string, children: ReactNode) {
  return (
    <div style={{ width: W, height: H, display: "flex", background: primary, padding: 34, fontFamily: "Jersey 10" }}>
      <div style={{ display: "flex", flex: 1, background: STOCK, border: `6px solid ${INK}`, padding: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, border: `3px solid ${primary}`, padding: "24px 26px 22px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function nameBanner(d: CardData, primary: string, fg: string) {
  const name = `${d.snap.firstName} ${d.snap.lastName}`.toUpperCase();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: primary,
        color: fg,
        border: `4px solid ${INK}`,
        boxShadow: `8px 8px 0 ${INK}`,
        padding: "12px 16px 8px",
        fontSize: Math.min(96, Math.floor(1750 / name.length)),
        lineHeight: 1,
        letterSpacing: 3,
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </div>
  );
}

function subtitle(d: CardData) {
  const s = d.snap;
  const parts = [POSITION_LABELS[s.position as Position]?.toUpperCase() ?? s.position, s.teamFullName?.toUpperCase(), d.stats?.jersey != null ? `#${d.stats.jersey}` : null];
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 20, fontSize: 34, letterSpacing: 7, color: MUTED }}>
      {parts.filter(Boolean).join("  ·  ")}
    </div>
  );
}

function segmentedBar(value: number | null, colors: [string, string], height: number) {
  const SEGS = 20;
  const filled = value === null ? 0 : Math.round((Math.min(100, Math.abs(value)) / 100) * SEGS);
  const negative = value !== null && value < 0;
  return (
    <div style={{ display: "flex", flex: 1, gap: 4, height }}>
      {Array.from({ length: SEGS }, (_, i) => {
        const on = i < filled;
        const t = i / (SEGS - 1);
        const color = negative ? "#b6301f" : t < 0.5 ? colors[0] : colors[1];
        return <div key={i} style={{ display: "flex", flex: 1, height, background: on ? color : EMPTY }} />;
      })}
    </div>
  );
}

function ratingRow(label: string, value: number | null, colors: [string, string], compact: boolean) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", width: compact ? 250 : 210, fontSize: compact ? 28 : 32, letterSpacing: 5, color: MUTED }}>{label}</div>
      {segmentedBar(value, colors, compact ? 18 : 24)}
      <div style={{ display: "flex", width: 110, justifyContent: "flex-end", fontSize: compact ? 38 : 46, lineHeight: 1, color: value === null ? "#b9b5a3" : INK }}>
        {value === null ? "—" : formatRating(value)}
      </div>
    </div>
  );
}

export function frontCard(d: CardData, portrait: string | null, nextHint: "SWIPE" | "POST" = "SWIPE") {
  const { primary, fg } = teamColors(d);
  const s = d.snap;
  const photo = d.isGoalie ? 380 : 490;
  const rated = s.overall !== null;
  const cta = s.ratings > 0 ? `YOUR VOTE MOVES THIS — RATE ${s.firstName.toUpperCase()}` : `BE THE FIRST TO RATE ${s.firstName.toUpperCase()}`;

  const rows = d.isGoalie
    ? (s.goalieAttributes ?? []).map((a) => ratingRow(a.label.toUpperCase(), a.value, BAR_COLORS.green, true))
    : [
        ratingRow("GENERAL", s.categories?.general ?? null, BAR_COLORS.green, false),
        ratingRow("OFFENSE", s.categories?.offense ?? null, BAR_COLORS.blue, false),
        ratingRow("DEFENSE", s.categories?.defense ?? null, BAR_COLORS.purple, false),
      ];

  return frame(
    primary,
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", width: photo + 20, height: photo + 20, border: `6px solid ${INK}`, background: "#e6efec", boxShadow: `8px 8px 0 ${primary}` }}>
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} width={photo + 8} height={photo + 8} style={{ width: photo + 8, height: photo + 8, objectFit: "cover", imageRendering: "pixelated" }} alt="" />
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>{nameBanner(d, primary, fg)}</div>
      {subtitle(d)}

      <div style={{ display: "flex", flexDirection: "column", marginTop: 22, padding: "14px 22px 16px", background: PAPER, border: `3px solid ${INK}`, gap: d.isGoalie ? 8 : 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: MUTED }}>{s.baselineOnly ? "STATS-BASED RATINGS" : "COMMUNITY RATINGS"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 28, letterSpacing: 5, color: MUTED }}>OVERALL</div>
            <div style={{ display: "flex", fontSize: 64, lineHeight: 1, color: rated ? GREEN : "#b9b5a3" }}>{rated ? formatRating(s.overall!) : "—"}</div>
          </div>
        </div>
        {rows}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", paddingTop: 20, alignItems: "center", gap: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
            padding: "16px 24px 12px",
            background: RED,
            color: "#fff",
            border: `4px solid ${INK}`,
            fontSize: Math.min(46, Math.floor(1500 / cta.length)),
            letterSpacing: 3,
            whiteSpace: "nowrap",
          }}
        >
          {cta}
        </div>
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 7, color: MUTED }}>{nextHint === "POST" ? "FULL STATS ON THE POST  ↑" : "SWIPE FOR THE STATS  →"}</div>
      </div>
    </div>
  );
}

export function backCard(d: CardData, portrait: string | null) {
  const { primary, fg } = teamColors(d);
  const s = d.snap;
  const st = d.stats;
  const goalie = d.isGoalie;
  const cellW = goalie ? 98 : 112;

  const bio = st?.bio ?? [];
  return frame(
    primary,
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ display: "flex", width: 150, height: 150, border: `5px solid ${INK}`, background: "#e6efec", flexShrink: 0 }}>
          {portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} width={140} height={140} style={{ width: 140, height: 140, objectFit: "cover", imageRendering: "pixelated" }} alt="" />
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{nameBanner(d, primary, fg)}</div>
      </div>
      {subtitle(d)}

      {st && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 12, fontSize: 26, letterSpacing: 4, color: MUTED, gap: 2 }}>
          <div style={{ display: "flex" }}>{bio.slice(0, 3).join("   ·   ")}</div>
          <div style={{ display: "flex" }}>{bio.slice(3).join("   ·   ")}</div>
        </div>
      )}

      <div style={{ display: "flex", marginTop: 34, fontSize: 30, letterSpacing: 8, color: MUTED }}>{st?.featuredLabel ?? "THIS SEASON"}</div>
      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
        {(st?.thisSeason ?? []).map((b, i) => (
          <div
            key={b.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              padding: "26px 0 18px",
              background: i === 0 ? primary : PAPER,
              color: i === 0 ? fg : INK,
              border: `4px solid ${INK}`,
              boxShadow: `6px 6px 0 ${INK}`,
            }}
          >
            <div style={{ display: "flex", fontSize: 92, lineHeight: 1 }}>{b.value}</div>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 6, opacity: 0.8 }}>{b.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 34, background: PAPER, border: `3px solid ${INK}` }}>
        {!st ? (
          <div style={{ display: "flex", padding: 30, fontSize: 34, color: MUTED }}>NHL stats are unavailable right now.</div>
        ) : st.rows.length === 0 ? (
          <div style={{ display: "flex", padding: 30, fontSize: 34, color: MUTED }}>No NHL games played yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "10px 16px 6px", fontSize: 26, letterSpacing: 4, color: MUTED, borderBottom: `3px solid ${INK}` }}>
              <div style={{ display: "flex", width: 120 }}>SEASON</div>
              <div style={{ display: "flex", flex: 1 }}>TEAM</div>
              {st.columns.map((c) => (
                <div key={c} style={{ display: "flex", width: cellW, justifyContent: "flex-end" }}>{c}</div>
              ))}
            </div>
            {st.rows.map((r, i) => (
              <div
                key={`${r.label}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "17px 16px 10px",
                  fontSize: 42,
                  background: r.current ? rgba(primary, 0.16) : "transparent",
                  borderTop: r.label === "CAREER" ? `3px solid ${INK}` : "none",
                  color: INK,
                }}
              >
                <div style={{ display: "flex", width: 120 }}>{r.label}</div>
                <div style={{ display: "flex", flex: 1, fontSize: 28, letterSpacing: 3, color: MUTED }}>{r.team}</div>
                {r.cells.map((c, j) => (
                  <div key={j} style={{ display: "flex", width: cellW, justifyContent: "flex-end" }}>{c}</div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", padding: "14px 22px 10px", background: PAPER, border: `3px solid ${INK}` }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: s.baselineOnly ? 3 : 6, color: MUTED }}>{s.baselineOnly ? "STATS-BASED OVERALL" : "COMMUNITY OVERALL"}</div>
          <div style={{ display: "flex", fontSize: 24, letterSpacing: 3, color: MUTED }}>
            {s.ratings === 0 ? "NO COMMUNITY RATINGS YET" : `${s.ratings} ${s.ratings === 1 ? "RATING" : "RATINGS"}`}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1, color: s.overall === null ? "#b9b5a3" : GREEN }}>
          {s.overall === null ? "—" : formatRating(s.overall)}
        </div>
        <div style={{ display: "flex", padding: "14px 26px 10px", background: RED, color: "#fff", border: `4px solid ${INK}`, fontSize: 38, letterSpacing: 3 }}>
          RATE AT STATPADDER.CA
        </div>
      </div>
    </div>
  );
}
