import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { applyConfig } from './config';
import { claudeMetricsPermissions } from '@internal/backstage-plugin-claude-metrics-common';
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
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        permissions: coreServices.permissions,
        permissionsRegistry: coreServices.permissionsRegistry,
      },
      async init({
        config,
        logger,
        httpAuth,
        httpRouter,
        permissions,
        permissionsRegistry,
      }) {
        applyConfig(config);
        permissionsRegistry.addPermissions(claudeMetricsPermissions);
        httpRouter.use(await createRouter({ logger, httpAuth, permissions }));
      },
    });
  },
});
