// Chart helpers shared by both UIs' TrendChart and Models tab.

/**
 * Point radius per value for a line chart that draws no points: a value with no value on either
 * side gets a dot, otherwise it would be invisible (no line segment reaches it).
 */
export function isolatedPointRadius(values: (number | null)[], radius = 3): number[] {
  return values.map((v, i) => (v != null && values[i - 1] == null && values[i + 1] == null ? radius : 0));
}

/** One row per day with every model's estimated cost; days a model wasn't used are 0, not missing. */
export function modelCostRows(
  daily: { day: string; modelCost: Record<string, number> }[],
  models: string[],
): Record<string, string | number>[] {
  return daily.map((p) => ({ day: p.day, ...Object.fromEntries(models.map((m) => [m, p.modelCost[m] ?? 0])) }));
}
