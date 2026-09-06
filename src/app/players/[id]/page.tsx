import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getScoredGroup } from "@/lib/group-scores";
import {
  attributesForPosition,
  ATTRIBUTE_CATEGORIES,
  ATTRIBUTE_LABELS,
  BOOSTER_ATTRIBUTES,
  BOOSTER_ATTRIBUTE_LABELS,
  POSITION_LABELS,
  Position,
  SkaterPosition,
  SKATER_POSITIONS,
} from "@/lib/attributes";
import { getPlayerLanding } from "@/lib/nhl-api";
import { calculateAge, formatHeight } from "@/lib/format";
import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { teamAccentStyle } from "@/lib/contrast";
import { pixelProfileFor } from "@/lib/pixel-profiles";
import { TeamPixelMosaic } from "@/components/TeamPixelMosaic";
import { OverallBarDisplay } from "@/components/AttributeBar";
import { PlayerAttributeRow } from "@/components/PlayerAttributeRow";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportButton } from "@/components/ReportButton";
import { BackButton } from "@/components/BackButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CommentSection } from "@/components/CommentSection";
import { auth } from "@/lib/auth";

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

  const session = await auth();
  const [isFavorited, comments] = await Promise.all([
    session?.user?.id
      ? prisma.favorite
          .findUnique({ where: { userId_playerId: { userId: session.user.id, playerId: id } } })
          .then((f) => Boolean(f))
      : Promise.resolve(false),
    prisma.comment.findMany({
      where: { playerId: id },
      include: { user: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const position = player.position as Position;
  const isGoalie = position === "G";
  // Skaters are ranked against every skater position by default; `?cross=0`
  // narrows the bars back down to this player's own position.
  const crossPosition = !isGoalie && cross !== "0";

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

  const pixelProfile = pixelProfileFor(player.firstName, player.lastName);
  const portrait = pixelProfile ?? player.headshotUrl;

  return (
    <div>
      <div
        style={accent as React.CSSProperties}
        className="bg-team-pixel relative overflow-hidden border-b-2 border-[var(--color-border)]"
      >
        {player.team && (
          <TeamPixelMosaic
            primary={player.team.primaryColor}
            secondary={player.team.secondaryColor}
          />
        )}
        <div className="bg-team-pixel-bar relative z-10 h-2 w-full" />
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <BackButton />
          <div className="mt-3 flex flex-col items-center gap-4 sm:mt-4 sm:flex-row sm:items-end sm:gap-6">
            <div
              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md border-4 bg-[var(--color-bg-subtle)]"
              style={{ borderColor: "var(--team-primary)" }}
            >
              {portrait && (
                <Image
                  src={portrait}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                  style={pixelProfile ? { imageRendering: "pixelated" } : undefined}
                  unoptimized
                />
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
                    {landing?.sweaterNumber && (
                      <span className="font-display font-bold tabular-nums text-[var(--color-fg)]"> #{landing.sweaterNumber}</span>
                    )}
                  </>
                ) : (
                  " · Free agent"
                )}
              </p>
              {(player.heightInches || player.weightPounds || player.birthDate) && (
                <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
                  {[
                    player.birthDate ? `Age ${calculateAge(player.birthDate)}` : null,
                    player.heightInches ? formatHeight(player.heightInches) : null,
                    player.weightPounds ? `${player.weightPounds} lbs` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2">
              <span
                className="btn-hero-chip"
                title="Total votes cast on this player, across every attribute"
              >
                <span className="font-display font-bold tabular-nums text-[var(--color-fg)]">
                  {scored?.totalVotes ?? 0}
                </span>
                votes
              </span>
              <FavoriteButton playerId={player.id} initialFavorited={isFavorited} />
              <Link href={`/players/${player.id}/history`} className="btn-hero-chip">
                <ChartLineUp size={13} />
                Rating History
              </Link>
              <ReportButton playerId={player.id} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {stat && (
          <section className="mb-8">
            <h2 className="mb-3 font-display text-lg font-bold text-[var(--color-fg)]">
              {landing?.featuredStats?.season ? formatSeason(landing.featuredStats.season) : "Current Season"} Stats
            </h2>
            <div className="flex divide-x-2 divide-[var(--color-border-strong)] overflow-hidden rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] sm:grid sm:grid-cols-7 sm:gap-3 sm:divide-x-0 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent">
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
          <h2 className="mb-3 font-display text-lg font-bold text-[var(--color-fg)]">Attribute Votes</h2>

          {scored && (
            <div className="mb-4 rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] p-2.5 sm:p-3">
              <div className="mb-1.5 flex items-center justify-between">
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

          {isGoalie ? (
            <div className="divide-y divide-[var(--color-border)] rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 sm:px-4">
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
          ) : (
            <div className="space-y-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
              {ATTRIBUTE_CATEGORIES.map((cat) => {
                const catBar = scored?.categoryBars[cat.key];
                return (
                <div key={cat.key}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
                    {cat.label}
                  </h3>
                  {/* All three categories get a summary bar now that they sit
                      side by side on desktop — General used to skip this
                      (it looked like a near-duplicate of the Overall bar
                      right above), but leaving it out threw the three
                      columns out of alignment. */}
                  <div className="mb-1.5 rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] p-2 sm:p-2.5">
                    <OverallBarDisplay
                      direction={catBar?.direction ?? "zero"}
                      pct={catBar?.pct ?? 0}
                      value={catBar?.value ?? 0}
                      color={cat.key === "general" ? "vote" : cat.key}
                    />
                  </div>
                  <div className="divide-y divide-[var(--color-border)] rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 sm:px-4">
                    {cat.attributes.map((a) => {
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
                          color={cat.key === "general" ? "vote" : cat.key}
                        />
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 font-display text-lg font-bold text-[var(--color-fg)]">
            Booster Attributes
          </h2>
          <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
            {BOOSTER_ATTRIBUTES.map((b) => {
              const bar = scored?.boosterBars[b];
              return (
                <div
                  key={b}
                  className="rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)] px-3 sm:px-4"
                >
                  <PlayerAttributeRow
                    playerId={player.id}
                    attribute={b}
                    label={BOOSTER_ATTRIBUTE_LABELS[b]}
                    direction={bar?.direction ?? "zero"}
                    pct={bar?.pct ?? 0}
                    positiveVotes={bar?.positiveVotes ?? 0}
                    negativeVotes={bar?.negativeVotes ?? 0}
                    net={bar?.net ?? 0}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-bold text-[var(--color-fg)]">Comments</h2>
          <CommentSection
            playerId={player.id}
            initialComments={comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: c.createdAt.toISOString(),
              author: c.user.name || c.user.email || "Someone",
              authorImage: c.user.image,
            }))}
          />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="min-w-0 flex-1 px-0.5 py-1.5 text-center sm:flex-none sm:rounded-md sm:border-2 sm:border-[var(--color-border-strong)] sm:bg-[var(--color-card)] sm:px-2 sm:py-3">
      <p className="font-display text-sm font-bold tabular-nums text-[var(--color-fg)] sm:text-xl">{value ?? "—"}</p>
      <p className="text-[8px] uppercase tracking-wide text-[var(--color-fg-faint)] sm:text-[10px]">{label}</p>
    </div>
  );
}

function formatSeason(seasonId: number) {
  const start = Math.floor(seasonId / 10000);
  const end = seasonId % 10000;
  return `${start}-${String(end).slice(2)}`;
}
