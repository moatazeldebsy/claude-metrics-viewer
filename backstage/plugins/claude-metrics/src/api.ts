import { ResponseError } from '@backstage/errors';
import { createApiRef, type FetchApi } from '@backstage/frontend-plugin-api';

export type Route =
  | 'claude-code'
  | 'departments'
  | 'users'
  | 'user-search'
  | 'seats'
  | 'cost'
  | 'meta'
  | 'raw';

export interface ClaudeMetricsApi {
  get<T>(route: Route, params: Record<string, string>): Promise<T>;
}

export const claudeMetricsApiRef = createApiRef<ClaudeMetricsApi>().with({
  id: 'plugin.claude-metrics.api',
  pluginId: 'claude-metrics',
});

/** Calls the claude-metrics backend plugin; `plugin://` URLs are resolved by the fetch API. */
export class ClaudeMetricsClient implements ClaudeMetricsApi {
  constructor(private readonly fetchApi: FetchApi) {}

  async get<T>(route: Route, params: Record<string, string>): Promise<T> {
    const res = await this.fetchApi.fetch(
      `plugin://claude-metrics/${route}?${new URLSearchParams(params)}`,
    );
    if (!res.ok) throw await ResponseError.fromResponse(res);
    return res.json();
  }
}
