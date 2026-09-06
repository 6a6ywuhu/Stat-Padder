import { getScoredGroup, selectorFromParams, parseRawSkaterPositions } from "@/lib/group-scores";
import { sortWithVoteTiebreak } from "@/lib/scoring";
import { startOfWeek, startOfMonth, ymd } from "@/lib/time-windows";
import { getCurrentSeasonId, getSkaterSummaryAll } from "@/lib/nhl-api";
import { PositionFilterBar } from "@/components/PositionFilterBar";
import { RankingsScopeToggle } from "@/components/RankingsScopeToggle";
import { RankingsWindowToggle, RankingWindow } from "@/components/RankingsWindowToggle";
import { RankingsSearch } from "@/components/RankingsSearch";
import { PlayerCard } from "@/components/PlayerCard";
import { Pagination } from "@/components/Pagination";
import { BackButton } from "@/components/BackButton";

export const metadata = { title: "Rankings — Stat Padder" };

const PAGE_SIZE = 25;

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    position?: string;
    page?: string;
    q?: string;
    window?: string;
  }>;
}) {
  const sp = await searchParams;
  const type = sp.type === "goalies" ? "goalies" : "skaters";
  const rankWindow: RankingWindow =
    sp.window === "week" || sp.window === "month" ? sp.window : "all";
  const since =
    rankWindow === "week" ? startOfWeek() : rankWindow === "month" ? startOfMonth() : undefined;
  // `?position=F` = Forwards picked as a whole (no individual position). It
  // expands to C/LW/RW for the query but leaves the sub-pills unlit.
  const forwardsGroup =
    type === "skaters" && (sp.position ?? "").split(",").some((s) => s.trim() === "F");
  const queryPositions = Array.from(
    new Set([
      ...parseRawSkaterPositions(sp.position),
      ...(forwardsGroup ? ["C", "LW", "RW"] : []),
    ])
  );
  const selector = selectorFromParams(
    type,
    queryPositions.length ? queryPositions.join(",") : undefined
  );
  const selectedPositions = type === "goalies" ? [] : parseRawSkaterPositions(sp.position);

  // Real NHL goals/assists/points for the active window — one bulk (paged)
  // stats call, mapped by NHL id. Best-effort: a failure just hides the box.
  const sinceYmd =
    rankWindow === "week" ? ymd(startOfWeek()) : rankWindow === "month" ? ymd(startOfMonth()) : undefined;
  const statsByNhlId = await (async () => {
    try {
      const seasonId = await getCurrentSeasonId();
      const rows = await getSkaterSummaryAll(seasonId, { since: sinceYmd });
      return new Map(
        rows.map((r) => [r.playerId, { goals: r.goals, assists: r.assists, points: r.points }])
      );
    } catch {
      return new Map<number, { goals: number; assists: number; points: number }>();
    }
  })();

  const scored = await getScoredGroup(selector, undefined, { since });
  const sorted = sortWithVoteTiebreak(
    scored,
    (s) => s.overallValue,
    (s) => s.player.team?.city ?? ""
  );

  // Rank is fixed against the full comparison group, before any name filter.
  const ranked = sorted.map((s, i) => ({ scored: s, rank: i + 1 }));
  const query = (sp.q ?? "").trim().toLowerCase();
  const matches = query
    ? ranked.filter(({ scored: s }) =>
        `${s.player.firstName} ${s.player.lastName}`.toLowerCase().includes(query)
      )
    : ranked;

  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, parseInt(sp.page ?? "1", 10) || 1));
  const pageItems = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    if (sp.type) params.set("type", sp.type);
    if (sp.position) params.set("position", sp.position);
    if (sp.q) params.set("q", sp.q);
    if (sp.window) params.set("window", sp.window);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/rankings${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-4">
        <BackButton />
      </div>
      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Rankings</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        A community-voted rating system for NHL players and teams.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <RankingsScopeToggle active="players" />
        <RankingsWindowToggle active={rankWindow} />
      </div>

      {/* Positions on the left, name filter on the right when they fit on one
          row; the filter wraps full-width below when there isn't room. */}
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <PositionFilterBar
          activeType={type}
          selectedPositions={selectedPositions}
          forwardsGroup={forwardsGroup}
        />
        <div className="w-full sm:ml-auto sm:w-72">
          <RankingsSearch />
        </div>
      </div>

      <div className="mt-6 space-y-2 sm:space-y-3">
        {matches.length === 0 && (
          <p className="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-card)] p-4 text-center text-sm text-[var(--color-fg-muted)] sm:p-6">
            {query
              ? `No players in this group match “${sp.q?.trim()}”.`
              : "No players found in this group yet."}
          </p>
        )}
        {pageItems.map(({ scored: s, rank }) => (
          <PlayerCard
            key={s.player.id}
            id={s.player.id}
            name={`${s.player.firstName} ${s.player.lastName}`}
            position={s.player.position}
            teamId={s.player.teamId}
            headshotUrl={s.player.headshotUrl}
            status={s.player.status}
            overall={s.overall}
            attributeBars={s.attributeBars}
            categoryBars={s.categoryBars}
            rank={rank}
            windowStats={statsByNhlId.get(s.player.nhlId) ?? null}
            statWindow={rankWindow}
          />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </div>
  );
}
