// The dashboard's data layer lives in the repo-root `lib/` and is shared with the Nuxt app.
// This file is the only place the plugin reaches outside its package; `lib/`'s own `#lib/*`
// imports resolve through the "imports" map in the repo-root package.json.
/* eslint-disable @backstage/no-relative-monorepo-imports */
export { holidayCountry } from '../../../../lib/holidays';
export { departmentList } from '../../../../lib/service';
export { dataSourceName } from '../../../../lib/sources';
/* eslint-enable @backstage/no-relative-monorepo-imports */
