import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { scorePlayerUncached } from "@/lib/group-scores";
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
import { ProfileVoting } from "@/components/ProfileVoting";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportButton } from "@/components/ReportButton";
import { BackButton } from "@/components/BackButton";
import { FavoriteButton } from "@/components/FavoriteButton";
import { CommentSection } from "@/components/CommentSection";

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
  // Skaters are ranked against every skater position by default; `?cross=0`
  // narrows the bars back down to this player's own position.
  const crossPosition = !isGoalie && cross !== "0";

  // Scoring, the NHL stat line, and comments only depend on `player` and
  // don't depend on each other — fire them together. The DB is a region
  // away from the function, so a chain of awaits here is the whole cost.
  const [scored, landing, comments] = await Promise.all([
    scorePlayerUncached(
      player.id,
      isGoalie
        ? { kind: "goalie" }
        : { kind: "skater", positions: crossPosition ? SKATER_POSITIONS : [position as SkaterPosition] },
      player.status === "RETIRED" ? ["RETIRED"] : ["ACTIVE", "INJURED"]
    ),
    getPlayerLanding(player.nhlId).catch(() => null),
    prisma.comment.findMany({
      where: { playerId: id },
      include: { user: { select: { name: true, email: true, image: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const attrs = attributesForPosition(position);
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
                <StatusBadge status={player.status as "ACTIVE" | "RETIRED" | "INJURED"} />
              </div>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {POSITION_LABELS[position]}
                {player.team ? (
                  <>
                    {" · "}
                    <Link
                      href={`/teams/${player.team.id}`}
                      prefetch={false}
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
              <FavoriteButton playerId={player.id} />
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
          <ProfileVoting
            playerId={player.id}
            section={
              isGoalie
                ? {
                    kind: "flat",
                    attrs: attrs.map((a) => ({
                      key: a,
                      label: ATTRIBUTE_LABELS[a],
                      color: "vote" as const,
                    })),
                  }
                : {
                    kind: "categories",
                    cats: ATTRIBUTE_CATEGORIES.map((cat) => ({
                      key: cat.key,
                      label: cat.label,
                      color: (cat.key === "general" ? "vote" : cat.key) as "vote" | "offense" | "defense",
                      attrs: cat.attributes.map((a) => ({
                        key: a,
                        label: ATTRIBUTE_LABELS[a],
                        color: (cat.key === "general" ? "vote" : cat.key) as "vote" | "offense" | "defense",
                      })),
                    })),
                  }
            }
            boosters={BOOSTER_ATTRIBUTES.map((b) => ({
              key: b,
              label: BOOSTER_ATTRIBUTE_LABELS[b],
              color: "vote" as const,
            }))}
            community={Object.fromEntries(
              [
                ...attrs.map((a) => [a, scored?.attributeBars[a]] as const),
                ...BOOSTER_ATTRIBUTES.map((b) => [b, scored?.boosterBars[b]] as const),
              ].map(([k, bar]) => [k, { value: bar?.net ?? 0, votes: bar?.votes ?? 0 }])
            )}
          />
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
