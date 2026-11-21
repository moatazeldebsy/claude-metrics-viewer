# Claude Metrics Backstage Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Claude Metrics dashboard as a Backstage frontend + backend plugin pair (all 10 tabs, sidebar page at `/claude-metrics`) plus a static HTML preview of how it looks inside Backstage.

**Architecture:** A yarn workspace in `backstage/` holds two plugins. The backend plugin (`pluginId: claude-metrics`) mounts an express router whose 8 routes call the existing framework-free `lib/service.ts` unchanged. The frontend plugin is a React page made from `@backstage/core-components`, fetching through `discoveryApi` + `fetchApi`, with Chart.js charts reusing `app/utils/palette.ts`.

**Tech Stack:** Backstage (current `@backstage/cli` templates, new backend system), React 18, MUI (whatever the scaffold uses), `react-chartjs-2` + `chart.js@4`, Jest + supertest + React Testing Library (via `backstage-cli package test`), yarn 4 via corepack.

**Spec:** `docs/superpowers/specs/2026-11-21-backstage-plugin-design.md`

## Global Constraints

- Plugin ID `claude-metrics`; packages `@internal/backstage-plugin-claude-metrics` and `@internal/backstage-plugin-claude-metrics-backend`.
- Frontend route path `/claude-metrics`; backend routes at `<discovery baseUrl for claude-metrics>/<route>`.
- The 8 routes keep the Nuxt names, query params and JSON shapes: `claude-code`, `departments`, `users`, `user-search`, `seats`, `cost`, `meta`, `raw`.
- No behavior change to `lib/` or the Nuxt app. Root `npm test`, `npm run typecheck` and `npm run lint` must still pass.
- Config keys: `claudeMetrics.dataSource` (`mock` | `anthropic`), `claudeMetrics.adminKey` (`@visibility secret`), `claudeMetrics.departmentsFile`, `claudeMetrics.holidayCountry`.
- URL filter keys stay as they are: `from`, `to`, `excludeWeekends`, `excludeHolidays`, `user`, `department`, `tab`. Default range: last 28 complete UTC days ending yesterday.
- Users and Seats paging is done on the server: 25 per page, `pageSize` clamped to 100.
- Tab order: Overview, Departments, Tool acceptance, Environments, Commits & PRs, Models, Cost & usage, Users, Seats, API response.
- Commits carry only the user's identity (no Claude co-author trailer, per the user's memory).

## Review Focus

1. `dataSource: anthropic` with no `adminKey` → backend fails at plugin init with `claudeMetrics.adminKey is required when dataSource is anthropic`, not a 502 on first request. Test in Task 2.
2. Host already sets `ANTHROPIC_ADMIN_KEY`/`DATA_SOURCE` env and omits `claudeMetrics` config → env is left as-is (config only overrides when present). Test in Task 2.
3. A shared URL with an invalid range (`to` = today, `from` > `to`) → every tab shows the 400 message in `ResponseErrorPanel`, not a blank card or spinner. Tests in Tasks 3 and 5.
4. Switching the Backstage theme light↔dark → chart colors switch to `PALETTE.dark` / `PALETTE.light`. Test in Task 4.
5. `page` past the last page or `pageSize=500` → server clamps (last page, 100 rows), and the table shows the clamped page. Test in Task 2.

---

### Task 1: Workspace + backend plugin skeleton that reads `lib/` (spike)

**Files:**
- Create: `backstage/package.json`, `backstage/.yarnrc.yml`, `backstage/tsconfig.json`, `backstage/app-config.yaml`, `backstage/.gitignore`
- Create (via `yarn backstage-cli new --select backend-plugin --option pluginId=claude-metrics`): `backstage/plugins/claude-metrics-backend/**`
- Modify: `backstage/plugins/claude-metrics-backend/src/plugin.ts`, `src/router.ts`
- Test: `backstage/plugins/claude-metrics-backend/src/router.test.ts`
- Commit also: `docs/superpowers/specs/2026-11-21-backstage-plugin-design.md`, this plan

