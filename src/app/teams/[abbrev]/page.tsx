import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStandingsNow } from "@/lib/nhl-api";
import { teamAccentStyle } from "@/lib/contrast";
import { TeamPixelMosaic } from "@/components/TeamPixelMosaic";
import { PlayerCard } from "@/components/PlayerCard";
import { RosterGrid } from "@/components/RosterGrid";
import { BackButton } from "@/components/BackButton";
import { getScoredGroup, GroupSelector, PlayerWithTeam } from "@/lib/group-scores";
import type { Position, SkaterPosition } from "@/lib/attributes";
import type { ScoredPlayer } from "@/lib/scoring";

// Read-heavy page backed by Postgres — serve from the CDN cache and
// regenerate in the background so navigation isn't a cold DB round-trip
// every time. Vote-driven numbers lag by at most this many seconds.
export const revalidate = 120;

export default async function TeamPage({ params }: { params: Promise<{ abbrev: string }> }) {
  const { abbrev } = await params;

  const team = await prisma.team.findUnique({ where: { id: abbrev.toUpperCase() } });
  if (!team) notFound();

  const players = await prisma.player.findMany({
    where: { teamId: team.id, status: { in: ["ACTIVE", "INJURED"] } },
    orderBy: [{ position: "asc" }, { lastName: "asc" }],
  });

  const standings = await getStandingsNow().catch(() => []);
  const record = standings.find((s) => s.teamAbbrev.default === team.id);

  const accent = teamAccentStyle(team.primaryColor, team.secondaryColor);

  const groups: { label: string; positions: Position[]; initialCount: number }[] = [
    { label: "Forwards", positions: ["C", "LW", "RW"], initialCount: 12 },
    { label: "Defense", positions: ["D"], initialCount: 6 },
    { label: "Goalies", positions: ["G"], initialCount: 2 },
  ];

  // For roster overall-bar previews, score each of the 3 sections (Forwards,
  // Defense, Goalies) as its own comparison group — forwards are pooled
  // together (C/LW/RW compared against each other), not split into 3
  // separate exact-position groups the way Defense and Goalies stay their
  // own single-position groups.
  const scoreCache = new Map<string, ScoredPlayer<PlayerWithTeam>[]>();
  async function scoresForGroup(groupLabel: string, positions: readonly string[]) {
    if (!scoreCache.has(groupLabel)) {
      const selector: GroupSelector =
        groupLabel === "Goalies" ? { kind: "goalie" } : { kind: "skater", positions: positions as SkaterPosition[] };
      scoreCache.set(groupLabel, await getScoredGroup(selector));
    }
    return scoreCache.get(groupLabel)!;
  }

  return (
    <div>
      <div
        style={accent as React.CSSProperties}
        className="bg-team-pixel relative overflow-hidden border-b-2 border-[var(--color-border)]"
      >
        <TeamPixelMosaic primary={team.primaryColor} secondary={team.secondaryColor} />
        <div className="bg-team-pixel-bar relative z-10 h-2 w-full" />
        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-6 sm:px-6">
          <BackButton />
        </div>
        <div className="relative z-10 mx-auto flex max-w-5xl items-center gap-4 px-4 pb-6 pt-4 sm:gap-6 sm:pb-10 sm:px-6">
          <div className="relative h-20 w-20 shrink-0 drop-shadow-md sm:h-24 sm:w-24">
            <Image src={team.logoLight} alt="" fill sizes="96px" unoptimized className="object-contain dark:hidden" />
            <Image src={team.logoDark} alt="" fill sizes="96px" unoptimized className="hidden object-contain dark:block" />
          </div>
          <div>
            <p className="text-sm text-[var(--color-fg-muted)]">{team.conference} Conference · {team.division} Division</p>
            <h1 className="font-display text-3xl font-bold text-[var(--color-fg)] sm:text-4xl">
              {team.city} {team.name}
            </h1>
            {record && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-[var(--color-fg-muted)]">
                <span>{record.wins}-{record.losses}-{record.otLosses}</span>
                <span
                  className="rounded-none px-2 py-0.5 text-xs font-bold tabular-nums"
                  style={{ background: "var(--team-primary)", color: "var(--team-primary-fg)" }}
                >
                  {record.points} PTS
                </span>
                <span>{record.gamesPlayed} GP</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {await Promise.all(
          groups.map(async (group) => {
            const groupPlayers = players.filter((p) => group.positions.includes(p.position));
            if (groupPlayers.length === 0) return null;

            // Within each section (Forwards/Defense/Goalies), sort by rating
            // (Overall score) descending — forwards aren't sub-grouped by
            // exact position (C/LW/RW), just pooled together by rating.
            const groupScored = await scoresForGroup(group.label, group.positions);
            const withScores = groupPlayers.map((p) => ({
              player: p,
              scored: groupScored.find((s) => s.player.id === p.id),
            }));
            withScores.sort((a, b) => (b.scored?.overall.value ?? 0) - (a.scored?.overall.value ?? 0));

            return (
              <section key={group.label} className="mb-8">
                <h2
                  className="mb-3 border-b-2 pb-1 font-display text-lg font-bold text-[var(--color-fg)]"
                  style={{ borderColor: "var(--team-primary)" }}
                >
                  {group.label}
                </h2>
                <RosterGrid initialCount={group.initialCount}>
                  {withScores.map(({ player: p, scored }) => (
                    <PlayerCard
                      key={p.id}
                      id={p.id}
                      name={`${p.firstName} ${p.lastName}`}
                      position={p.position}
                      teamId={p.teamId}
                      headshotUrl={p.headshotUrl}
                      status={p.status}
                      overall={scored?.overall ?? { direction: "zero", pct: 0, value: 0 }}
                      attributeBars={scored?.attributeBars}
                      categoryBars={scored?.categoryBars}
                    />
                  ))}
                </RosterGrid>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
