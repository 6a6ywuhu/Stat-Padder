import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/SearchBar";
import { StarField } from "@/components/StarField";
import { AnimatedLogo } from "@/components/AnimatedLogo";
import { pixelProfileForName } from "@/lib/pixel-profiles";
import { formatRating } from "@/lib/scoring";
import { NAV_LINKS } from "@/lib/nav";
import {
  getWeeklyLeaders,
  WeeklyPlayer,
  WeeklyTeam,
  WeeklyStatLine,
  WeeklyTeamStats,
} from "@/lib/weekly";

// ISR: the weekly boards only shift when a vote lands or the NHL stat
// windows tick over, so a short revalidate keeps the landing page on the
// CDN edge (no cold-start on the home route) while staying fresh enough
// for a "since Monday" leaderboard. getWeeklyLeaders' own NHL fetches
// keep their longer fetch cache underneath this.
export const revalidate = 300;

export default async function Home() {
  const { players, teams } = await getWeeklyLeaders();

  return (
    <div>
      <section className="bg-arcade border-b-2 border-[var(--color-border)]">
        <StarField />
        <div className="mx-auto max-w-4xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pb-14 sm:pt-24">
          <h1 className="animate-pixel-rise">
            <span className="block font-display text-xl font-semibold uppercase tracking-[0.25em] text-[var(--color-fg-muted)] sm:text-3xl">
              Welcome to
            </span>
            <AnimatedLogo className="img-glow-accent relative mx-auto mt-1 block h-24 w-full max-w-[420px] sm:h-40 sm:max-w-[760px]" />
          </h1>
          <p
            className="animate-pixel-rise mx-auto mt-6 max-w-xl font-display text-lg text-[var(--color-fg-muted)] sm:text-xl"
            style={{ animationDelay: "130ms, 1600ms" }}
          >
            Player ratings, powered by the community.
          </p>
          <div
            className="animate-pixel-rise relative z-20 mx-auto mt-8 flex justify-center"
            style={{ animationDelay: "240ms, 1600ms" }}
          >
            <SearchBar variant="hero" />
          </div>
          <div
            className="animate-pixel-rise mt-7 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "350ms, 1600ms" }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="btn-pixel rounded-md border-[var(--color-border-strong)] bg-[var(--color-card)] px-5 py-2 font-display text-sm font-bold uppercase tracking-wide text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-text)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-14 pt-6 sm:px-6">
        <div className="flex flex-col gap-6">
          <Board title="Biggest rating risers this week" viewAllHref="/rankings" isEmpty={players.length === 0}>
            {players.map((p, i) => (
              <PlayerRow key={p.id} rank={i + 1} player={p} />
            ))}
          </Board>
          <Board title="Top-rated teams" viewAllHref="/team-rankings" isEmpty={teams.length === 0}>
            {teams.map((t, i) => (
              <TeamRow key={t.id} rank={i + 1} team={t} />
            ))}
          </Board>
        </div>
      </section>
    </div>
  );
}

function Board({
  title,
  viewAllHref,
  isEmpty,
  children,
}: {
  title: string;
  viewAllHref: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="panel-pixel bg-[var(--color-card)] p-3 sm:p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-[var(--color-fg)]">
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent-text)] transition-colors hover:text-[var(--color-accent-text-strong)]"
        >
          Full rankings
          <ArrowRight size={12} weight="bold" />
        </Link>
      </div>
      {isEmpty ? (
        <p className="px-2 py-8 text-center text-sm text-[var(--color-fg-muted)]">
          No votes yet this week — check back soon.
        </p>
      ) : (
        <ol className="flex flex-col">{children}</ol>
      )}
    </div>
  );
}

function Rank({ n }: { n: number }) {
  const isTop = n === 1;
  return (
    <span
      className={`flex w-6 shrink-0 items-center justify-center rounded-none font-display text-sm font-bold tabular-nums ${
        isTop
          ? "border border-[var(--color-accent-2)] bg-[var(--color-accent-2)]/15 text-[var(--color-accent-2)]"
          : "text-[var(--color-fg-faint)]"
      }`}
    >
      {n}
    </span>
  );
}

