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
/* eslint-enable @backstage/no-relative-monorepo-imports */
