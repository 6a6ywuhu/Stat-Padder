import { prisma } from "@/lib/prisma";
import { getStandingsNow } from "@/lib/nhl-api";
import { TeamRankRow } from "@/components/TeamRankRow";
import { TeamsScopeToggle, StandingsScope } from "@/components/TeamsScopeToggle";
import { BackButton } from "@/components/BackButton";

export const metadata = { title: "Standings — Stat Padder" };

// Standings shift daily during the season.
export const revalidate = 600;

const CONFERENCE_ORDER = ["Eastern", "Western"];
const DIVISION_ORDER = ["Atlantic", "Metropolitan", "Central", "Pacific"];

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: scopeParam } = await searchParams;
  const scope: StandingsScope =
    scopeParam === "league" || scopeParam === "conference" ? scopeParam : "division";

  const [teams, standings] = await Promise.all([
    prisma.team.findMany(),
    getStandingsNow().catch(() => []),
  ]);

  const standByAbbrev = new Map(standings.map((s) => [s.teamAbbrev.default, s]));

  const rows = teams.map((t) => {
    const s = standByAbbrev.get(t.id);
    return {
      team: t,
      seq: {
        division: s?.divisionSequence ?? 99,
        conference: s?.conferenceSequence ?? 99,
        league: s?.leagueSequence ?? 99,
      },
      stats: s
        ? {
            gp: s.gamesPlayed,
            wins: s.wins,
            losses: s.losses,
            otl: s.otLosses,
            points: s.points,
            streakCode: s.streakCode,
            streakCount: s.streakCount,
          }
        : null,
    };
  });

  type Group = { label: string | null; rows: typeof rows };
  let groups: Group[];
  if (scope === "league") {
    groups = [{ label: null, rows: [...rows].sort((a, b) => a.seq.league - b.seq.league) }];
  } else if (scope === "conference") {
    groups = CONFERENCE_ORDER.map((conf) => ({
      label: `${conf} Conference`,
      rows: rows
        .filter((r) => r.team.conference === conf)
        .sort((a, b) => a.seq.conference - b.seq.conference),
    }));
  } else {
    groups = DIVISION_ORDER.map((div) => ({
      label: div,
      rows: rows.filter((r) => r.team.division === div).sort((a, b) => a.seq.division - b.seq.division),
    }));
  }

  const standingsMissing = standings.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-4">
        <BackButton />
      </div>
      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Standings</h1>

      <div className="mt-6">
        <TeamsScopeToggle active={scope} />
      </div>

      {standingsMissing && (
        <p className="mt-6 rounded-md border-2 border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-sm text-[var(--color-fg-muted)]">
          Live standings are unavailable right now — teams are listed without records.
        </p>
      )}

      <div className="mt-8 space-y-8">
        {groups.map((g, gi) => (
          <section key={g.label ?? gi}>
            {g.label && (
              <h2 className="mb-3 font-display text-xl font-bold text-[var(--color-fg)]">
                {g.label}
              </h2>
            )}
            <ol className="overflow-hidden rounded-md border-2 border-[var(--color-border-strong)] bg-[var(--color-card)]">
              {g.rows.map((r, i) => (
                <TeamRankRow
                  key={r.team.id}
                  rank={i + 1}
                  id={r.team.id}
                  name={r.team.name}
                  city={r.team.city}
                  primaryColor={r.team.primaryColor}
                  logoLight={r.team.logoLight}
                  logoDark={r.team.logoDark}
                  stats={r.stats}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
