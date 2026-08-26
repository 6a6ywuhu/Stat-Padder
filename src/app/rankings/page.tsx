import { getScoredGroup, selectorFromParams, parseRawSkaterPositions } from "@/lib/group-scores";
import { sortWithVoteTiebreak } from "@/lib/scoring";
import { PositionFilterBar } from "@/components/PositionFilterBar";
import { PlayerCard } from "@/components/PlayerCard";
import { Pagination } from "@/components/Pagination";

export const metadata = { title: "Rankings — Stat Padder" };

const PAGE_SIZE = 25;

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; position?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const type = sp.type === "goalies" ? "goalies" : "skaters";
  const selector = selectorFromParams(type, sp.position);
  const selectedPositions = type === "goalies" ? [] : parseRawSkaterPositions(sp.position);

  const scored = await getScoredGroup(selector);
  const sorted = sortWithVoteTiebreak(
    scored,
    (s) => s.overallValue,
    (s) => s.player.team?.city ?? ""
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, parseInt(sp.page ?? "1", 10) || 1));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    if (sp.type) params.set("type", sp.type);
    if (sp.position) params.set("position", sp.position);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/rankings${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Rankings</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Ranked by community-voted Overall score, within the comparison group you pick below. All
        skaters are compared together by default — select one or more positions to narrow it down.
      </p>

      <div className="mt-6">
        <PositionFilterBar activeType={type} selectedPositions={selectedPositions} />
      </div>

      <div className="mt-6 space-y-3">
        {sorted.length === 0 && (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-sm text-[var(--color-fg-muted)]">
            No players found in this group yet.
          </p>
        )}
        {pageItems.map((s, i) => (
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
            rank={(page - 1) * PAGE_SIZE + i + 1}
          />
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </div>
  );
}
