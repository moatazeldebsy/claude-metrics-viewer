export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtUsd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents >= 1_000_000 ? 0 : 2 });
export const fmtPct = (r: number | null | undefined) => (r == null ? "—" : `${(r * 100).toFixed(1)}%`);
export const fmtCompact = (n: number) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const fmtFixed1 = (n: number) => n.toFixed(1);
