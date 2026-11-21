# Claude Metrics for Backstage

The Claude Metrics dashboard as a Backstage plugin: a **Claude Metrics** page in the sidebar with the same ten tabs, filters and numbers as the standalone app.

![Overview tab inside Backstage, light theme](../docs/screenshots/backstage-overview-light.png)

| Package | What it does |
|---|---|
| `plugins/claude-metrics` (`@internal/backstage-plugin-claude-metrics`) | Frontend plugin, built on Backstage's new frontend system and Backstage UI. Page at `/claude-metrics`, with a sidebar entry. |
| `plugins/claude-metrics-backend` (`@internal/backstage-plugin-claude-metrics-backend`) | Backend plugin. Serves `/api/claude-metrics/*` (the same routes and JSON as the Nuxt app's `server/api`) by calling the shared data layer in the repo-root `lib/`. |
| `preview/index.html` | A static page showing how the plugin looks inside Backstage, filled with mock data. Open it straight from disk. |

The Admin API key is read only by the backend plugin, and every route requires a signed-in Backstage user, so the dashboard sits behind your Backstage sign-in.

## Run the plugins locally

Prerequisites: Node 24 and a repo-root `npm install` (the backend plugin loads `lib/` and its npm dependencies from the repo root).

```bash
npm install                      # repo root, once
cd backstage
corepack enable && yarn install

# terminal 1: backend plugin on http://localhost:7007 (auth mocked, mock data)
cd plugins/claude-metrics-backend && yarn start

# terminal 2: frontend plugin in a dev app on http://localhost:3001/claude-metrics
cd plugins/claude-metrics && yarn start
```

The dev harness uses port 3001 so it can run next to the Nuxt app on 3000.

## Install into a Backstage app

These packages run from source (they are `private`, not published, and `backstage-cli package build` isn't supported). The backend plugin loads the repo-root `lib/`, which needs two things from this repo:

- the `"imports"` map in the repo-root `package.json`, which resolves `lib/`'s own `#lib/*` imports;
- `lib/`'s npm dependencies (`date-holidays`, `@anthropic-ai/sdk`) installed in the repo-root `node_modules` (`npm install` at the root).

So keep this whole repository together: add it to your Backstage repo (for example as a git submodule), run `npm install` at its root, and point your app's workspaces at its `backstage/plugins/*`. Copying only the plugin folders into another app won't work.

**Frontend** (new frontend system, `app.packages: all`):

```bash
yarn --cwd packages/app add @internal/backstage-plugin-claude-metrics
```

That's all: the app discovers the plugin, mounts the page at `/claude-metrics` and lists **Claude Metrics** in the sidebar. If your app lists features explicitly, add it to `createApp({ features: [...] })`.

**Backend** (`packages/backend/src/index.ts`):

```bash
yarn --cwd packages/backend add @internal/backstage-plugin-claude-metrics-backend
```

```ts
backend.add(import('@internal/backstage-plugin-claude-metrics-backend'));
```

**Config** (`app-config.yaml`):

```yaml
claudeMetrics:
  dataSource: anthropic              # or mock (default): a seeded 1,200-person org
  adminKey: ${ANTHROPIC_ADMIN_KEY}   # Console → Settings → Admin keys; required for anthropic
  departmentsFile: ./departments.csv # optional, email,department
  holidayCountry: US                 # optional, e.g. US-CA, DE
```

Keys you leave out fall back to the matching env vars (`DATA_SOURCE`, `ANTHROPIC_ADMIN_KEY`, `DEPARTMENTS_FILE`, `HOLIDAY_COUNTRY`). With `dataSource: anthropic` and no key in either place, the backend refuses to start. See the root [README](../README.md) for what each data source covers.

## Check

```bash
yarn tsc && yarn lint && yarn test   # in backstage/
```

## Preview page

`preview/index.html` is generated from `preview/template.html` and real `lib/` output on the mock org (28 days ending 2026-11-20):

```bash
npx tsx backstage/scripts/build-preview.ts                     # from the repo root
npx playwright test -c backstage/preview/playwright.config.ts  # every tab, light and dark, phone width
```

In the preview the filter bar is visual only; search, sorting and paging work on the rows it includes.

## Known limits

- `backstage-cli package build` isn't supported: the plugins import `lib/` from outside their package, so they run from source.
- The cost tab stays organization-wide: the cost API has no department or user dimension.
