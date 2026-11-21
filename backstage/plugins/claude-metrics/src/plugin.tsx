import {
  ApiBlueprint,
  createFrontendPlugin,
  fetchApiRef,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import { claudeMetricsApiRef, ClaudeMetricsClient } from './api';
import { rootRouteRef } from './routes';

export const claudeMetricsApi = ApiBlueprint.make({
  params: defineParams =>
    defineParams({
      api: claudeMetricsApiRef,
      deps: { fetchApi: fetchApiRef },
      factory: ({ fetchApi }) => new ClaudeMetricsClient(fetchApi),
    }),
});

export const page = PageBlueprint.make({
  params: {
    path: '/claude-metrics',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/ClaudeMetricsPage').then(m => (
        <m.ClaudeMetricsPage />
      )),
  },
});

export const claudeMetricsPlugin = createFrontendPlugin({
  pluginId: 'claude-metrics',
  title: 'Claude Metrics',
  info: { packageJson: () => import('../package.json') },
  extensions: [claudeMetricsApi, page],
  routes: {
    root: rootRouteRef,
  },
});
