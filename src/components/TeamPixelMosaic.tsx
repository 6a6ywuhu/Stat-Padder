import type { ReactNode } from "react";

/* A mosaic gradient: a fixed grid of cells, each painted a single flat
 * colour, that together read as a smooth gradient sampled down to a low-res
 * grid — like the reference textures.
 *
 * The value field is a diagonal ramp plus a gentle radial pull toward a
 * bright point, warped by a low-frequency wave so the contour bands curve
 * and flow instead of running as straight parallel stripes. There is no
 * per-cell random noise (that read as camo) — nearby cells always move
 * together, so the grid stays smooth.
 *
 * Colour is blended in OKLab (perceptual) so a navy → gold pairing moves
 * through coherent tones instead of grey mud, the ramp is eased so the
 * field stays primary-dominant with the secondary in the hot corner, and
 * every cell is lifted slightly toward white. A vertical sheen plus the
 * low overall opacity (composited over --color-bg-subtle) give the
 * frosted-glass read.
 *
 * Rendered as an SVG sized in cell units and stretched to cover the banner
 * (slice, so cells stay square at any banner aspect ratio), behind the
 * banner content. */

const COLS = 48;
const ROWS = 16;
/** Steps the colour is snapped to — high enough that the bands flow. */
const STEPS = 24;

/** Low-frequency wave in ~[-1, 1]. Summed sines, not random noise, so the
 *  offset varies smoothly across the grid — broad sweeps that make the
 *  contour bands curl, rather than speckle. */
function wave(x: number, y: number): number {
  return (
    Math.sin(x * 2.0 + y * 1.4) * 0.52 +
    Math.sin(x * 1.05 - y * 2.3 + 2.1) * 0.34 +
    Math.sin(x * 3.3 + y * 3.7 + 4.7) * 0.14
  );
}

export function TeamPixelMosaic({ primary, secondary }: { primary: string; secondary: string }) {
  const cells: ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c / (COLS - 1);
      const y = r / (ROWS - 1);

      // Diagonal ramp (primary top-left → secondary bottom-right) blended
      // with a radial falloff from a bright point just inside the top-left,
      // weighted toward the radial term so the bands curl outward rather
      // than running as parallel stripes.
      const diag = 0.56 * x + 0.44 * y;
      const dx = x - 0.16;
      const dy = y - 0.08;
      const radial = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 1.12);
      let t = diag * 0.5 + radial * 0.5;

      // Ripple the bands so they flow.
      t += wave(x, y) * 0.08;

      // Ease toward primary so most of the field is one coherent hue.
      t = Math.pow(Math.max(0, Math.min(1, t)), 1.3);

      // Snap to steps so runs of cells share one flat value.
      t = Math.round(t * STEPS) / STEPS;

      const p = Math.round((1 - t) * 100);
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={c}
          y={r}
          // A hair of overlap so no seam shows between cells once scaled.
          width={1.01}
          height={1.01}
          fill={`color-mix(in oklab, color-mix(in oklab, ${primary} ${p}%, ${secondary}), white 9%)`}
        />,
      );
    }
  }

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${COLS} ${ROWS}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ opacity: 0.62 }}
    >
      <defs>
        <linearGradient id="tpm-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
          <stop offset="38%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="66%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(6,12,22,0.14)" />
        </linearGradient>
      </defs>
      {cells}
      <rect x="0" y="0" width={COLS} height={ROWS} fill="url(#tpm-sheen)" />
    </svg>
  );
}
