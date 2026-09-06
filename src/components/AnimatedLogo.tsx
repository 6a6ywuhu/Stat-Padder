"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * The wordmark with a second rendition (stat-padder-2 — the same art with
 * a brighter highlight band baked across the middle) layered on top and
 * swept across left-to-right via a clip-path, so it reads as a shine
 * glinting over the base logo rather than a static highlight or a hard
 * frame-swap.
 *
 * Replays on hover: `playCount` is bumped on mouseenter and used as the
 * shine layer's `key`, so React remounts that element (restarting its CSS
 * animation from the `from` keyframe) instead of trying to restart a
 * still-applied animation, which CSS won't do on its own.
 *
 * `playOnMount` (default true, for the hero) also fires it once on load;
 * the header passes `false` so its logo only glints on hover.
 */
export function AnimatedLogo({
  className,
  imgClassName = "object-contain",
  playOnMount = true,
}: {
  className?: string;
  imgClassName?: string;
  playOnMount?: boolean;
}) {
  // Hero starts at 1 (shine layer mounts → plays once); header starts at
  // 0, so the shine layer isn't rendered at all until the first hover.
  const [playCount, setPlayCount] = useState(playOnMount ? 1 : 0);

  return (
    <div className={className} onMouseEnter={() => setPlayCount((c) => c + 1)}>
      <Image
        src="/brand/stat-padder-1.png"
        alt="Stat Padder"
        fill
        unoptimized
        priority
        className={imgClassName}
      />
      {playCount > 0 && (
        <Image
          key={playCount}
          src="/brand/stat-padder-2.png"
          alt=""
          aria-hidden="true"
          fill
          unoptimized
          className={`shine-sweep ${imgClassName}`}
        />
      )}
    </div>
  );
}
