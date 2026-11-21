import type { ClaudeMetricsApi, Route } from './api';

type Responder = (params: Record<string, string>) => unknown;

/** Fake backend: returns canned JSON per route and records every call. */
export function fakeApi(routes: Partial<Record<Route, unknown | Responder>>) {
  const calls: { route: Route; params: Record<string, string> }[] = [];
  const api: ClaudeMetricsApi = {
    async get<T>(route: Route, params: Record<string, string>): Promise<T> {
      calls.push({ route, params });
      const r = routes[route];
      if (r === undefined) throw new Error(`no fake for ${route}`);
      return (
        typeof r === 'function' ? await (r as Responder)(params) : r
      ) as T;
    },
  };
  return {
    api,
    calls,
    last: (route: Route) =>
      [...calls].reverse().find(c => c.route === route)?.params,
  };
}

export const META = {
  dataSource: 'mock',
  holidayCountry: 'US',
  departments: ['Data', 'Platform'],
};
