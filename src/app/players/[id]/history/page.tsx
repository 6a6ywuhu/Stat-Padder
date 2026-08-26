import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { getPlayerHistory, isValidHistorySeries, Granularity } from "@/lib/history";
import {
  attributesForPosition,
  ATTRIBUTE_LABELS,
  BOOSTER_ATTRIBUTES,
  BOOSTER_ATTRIBUTE_LABELS,
  Position,
} from "@/lib/attributes";
import { RatingHistoryChart } from "@/components/RatingHistoryChart";

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export default async function PlayerHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ granularity?: string; series?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const player = await prisma.player.findUnique({ where: { id } });
  if (!player) notFound();

  const position = player.position as Position;
  const granularity: Granularity =
    sp.granularity === "day" || sp.granularity === "year" ? sp.granularity : "month";
  const series = sp.series && isValidHistorySeries(sp.series, position) ? sp.series : "overall";

  const data = await getPlayerHistory(player.id, position, series, granularity);

  const coreAttrs = attributesForPosition(position);
  const seriesLabel =
    series === "overall"
      ? "Overall"
      : (ATTRIBUTE_LABELS as Record<string, string>)[series] ??
        (BOOSTER_ATTRIBUTE_LABELS as Record<string, string>)[series] ??
        series;

  const playerId = player.id;
  function hrefFor(overrides: { granularity?: Granularity; series?: string }) {
    const params = new URLSearchParams();
    params.set("granularity", overrides.granularity ?? granularity);
    params.set("series", overrides.series ?? series);
    return `/players/${playerId}/history?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={`/players/${player.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
      >
        <ArrowLeft size={14} weight="bold" />
        {player.firstName} {player.lastName}
      </Link>

      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Rating History</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        How {player.firstName} {player.lastName}&apos;s community-voted score has moved over time.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Which score to chart">
          <Link
            href={hrefFor({ series: "overall" })}
            className={pillClass(series === "overall")}
          >
            Overall
          </Link>
          {coreAttrs.map((a) => (
            <Link key={a} href={hrefFor({ series: a })} className={pillClass(series === a)}>
              {ATTRIBUTE_LABELS[a]}
            </Link>
          ))}
          {BOOSTER_ATTRIBUTES.map((b) => (
            <Link key={b} href={hrefFor({ series: b })} className={pillClass(series === b)}>
              {BOOSTER_ATTRIBUTE_LABELS[b]}
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 rounded-full border border-[var(--color-border)] p-0.5">
          {GRANULARITIES.map((g) => (
            <Link
              key={g.key}
              href={hrefFor({ granularity: g.key })}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                granularity === g.key
                  ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                  : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {g.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <RatingHistoryChart data={data} label={seriesLabel} />
      </div>
    </div>
  );
}

function pillClass(active: boolean) {
  return `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "border-[var(--color-fg)] bg-[var(--color-fg)] text-[var(--color-bg)]"
      : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
  }`;
}
