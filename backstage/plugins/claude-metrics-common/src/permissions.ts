import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Viewing the Claude Metrics dashboard and calling its API. It shows per-user activity and
 * cost for the whole organization, so a permission policy usually limits it to managers.
 *
 * @public
 */
export const claudeMetricsReadPermission = createPermission({
  name: 'claude-metrics.dashboard.read',
  attributes: { action: 'read' },
});

/**
 * Every permission the Claude Metrics plugins define.
 *
 * @public
 */
export const claudeMetricsPermissions = [claudeMetricsReadPermission];
