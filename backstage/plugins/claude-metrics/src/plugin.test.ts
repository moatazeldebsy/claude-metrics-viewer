import { claudeMetricsPlugin } from './plugin';

describe('claude-metrics', () => {
  it('should export plugin', () => {
    expect(claudeMetricsPlugin).toBeDefined();
  });
});
