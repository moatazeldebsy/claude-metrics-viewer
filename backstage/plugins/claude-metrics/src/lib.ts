// The dashboard's shared code lives in the repo root (`lib/`, `app/utils/`) and is also used by
// the Nuxt app. This file is the only place the plugin reaches outside its package.
/* eslint-disable @backstage/no-relative-monorepo-imports */
export { addDays, toDay } from '../../../../lib/dates';
export {
  PALETTE,
  type ChartColors,
  type SeriesDef,
} from '../../../../app/utils/palette';
export {
  fmtCompact,
  fmtFixed1,
  fmtInt,
  fmtPct,
  fmtUsd,
} from '../../../../app/utils/format';
export type { GridColumn } from '../../../../app/utils/grid';
export type { ClaudeCodeSummary, UserRow } from '../../../../lib/aggregate';
export type { DepartmentRow } from '../../../../lib/departments-agg';
export type { Member } from '../../../../lib/sources/types';
export type { UserOption } from '../../../../lib/users';
/* eslint-enable @backstage/no-relative-monorepo-imports */
