import { useCallback, useMemo } from 'react';
import { useAppSearchParams } from '@backstage/frontend-plugin-api';
import { addDays, toDay } from '../lib';

const FILTER_KEYS = [
  'excludeWeekends',
  'excludeHolidays',
  'user',
  'department',
] as const;

/** Dashboard filters live in the URL so any view can be shared (same keys as the Nuxt app). */
export function useFilters() {
  const [params, setParams] = useAppSearchParams();
  const yesterday = addDays(toDay(new Date()), -1);
  const param = useCallback((k: string) => params.get(k) || null, [params]);

  const to = param('to') ?? yesterday;
  const from = param('from') ?? addDays(to, -27);
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
        prev => {
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

  return { yesterday, from, to, tab, query, param, set };
}
