import {
  HttpAuthService,
  LoggerService,
  PermissionsService,
} from '@backstage/backend-plugin-api';
import { NotAllowedError } from '@backstage/errors';
import { claudeMetricsReadPermission } from '@internal/backstage-plugin-claude-metrics-common';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import express from 'express';
import Router from 'express-promise-router';
import { dashboard, intParam } from './handler';
import {
  claudeCodeSummary,
  costSummary,
  COST_DIMENSIONS,
  dataSourceName,
  departmentList,
  departmentSummary,
  getSource,
  handleOtlpIngest,
  holidayCountry,
  seatSummary,
  sourceCapabilities,
  telemetryStatus,
  userSearch,
  usersPage,
  type TelemetryStore,
  type UserRow,
} from '@internal/claude-metrics-lib/server';

const SORTABLE = new Set<keyof UserRow>([
  'label',
  'sessions',
  'linesAdded',
  'linesRemoved',
  'commits',
  'prs',
  'acceptRate',
  'costCents',
  'activeDays',
  'lastActive',
]);

/** The same routes, params and JSON shapes as the Nuxt app's server/api. */
export async function createRouter({
  logger,
  httpAuth,
  permissions,
  telemetry,
}: {
  logger: LoggerService;
  httpAuth: HttpAuthService;
  permissions: PermissionsService;
  /** Set when claudeMetrics.dataSource is otel: enables the OTLP ingest route. */
  telemetry?: { tokens: string[]; store: TelemetryStore };
}): Promise<express.Router> {
  const router = Router();

  // OTLP/HTTP ingest for Claude Code. It sits before the permission check: Claude Code has no
  // Backstage token, so this route is unauthenticated in Backstage's auth policy (see plugin.ts)
  // and checks its own ingest tokens instead.
  router.post(
    '/otlp/v1/metrics',
    express.raw({ type: () => true, limit: '6mb' }),
    async (req, res) => {
      if (!telemetry) {
        res.status(404).json({
          message:
            'OTLP ingest is only available with claudeMetrics.dataSource: otel.',
        });
        return;
      }
      const result = await handleOtlpIngest(
        {
          body: new Uint8Array(
            Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
          ),
          contentType: req.header('content-type'),
          contentEncoding: req.header('content-encoding'),
          authorization: req.header('authorization'),
        },
        telemetry,
      );
      res.status(result.status).type(result.contentType);
      res.send(
        typeof result.body === 'string'
          ? result.body
          : Buffer.from(result.body),
      );
    },
  );

  // Every route shows organization-wide per-user data: the permission policy decides who may see it.
  router.use(async (req, _res, next) => {
    const credentials = await httpAuth.credentials(req);
    const [decision] = await permissions.authorize(
      [{ permission: claudeMetricsReadPermission }],
      { credentials },
    );
    if (decision.result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError(
        'You do not have access to Claude Metrics. Ask your Backstage admins for the claude-metrics.dashboard.read permission.',
      );
    }
    next();
  });
  const route = (path: string, fn: Parameters<typeof dashboard>[1]) =>
    router.get(path, dashboard(logger, fn));

  route('/meta', async () => ({
    dataSource: dataSourceName(),
    holidayCountry: holidayCountry(),
    departments: await departmentList(),
    capabilities: sourceCapabilities(),
    telemetry: await telemetryStatus(),
  }));

  route('/claude-code', q => claudeCodeSummary(q));
  route('/departments', q => departmentSummary(q));
  route('/cost', q => costSummary(q));

  route('/users', (q, sp) => {
    const sort = sp.get('sort') as keyof UserRow;
    return usersPage(q, {
      q: sp.get('q') ?? '',
      sort: SORTABLE.has(sort) ? sort : 'sessions',
      desc: sp.get('desc') !== 'false',
      page: intParam(sp, 'page', 1),
      pageSize: intParam(sp, 'pageSize', 25, 100),
    });
  });

  route('/seats', (q, sp) =>
    seatSummary(q, {
      text: sp.get('q') ?? '',
      page: intParam(sp, 'page', 1),
      pageSize: intParam(sp, 'pageSize', 25, 100),
    }),
  );

  route('/user-search', async (q, sp) => ({
    options: await userSearch(q, sp.get('q') ?? ''),
  }));

  // Untouched upstream rows for one day, for the "API response" tab.
  route('/raw', async (q, sp) => {
    const day = sp.get('day') ?? q.to;
    const src = getSource();
    const data =
      sp.get('source') === 'cost'
        ? await src.cost({
            from: day,
            to: day,
            groupBy: [...COST_DIMENSIONS],
            daily: true,
          })
        : await src.claudeCodeDay(day);
    return { dataSource: dataSourceName(), day, data };
  });

  return router;
}
