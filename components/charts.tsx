"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Categorical slots in fixed order (never cycled). Series past 8 should be folded into "Other" upstream.
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

const axis = { stroke: "var(--text-muted)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-primary)" },
  labelStyle: { color: "var(--text-secondary)" },
  cursor: { stroke: "var(--text-muted)", strokeWidth: 1, fill: "var(--grid)" },
} as const;
const shortDay = (d: string) => d.slice(5);

export interface SeriesDef {
  key: string;
  label: string;
}

/** Daily line chart; one shared y-axis, so only plot series of the same unit together. */
export function TrendChart<T extends { day: string }>({ data, series, format = (v: number) => String(v), height = 240 }: { data: T[]; series: SeriesDef[]; format?: (v: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="day" tickFormatter={shortDay} {...axis} minTickGap={24} />
        <YAxis tickFormatter={format} {...axis} width={56} />
        <Tooltip {...tooltipStyle} formatter={(v) => (typeof v === "number" ? format(v) : String(v ?? "—"))} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} iconType="plainline" />}
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-1)" }} connectNulls={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for a ranked breakdown. Single series, so no legend: the card title names it. */
export function HBar({ data, format = (v: number) => String(v), max = 8 }: { data: { key: string; value: number }[]; format?: (v: number) => string; max?: number }) {
  const top = data.slice(0, max);
  const rest = data.slice(max).reduce((s, d) => s + d.value, 0);
  const rows = rest > 0 ? [...top, { key: "Other", value: rest }] : top;
  return (
    <ResponsiveContainer width="100%" height={Math.max(80, rows.length * 34 + 16)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="key" {...axis} width={150} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
        <Tooltip {...tooltipStyle} formatter={(v) => (typeof v === "number" ? format(v) : String(v))} />
        <Bar dataKey="value" name="Value" fill={SERIES[0]} radius={[0, 4, 4, 0]} isAnimationActive={false}
          label={{ position: "right", fill: "var(--text-secondary)", fontSize: 11, formatter: (v: unknown) => (typeof v === "number" ? format(v) : "") }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Stacked vertical bars (e.g. accepted vs rejected per tool). 2px surface gap between segments. */
export function StackedBar<T>({ data, xKey, series, format = (v: number) => String(v) }: { data: T[]; xKey: string; series: SeriesDef[]; format?: (v: number) => string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis tickFormatter={format} {...axis} width={56} />
        <Tooltip {...tooltipStyle} formatter={(v) => (typeof v === "number" ? format(v) : String(v))} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={SERIES[i]} stroke="var(--surface-1)" strokeWidth={2}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
