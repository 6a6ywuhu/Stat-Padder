import Link from "next/link";
import { getScoredGroup, selectorFromParams, parseRawSkaterPositions } from "@/lib/group-scores";
import { sortWithVoteTiebreak } from "@/lib/scoring";
import { PositionFilterBar } from "@/components/PositionFilterBar";
import { PlayerCard } from "@/components/PlayerCard";
import { Pagination } from "@/components/Pagination";

export const metadata = { title: "Legends — Stat Padder" };

const PAGE_SIZE = 25;

export default async function LegendsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; position?: string; includeCurrent?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const type = sp.type === "goalies" ? "goalies" : "skaters";
  const includeCurrent = sp.includeCurrent === "1";
  const selector = selectorFromParams(type, sp.position);
  const selectedPositions = type === "goalies" ? [] : parseRawSkaterPositions(sp.position);

  const statuses = includeCurrent ? (["RETIRED", "ACTIVE", "INJURED"] as const) : (["RETIRED"] as const);
  const scored = await getScoredGroup(selector, [...statuses]);
  const sorted = sortWithVoteTiebreak(
    scored,
    (s) => s.overallValue,
    (s) => s.player.team?.city ?? ""
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(totalPages, Math.max(1, parseInt(sp.page ?? "1", 10) || 1));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleParams = new URLSearchParams();
  if (sp.type) toggleParams.set("type", sp.type);
  if (sp.position) toggleParams.set("position", sp.position);
  if (!includeCurrent) toggleParams.set("includeCurrent", "1");

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    if (sp.type) params.set("type", sp.type);
    if (sp.position) params.set("position", sp.position);
    if (includeCurrent) params.set("includeCurrent", "1");
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/legends${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Legends</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        Retired players, voted on just like active ones. Turn on &quot;include current players&quot; for legend-vs-current comparisons.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <PositionFilterBar activeType={type} selectedPositions={selectedPositions} basePath="/legends" />
        <Link
          href={`/legends?${toggleParams.toString()}`}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            includeCurrent
              ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
              : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          }`}
        >
          Include current players
        </Link>
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
