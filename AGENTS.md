# AGENTS.md

Guidance for AI coding agents working in this repository. Humans: see [CONTRIBUTING.md](CONTRIBUTING.md).

Claude Metrics Viewer is a dashboard for Claude Code adoption and Anthropic API usage and cost. It ships twice from one data layer:

| Part | Path | Package manager |
|---|---|---|
| Standalone dashboard (Nuxt 4, Vuetify 3, Chart.js) | `app/`, `server/` | npm (repo root) |
| Data layer (framework-free TypeScript) | `backstage/packages/claude-metrics-lib/src/` | Yarn 4 (`backstage/`) |
| Backstage frontend, backend and common plugins | `backstage/plugins/claude-metrics*` | Yarn 4 (`backstage/`) |
| Static preview of the plugin | `backstage/preview/` (generated) | – |

Docs: `README.md`, `backstage/README.md`, `docs/backstage-integration.md`.

## Commands

```bash
# Standalone dashboard (repo root)
npm install
npm run dev                 # http://localhost:3000, mock data
npm run lint && npm run typecheck && npm test && npm run test:e2e

# Backstage workspace
cd backstage && corepack enable && yarn install
yarn tsc && yarn lint && yarn test && yarn build
cd plugins/claude-metrics-backend && yarn start   # :7007, auth mocked
cd plugins/claude-metrics && yarn start           # http://localhost:3001/claude-metrics

# Preview page (repo root)
npx tsx backstage/scripts/build-preview.ts
npx playwright test -c backstage/preview/playwright.config.ts
```

## Done means

Run the checks for every part you touched and quote their real output. CI (`.github/workflows/ci.yml`) runs all of them, including that `backstage/preview/index.html` is up to date. A change to the data layer affects both apps, so run both suites.

## Rules the code doesn't tell you

### Data layer (`@internal/claude-metrics-lib`)
- No framework imports. `.` (`src/index.ts`) must stay browser-safe; anything using the network, `fs` or env vars belongs behind `./server` (`src/server.ts`).
- Use **relative** imports inside the package. A `#lib/...` import would be left unresolved in the built `dist/`. The Nuxt app and the root tests import the package as `#lib` through aliases in `nuxt.config.ts` and `vitest.config.mts`.
- The package has its own self-contained `tsconfig.json`. Don't make it extend `@backstage/cli/config/tsconfig.json`: Vite compiles these files for the Nuxt app using the nearest tsconfig, and CI's root job has no `backstage/node_modules`.
- `DATA_SOURCE=otel` needs a telemetry store, and the lib doesn't create one: each host calls `registerTelemetryStore()` at startup (Nitro plugin `server/plugins/telemetry.ts` with SQLite; backend `plugin.ts` with `KnexTelemetryStore`). The two stores must behave the same: atomic increments, latest department wins, prune by day.
- What a source can show is `capabilities()` (`billedCost`, `seats`, `rawUpstream`, `remoteSplit`, `includesToday`), sent to the UIs on `/meta`. Gate tabs and KPIs on capabilities, never on the source name.
- `@anthropic-ai/sdk` and `date-holidays` are pinned to the same exact versions as the root lockfile. The mock source's types follow the SDK, so bump both places together.
- Mock data is seeded and deterministic. Tests, fixtures (`backstage/plugins/claude-metrics/src/__fixtures__/`, saved backend responses for 2026-10-24 to 2026-11-20) and the preview depend on it.

### Backstage plugins
- The workspace is pinned to the **Backstage 1.56.2** release on purpose. Newer apps accept plugins built for older releases, but not the reverse (a 1.57 build fails in 1.56 with "Property 'id' is missing"). Don't run `versions:bump` without checking the oldest supported release.
- Use react-router's `useSearchParams` for URL state, not `useAppSearchParams`, which only exists from 1.57.
- Chart.js registration is an explicit `registerCharts()` call in each chart. The package is `"sideEffects": false`, so bundlers drop a bare `import './register'`, and charts fail with "category is not a registered scale". Jest doesn't show this; check in a browser.
- Tests need `jest-canvas-mock` and a `ResizeObserver` stub (`src/setupTests.ts`). Without them Chart.js crashes in jsdom, and the error surfaces misleadingly as "A component suspended while responding to synchronous input".
- `usePermission` caches decisions across renders in one test file, so a DENY test followed by an ALLOW test fails. Keep them in separate files.
- Backend config: empty strings count as unset. Docker Compose's `${VAR:-}` passes `''`, and `getOptionalString` rejects it, which used to fail startup even on mock data.
- Every backend route checks `claude-metrics.dashboard.read` (defined in `claude-metrics-common`). Keep new routes behind the same middleware in `router.ts`. The one exception is `POST /otlp/v1/metrics` (OpenTelemetry ingest): it's registered before that middleware, marked `allow: 'unauthenticated'` in `plugin.ts`, and checks ingest tokens instead. It must never return dashboard data.
- `backstage-cli` lint forbids relative imports across packages (`no-relative-monorepo-imports`). Depend on the package instead.
- Errors surfaced to users should be the backend's own message: `ResponseError.message` is only "Request failed with 400"; read `error.body.error.message`.

### Both UIs
- A tab exists twice: `app/components/tabs/*.vue` and `backstage/plugins/claude-metrics/src/tabs/*.tsx`. Port changes to both, keeping the same fields, labels and formatters (`format.ts`, `palette.ts` in the data layer).
- Ports: the Nuxt dev server uses 3000; the plugin dev app uses 3001 so both can run.

### Secrets and data
- The Anthropic **Admin** API key (`ANTHROPIC_ADMIN_KEY`, `sk-ant-admin…`) is high-privilege. Never log it, put it in fixtures, commit it, or send it to the browser. Use mock data for screenshots and tests.
- Don't commit `.env`. `.env.example` is the template.

## Commits and pull requests

Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, optional scope such as `fix(backstage):`). Fill in `.github/pull_request_template.md`. See [SECURITY.md](SECURITY.md) for vulnerability reports.