**Interfaces:**
- Produces: `createRouter(options: { logger: LoggerService; httpAuth: HttpAuthService }): Promise<express.Router>` in `src/router.ts`; `claudeMetricsPlugin` default export from `src/index.ts`.
- `#lib/*` resolves to `<repo>/lib/*` in tsc (tsconfig `paths`), Jest (`"jest": {"moduleNameMapper": {"^#lib/(.*)$": "<rootDir>/../../../lib/$1"}}`) and the dev server.

- [ ] **Step 1:** `backstage/package.json`: `private`, `workspaces: ["plugins/*"]`, `packageManager: "yarn@4.x"` (latest 4 at execution time), devDeps `@backstage/cli`, `typescript`. Scripts: `tsc`, `lint: backstage-cli repo lint`, `test: backstage-cli repo test`. Run `corepack enable && yarn install`, then scaffold the backend plugin. Expected: `plugins/claude-metrics-backend` exists and `yarn tsc` passes.
- [ ] **Step 2: Write the failing test** `GET /meta returns mock metadata`:
  ```ts
  const res = await request(app).get('/meta');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ dataSource: 'mock', holidayCountry: 'US', departments: expect.arrayContaining(['Unassigned']) });
  expect(res.body.departments.length).toBeGreaterThan(5);
  ```
  (Build `app` with `express().use(await createRouter({ logger: mockServices.logger.mock(), httpAuth: mockServices.httpAuth() }))`.) If the mock org has no Unassigned members, assert on `length > 5` only.
