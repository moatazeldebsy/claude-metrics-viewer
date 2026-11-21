import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
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
});
