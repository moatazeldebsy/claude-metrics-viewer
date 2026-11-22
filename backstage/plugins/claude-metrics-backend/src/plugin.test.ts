import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import request from 'supertest';
import { claudeMetricsPlugin } from './plugin';

describe('claudeMetricsPlugin', () => {
  it('registers its permission so permission policies and tooling can see it', async () => {
    const registry = mockServices.permissionsRegistry.mock();
    await startTestBackend({
      features: [claudeMetricsPlugin, registry.factory],
    });
    expect(registry.addPermissions).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'claude-metrics.dashboard.read' }),
    ]);
  });

  it('starts in otel mode when the ingest token env var is empty, with ingest disabled (503)', async () => {
    // Docker Compose's ${VAR:-} passes '' when the variable isn't set.
    const saved = process.env.DATA_SOURCE;
    try {
      const { server } = await startTestBackend({
        features: [
          claudeMetricsPlugin,
          mockServices.rootConfig.factory({
            data: {
              claudeMetrics: {
                dataSource: 'otel',
                otel: { ingestTokens: [''] },
              },
            },
          }),
        ],
      });
      const res = await request(server)
        .post('/api/claude-metrics/otlp/v1/metrics')
        .set('content-type', 'application/json')
        .set('authorization', 'Bearer x')
        .send('{}');
      expect(res.status).toBe(503);
    } finally {
      if (saved === undefined) delete process.env.DATA_SOURCE;
      else process.env.DATA_SOURCE = saved;
    }
  });
});
