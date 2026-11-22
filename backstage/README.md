# Claude Metrics for Backstage

The Claude Metrics dashboard as a Backstage plugin: a **Claude Metrics** page in the sidebar with the same ten tabs, filters and numbers as the standalone app.

![Overview tab inside Backstage, light theme](../docs/screenshots/backstage-overview-light.png)

| Package | What it does |
|---|---|
| `plugins/claude-metrics` (`@moatazeldebsy/backstage-plugin-claude-metrics`) | Frontend plugin, built on Backstage's new frontend system and Backstage UI. Page at `/claude-metrics`, with a sidebar entry. |
| `plugins/claude-metrics-backend` (`@moatazeldebsy/backstage-plugin-claude-metrics-backend`) | Backend plugin. Serves `/api/claude-metrics/*`, the same routes and JSON as the Nuxt app's `server/api`. |
| `plugins/claude-metrics-common` (`@moatazeldebsy/backstage-plugin-claude-metrics-common`) | The `claude-metrics.dashboard.read` permission. The backend checks it on every route and the page checks it before loading; your permission policy decides who has it (for example, managers only). |
| `packages/claude-metrics-lib` (`@moatazeldebsy/claude-metrics-lib`) | The data layer (Anthropic and mock sources, aggregation, departments, holidays, palette, formatters). The Nuxt app imports it as `#lib`; the plugins depend on it. `.` is browser-safe, `./server` is the Node entry. |
| `preview/index.html` | A static page showing how the plugin looks inside Backstage, filled with mock data. Open it straight from disk. |

The Admin API key is read only by the backend plugin. Every route requires a signed-in Backstage user **and** the `claude-metrics.dashboard.read` permission, so you can limit the dashboard to managers in your permission policy. See [Access control](../docs/backstage-integration.md#access-control).

## Run the plugins locally

Prerequisites: Node 24.

```bash
cd backstage
corepack enable && yarn install

# terminal 1: backend plugin on http://localhost:7007 (auth mocked, mock data)
cd plugins/claude-metrics-backend && yarn start

# terminal 2: frontend plugin in a dev app on http://localhost:3001/claude-metrics
cd plugins/claude-metrics && yarn start
```

The dev harness uses port 3001 so it can run next to the Nuxt app on 3000.

## Install into a Backstage app

The packages are on npm. In your Backstage repository:

```bash
yarn --cwd packages/app add @moatazeldebsy/backstage-plugin-claude-metrics
yarn --cwd packages/backend add @moatazeldebsy/backstage-plugin-claude-metrics-backend
```

```ts
// packages/backend/src/index.ts, before backend.start()
backend.add(import('@moatazeldebsy/backstage-plugin-claude-metrics-backend'));
```

With `app.packages: all` the frontend needs nothing else. See the [integration guide](../docs/backstage-integration.md) for configuration, access control (managers only), Kubernetes secrets and the departments CSV, the offline tarball route, checks and troubleshooting.

## Publish a release

Bump `version` in the four `package.json` files (and the `^` ranges between them), then push a tag: `git tag backstage-v0.1.0 && git push origin backstage-v0.1.0`. The `Release Backstage packages` workflow builds and publishes them to npm. It needs an `NPM_TOKEN` repository secret with publish rights on the `@moatazeldebsy` scope.

## Check

```bash
yarn tsc && yarn lint && yarn test   # in backstage/
```

## Preview page

`preview/index.html` is generated from `preview/template.html` and real `@moatazeldebsy/claude-metrics-lib` output on the mock org (28 days ending 2026-11-20):

```bash
npx tsx backstage/scripts/build-preview.ts                     # from the repo root
npx playwright test -c backstage/preview/playwright.config.ts  # every tab, light and dark, phone width
```

In the preview the filter bar is visual only; search, sorting and paging work on the rows it includes.

## Known limits

- Needs Backstage 1.56.2 or newer on the new frontend system. The workspace is pinned to the 1.56.2 release on purpose: newer apps accept plugins built for older releases, not the reverse. Don't bump it past the oldest Backstage you need to support.
- Access is only limited if the permission framework is on and your policy handles `claude-metrics.dashboard.read`; with it off, every signed-in user can open the dashboard.
- The cost tab stays organization-wide: the cost API has no department or user dimension.
