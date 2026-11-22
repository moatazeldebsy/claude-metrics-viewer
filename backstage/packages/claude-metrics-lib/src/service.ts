import {
  aggregateClaudeCode,
  aggregateCost,
  idleSeats,
  type DayRecords,
} from './aggregate';
import { actorLabel } from './aggregate';
import type { ClaudeCodeRecord } from './anthropic-types';
import { aggregateDepartments, UNASSIGNED } from './departments-agg';
import type { DashboardQuery } from './query';
import { selectedDays } from './query';
import { getSource } from './sources';
import type { CostGroupBy, Member } from './sources/types';
import { pageUsers, searchUsers, type UserPageQuery } from './users';

/** Run async work over items with at most `limit` in flight, keeping order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}

async function loadDays(q: DashboardQuery): Promise<DayRecords[]> {
  const src = getSource();
  return mapLimit(selectedDays(q), 5, async day => ({
    day,
    records: await src.claudeCodeDay(day),
  }));
}

/**
 * Load the selected days and members, then apply the department and user filters.
 * With a department filter, API-key actors drop out (they belong to no department) and
 * users missing from the member list count as Unassigned.
 */
async function loadFiltered(q: DashboardQuery) {
  const [allMembers, days] = await Promise.all([
    getSource().members(),
    loadDays(q),
  ]);
  const deptOf = new Map(
    allMembers.map(m => [m.email.toLowerCase(), m.department ?? UNASSIGNED]),
  );
  const keep = (r: ClaudeCodeRecord) => {
    if (q.user && actorLabel(r.actor) !== q.user) return false;
    if (!q.department) return true;
    return (
      r.actor.type === 'user_actor' &&
      (deptOf.get(r.actor.email_address.toLowerCase()) ?? UNASSIGNED) ===
        q.department
    );
  };
  const members: Member[] = q.department
    ? allMembers.filter(m => (m.department ?? UNASSIGNED) === q.department)
    : allMembers;
  return {
    members,
    allMembers,
    days:
      q.user || q.department
        ? days.map(d => ({ ...d, records: d.records.filter(keep) }))
        : days,
  };
}

export async function claudeCodeSummary(q: DashboardQuery) {
  const { days } = await loadFiltered(q);
  const { users, ...summary } = aggregateClaudeCode(days);
  // The full user list can be thousands of rows; the Users tab pages it via usersPage().
  return {
    ...summary,
    topContributors: [...users]
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 10),
  };
}

export async function usersPage(q: DashboardQuery, pq: UserPageQuery) {
  const { days, allMembers } = await loadFiltered(q);
  const deptOf = new Map(
    allMembers.map(m => [m.email.toLowerCase(), m.department]),
  );
  const page = pageUsers(aggregateClaudeCode(days).users, pq);
  return {
    ...page,
    rows: page.rows.map(u => ({
      ...u,
      department:
        u.type === 'user_actor'
          ? deptOf.get(u.label.toLowerCase()) ?? UNASSIGNED
          : null,
    })),
  };
}

export async function departmentSummary(q: DashboardQuery) {
  const { days, members } = await loadFiltered(q);
  const activeByDay = new Map(
    days.map(d => [
      d.day,
      new Set(
        d.records.flatMap(r =>
          r.actor.type === 'user_actor' ? [r.actor.email_address] : [],
        ),
      ),
    ]),
  );
  return aggregateDepartments(
    members,
    aggregateClaudeCode(days).users,
    days.map(d => d.day),
    activeByDay,
    days.length,
    { from: q.from, to: q.to },
  );
}

export async function seatSummary(
  q: DashboardQuery,
  { text = '', page = 1, pageSize = 25 } = {},
) {
  const { members, days } = await loadFiltered(q);
  const active = days.flatMap(d =>
    d.records.flatMap(r =>
      r.actor.type === 'user_actor' ? [r.actor.email_address] : [],
    ),
  );
  const idle = idleSeats(members, active);
  const needle = text.trim().toLowerCase();
  const matches = (
    needle
      ? idle.filter(m =>
          `${m.name} ${m.email} ${m.department ?? ''}`
            .toLowerCase()
            .includes(needle),
        )
      : idle
  ).sort((a, b) => a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  return {
    totalSeats: members.length,
    activeSeats: members.length - idle.length,
    idleCount: idle.length,
    idle: {
      rows: matches.slice((p - 1) * pageSize, p * pageSize),
      total: matches.length,
      page: p,
      pages,
    },
  };
}

/** Typeahead for the user filter: at most 20 matches, never the full list. */
export async function userSearch(q: DashboardQuery, text: string) {
  const [members, days] = await Promise.all([
    getSource().members(),
    loadDays(q),
  ]);
  const apiActors = [
    ...new Set(
      days.flatMap(d =>
        d.records.flatMap(r =>
          r.actor.type === 'api_actor' ? [actorLabel(r.actor)] : [],
        ),
      ),
    ),
  ];
  return searchUsers(members, apiActors, text, 20);
}

export async function departmentList() {
  const members = await getSource().members();
  return [...new Set(members.map(m => m.department ?? UNASSIGNED))].sort();
}

export const COST_DIMENSIONS = [
  'model',
  'workspace_id',
  'api_key_id',
  'product',
  'service_tier',
  'cost_type',
] as const satisfies readonly CostGroupBy[];

export async function costSummary(q: DashboardQuery) {
  const days = new Set(selectedDays(q));
  // One daily query grouped by every dimension (cost_type doesn't count toward the 5-dimension limit),
  // then drop excluded days and roll up per dimension.
  const rows = (
    await getSource().cost({
      from: q.from,
      to: q.to,
      groupBy: [...COST_DIMENSIONS],
      daily: true,
    })
  ).filter(r => days.has(r.starting_at.slice(0, 10)));
  const daily = new Map<string, number>([...days].map(d => [d, 0]));
  for (const r of rows)
    daily.set(
      r.starting_at.slice(0, 10),
      (daily.get(r.starting_at.slice(0, 10)) ?? 0) + Number(r.cost.amount),
    );
  return {
    totalCents: rows.reduce((s, r) => s + Number(r.cost.amount), 0),
    listCents: rows.reduce((s, r) => s + Number(r.cost.list_amount), 0),
    daily: [...daily.entries()].sort().map(([day, cents]) => ({ day, cents })),
    by: Object.fromEntries(
      COST_DIMENSIONS.map(d => [d, aggregateCost(rows, d)]),
    ) as Record<
      (typeof COST_DIMENSIONS)[number],
      { key: string; cents: number }[]
    >,
  };
}
