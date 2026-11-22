import type { UserRow } from './aggregate';
import { acceptRate } from './aggregate';
import { addDays, weekStart } from './dates';
import type { Member } from './sources/types';

export const UNASSIGNED = 'Unassigned';
export type Tier = 'power' | 'regular' | 'light';

/** Power: active on >= 60% of the selected days; regular: >= 25%; light: anything less. */
export function engagementTier(activeDays: number, selectedDays: number): Tier {
  const share = selectedDays ? activeDays / selectedDays : 0;
  return share >= 0.6 ? 'power' : share >= 0.25 ? 'regular' : 'light';
}

export interface DepartmentRow {
  department: string;
  seats: number;
  activeUsers: number;
  adoption: number;
  sessions: number;
  sessionsPerActive: number;
  linesAdded: number;
  commits: number;
  prs: number;
  acceptRate: number | null;
  costCents: number;
  costPerActive: number;
  tiers: Record<Tier | 'inactive', number>;
}

/**
 * Roll per-user Claude Code activity up to departments.
 * Seats = members of the department, plus active users the member list doesn't know (counted as Unassigned).
 */
export function aggregateDepartments(
  members: Member[],
  users: UserRow[],
  days: string[],
  activeByDay: Map<string, Set<string>>,
  selectedDays: number,
  range?: { from: string; to: string },
) {
  const deptOf = new Map(
    members.map(m => [m.email.toLowerCase(), m.department ?? UNASSIGNED]),
  );
  const rows = new Map<
    string,
    DepartmentRow & { accepted: number; rejected: number }
  >();
  const row = (d: string) => {
    let r = rows.get(d);
    if (!r) {
      r = {
        department: d,
        seats: 0,
        activeUsers: 0,
        adoption: 0,
        sessions: 0,
        sessionsPerActive: 0,
        linesAdded: 0,
        commits: 0,
        prs: 0,
        acceptRate: null,
        costCents: 0,
        costPerActive: 0,
        accepted: 0,
        rejected: 0,
        tiers: { power: 0, regular: 0, light: 0, inactive: 0 },
      };
      rows.set(d, r);
    }
    return r;
  };

  for (const m of members) row(m.department ?? UNASSIGNED).seats++;
  for (const u of users) {
    if (u.type !== 'user_actor') continue;
    const email = u.label.toLowerCase();
    if (!deptOf.has(email)) {
      deptOf.set(email, UNASSIGNED);
      row(UNASSIGNED).seats++;
    }
    const r = row(deptOf.get(email)!);
    r.activeUsers++;
    r.sessions += u.sessions;
    r.linesAdded += u.linesAdded;
    r.commits += u.commits;
    r.prs += u.prs;
    r.accepted += u.accepted;
    r.rejected += u.rejected;
    r.costCents += u.costCents;
    r.tiers[engagementTier(u.activeDays, selectedDays)]++;
  }

  const out: DepartmentRow[] = [...rows.values()].map(
    ({ accepted, rejected, ...r }) => ({
      ...r,
      adoption: r.seats ? r.activeUsers / r.seats : 0,
      sessionsPerActive: r.activeUsers ? r.sessions / r.activeUsers : 0,
      costPerActive: r.activeUsers ? r.costCents / r.activeUsers : 0,
      acceptRate: acceptRate(accepted, rejected),
      tiers: { ...r.tiers, inactive: r.seats - r.activeUsers },
    }),
  );
  out.sort(
    (a, b) =>
      a.adoption - b.adoption || a.department.localeCompare(b.department),
  );

  // Weekly adoption: distinct active users in the week / department seats.
  const weeks = new Map<string, Set<string>>();
  for (const day of days) {
    const set = weeks.get(weekStart(day)) ?? new Set<string>();
    for (const e of activeByDay.get(day) ?? []) set.add(e.toLowerCase());
    weeks.set(weekStart(day), set);
  }
  // A partial first/last week looks like an adoption dip, so keep complete weeks when there are any.
  const allWeeks = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b));
  const complete = range
    ? allWeeks.filter(([w]) => w >= range.from && addDays(w, 6) <= range.to)
    : allWeeks;
  const weekly = (complete.length ? complete : allWeeks).map(
    ([week, active]) => {
      const point: Record<string, string | number> = { week };
      for (const r of out) point[r.department] = 0;
      for (const e of active) {
        const d = deptOf.get(e) ?? UNASSIGNED;
        point[d] = (point[d] as number) + 1;
      }
      for (const r of out)
        point[r.department] = r.seats
          ? (point[r.department] as number) / r.seats
          : 0;
      return point;
    },
  );

  const seats = out.reduce((s, r) => s + r.seats, 0);
  const activeUsers = out.reduce((s, r) => s + r.activeUsers, 0);
  return {
    rows: out,
    weekly,
    totals: {
      departments: out.length,
      seats,
      activeUsers,
      adoption: seats ? activeUsers / seats : 0,
      tiers: out.reduce(
        (t, r) => ({
          power: t.power + r.tiers.power,
          regular: t.regular + r.tiers.regular,
          light: t.light + r.tiers.light,
          inactive: t.inactive + r.tiers.inactive,
        }),
        { power: 0, regular: 0, light: 0, inactive: 0 },
      ),
    },
  };
}
