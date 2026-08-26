import Link from "next/link";
import { CaretDown, CaretUp } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { getCurrentSeasonId, getSkaterSummary, getGoalieSummary, StatSortKey } from "@/lib/nhl-api";

export const metadata = { title: "Player Stats — Stat Padder" };

function formatSeason(seasonId: number) {
  const start = Math.floor(seasonId / 10000);
  const end = seasonId % 10000;
  return `${start}-${String(end).slice(2)}`;
}

type Column = {
  key: string; // property name the NHL stats API sorts by
  label: string;
  align?: "right";
  defaultDir: "ASC" | "DESC";
};

const SKATER_COLUMNS: Column[] = [
  { key: "lastName", label: "Player", defaultDir: "ASC" },
  { key: "teamAbbrevs", label: "Team", defaultDir: "ASC" },
  { key: "gamesPlayed", label: "GP", align: "right", defaultDir: "DESC" },
  { key: "goals", label: "G", align: "right", defaultDir: "DESC" },
  { key: "assists", label: "A", align: "right", defaultDir: "DESC" },
  { key: "points", label: "P", align: "right", defaultDir: "DESC" },
  { key: "plusMinus", label: "+/-", align: "right", defaultDir: "DESC" },
];

const GOALIE_COLUMNS: Column[] = [
  { key: "lastName", label: "Player", defaultDir: "ASC" },
  { key: "teamAbbrevs", label: "Team", defaultDir: "ASC" },
  { key: "gamesPlayed", label: "GP", align: "right", defaultDir: "DESC" },
  { key: "wins", label: "W", align: "right", defaultDir: "DESC" },
  { key: "losses", label: "L", align: "right", defaultDir: "DESC" },
  { key: "goalsAgainstAverage", label: "GAA", align: "right", defaultDir: "ASC" },
  { key: "savePct", label: "SV%", align: "right", defaultDir: "DESC" },
  { key: "shutouts", label: "SO", align: "right", defaultDir: "DESC" },
];

export default async function PlayerStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sortBy?: string; sortDir?: string }>;
}) {
  const { type, sortBy, sortDir } = await searchParams;
  const isGoalies = type === "goalies";
  const columns = isGoalies ? GOALIE_COLUMNS : SKATER_COLUMNS;

  const defaultSortKey = isGoalies ? "wins" : "points";
  const activeSortBy = columns.some((c) => c.key === sortBy) ? sortBy! : defaultSortKey;
  const activeDir: "ASC" | "DESC" = sortDir === "asc" ? "ASC" : sortDir === "desc" ? "DESC" : columns.find((c) => c.key === activeSortBy)!.defaultDir;

  // "Sort by most points, then goals" — keep goals as an automatic tiebreaker
  // only for the default points sort; any other chosen column sorts alone.
  const sortKeys: StatSortKey[] =
    !isGoalies && activeSortBy === "points"
      ? [{ property: "points", direction: activeDir }, { property: "goals", direction: "DESC" }]
      : [{ property: activeSortBy, direction: activeDir }];

  const seasonId = await getCurrentSeasonId();

  const skaterRows = !isGoalies ? (await getSkaterSummary(seasonId, { limit: 50, sort: sortKeys })).data : [];
  const goalieRows = isGoalies ? (await getGoalieSummary(seasonId, { limit: 50, sort: sortKeys })).data : [];

  const nhlIds = isGoalies ? goalieRows.map((r) => r.playerId) : skaterRows.map((r) => r.playerId);
  const localPlayers = await prisma.player.findMany({
    where: { nhlId: { in: nhlIds } },
    select: { id: true, nhlId: true },
  });
  const localIdByNhlId = new Map(localPlayers.map((p) => [p.nhlId, p.id]));

  function sortHref(column: Column) {
    const params = new URLSearchParams();
    if (isGoalies) params.set("type", "goalies");
    params.set("sortBy", column.key);
    const nextDir = column.key === activeSortBy ? (activeDir === "DESC" ? "asc" : "desc") : column.defaultDir.toLowerCase();
    params.set("sortDir", nextDir);
    return `/player-stats?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Player Stats</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Real NHL stats for the {formatSeason(seasonId)} season, sourced live from the NHL Stats API.
        Click a column to sort by it.
      </p>

      <div className="mt-6 flex rounded-full border border-[var(--color-border)] p-0.5 w-fit">
        <Link
          href="/player-stats"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${!isGoalies ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "text-[var(--color-fg-muted)]"}`}
        >
          Skaters
        </Link>
        <Link
          href="/player-stats?type=goalies"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${isGoalies ? "bg-[var(--color-fg)] text-[var(--color-bg)]" : "text-[var(--color-fg-muted)]"}`}
        >
          Goalies
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-left text-xs uppercase tracking-wide text-[var(--color-fg-faint)]">
              <th className="px-3 py-2">#</th>
              {columns.map((col) => {
                const active = col.key === activeSortBy;
                return (
                  <th
                    key={col.key}
                    className={`px-3 py-2 ${col.align === "right" ? "text-right" : ""}`}
                    aria-sort={active ? (activeDir === "ASC" ? "ascending" : "descending") : "none"}
                  >
                    <Link
                      href={sortHref(col)}
                      className={`inline-flex cursor-pointer items-center gap-0.5 hover:text-[var(--color-fg)] ${
                        col.align === "right" ? "flex-row-reverse" : ""
                      } ${active ? "text-[var(--color-fg)]" : ""}`}
                    >
                      {col.label}
                      {active &&
                        (activeDir === "ASC" ? (
                          <CaretUp size={11} weight="bold" />
                        ) : (
                          <CaretDown size={11} weight="bold" />
                        ))}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {isGoalies
              ? goalieRows.map((r, i) => (
                  <tr key={r.playerId} className="hover:bg-[var(--color-bg-subtle)]">
                    <td className="px-3 py-2 tabular-nums text-[var(--color-fg-faint)]">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      <PlayerLink localId={localIdByNhlId.get(r.playerId)} name={r.goalieFullName} />
                    </td>
                    <td className="px-3 py-2 text-[var(--color-fg-muted)]">{r.teamAbbrevs}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.gamesPlayed}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.losses}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.goalsAgainstAverage?.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{(r.savePct * 100)?.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.shutouts}</td>
                  </tr>
                ))
              : skaterRows.map((r, i) => (
                  <tr key={r.playerId} className="hover:bg-[var(--color-bg-subtle)]">
                    <td className="px-3 py-2 tabular-nums text-[var(--color-fg-faint)]">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      <PlayerLink localId={localIdByNhlId.get(r.playerId)} name={r.skaterFullName} />
                    </td>
                    <td className="px-3 py-2 text-[var(--color-fg-muted)]">{r.teamAbbrevs}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.gamesPlayed}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.goals}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.assists}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.points}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.plusMinus}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerLink({ localId, name }: { localId?: string; name: string }) {
  if (!localId) return <span>{name}</span>;
  return (
    <Link href={`/players/${localId}`} className="hover:underline underline-offset-2">
      {name}
    </Link>
  );
}
