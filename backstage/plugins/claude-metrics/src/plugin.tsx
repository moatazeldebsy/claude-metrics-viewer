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

// Bar-chart glyph for the sidebar entry and plugin header.
const icon = (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const claudeMetricsPlugin = createFrontendPlugin({
  pluginId: 'claude-metrics',
  title: 'Claude Metrics',
  icon,
  info: { packageJson: () => import('../package.json') },
  extensions: [claudeMetricsApi, page],
  routes: {
    root: rootRouteRef,
  },
});
