"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint } from "@/lib/history";

export function RatingHistoryChart({ data, label }: { data: HistoryPoint[]; label: string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] text-sm text-[var(--color-fg-muted)]">
        No votes yet for this period — nothing to chart.
      </div>
    );
  }

  const last = data[data.length - 1].value;
  const lineColor = last >= 0 ? "var(--color-positive)" : "var(--color-negative)";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <ResponsiveContainer width="100%" height={288}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="bucket"
            stroke="var(--color-fg-faint)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            minTickGap={24}
          />
          <YAxis
            stroke="var(--color-fg-faint)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <ReferenceLine y={0} stroke="var(--color-border-strong)" />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--color-fg-muted)" }}
            itemStyle={{ color: "var(--color-fg)" }}
            formatter={(value) => [typeof value === "number" && value > 0 ? `+${value}` : String(value), label]}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke={lineColor}
            strokeWidth={2}
            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