function RiseBadge({ delta }: { delta: number }) {
  return (
    <span className="flex shrink-0 flex-col items-end leading-tight">
      <span
        className={`font-display text-sm font-bold tabular-nums ${
          delta > 0
            ? "text-[var(--color-positive)]"
            : delta < 0
              ? "text-[var(--color-negative)]"
              : "text-[var(--color-fg-faint)]"
        }`}
      >
        {delta > 0 ? "+" : ""}
        {(Math.round(delta * 10) / 10).toFixed(1)}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-fg-faint)]">this week</span>
    </span>
  );
}

function fmtSavePct(p: number | null): string {
  if (p === null) return "—";
  return p.toFixed(3).replace(/^0\./, ".");
}

function StatText({ children }: { children: React.ReactNode }) {
  return (
    <span className="block truncate text-[11px] tabular-nums text-[var(--color-fg-faint)]">
      {children}
    </span>
  );
}

function PlayerStatLine({ stats }: { stats: WeeklyStatLine | null }) {
  if (!stats) return null;
  if (stats.gp === 0) return <StatText>No games this week</StatText>;
  return (
    <StatText>
      {stats.kind === "skater"
        ? `${stats.gp} GP · ${stats.goals} G · ${stats.assists} A · ${stats.points} P`
        : `${stats.gp} GP · ${stats.wins} W · ${stats.losses} L · ${fmtSavePct(stats.savePct)} SV%`}
    </StatText>
  );
}

function TeamStatLine({ stats }: { stats: WeeklyTeamStats | null }) {
  if (!stats) return null;
  if (stats.gp === 0) return <StatText>No games this week</StatText>;
  return (
    <StatText>
      {stats.gp} GP · {stats.wins} W · {stats.losses} L · {stats.otl} OTL
    </StatText>
  );
}

function PlayerRow({ rank, player }: { rank: number; player: WeeklyPlayer }) {
  const portrait = pixelProfileForName(player.name, player.position) ?? player.headshotUrl;
  return (
    <li>
      <Link
        href={`/players/${player.id}`} prefetch={false}
        className="group flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-[var(--color-accent)]/10 sm:gap-3 sm:px-2 sm:py-2.5"
      >
        <Rank n={rank} />
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-bg-subtle)] transition-colors group-hover:border-[var(--color-accent)] sm:h-10 sm:w-10">
          {portrait && (
            <Image src={portrait} alt="" fill sizes="40px" unoptimized className="object-cover" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--color-fg)]">
            {player.name}
          </span>
          <span className="block truncate text-xs text-[var(--color-fg-muted)]">
            {player.position}
            {player.teamAbbrev ? ` · ${player.teamAbbrev}` : ""}
          </span>
          <PlayerStatLine stats={player.stats} />
        </span>
        <RiseBadge delta={player.delta} />
      </Link>
    </li>
  );
}

function TeamRow({ rank, team }: { rank: number; team: WeeklyTeam }) {
  return (
    <li>
      <Link
        href={`/teams/${team.id}`} prefetch={false}
        className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 transition-colors hover:bg-[var(--color-accent)]/10 sm:gap-3 sm:px-2 sm:py-2.5"
      >
        <Rank n={rank} />
        <span className="relative h-9 w-9 shrink-0 sm:h-10 sm:w-10">
          <Image src={team.logoLight} alt="" fill sizes="40px" unoptimized className="object-contain dark:hidden" />
          <Image src={team.logoDark} alt="" fill sizes="40px" unoptimized className="hidden object-contain dark:block" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--color-fg)]">
            {team.city} {team.name}
          </span>
          <TeamStatLine stats={team.stats} />
        </span>
        <OverallBadge value={team.overall} />
      </Link>
    </li>
  );
}

function OverallBadge({ value }: { value: number | null }) {
  return (
    <span className="flex shrink-0 flex-col items-end leading-tight">
      <span
        className={`font-display text-sm font-bold tabular-nums ${
          value === null
            ? "text-[var(--color-fg-faint)]"
            : value < 0
              ? "text-[var(--color-negative)]"
              : "text-[var(--color-positive)]"
        }`}
      >
        {value === null ? "N/A" : formatRating(value)}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-fg-faint)]">overall</span>
    </span>
  );
}
