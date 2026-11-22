# Contributing

Thanks for helping improve Claude Metrics Viewer. This page covers how the repo is laid out, how to run and test each part, and what a pull request needs.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues privately, as described in [SECURITY.md](SECURITY.md), not in issues.

## What's in the repo

| Part | Path | Stack |
|---|---|---|
| Standalone dashboard | `app/`, `server/`, `nuxt.config.ts` | Nuxt 4, Vuetify 3, Chart.js |
| Data layer (shared) | `backstage/packages/claude-metrics-lib/src/` | Framework-free TypeScript. The Nuxt app imports it as `#lib`; the Backstage plugins depend on it as `@moatazeldebsy/claude-metrics-lib` |
| Backstage plugins | `backstage/plugins/claude-metrics*` | Backstage new frontend and backend systems, Backstage UI |
| Preview page | `backstage/preview/` | Static HTML generated from the data layer |
| Docs | `README.md`, `backstage/README.md`, `docs/` | |

The root is an **npm** project (the Nuxt app); `backstage/` is a separate **Yarn 4** workspace.

## Set up

Prerequisites: Node.js 24 (Corepack enabled for Yarn).

```bash
npm install                                 # standalone dashboard
cd backstage && corepack enable && yarn install   # Backstage plugins
```

Everything runs on **mock data** by default (a seeded 1,200-person organization), so you don't need an Anthropic key to develop. To try real data with the standalone app, copy `.env.example` to `.env` and set `DATA_SOURCE=anthropic` and `ANTHROPIC_ADMIN_KEY`. Never commit `.env`.

## Run

```bash
npm run dev                                          # dashboard on http://localhost:3000

cd backstage/plugins/claude-metrics-backend && yarn start   # plugin backend on :7007
cd backstage/plugins/claude-metrics && yarn start           # plugin dev app on http://localhost:3001/claude-metrics
```

## Test

Run the checks for every part you touched. CI runs all of them.

| Part | Commands |
|---|---|
| Dashboard and data layer | `npm run lint && npm run typecheck && npm test && npm run test:e2e` (first time: `npx playwright install chromium`) |
| Backstage plugins | `cd backstage && yarn tsc && yarn lint && yarn test && yarn build` |
| Preview page | `npx tsx backstage/scripts/build-preview.ts && npx playwright test -c backstage/preview/playwright.config.ts` |

## Conventions

- **The data layer stays framework-free.** No Vue, React, Nuxt or Backstage imports in `backstage/packages/claude-metrics-lib`. Its root entry (`.`) must stay browser-safe; anything that touches the network or filesystem goes behind `./server`. Use relative imports inside it so the built package resolves on its own.
- **The Backstage workspace targets Backstage 1.56.2 on purpose.** Newer apps accept plugins built for older releases, but not the reverse. Don't run `versions:bump` past the oldest Backstage release the plugins support; if a change needs a newer API, say so in the PR.
- **Mock data is deterministic.** Tests, fixtures and the preview rely on the seeded mock organization. If you change the generator or aggregation, regenerate `backstage/preview/index.html` (CI fails when it's stale) and the test fixtures in `backstage/plugins/claude-metrics/src/__fixtures__/` (saved responses from the plugin backend's dev server for `from=2026-10-24&to=2026-11-20`).
- **Keep the two UIs in step.** A change to a tab in `app/components/tabs/` usually needs the same change in `backstage/plugins/claude-metrics/src/tabs/`.
- **No secrets in code, fixtures or screenshots.** Use mock data for screenshots.
- **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, with an optional scope such as `fix(backstage): …`.

## Pull requests

1. For anything larger than a small fix, open an issue first so we can agree on the approach.
2. Branch from `main` and keep the PR focused on one change.
3. Add or update tests that fail without your change.
4. Update the docs when behaviour, configuration or setup changes.
5. Fill in the pull request template, including what you ran and what you saw. Screenshots help for UI changes.

A maintainer reviews every PR (see [`.github/CODEOWNERS`](.github/CODEOWNERS)).
