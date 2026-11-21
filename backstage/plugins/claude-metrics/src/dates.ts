import { parseDate, type CalendarDate } from '@internationalized/date';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD calendar date, or null for anything else (bad shapes and dates like 2026-02-30). */
export function parseDay(s: string): CalendarDate | null {
  if (!DAY_RE.test(s)) return null;
  try {
    const d = parseDate(s);
    return d.toString() === s ? d : null;
  } catch {
    return null;
  }
}
