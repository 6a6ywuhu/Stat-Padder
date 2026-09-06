"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useTheme } from "next-themes";
import { readableTextColor } from "@/lib/contrast";

export type TeamRankStats = {
  gp: number;
  wins: number;
  losses: number;
  otl: number;
  points: number;
  streakCode?: string;
  streakCount?: number;
};

export function TeamRankRow({
  rank,
  id,
  name,
  city,
  primaryColor,
  logoLight,
  logoDark,
  stats,
}: {
  rank: number;
  id: string;
  name: string;
  city: string;
  primaryColor: string;
  logoLight: string;
  logoDark: string;
  stats: TeamRankStats | null;
}) {
  const [hovered, setHovered] = useState(false);
  const { resolvedTheme } = useTheme();
  const hoverFg = readableTextColor(primaryColor);

  // Outside hover the logo matches the page theme; on hover the row fills
  // with the (softened) team color, so the logo follows that contrast.
  const showDarkVariant = hovered ? hoverFg === "#ffffff" : resolvedTheme === "dark";

  const streak =
    stats?.streakCode && stats.streakCount ? `${stats.streakCode}${stats.streakCount}` : "—";

  return (
    <li className="border-b border-[var(--color-border)] last:border-b-0">
      <Link
        href={`/teams/${id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={
          {
            // Team color blended ~20% toward the card so the hover reads as a
            // tint, not a full-saturation slam.
            "--hover-bg": `color-mix(in srgb, ${primaryColor} 80%, var(--color-card))`,
            "--hover-fg": hoverFg,
          } as React.CSSProperties
        }
        className="group flex items-stretch pl-2 transition-colors duration-200 hover:bg-[var(--hover-bg)] sm:pl-3"
      >
        <span className="flex w-5 shrink-0 items-center justify-end py-2 font-display text-sm font-bold tabular-nums text-[var(--color-fg-faint)] group-hover:text-[var(--hover-fg)] sm:py-3">
          {rank}
        </span>
        <span className="relative mx-2 my-auto h-7 w-7 shrink-0 self-center sm:mx-3 sm:h-8 sm:w-8">
          <Image
            src={showDarkVariant ? logoDark : logoLight}
            alt=""
            fill
            sizes="32px"
            unoptimized
            className="object-contain"
          />
        </span>
        <span className="my-auto min-w-0 flex-1 self-center truncate py-2 text-sm font-semibold text-[var(--color-fg)] group-hover:text-[var(--hover-fg)] sm:py-3">
          {city} {name}
        </span>

        {/* Fixed-width columns with vertical rules — same axis on every row. */}
        <span className="flex shrink-0 divide-x divide-[var(--color-border)] border-l border-[var(--color-border)] text-xs tabular-nums group-hover:divide-[var(--hover-fg)]/20 group-hover:border-[var(--hover-fg)]/20">
          <StatCell className="hidden w-16 sm:flex">{stats ? `${stats.gp} GP` : "—"}</StatCell>
          <StatCell className="w-16 sm:w-[4.5rem]">
            {stats ? `${stats.wins}-${stats.losses}-${stats.otl}` : "—"}
          </StatCell>
          <StatCell className="hidden w-12 md:flex">{streak}</StatCell>
          <StatCell className="w-12 pr-3 sm:w-16 sm:pr-4" strong>
            {stats ? stats.points : "—"}
          </StatCell>
        </span>
      </Link>
    </li>
  );
}

/** One aligned standings column — fixed width, centered, full row height. */
function StatCell({
  children,
  className = "",
  strong = false,
}: {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center px-1.5 text-center sm:px-2 ${
        strong
          ? "font-display text-sm font-bold tabular-nums text-[var(--color-fg)]"
          : "text-[var(--color-fg-muted)]"
      } group-hover:text-[var(--hover-fg)] ${className}`}
    >
      {children}
    </span>
  );
}
