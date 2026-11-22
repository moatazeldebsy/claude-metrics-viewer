import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseDay } from '../dates';
import { addDays, toDay } from '@moatazeldebsy/claude-metrics-lib';
import { useCapabilities } from './useMeta';

const FILTER_KEYS = [
  'excludeWeekends',
  'excludeHolidays',
  'user',
  'department',
] as const;

/** Dashboard filters live in the URL so any view can be shared (same keys as the Nuxt app). */
export function useFilters() {
  const [params, setParams] = useSearchParams();
  // Live sources (OpenTelemetry) can show today; the Admin API's data for today is incomplete.
  const latest = addDays(
    toDay(new Date()),
    useCapabilities().includesToday ? 0 : -1,
  );
  const param = useCallback((k: string) => params.get(k) || null, [params]);

  const to = param('to') ?? latest;
  // A malformed `to` from a shared link is left for the server to reject with a clear message.
  const from = param('from') ?? (parseDay(to) ? addDays(to, -27) : to);
  const tab = param('tab') ?? 'overview';

  /** Query sent to every backend route. */
  const query = useMemo(() => {
    const q: Record<string, string> = { from, to };
    for (const k of FILTER_KEYS) {
      const v = param(k);
      if (v) q[k] = v;
    }
    return q;
  }, [from, to, param]);

  const set = useCallback(
    (patch: Record<string, string | null>) =>
      setParams(
        (prev: URLSearchParams) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  return { latest, from, to, tab, query, param, set };
}
