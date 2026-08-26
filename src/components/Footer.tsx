import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-[var(--color-fg-muted)] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Stat Padder is a fan-run voting site. Not affiliated with the NHL.
            Real stats and rosters are sourced from public NHL data.
          </p>
          <nav className="flex gap-4">
            <Link href="/teams" className="hover:text-[var(--color-fg)]">
              Teams
            </Link>
            <Link href="/player-stats" className="hover:text-[var(--color-fg)]">
              Player Stats
            </Link>
            <Link href="/rankings" className="hover:text-[var(--color-fg)]">
              Rankings
            </Link>
            <Link href="/history" className="hover:text-[var(--color-fg)]">
              History
            </Link>
            <Link href="/legends" className="hover:text-[var(--color-fg)]">
              Legends
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
