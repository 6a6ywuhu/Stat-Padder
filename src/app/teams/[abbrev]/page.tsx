import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStandingsNow } from "@/lib/nhl-api";
import { teamAccentStyle } from "@/lib/contrast";
import { PlayerCard } from "@/components/PlayerCard";
import { getScoredGroup, GroupSelector, PlayerWithTeam } from "@/lib/group-scores";
import type { ScoredPlayer } from "@/lib/scoring";

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

  const groups = [
    { label: "Forwards", positions: ["C", "LW", "RW"] },
    { label: "Defense", positions: ["D"] },
    { label: "Goalies", positions: ["G"] },
  ];

  // For roster overall-bar previews, score each position group separately
  // so bars stay meaningful (same rule as everywhere else on the site).
  const scoreCache = new Map<string, ScoredPlayer<PlayerWithTeam>[]>();
  async function scoresFor(position: "C" | "LW" | "RW" | "D" | "G") {
    const key = position === "G" ? "G" : position;
    if (!scoreCache.has(key)) {
      const selector: GroupSelector =
        position === "G" ? { kind: "goalie" } : { kind: "skater", positions: [position] };
      scoreCache.set(key, await getScoredGroup(selector));
    }
    return scoreCache.get(key)!;
  }

  return (
    <div>
      <div style={accent as React.CSSProperties} className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-10 sm:px-6">
          <div className="relative h-20 w-20 shrink-0">
            <Image src={team.logoLight} alt="" fill sizes="80px" unoptimized className="object-contain dark:hidden" />
            <Image src={team.logoDark} alt="" fill sizes="80px" unoptimized className="hidden object-contain dark:block" />
          </div>
          <div>
            <p className="text-sm text-[var(--color-fg-muted)]">{team.conference} Conference · {team.division} Division</p>
            <h1 className="font-display text-3xl font-bold text-[var(--color-fg)] sm:text-4xl">
              {team.city} {team.name}
            </h1>
            {record && (
              <p className="mt-1 text-sm tabular-nums text-[var(--color-fg-muted)]">
                {record.wins}-{record.losses}-{record.otLosses} · {record.points} PTS · {record.gamesPlayed} GP
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {await Promise.all(
          groups.map(async (group) => {
            const groupPlayers = players.filter((p) => group.positions.includes(p.position));
            if (groupPlayers.length === 0) return null;
            return (
              <section key={group.label} className="mb-8">
                <h2
                  className="mb-3 border-b-2 pb-1 font-display text-lg font-bold text-[var(--color-fg)]"
                  style={{ borderColor: "var(--team-primary)" }}
                >
                  {group.label}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {await Promise.all(
                    groupPlayers.map(async (p) => {
                      const scored = (await scoresFor(p.position as "C" | "LW" | "RW" | "D" | "G")).find(
                        (s) => s.player.id === p.id
                      );
                      return (
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
                        />
                      );
                    })
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
