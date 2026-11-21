import { isPermission } from '@backstage/plugin-permission-common';
import {
  claudeMetricsPermissions,
  claudeMetricsReadPermission,
} from './permissions';

describe('claudeMetricsReadPermission', () => {
  it('is a basic read permission named claude-metrics.dashboard.read', () => {
    expect(claudeMetricsReadPermission).toEqual(
      expect.objectContaining({
        type: 'basic',
        name: 'claude-metrics.dashboard.read',
        attributes: { action: 'read' },
      }),
    );
    expect(
      isPermission(claudeMetricsReadPermission, claudeMetricsReadPermission),
    ).toBe(true);
    expect(claudeMetricsPermissions).toEqual([claudeMetricsReadPermission]);
  });
});
