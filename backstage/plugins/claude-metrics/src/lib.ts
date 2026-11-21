// The dashboard's shared code lives in the repo root (`lib/`, `app/utils/`) and is also used by
// the Nuxt app. This file is the only place the plugin reaches outside its package.
/* eslint-disable @backstage/no-relative-monorepo-imports */
export { addDays, toDay } from '../../../../lib/dates';
/* eslint-enable @backstage/no-relative-monorepo-imports */
