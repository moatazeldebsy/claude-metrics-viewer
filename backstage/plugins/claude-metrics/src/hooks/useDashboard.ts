import { useApi } from '@backstage/frontend-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import { claudeMetricsApiRef, type Route } from '../api';
import { useFilters } from './useFilters';

/** Fetch one backend route with the current URL filters plus any route-specific params. */
export function useDashboard<T>(
  route: Route,
  extra: Record<string, string> = {},
) {
  const api = useApi(claudeMetricsApiRef);
  const { query } = useFilters();
  const params = { ...query, ...extra };
  const key = JSON.stringify(params);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useAsync(() => api.get<T>(route, params), [api, route, key]);
}
