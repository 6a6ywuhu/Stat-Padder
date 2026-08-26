"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MultiPlayerHistory } from "@/lib/history";

export function MultiPlayerHistoryChart({ data }: { data: MultiPlayerHistory }) {
  if (data.buckets.length === 0 || data.series.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-sm text-[var(--color-fg-muted)]">
        No votes yet in this group — nothing to chart.
      </div>
    );
  }

  const rows = data.buckets.map((bucket, i) => {
    const row: Record<string, string | number | null> = { bucket };
    for (const s of data.series) row[s.name] = s.points[i];
    return row;
  });

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <ResponsiveContainer width="100%" height={384}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="bucket"
            stroke="var(--color-fg-faint)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            minTickGap={24}
          />
          <YAxis stroke="var(--color-fg-faint)" fontSize={12} tickLine={false} axisLine={false} width={40} />
          <ReferenceLine y={0} stroke="var(--color-border-strong)" />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-fg-muted)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-fg-muted)" }} />
          {data.series.map((s) => (
            <Line
              key={s.playerId}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 2, strokeWidth: 0, fill: s.color }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
