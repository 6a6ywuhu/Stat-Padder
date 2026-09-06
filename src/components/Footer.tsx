import Link from "next/link";
import Image from "next/image";
import { NAV_LINKS } from "@/lib/nav";

export function Footer() {
  return (
    <footer className="mt-16 border-t-2 border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="relative h-8 w-[135px]">
              <Image
                src="/brand/stat-padder-1.png"
                alt="Stat Padder"
                fill
                unoptimized
                className="object-contain object-left"
              />
            </div>
            <p className="mt-3 max-w-md text-sm text-[var(--color-fg-muted)]">
              Stat Padder is a fan-run voting site. Not affiliated with the NHL.
              Real stats and rosters are sourced from public NHL data.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 font-display text-sm font-semibold uppercase tracking-wide">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-accent-text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
