// Browser-safe entry point: dates, formatting, chart palette, constants and types.
// Anything that talks to the Anthropic API or the filesystem lives in `./server`.
export * from './dates';
export * from './format';
export { PALETTE, type ChartColors, type SeriesDef } from './palette';
export type { GridColumn } from './grid';
export * from './anthropic-types';
export type {
  ClaudeCodeSummary,
  DailyPoint,
  DayRecords,
  UserRow,
} from './aggregate';
export type { DepartmentRow, Tier } from './departments-agg';
export type { DashboardQuery } from './query';
export type {
  CostGroupBy,
  CostItem,
  CostQuery,
  Member,
  MetricsSource,
  SourceCapabilities,
} from './sources/types';
export type { UserOption, UserPageQuery } from './users';
