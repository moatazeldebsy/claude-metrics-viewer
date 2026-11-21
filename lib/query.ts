import { addDays, eachDay, filterDays, toDay } from "#lib/dates";
import { holidayCountry, holidaysFor } from "#lib/holidays";

export interface DashboardQuery {
  from: string;
  to: string;
  excludeWeekends: boolean;
  excludeHolidays: boolean;
  user: string | null;
  department: string | null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_RANGE_DAYS = 365;

export class QueryError extends Error {}

/** Parse and validate dashboard filters. Defaults to the last 28 complete UTC days. */
export function parseQuery(sp: URLSearchParams, today = toDay(new Date())): DashboardQuery {
  const to = sp.get("to") ?? addDays(today, -1);
  const from = sp.get("from") ?? addDays(to, -27);
  if (!DAY_RE.test(from) || !DAY_RE.test(to)) throw new QueryError("from/to must be YYYY-MM-DD");
  if (from > to) throw new QueryError("from must be on or before to");
  if (to >= today) throw new QueryError("to must be before today (UTC); today's data is incomplete");
  if (eachDay(from, to).length > MAX_RANGE_DAYS) throw new QueryError(`range is limited to ${MAX_RANGE_DAYS} days`);
  return {
    from,
    to,
    excludeWeekends: sp.get("excludeWeekends") === "true",
    excludeHolidays: sp.get("excludeHolidays") === "true",
    user: sp.get("user") || null,
    department: sp.get("department") || null,
  };
}

export function selectedDays(q: DashboardQuery, country = holidayCountry()): string[] {
  const days = eachDay(q.from, q.to);
  const years = [...new Set(days.map((d) => Number(d.slice(0, 4))))];
  return filterDays(days, { ...q, holidays: q.excludeHolidays ? [...holidaysFor(country, years)] : [] });
}
