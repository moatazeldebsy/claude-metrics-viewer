import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import {
  addDays,
  dataSourceName,
  registerTelemetryStore,
  toDay,
} from '@internal/claude-metrics-lib/server';
import { applyConfig } from './config';
import { KnexTelemetryStore } from './telemetry/KnexTelemetryStore';
import { claudeMetricsPermissions } from '@internal/backstage-plugin-claude-metrics-common';
import { createRouter } from './router';

const readTokens = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (t): t is string => typeof t === 'string' && t.trim() !== '',
  );

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
        database: coreServices.database,
        scheduler: coreServices.scheduler,
      },
      async init({
        config,
        logger,
        httpAuth,
        httpRouter,
        permissions,
        permissionsRegistry,
        database,
        scheduler,
      }) {
        applyConfig(config);
        permissionsRegistry.addPermissions(claudeMetricsPermissions);

        let telemetry: Parameters<typeof createRouter>[0]['telemetry'];
        if (dataSourceName() === 'otel') {
          const store = await KnexTelemetryStore.create(
            await database.getClient(),
          );
          registerTelemetryStore(store);
          telemetry = {
            // Read loosely: Compose's ${VAR:-} leaves '' when the token isn't set, and a strict
            // string-array read would fail startup. Empty tokens are ignored (ingest answers 503).
            tokens: readTokens(
              config.getOptional('claudeMetrics.otel.ingestTokens'),
            ),
            store,
          };
          const retentionDays =
            config.getOptionalNumber('claudeMetrics.otel.retentionDays') ?? 400;
          if (retentionDays > 0) {
            await scheduler.scheduleTask({
              id: 'claude-metrics-telemetry-prune',
              frequency: { hours: 24 },
              timeout: { minutes: 10 },
              initialDelay: { minutes: 1 },
              fn: () => store.prune(addDays(toDay(new Date()), -retentionDays)),
            });
          }
          logger.info(
            'Claude Metrics: OpenTelemetry ingest at /api/claude-metrics/otlp/v1/metrics',
          );
        }

        // Claude Code can't send a Backstage token; the route checks its own ingest tokens.
        httpRouter.addAuthPolicy({ path: '/otlp', allow: 'unauthenticated' });
        httpRouter.use(
          await createRouter({ logger, httpAuth, permissions, telemetry }),
        );
      },
    });
  },
});
