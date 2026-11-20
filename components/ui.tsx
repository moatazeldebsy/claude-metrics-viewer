"use client";

import { useMemo, useState, type ReactNode } from "react";

export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtUsd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents >= 1_000_000 ? 0 : 2 });
export const fmtPct = (r: number | null) => (r == null ? "—" : `${(r * 100).toFixed(1)}%`);
export const fmtCompact = (n: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function Card({ title, subtitle, children, className = "" }: { title?: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface-1 p-4 ${className}`}>
      {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
      {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}

export function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-1 p-4" data-testid="kpi">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="tabular mt-1 text-2xl font-semibold text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

export interface Column<T> {
  key: string;
  label: string;
  value: (row: T) => string | number | null;
  format?: (v: never) => string;
  numeric?: boolean;
}

export function DataTable<T>({ rows, columns, initialSort, initialDesc = true, testId, onRowClick }: {
  rows: T[]; columns: Column<T>[]; initialSort?: string; initialDesc?: boolean; testId?: string; onRowClick?: (row: T) => void;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: initialSort ?? columns[0].key, desc: initialDesc });
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key) ?? columns[0];
    return [...rows].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      const cmp = va == null ? -1 : vb == null ? 1 : typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, columns, sort]);

  if (rows.length === 0) return <p className="py-6 text-center text-sm text-ink-3">No data for this range.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid={testId}>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-2">
            {columns.map((c) => (
              <th key={c.key} className={`px-2 py-2 font-medium ${c.numeric ? "text-right" : ""}`}>
                <button type="button" className="hover:text-ink" onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : true })}>
                  {c.label}
                  {sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className={`border-b border-line last:border-0 ${onRowClick ? "cursor-pointer hover:bg-surface-0" : ""}`}
              onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => {
                const v = c.value(r);
                return (
                  <td key={c.key} className={`px-2 py-1.5 ${c.numeric ? "tabular text-right" : ""}`}>
                    {c.format ? c.format(v as never) : v == null ? "—" : typeof v === "number" ? fmtInt(v) : v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
