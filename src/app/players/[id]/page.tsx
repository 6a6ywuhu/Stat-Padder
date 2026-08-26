import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getScoredGroup } from "@/lib/group-scores";
import {
  attributesForPosition,
  ATTRIBUTE_LABELS,
  BOOSTER_ATTRIBUTES,
  BOOSTER_ATTRIBUTE_LABELS,
  POSITION_LABELS,
  Position,
  SkaterPosition,
  SKATER_POSITIONS,
} from "@/lib/attributes";
import { getPlayerLanding } from "@/lib/nhl-api";
import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { teamAccentStyle } from "@/lib/contrast";
import { OverallBarDisplay } from "@/components/AttributeBar";
import { PlayerAttributeRow } from "@/components/PlayerAttributeRow";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportButton } from "@/components/ReportButton";

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cross?: string }>;
}) {
  const { id } = await params;
  const { cross } = await searchParams;

  const player = await prisma.player.findUnique({ where: { id }, include: { team: true } });
  if (!player) notFound();

  const position = player.position as Position;
  const isGoalie = position === "G";
  const crossPosition = !isGoalie && cross === "1";

  const group = await getScoredGroup(
    isGoalie
      ? { kind: "goalie" }
      : { kind: "skater", positions: crossPosition ? SKATER_POSITIONS : [position as SkaterPosition] },
    player.status === "RETIRED" ? ["RETIRED"] : ["ACTIVE", "INJURED"]
  );
  const scored = group.find((g) => g.player.id === player.id);

  const attrs = attributesForPosition(position);

  const landing = await getPlayerLanding(player.nhlId).catch(() => null);
  const stat = landing?.featuredStats?.regularSeason?.subSeason;

  const accent = player.team
    ? teamAccentStyle(player.team.primaryColor, player.team.secondaryColor)
    : undefined;

  return (
    <div>
      <div
        style={accent as React.CSSProperties}
        className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]"
      >
        <div
          className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, var(--team-primary), var(--team-secondary))" }}
        />
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
            <div
              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 bg-[var(--color-bg)]"
              style={{ borderColor: "var(--team-primary)" }}
            >
              {player.headshotUrl && (
                <Image src={player.headshotUrl} alt="" fill sizes="112px" className="object-cover" unoptimized />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="font-display text-3xl font-bold text-[var(--color-fg)] sm:text-4xl">
                  {player.firstName} {player.lastName}
                </h1>
                <StatusBadge status={player.status} />
              </div>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {POSITION_LABELS[position]}
                {player.team ? (
                  <>
                    {" · "}
                    <Link
                      href={`/teams/${player.team.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {player.team.city} {player.team.name}
                    </Link>
                  </>
                ) : (
                  " · Free agent"
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/players/${player.id}/history`}
                className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
              >
                <ChartLineUp size={13} />
                Rating History
              </Link>
              <ReportButton playerId={player.id} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {stat && (
          <section className="mb-8">
            <h2 className="mb-3 font-display text-lg font-bold text-[var(--color-fg)]">
              {landing?.featuredStats?.season ? formatSeason(landing.featuredStats.season) : "Current Season"} Stats
            </h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
              {isGoalie ? (
                <>
                  <Stat label="GP" value={stat.gamesPlayed} />
                  <Stat label="W" value={stat.wins} />
                  <Stat label="L" value={stat.losses} />
                  <Stat label="OTL" value={stat.otLosses} />
                  <Stat label="GAA" value={stat.goalsAgainstAvg?.toFixed(2)} />
                  <Stat label="SV%" value={stat.savePctg ? (stat.savePctg * 100).toFixed(1) : undefined} />
                  <Stat label="SO" value={stat.shutouts} />
                </>
              ) : (
                <>
                  <Stat label="GP" value={stat.gamesPlayed} />
                  <Stat label="G" value={stat.goals} />
                  <Stat label="A" value={stat.assists} />
                  <Stat label="P" value={stat.points} />
                  <Stat label="+/-" value={stat.plusMinus} />
                  <Stat label="PIM" value={stat.pim} />
                  <Stat label="Shots" value={stat.shots} />
                </>
              )}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[var(--color-fg)]">Attribute Votes</h2>
            {!isGoalie && (
              <Link
                href={crossPosition ? `/players/${player.id}` : `/players/${player.id}?cross=1`}
                className="text-xs font-medium text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-fg)] hover:underline"
              >
                {crossPosition
                  ? "Comparing across RW / LW / C / D — reset to own position"
                  : "Compare across RW / LW / C / D"}
              </Link>
            )}
          </div>

          {scored && (
            <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
                  Overall
                </p>
                <Link
                  href={`/players/${player.id}/history`}
                  className="text-xs font-medium text-[var(--color-fg-muted)] underline-offset-2 hover:text-[var(--color-fg)] hover:underline"
                >
                  View rating history →
                </Link>
              </div>
              <OverallBarDisplay
                direction={scored.overall.direction}
                pct={scored.overall.pct}
                value={scored.overall.value}
              />
            </div>
          )}

          <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4">
            {attrs.map((a) => {
              const bar = scored?.attributeBars[a];
              return (
                <PlayerAttributeRow
                  key={a}
                  playerId={player.id}
                  attribute={a}
                  label={ATTRIBUTE_LABELS[a]}
                  direction={bar?.direction ?? "zero"}
                  pct={bar?.pct ?? 0}
                  positiveVotes={bar?.positiveVotes ?? 0}
                  negativeVotes={bar?.negativeVotes ?? 0}
                  net={bar?.net ?? 0}
                />
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-1 font-display text-lg font-bold text-[var(--color-fg)]">
            Booster Attributes
          </h2>
          <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
            Separate from the six attributes above — doesn&apos;t affect Overall.
          </p>
          <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4">
            {BOOSTER_ATTRIBUTES.map((b) => {
              const bar = scored?.boosterBars[b];
              return (
                <PlayerAttributeRow
                  key={b}
                  playerId={player.id}
                  attribute={b}
                  label={BOOSTER_ATTRIBUTE_LABELS[b]}
                  direction={bar?.direction ?? "zero"}
                  pct={bar?.pct ?? 0}
                  positiveVotes={bar?.positiveVotes ?? 0}
                  negativeVotes={bar?.negativeVotes ?? 0}
                  net={bar?.net ?? 0}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-3 text-center">
      <p className="font-display text-xl font-bold tabular-nums text-[var(--color-fg)]">{value ?? "—"}</p>
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-fg-faint)]">{label}</p>
    </div>
  );
}

function formatSeason(seasonId: number) {
  const start = Math.floor(seasonId / 10000);
  const end = seasonId % 10000;
  return `${start}-${String(end).slice(2)}`;
}
