// All dates are UTC calendar days in YYYY-MM-DD form.

const DAY_MS = 86_400_000;

export function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return toDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));
}

/** Every day from `from` to `to`, both inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function isWeekend(day: string): boolean {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Split an inclusive day range into chunks of at most `maxDays` days. */
export function splitRange(
  from: string,
  to: string,
  maxDays: number,
): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  for (let start = from; start <= to; start = addDays(start, maxDays)) {
    const end = addDays(start, maxDays - 1);
    out.push({ from: start, to: end < to ? end : to });
  }
  return out;
}

export interface DayFilter {
  excludeWeekends?: boolean;
  excludeHolidays?: boolean;
  holidays?: string[];
}

export function filterDays(days: string[], f: DayFilter): string[] {
  const hol = new Set(f.excludeHolidays ? f.holidays ?? [] : []);
  return days.filter(d => !(f.excludeWeekends && isWeekend(d)) && !hol.has(d));
}

/** Monday of the UTC week containing `day`. */
export function weekStart(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}