- [ ] **Step 3:** Run `yarn workspace @internal/backstage-plugin-claude-metrics-backend test`. Expected: FAIL (404 or route missing).
- [ ] **Step 4:** Add the `/meta` route in `router.ts` importing `departmentList` from `#lib/service`, `holidayCountry` from `#lib/holidays`, `dataSourceName` from `#lib/sources`. Note that `lib/` resolves its npm deps (`@anthropic-ai/sdk`, `date-holidays`) from the repo-root `node_modules`, so a root `npm install` is a prerequisite. Also add both to the backend plugin's `dependencies` so it stays installable on its own.
- [ ] **Step 5:** Run the test. Expected: PASS. Then run `yarn workspace … start` and `curl localhost:7007/api/claude-metrics/meta` (with the dev server's auth disabled or a guest token). Expected: JSON. **If either fails because of the cross-package import**, stop and use the fallback: `backstage/packages/claude-metrics-lib/package.json` with `"main": "../../../lib/service.ts"`, plus a note to the user.
- [ ] **Step 6: Commit** spec + plan + workspace + backend skeleton: `feat(backstage): workspace and backend plugin reading lib/`.

### Task 2: All 8 backend routes, error mapping, config

**Files:**
- Modify: `backstage/plugins/claude-metrics-backend/src/router.ts`, `src/plugin.ts`
- Create: `src/handler.ts`, `src/config.ts`, `config.d.ts` (package root, listed in `package.json` `files` + `configSchema`)
- Test: `src/router.test.ts`, `src/config.test.ts`

**Interfaces:**
- Consumes: `createRouter` from Task 1.
- Produces: `applyConfig(config: Config, env?: NodeJS.ProcessEnv): void` in `src/config.ts`; `dashboard(fn: (q: DashboardQuery, sp: URLSearchParams) => Promise<unknown>): express.RequestHandler` and `intParam(sp, key, fallback, max?)` in `src/handler.ts`.
- HTTP: errors return `{ error: { name, message }, response: { statusCode } }` (Backstage `errorHandler` shape) so the frontend's `ResponseError.fromResponse` parses them.

- [ ] **Step 1: Write failing route tests** (one `it` each):
  - `claude-code` → 200, `body.kpis.activeUsers > 0`, `body.daily.length === 28`, `body.topContributors.length <= 10`.
  - `departments` → 200, array with `department`, `adoption`, `tiers`.
  - `users?pageSize=500&page=999` → 200, `body.rows.length <= 100`, `body.page === body.pages`.
  - `users?sort=bogus` → rows sorted by `sessions` desc.
  - `user-search?q=a` → `body.options.length <= 20`.
  - `seats` → `totalSeats === 1200`, `idle.rows.length <= 25`.
  - `cost` → `body.by` has keys `model, workspace_id, api_key_id, product, service_tier, cost_type`.
  - `raw?source=cost` → `body.data` is an array, `body.day === <to>`.
  - `claude-code?from=2026-02-10&to=2026-02-01` → 400, `body.error.message === 'from must be on or before to'`.
  - `claude-code?to=<today>` → 400.
- [ ] **Step 2: Write failing config tests:**
  - `applyConfig(new ConfigReader({ claudeMetrics: { dataSource: 'anthropic' } }), env)` throws `claudeMetrics.adminKey is required when dataSource is anthropic`.
  - Config `{ dataSource: 'anthropic', adminKey: 'k', departmentsFile: 'd.csv', holidayCountry: 'DE' }` → `env` has `DATA_SOURCE=anthropic, ANTHROPIC_ADMIN_KEY=k, DEPARTMENTS_FILE=d.csv, HOLIDAY_COUNTRY=DE`.
  - Empty config with `env = { DATA_SOURCE: 'anthropic', ANTHROPIC_ADMIN_KEY: 'x' }` → env unchanged and no throw.
- [ ] **Step 3:** Run tests. Expected: new tests FAIL.
- [ ] **Step 4:** Implement `handler.ts` (port of `server/utils/dashboard-handler.ts`: `QueryError` → `InputError` (400), other errors → log + 502 with the message), the 7 remaining routes in `router.ts` (copy the `SORTABLE` set from `server/api/users.get.ts` and the raw logic from `server/api/raw.get.ts`), and `config.ts`. Call `applyConfig` in `plugin.ts` `init` before `createRouter`, and keep the default `httpRouter` auth policy (user auth required).
- [ ] **Step 5:** Run `yarn tsc && yarn workspace … test`. Expected: all PASS.
- [ ] **Step 6: Commit** `feat(backstage): backend routes and config`.

### Task 3: Frontend plugin skeleton, API client, URL filters

**Files:**
- Create (via `yarn backstage-cli new --select frontend-plugin --option pluginId=claude-metrics`): `backstage/plugins/claude-metrics/**`
- Create: `src/api.ts`, `src/hooks/useFilters.ts`, `src/hooks/useDashboard.ts`, `src/components/ApiState.tsx`
- Test: `src/hooks/useFilters.test.tsx`, `src/components/ApiState.test.tsx`

**Interfaces:**
- Produces:
  - `claudeMetricsApiRef: ApiRef<ClaudeMetricsApi>`; `interface ClaudeMetricsApi { get<T>(route: Route, params: Record<string, string>): Promise<T> }` with `type Route = 'claude-code'|'departments'|'users'|'user-search'|'seats'|'cost'|'meta'|'raw'`; `ClaudeMetricsClient` uses `discoveryApi.getBaseUrl('claude-metrics')` + `fetchApi.fetch`, and on `!res.ok` throws `await ResponseError.fromResponse(res)`.
  - `useFilters(): { from: string; to: string; tab: string; query: Record<string,string>; param(k): string|null; set(patch: Record<string,string|null>): void; yesterday: string }`, the same semantics as `app/composables/useFilters.ts`, on top of react-router `useSearchParams` (replace, not push).
  - `useDashboard<T>(route: Route, extra?: Record<string,string>): { value?: T; loading: boolean; error?: Error }`: `useAsync` keyed on `query` + `extra`.
  - `<ApiState state={…}>{(value) => …}</ApiState>`: renders `Progress` while loading, `ResponseErrorPanel` on error, otherwise children.
- Types: import the view-model types (`ClaudeCodeSummary`, `DepartmentRow`, `UserRow`, `UserOption`, `Member`) as `import type` from `#lib/...`, with the same alias setup as Task 1.
- Register `claudeMetricsApiRef` in `createPlugin({ apis: [createApiFactory(...)] })`.

- [ ] **Step 1: Write failing tests:**
  - `useFilters` with no params → `from === addDays(yesterday, -27)`, `to === yesterday`, `tab === 'overview'`, `query` has only `from`/`to`.
  - `set({ department: 'Data', user: null })` with `?user=a@x.com` → URL has `department=Data` and no `user`.
  - `ApiState` given `error = new ResponseError(...)` with message `from must be on or before to` → text visible. Given `loading` → progressbar role visible.
- [ ] **Step 2:** Run `yarn workspace @internal/backstage-plugin-claude-metrics test`. Expected: FAIL.
- [ ] **Step 3:** Implement the 4 files.
- [ ] **Step 4:** Run tests + `yarn tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backstage): frontend plugin skeleton, API client, URL filters`.

### Task 4: Shared visual components (KPI, cards, grid, charts)

**Files:**
- Create: `src/components/KpiTile.tsx`, `ChartCard.tsx`, `DataGrid.tsx`, `charts/TrendChart.tsx`, `charts/HBarChart.tsx`, `charts/StackedBarChart.tsx`, `charts/useChartColors.ts`, `charts/register.ts`
- Test: `src/components/charts/useChartColors.test.tsx`, `src/components/DataGrid.test.tsx`

**Interfaces:**
- Consumes: `PALETTE`, `SeriesDef`, `ChartColors` from `<repo>/app/utils/palette.ts`; `fmt*` from `<repo>/app/utils/format.ts`. Import them through a `#app-utils/*` alias, set up the same way as `#lib`. If the frontend bundler refuses files outside the package, copy both files into `src/shared/` with a header pointing to the original.
- Produces (props mirror the Vue components; read each `.vue` for the exact fields and options):
  - `KpiTile({ label, value, hint? })`
  - `ChartCard({ title, subtitle?, children })` wraps `InfoCard`
  - `DataGrid<R>({ columns: GridColumn<R>[], rows: R[], total?, page?, onPage?, onSort?, onSearch?, onRowClick?, serverSide?: boolean })` on core-components `Table`; `GridColumn` comes from `app/utils/grid.ts`
  - `TrendChart({ labels: string[], series: SeriesDef[], data: Record<string, number[]>, format?: (n:number)=>string })`, `HBarChart({ labels, values, format? })`, `StackedBarChart({ labels, series, data, horizontal?, percent? })`: same options as `app/components/charts/*.vue`
  - `useChartColors(): ChartColors`: `PALETTE.dark` when the MUI theme is dark (`palette.type` on MUI v4 / `palette.mode` on v5), else `PALETTE.light`

- [ ] **Step 1: Write failing tests:**
  - `useChartColors` under the Backstage `lightTheme` → `series[0] === '#c6613f'`; under `darkTheme` → `'#d4714f'`.
  - `DataGrid` with `serverSide`, `total: 60`, `page: 1` → clicking next page calls `onPage(2)`. Typing in search calls `onSearch` with the text.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `register.ts` registers the Chart.js scales and elements once (port of `app/plugins/chartjs.client.ts`).
- [ ] **Step 4:** Run tests + `yarn tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backstage): KPI, card, grid and chart components`.

### Task 5: Page shell, filter bar, dev app

**Files:**
- Create: `src/components/ClaudeMetricsPage.tsx`, `FilterBar.tsx`, `UserPicker.tsx`
- Modify: `src/plugin.ts` (`ClaudeMetricsPage` via `createRoutableExtension`, `rootRouteRef` id `claude-metrics`), `src/index.ts`, `dev/index.tsx`
- Test: `src/components/ClaudeMetricsPage.test.tsx`, `src/components/FilterBar.test.tsx`

**Interfaces:**
- Consumes: `useFilters`, `useDashboard('meta')`, `ApiState` (Task 3).
- Produces: `ClaudeMetricsPage`, `claudeMetricsPlugin`, and `TABS: { id: string; label: string; Component: React.FC }[]` in `src/tabs/index.ts` (placeholder components until Tasks 6–7). The active tab is driven by the `tab` URL param.
- Header: title `Claude Metrics`, subtitle `Claude Code adoption and Claude API usage & cost`, and a `HeaderLabel` `Data source` = `meta.dataSource`.
- FilterBar: from/to date inputs (`max = yesterday`), 7/28/90 preset buttons (each sets `from = addDays(to, -(n-1))`), "Exclude weekends" / "Exclude holidays (<holidayCountry>)" switches, a department `Select` from `meta.departments` with an "All departments" option, and `UserPicker` (MUI `Autocomplete`, 250 ms debounce, calls `user-search` with the current query + `q`).
- `dev/index.tsx`: `createDevApp().registerPlugin(claudeMetricsPlugin).addPage({ element: <ClaudeMetricsPage/>, title: 'Claude Metrics', path: '/claude-metrics' })`, plus a `proxy`/discovery override pointing at the backend dev server on :7007.

- [ ] **Step 1: Write failing tests** (`renderInTestApp` + `TestApiProvider` with a fake `claudeMetricsApiRef`):
  - The page shows all 10 tab labels in the Global Constraints order and the `mock` data-source label.
  - With `?to=<today>`, the fake API rejects with a 400 `ResponseError` → the error message is visible (Review Focus 3).
  - Clicking preset `7` calls `set` → URL `from` equals `addDays(to, -6)`.
  - Choosing department `Data` puts `department=Data` in the next API call's params.
- [ ] **Step 2:** Run tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests + `yarn tsc` + `yarn lint`. Expected: PASS. Run backend `yarn start` and frontend `yarn start`, open `/claude-metrics`, and check that the header, filters and placeholder tabs render.
- [ ] **Step 5: Commit** `feat(backstage): page shell, filter bar and dev app`.

### Task 6: Claude Code tabs: Overview, Tool acceptance, Environments, Commits & PRs, Models

**Files:**
- Create: `src/tabs/OverviewTab.tsx`, `ToolsTab.tsx`, `EnvironmentsTab.tsx`, `CommitsTab.tsx`, `ModelsTab.tsx`; modify `src/tabs/index.ts`
- Test: `src/tabs/claudeCodeTabs.test.tsx`

**Interfaces:**
- Consumes: `useDashboard<ClaudeCodeSummary & { topContributors: UserRow[] }>('claude-code')`, Task 4 components.
- Each tab ports its `.vue` counterpart one-for-one: same KPIs, charts, series keys, labels and table columns. Read the `.vue` file and translate it; don't redesign.

- [ ] **Step 1: Write failing tests:** with a fixture `claude-code` response (build it once by calling `claudeCodeSummary` on the mock source for a fixed range in a `beforeAll`, or a trimmed JSON fixture in `src/__fixtures__/claude-code.json`), each tab renders its first KPI label and value formatted with the same `fmt*` call as the Vue tab (e.g. Overview `Active users` → `fmtInt(kpis.activeUsers)`), and its chart canvas is in the document.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the 5 tabs.
- [ ] **Step 4:** Run tests + `yarn tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(backstage): Claude Code tabs`.

### Task 7: Departments, Cost & usage, Users, Seats, API response tabs

**Files:**
- Create: `src/tabs/DepartmentsTab.tsx`, `CostTab.tsx`, `UsersTab.tsx`, `SeatsTab.tsx`, `RawTab.tsx`; modify `src/tabs/index.ts`
- Test: `src/tabs/otherTabs.test.tsx`

**Interfaces:**
- Consumes: `useDashboard` for `departments`, `cost`, `users` (+ `q, sort, desc, page, pageSize=25`), `seats` (+ `q, page, pageSize=25`), `raw` (+ `day`, `source`), plus `useFilters().set`.
- Departments row click → `set({ department: row.department })`. Users/Seats use `DataGrid serverSide`. The Cost tab ignores the department/user filters (the API has none) and says so in the same note the Vue tab shows.

- [ ] **Step 1: Write failing tests:**
  - Departments: clicking the row for `Data` calls `set({ department: 'Data' })`.
  - Users: clicking next page triggers an API call with `page: '2'`; clicking the `Cost` header sends `sort: 'costCents'`.
  - Seats: renders `Idle seats` KPI = `idleCount` from the fixture.
  - Cost: renders a card for each of the 6 dimensions.
  - Raw: switching source to `cost` sends `source: 'cost'`; renders JSON in a `CodeSnippet`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all frontend tests + `yarn tsc` + `yarn lint`. Expected: PASS. In the dev app, open each of the 10 tabs in light and dark themes and click a department row, then reload and check that the filter persists.
- [ ] **Step 5: Commit** `feat(backstage): departments, cost, users, seats and raw tabs`.

### Task 8: Static HTML preview

**Files:**
- Create: `backstage/scripts/export-preview-data.ts`, `backstage/preview/template.html`, `backstage/preview/index.html` (generated, committed), `backstage/scripts/build-preview.ts`
- Test: `backstage/preview/preview.spec.ts` (Playwright, run with the root `@playwright/test`)

**Interfaces:**
- `export-preview-data.ts` → writes `preview/data.json` with `{ meta, claudeCode, departments, cost, users, seats, raw }` from the `lib/service` functions on the mock source, range `from=<to-27>`, `to=2026-11-20`. Run it with `npx tsx` from the repo root with the `#lib` alias. A fixed range keeps the output stable between runs.
- `build-preview.ts` inlines `data.json` into `template.html` → `index.html`.
- The page mimics the Backstage chrome: a 224px dark sidebar (Home, Catalog, APIs, Docs, Create…, divider, **Claude Metrics** active with a clay accent), a header band (title, subtitle, `Data source: mock` label), a tab strip with the 10 tabs, the filter bar (visual only), and InfoCard-styled cards. Chart.js `4.4.x` comes from cdnjs. Light/dark follow `prefers-color-scheme` and a toggle. Load the `artifact-design` skill before writing it.

- [ ] **Step 1: Write failing Playwright test:** open `file://…/preview/index.html`, click each of the 10 tabs and assert its first card title is visible, screenshot it to `backstage/preview/screenshots/<tab>-light.png`, repeat with `colorScheme: 'dark'`, and assert there are no console errors.
- [ ] **Step 2:** Run `npx playwright test backstage/preview/preview.spec.ts`. Expected: FAIL (file missing).
- [ ] **Step 3:** Implement the export script, template, build script; generate `index.html`.
- [ ] **Step 4:** Run the test. Expected: PASS. Look at a light and a dark screenshot.
- [ ] **Step 5:** Publish `backstage/preview/index.html` as a private Artifact (icon `chart`).
- [ ] **Step 6: Commit** `feat(backstage): static HTML preview of the plugin`.

### Task 9: Docs and CI

**Files:**
- Create: `backstage/README.md`
- Modify: `README.md` (one short "Backstage plugin" section linking `backstage/README.md` and the preview), `.github/workflows/ci.yml` (new `backstage` job)

- [ ] **Step 1:** `backstage/README.md`: what each package is; how to run the dev harnesses; how to install into an app: `yarn --cwd packages/app add`, a `<Route path="/claude-metrics" element={<ClaudeMetricsPage />} />` in `App.tsx`, a `SidebarItem` in `Root.tsx`, `backend.add(import('@internal/backstage-plugin-claude-metrics-backend'))`, the app-config block from Global Constraints, and the root `npm install` prerequisite for `lib/`.
- [ ] **Step 2:** CI job: checkout, setup-node 24, `npm ci` (root, for `lib/` deps), `corepack enable`, `cd backstage && yarn install --immutable && yarn tsc && yarn lint && yarn test`.
- [ ] **Step 3:** Verify end-to-end: `cd backstage && yarn tsc && yarn lint && yarn test`, plus root `npm test && npm run typecheck && npm run lint`. Expected: all pass. Run `actionlint` on the workflow if it's installed.
- [ ] **Step 4: Commit** `docs(backstage): install guide and CI job`.
