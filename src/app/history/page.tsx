import Link from "next/link";
import { getTopPlayersHistory, Granularity } from "@/lib/history";
import { selectorFromParams, parseRawSkaterPositions } from "@/lib/group-scores";
import {
  SKATER_ATTRIBUTES,
  GOALIE_ATTRIBUTES,
  ATTRIBUTE_LABELS,
  BOOSTER_ATTRIBUTES,
  BOOSTER_ATTRIBUTE_LABELS,
} from "@/lib/attributes";
import { PositionFilterBar } from "@/components/PositionFilterBar";
import { MultiPlayerHistoryChart } from "@/components/MultiPlayerHistoryChart";

export const metadata = { title: "Rating History — Stat Padder" };

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; position?: string; series?: string; granularity?: string }>;
}) {
  const sp = await searchParams;
  const type = sp.type === "goalies" ? "goalies" : "skaters";
  const selector = selectorFromParams(type, sp.position);
  const selectedPositions = type === "goalies" ? [] : parseRawSkaterPositions(sp.position);

  const coreAttrs = type === "goalies" ? GOALIE_ATTRIBUTES : SKATER_ATTRIBUTES;
  const seriesOptions = ["overall", ...coreAttrs, ...BOOSTER_ATTRIBUTES];
  const series = seriesOptions.includes(sp.series ?? "") ? sp.series! : "overall";

  const granularity: Granularity =
    sp.granularity === "day" || sp.granularity === "year" ? sp.granularity : "month";

  const data = await getTopPlayersHistory(selector, series, granularity, 10);

  const seriesLabel =
    series === "overall"
      ? "Overall"
      : (ATTRIBUTE_LABELS as Record<string, string>)[series] ??
        (BOOSTER_ATTRIBUTE_LABELS as Record<string, string>)[series] ??
        series;

  function hrefFor(overrides: { series?: string; granularity?: Granularity }) {
    const params = new URLSearchParams();
    if (type === "goalies") params.set("type", "goalies");
    if (sp.position) params.set("position", sp.position);
    params.set("series", overrides.series ?? series);
    params.set("granularity", overrides.granularity ?? granularity);
    return `/history?${params.toString()}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-[var(--color-fg)]">Rating History</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        How the top 10 players by {seriesLabel} have trended over time, within the comparison group
        you pick below.
      </p>

      <div className="mt-6">
        <PositionFilterBar activeType={type} selectedPositions={selectedPositions} basePath="/history" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Which score to chart">
          <Link href={hrefFor({ series: "overall" })} className={pillClass(series === "overall")}>
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
        <MultiPlayerHistoryChart data={data} />
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
