# Claude Metrics as a Backstage plugin + HTML preview

## Context
The dashboard is currently a standalone Nuxt/Vue/Vuetify app. The user wants it inside Backstage as a sidebar page, plus a static HTML page showing how it will look there. Backstage plugins are React (MUI / `@backstage/core-components`), so the Vue UI can't be reused. `lib/` is framework-free TypeScript (sources, aggregation, departments, holidays, paging) and can be reused unchanged by a Backstage backend plugin.

**Decisions (user):** standalone plugin packages with dev harnesses, no host app · all 10 tabs · standalone sidebar page (`/claude-metrics`), not an entity tab · Approach A: frontend plugin + backend plugin wrapping `lib/`.

**Approaches considered:** (A, picked) backend plugin calls `lib/service.ts`: one deployment, Admin key stays on the Backstage server, Backstage auth sits in front. (B) frontend-only plugin proxied to the Nuxt server: less code, but two services and the Nuxt API stays unauthenticated. (C) iframe: dropped because it isn't a real plugin and doesn't look native.

**Non-goals:** Group entity tab, Enterprise Analytics source, changes to the Nuxt app's behavior, publishing to npm.

## Layout (new, in this repo)
```
backstage/                         yarn workspace (Backstage tooling expects yarn); root Nuxt app stays on npm
  package.json                     workspaces: plugins/*; @backstage/cli
  plugins/claude-metrics/          frontend plugin  (@internal/backstage-plugin-claude-metrics)
  plugins/claude-metrics-backend/  backend plugin   (@internal/backstage-plugin-claude-metrics-backend)
  preview/index.html               static Backstage-look preview, mock data inlined
  scripts/export-preview-data.ts   runs lib/service on the mock source → preview JSON
docs/superpowers/specs/2026-11-21-backstage-plugin-design.md   this design, committed first
```
Scaffold both plugins with `yarn backstage-cli new` (frontend-plugin, backend-plugin) so they match the current Backstage templates and frontend/backend system versions. Builder's call on the exact template output.

## Steps

1. **Spike: can the backend import `lib/`?** Scaffold the backend plugin and import `../../../lib/service` (resolve `#lib/*` via a tsconfig `paths` entry and, if the backstage-cli runtime needs it, a root `package.json` `"imports": {"#lib/*": "./lib/*.ts"}`, which leaves Nuxt/Vitest aliases untouched). → verify: `yarn start` in the backend plugin serves mock data. If cross-package import fails under `backstage-cli package build`, fall back to an `@internal/claude-metrics-lib` workspace package that points at `lib/`, and tell the user.

2. **Backend plugin** (`createBackendPlugin`, `coreServices.httpRouter` + `config` + `logger`). Express router reproducing the 8 Nuxt routes with the same query params and JSON shapes: `claude-code`, `departments`, `users`, `user-search`, `seats`, `cost`, `meta`, `raw`. Port `defineDashboardHandler` / `intParam` (`server/utils/dashboard-handler.ts`) as express middleware: `QueryError` → 400, upstream → 502. Reuse `parseQuery` (`lib/query.ts`) and the `lib/service.ts` exports (`claudeCodeSummary`, `usersPage`, `departmentSummary`, `seatSummary`, `userSearch`, `departmentList`, `costSummary`); copy the `SORTABLE` whitelist from `server/api/users.get.ts`.
   Config (`config.d.ts` schema, `adminKey` marked `@visibility secret`):
   ```yaml
   claudeMetrics:
     dataSource: mock | anthropic
     adminKey: ${ANTHROPIC_ADMIN_KEY}
     departmentsFile: ./departments.csv
     holidayCountry: US
   ```
   `lib/` reads `process.env`, so at plugin init map config onto `DATA_SOURCE`, `ANTHROPIC_ADMIN_KEY`, `DEPARTMENTS_FILE`, `HOLIDAY_COUNTRY` (my call: no `lib/` edits). Routes require Backstage user auth (default `httpAuth` policy).
   → verify: supertest tests for each route (200 on mock, 400 on bad range, `pageSize` clamp at 100).

3. **Frontend plugin: shell.** `ClaudeMetricsPage` routed at `/claude-metrics`, plus a sidebar item example in the README. Uses `Page`, `Header` (title, data-source label from `/meta`), `TabbedLayout` with the 10 tabs, `Progress`/`ResponseErrorPanel` (replaces `ApiState.vue`). API client via `createApiRef` + `discoveryApi` + `fetchApi`. Filters live in the URL search params (same keys as `app/composables/useFilters.ts`, reusing `lib/dates.ts` helpers) → shareable links.
   - FilterBar: date range, 7/28/90 presets, exclude weekends/holidays, department select, user typeahead (MUI `Autocomplete` hitting `/user-search`, debounced).

4. **Frontend plugin: components + 10 tabs.** Port one Vue component at a time to React, keeping the same data fields:
   - `KpiTile`, `ChartCard` (`InfoCard`), `DataGrid` (core-components `Table` with remote paging/sort/search for Users and Seats, 25/page).
   - Charts with `react-chartjs-2` + Chart.js 4: `TrendChart`, `HBarChart`, `StackedBarChart`. Import `PALETTE`/`SeriesDef` from `app/utils/palette.ts` and pick light/dark from the Backstage theme (`useTheme().palette.type`/`mode`). Reuse `app/utils/format.ts`.
   - Tabs: Overview, Departments (click row → sets department filter), Tool acceptance, Environments, Commits & PRs, Models, Cost & usage, Users, Seats, API response.
   → verify: `yarn start` in the frontend plugin (dev app, `createDevApp`, pointing at the backend dev server). Every tab renders with mock data in light and dark. A few RTL tests per component (render with mocked API) plus `yarn tsc` and `yarn lint`.

5. **HTML preview** (`backstage/preview/index.html`). `scripts/export-preview-data.ts` calls the `lib/service` functions on the mock source for a fixed 28-day range and writes JSON. That JSON is inlined into one self-contained page that mimics Backstage chrome: dark left sidebar (Home, Catalog, APIs, Docs, Create, **Claude Metrics** active), themed header band, tab strip, InfoCards, Chart.js from cdnjs, light/dark toggle. All 10 tabs are clickable; filters are visual only. Publish it as a private Artifact so it can be shared, and keep the file in the repo.
   → verify: open locally with Playwright, screenshot every tab in light and dark, no console errors.

6. **Docs + CI.** `backstage/README.md`: install into a Backstage app (`yarn add`, `App.tsx` route, `Root.tsx` sidebar item, `backend.add(import(...))`, app-config block). Short pointer in the root README. Add a CI job running `yarn install && yarn tsc && yarn lint && yarn test` in `backstage/`.

## Verification (end-to-end)
- `cd backstage && yarn install && yarn tsc && yarn lint && yarn test` passes.
- Backend dev server + frontend dev app: every tab loads mock data; department row click filters every tab; URL reload restores filters; Users/Seats paging hits the server.
- Root `npm test && npm run typecheck && npm run lint` still pass, so the Nuxt app is unaffected.
- Preview HTML screenshots for all tabs in both themes, then the Artifact link.

## Calls I made (correct any)
- `backstage/` subfolder in this repo, yarn workspace, `@internal/` package names.
- Charts stay on Chart.js (parity with the current look, palette reused) rather than Recharts.
- Config is mapped to env vars at backend init instead of refactoring `lib/` to take config.
- Preview uses real mock-source output, not hand-written numbers.
