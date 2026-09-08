"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";
import { NetBarTrack, BarColor } from "./AttributeBar";
import { formatRating, type Direction } from "@/lib/scoring";
import type { Contributor } from "@/lib/team-scores";

type Bar = { direction: Direction; pct: number };
export type ScoreKey = "overall" | "offense" | "defense" | "goalie";

export type TeamRow = {
  teamId: string;
  city: string;
  name: string;
  logoLight: string;
  logoDark: string;
  incomplete: boolean;
  scores: Record<ScoreKey, number | null>;
  bars: Record<ScoreKey, Bar>;
  topOffense: Contributor[];
  topDefense: Contributor[];
  topGoalies: Contributor[];
};

const COLUMNS: { key: ScoreKey; label: string; color: BarColor }[] = [
  { key: "overall", label: "Overall", color: "vote" },
  { key: "offense", label: "Offense", color: "offense" },
  { key: "defense", label: "Defense", color: "defense" },
  { key: "goalie", label: "Goalie", color: "vote" },
];

function fmt(v: number | null): string {
  return v === null ? "N/A" : formatRating(v);
}

function ScoreCell({ value, bar, color }: { value: number | null; bar: Bar; color: BarColor }) {
  if (value === null) {
    return <span className="text-sm font-medium text-[var(--color-fg-faint)]">N/A</span>;
  }
  return (
    <div className="w-16 sm:w-[84px]">
      <div className="font-display text-sm font-bold tabular-nums text-[var(--color-fg)] sm:text-base">
        {fmt(value)}
      </div>
      <NetBarTrack direction={bar.direction} pct={bar.pct} height="h-1" color={color} />
    </div>
  );
}

function ContributorList({ title, items }: { title: string; items: Contributor[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-fg-muted)]">None</p>
      ) : (
        <ol className="space-y-1">
          {items.map((c, i) => (
            <li key={c.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-[var(--color-fg)]">
                <span className="mr-1 tabular-nums text-[var(--color-fg-faint)]">{i + 1}.</span>
                <Link href={`/players/${c.id}`} prefetch={false} className="hover:underline">
                  {c.name}
                </Link>
                <span className="ml-1 text-xs text-[var(--color-fg-faint)]">{c.position}</span>
              </span>
              <span className="shrink-0 tabular-nums font-medium text-[var(--color-fg-muted)]">
                {fmt(c.value)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function TeamRankingsTable({
  rows,
  topSkaters,
  topGoalies,
}: {
  rows: TeamRow[];
  topSkaters: number;
  topGoalies: number;
}) {
  const [sortKey, setSortKey] = useState<ScoreKey>("overall");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = [...rows].sort((a, b) => {
    const av = a.scores[sortKey];
    const bv = b.scores[sortKey];
    if (av === null && bv === null) return 0;
    if (av === null) return 1; // nulls always last
    if (bv === null) return -1;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  function toggleSort(key: ScoreKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const anyIncomplete = rows.some((r) => r.incomplete);

  return (
    <div>
      <div className="overflow-x-auto rounded-md border-2 border-[var(--color-border-strong)]">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-faint)]">
              <th className="w-10 px-2 py-1.5 text-right tabular-nums sm:px-3 sm:py-2">#</th>
              <th className="px-2 py-1.5 sm:px-3 sm:py-2">Team</th>
              {COLUMNS.map((col) => {
                const active = sortKey === col.key;
                return (
                  <th key={col.key} className="px-2 py-1.5 sm:px-3 sm:py-2">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-[var(--color-fg)] ${
                        active ? "text-[var(--color-fg)]" : ""
                      }`}
                    >
                      {col.label}
                      {active &&
                        (sortDir === "desc" ? <CaretDown size={11} weight="bold" /> : <CaretUp size={11} weight="bold" />)}
                    </button>
                  </th>
                );
              })}
              <th className="w-10 px-2 py-1.5 sm:px-3 sm:py-2" aria-label="Expand" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const isOpen = expanded === row.teamId;
              return (
                <FragmentRow
                  key={row.teamId}
                  row={row}
                  rank={i + 1}
                  isOpen={isOpen}
                  onToggle={() => setExpanded(isOpen ? null : row.teamId)}
                  topSkaters={topSkaters}
                  topGoalies={topGoalies}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {anyIncomplete && (
        <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
          <span className="font-semibold">*</span> Overall excludes a category with no data yet
          (usually Goalie) — it&apos;s the average of the categories that do have votes.
        </p>
      )}
    </div>
  );
}

function FragmentRow({
  row,
  rank,
  isOpen,
  onToggle,
  topSkaters,
  topGoalies,
}: {
  row: TeamRow;
  rank: number;
  isOpen: boolean;
  onToggle: () => void;
  topSkaters: number;
  topGoalies: number;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-b-0 hover:bg-[var(--color-bg-subtle)] ${
          isOpen ? "bg-[var(--color-bg-subtle)]" : ""
        }`}
      >
        <td className="px-2 py-2 text-right align-middle font-display text-sm font-bold tabular-nums text-[var(--color-fg-muted)] sm:px-3 sm:py-3">
          {rank}
        </td>
        <td className="px-2 py-2 align-middle sm:px-3 sm:py-3">
          <Link
            href={`/teams/${row.teamId}`}
            prefetch={false}
            onClick={(e) => e.stopPropagation()}
            className="group flex items-center gap-2 sm:gap-2.5"
          >
            <span className="relative h-6 w-6 shrink-0 sm:h-7 sm:w-7">
              <Image src={row.logoLight} alt="" fill sizes="28px" unoptimized className="object-contain dark:hidden" />
              <Image src={row.logoDark} alt="" fill sizes="28px" unoptimized className="hidden object-contain dark:block" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-[var(--color-fg)] group-hover:underline">
                {row.city} {row.name}
              </span>
            </span>
          </Link>
        </td>
        {COLUMNS.map((col) => (
          <td key={col.key} className="px-2 py-2 align-middle sm:px-3 sm:py-3">
            <div className="flex items-center gap-1">
              <ScoreCell value={row.scores[col.key]} bar={row.bars[col.key]} color={col.color} />
              {col.key === "overall" && row.incomplete && (
                <span className="font-bold text-[var(--color-fg-faint)]" title="Overall excludes a category with no data">
                  *
                </span>
              )}
            </div>
          </td>
        ))}
        <td className="px-2 py-2 text-center align-middle text-[var(--color-fg-faint)] sm:px-3 sm:py-3">
          <CaretDown
            size={14}
            weight="bold"
            className={`inline transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
          <td colSpan={7} className="px-3 py-3 sm:px-4 sm:py-4">
            <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
              Team scores average the top {topSkaters} skaters by each composite (independently ranked)
              and the top {topGoalies} goalies.
            </p>
            <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
              <ContributorList title={`Offense · top ${topSkaters}`} items={row.topOffense} />
              <ContributorList title={`Defense · top ${topSkaters}`} items={row.topDefense} />
              <ContributorList title={`Goalies · top ${topGoalies}`} items={row.topGoalies} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
