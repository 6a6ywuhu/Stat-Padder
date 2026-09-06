import type { CSSProperties } from "react";

type Star = {
  /** Vertical position as a percentage of the container — fixed per star;
   *  the motion itself is purely horizontal (left to right only). */
  y: number;
  /** Dot diameter in px. */
  size: number;
  /** Full left-to-right crossing time, in seconds — varies per star so
   *  they don't all move at the same speed. */
  driftDur: number;
  /** Negative seconds: fast-forwards this star's animation to wherever it
   *  would be `-driftPhase` seconds in, so the field starts already full
   *  of stars mid-flight instead of empty until the first one arrives. */
  driftPhase: number;
  /** If set, this star also gets the brightness-flare animation, cycling
   *  every sparkleDur seconds (8-20s) starting sparkleDelay seconds in. */
  sparkleDur?: number;
  sparkleDelay?: number;
};

// Hand-picked rather than randomized so the layout is stable and
// reviewable. Every star starts just off the left edge (--x, set once
// below) and travels the same one-way line — see .star / .star--sparkle
// in globals.css for the actual keyframes. driftPhase is a negative delay
// spread across each star's own duration so they're already spread across
// the screen on first paint rather than all queued up at the left edge.
const STARS: Star[] = [
  { y: 22, size: 2.2, driftDur: 8, driftPhase: -0.8 },
  { y: 12, size: 2.2, driftDur: 10, driftPhase: -3.5, sparkleDur: 14, sparkleDelay: 1 },
  { y: 68, size: 3.2, driftDur: 12, driftPhase: -7.2 },
  { y: 38, size: 2.2, driftDur: 7, driftPhase: -1.4, sparkleDur: 9, sparkleDelay: 3 },
  { y: 82, size: 2.2, driftDur: 9, driftPhase: -7.2 },
  { y: 88, size: 3.2, driftDur: 11, driftPhase: -4.95, sparkleDur: 18, sparkleDelay: 0 },
  { y: 8, size: 2.2, driftDur: 6.5, driftPhase: -0.98 },
  { y: 52, size: 2.2, driftDur: 9.5, driftPhase: -6.65, sparkleDur: 11, sparkleDelay: 5 },
  { y: 30, size: 2.2, driftDur: 6, driftPhase: -3 },
  { y: 55, size: 2.2, driftDur: 13, driftPhase: -3.25, sparkleDur: 20, sparkleDelay: 2 },
  { y: 65, size: 3.2, driftDur: 10.5, driftPhase: -0.53 },
  { y: 60, size: 2.2, driftDur: 7.5, driftPhase: -6.75 },
  { y: 45, size: 3.2, driftDur: 12.5, driftPhase: -6.88 },
  { y: 25, size: 2.2, driftDur: 8.5, driftPhase: -2.55, sparkleDur: 16, sparkleDelay: 6 },
];

/** The homepage hero's star field — see .star / .star--sparkle in
 *  globals.css for the actual drift/sparkle animations these values feed. */
export function StarField() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {STARS.map((s, i) => (
        <span
          key={i}
          className={s.sparkleDur ? "star star--sparkle" : "star"}
          style={
            {
              "--x": "-6%",
              "--y": `${s.y}%`,
              "--size": `${s.size}px`,
              "--drift-dur": `${s.driftDur}s`,
              "--drift-delay": `${s.driftPhase}s`,
              ...(s.sparkleDur && {
                "--sparkle-dur": `${s.sparkleDur}s`,
                "--sparkle-delay": `${s.sparkleDelay}s`,
              }),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
