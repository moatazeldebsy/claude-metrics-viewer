import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';

/**
 * Claude Metrics backend plugin: serves the dashboard's data routes under /api/claude-metrics.
 *
 * @public
 */
export const claudeMetricsPlugin = createBackendPlugin({
  pluginId: 'claude-metrics',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
      },
      async init({ logger, httpAuth, httpRouter }) {
        httpRouter.use(await createRouter({ logger, httpAuth }));
      },
    });
  },
});
