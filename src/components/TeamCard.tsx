"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useTheme } from "next-themes";
import { readableTextColor } from "@/lib/contrast";

export function TeamCard({
  id,
  name,
  city,
  primaryColor,
  logoLight,
  logoDark,
}: {
  id: string;
  name: string;
  city: string;
  primaryColor: string;
  logoLight: string;
  logoDark: string;
}) {
  const [hovered, setHovered] = useState(false);
  const { resolvedTheme } = useTheme();
  const hoverFg = readableTextColor(primaryColor);

  // Outside hover: logo matches page theme. On hover, the card background
  // becomes the team color, so the logo must match *that* background's
  // contrast instead, independent of page theme.
  const showDarkVariant = hovered ? hoverFg === "#ffffff" : resolvedTheme === "dark";

  return (
    <Link
      href={`/teams/${id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ "--hover-bg": primaryColor, "--hover-fg": hoverFg } as React.CSSProperties}
      className="group flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center transition-colors duration-200 hover:border-transparent hover:bg-[var(--hover-bg)]"
    >
      <div className="relative h-16 w-16">
        <Image
          src={showDarkVariant ? logoDark : logoLight}
          alt=""
          fill
          sizes="64px"
          unoptimized
          className="object-contain"
        />
      </div>
      <div>
        <p className="text-sm text-[var(--color-fg-muted)] group-hover:text-[var(--hover-fg)]">
          {city}
        </p>
        <p className="font-display text-lg font-bold text-[var(--color-fg)] group-hover:text-[var(--hover-fg)]">
          {name}
        </p>
      </div>
    </Link>
  );
}
