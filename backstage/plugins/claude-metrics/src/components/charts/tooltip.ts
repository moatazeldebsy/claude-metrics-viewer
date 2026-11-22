import type { ChartColors } from '@moatazeldebsy/claude-metrics-lib';

export const tooltipColors = (c: ChartColors) => ({
  backgroundColor: c.surface,
  titleColor: c.text2,
  bodyColor: c.text,
  borderColor: c.border,
  borderWidth: 1,
});
