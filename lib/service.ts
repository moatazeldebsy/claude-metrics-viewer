import { aggregateClaudeCode, aggregateCost, idleSeats, type DayRecords } from "@/lib/aggregate";
import { actorLabel } from "@/lib/aggregate";
import type { DashboardQuery } from "@/lib/query";
import { selectedDays } from "@/lib/query";
import { getSource } from "@/lib/sources";
import type { CostGroupBy } from "@/lib/sources/types";

/** Run async work over items with at most `limit` in flight, keeping order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function loadDays(q: DashboardQuery): Promise<DayRecords[]> {
  const src = getSource();
  return mapLimit(selectedDays(q), 5, async (day) => ({ day, records: await src.claudeCodeDay(day) }));
}

export async function claudeCodeSummary(q: DashboardQuery) {
  const days = await loadDays(q);
  const allUsers = [...new Set(days.flatMap((d) => d.records.map((r) => actorLabel(r.actor))))].sort();
  const filtered = q.user
    ? days.map((d) => ({ ...d, records: d.records.filter((r) => actorLabel(r.actor) === q.user) }))
    : days;
  return { ...aggregateClaudeCode(filtered), allUsers };
}

export const COST_DIMENSIONS = ["model", "workspace_id", "api_key_id", "product", "service_tier", "cost_type"] as const satisfies readonly CostGroupBy[];

export async function costSummary(q: DashboardQuery) {
  const days = new Set(selectedDays(q));
  // One daily query grouped by every dimension (cost_type doesn't count toward the 5-dimension limit),
  // then drop excluded days and roll up per dimension.
  const rows = (await getSource().cost({ from: q.from, to: q.to, groupBy: [...COST_DIMENSIONS], daily: true })).filter((r) =>
    days.has(r.starting_at.slice(0, 10)),
  );
  const daily = new Map<string, number>([...days].map((d) => [d, 0]));
  for (const r of rows) daily.set(r.starting_at.slice(0, 10), (daily.get(r.starting_at.slice(0, 10)) ?? 0) + Number(r.cost.amount));
  return {
    totalCents: rows.reduce((s, r) => s + Number(r.cost.amount), 0),
    listCents: rows.reduce((s, r) => s + Number(r.cost.list_amount), 0),
    daily: [...daily.entries()].sort().map(([day, cents]) => ({ day, cents })),
    by: Object.fromEntries(COST_DIMENSIONS.map((d) => [d, aggregateCost(rows, d)])) as Record<(typeof COST_DIMENSIONS)[number], { key: string; cents: number }[]>,
  };
}

export async function seatSummary(q: DashboardQuery) {
  const [members, days] = await Promise.all([getSource().members(), loadDays(q)]);
  const active = days.flatMap((d) => d.records.flatMap((r) => (r.actor.type === "user_actor" ? [r.actor.email_address] : [])));
  const idle = idleSeats(members, active);
  return { totalSeats: members.length, activeSeats: members.length - idle.length, idle };
}
