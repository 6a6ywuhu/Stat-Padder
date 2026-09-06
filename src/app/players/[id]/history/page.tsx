import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { getPlayerHistory, isValidHistorySeries, Granularity } from "@/lib/history";
import {
  attributesForPosition,
  ATTRIBUTE_CATEGORIES,
  ATTRIBUTE_LABELS,
  BOOSTER_ATTRIBUTE_LABELS,
  Position,
} from "@/lib/attributes";
import { RatingHistoryChart } from "@/components/RatingHistoryChart";
import { SeriesPicker, PickerGroup } from "@/components/SeriesPicker";

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

// Read-heavy page backed by Postgres — serve from the CDN cache and
// regenerate in the background so navigation isn't a cold DB round-trip
// every time. Vote-driven numbers lag by at most this many seconds.
export const revalidate = 120;

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
  const isGoalie = position === "G";
  const granularity: Granularity =
    sp.granularity === "day" || sp.granularity === "month" ? sp.granularity : "week";
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

  const groups: PickerGroup[] = isGoalie
    ? [
        {
          label: null,
          items: coreAttrs.map((a) => ({
            key: a,
            label: ATTRIBUTE_LABELS[a],
            href: hrefFor({ series: a }),
            active: series === a,
          })),
        },
      ]
    : ATTRIBUTE_CATEGORIES.map((cat) => ({
        label: cat.label,
        items: cat.attributes.map((a) => ({
          key: a,
          label: ATTRIBUTE_LABELS[a],
          href: hrefFor({ series: a }),
          active: series === a,
        })),
      }));

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

      <div className="mt-6">
        <SeriesPicker
          overall={{ key: "overall", label: "Overall", href: hrefFor({ series: "overall" }), active: series === "overall" }}
          groups={groups}
        />
      </div>

      <div className="mt-4">
        <RatingHistoryChart data={data} label={seriesLabel} />
      </div>

      <div className="mt-4 flex shrink-0 rounded-none border-2 border-[var(--color-border-strong)] p-0.5" style={{ width: "fit-content" }}>
        {GRANULARITIES.map((g) => (
          <Link
            key={g.key}
            href={hrefFor({ granularity: g.key })}
            scroll={false}
            className={`rounded-none px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wide transition-colors ${
              granularity === g.key
                ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
                : "text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {g.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
