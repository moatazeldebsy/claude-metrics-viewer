# Claude Metrics Viewer

A dashboard for your Anthropic organization's **Claude Code adoption** and **Claude API usage & cost**, in the spirit of GitHub's Copilot Metrics Viewer.

It runs on deterministic mock data out of the box. Point it at a real organization by setting two environment variables.

## Tabs

| Tab | What it shows | Source |
|---|---|---|
| Overview | Active users, sessions, lines added/removed, accept rate, commits, PRs, estimated cost, daily trends | Claude Code Analytics |
| Tool acceptance | Accept rate and volume for Edit, MultiEdit, Write, NotebookEdit | Claude Code Analytics |
| Environments | Sessions and users by terminal; local vs remote | Claude Code Analytics |
| Commits & PRs | Daily commits and PRs by Claude Code, top contributors | Claude Code Analytics |
| Models | Tokens and estimated cost per model | Claude Code Analytics |
| Cost & usage | Org-wide cost by model, workspace, API key, product, service tier, cost type | Usage & Cost Analytics (beta) |
| Users | Sortable per-user table | Claude Code Analytics |
| Seats | Members with no Claude Code activity in the range | Admin API: members |
| API response | Raw upstream rows for one day | Both |

Filters: date range, 7/28/90-day presets, exclude weekends, exclude holidays (edit `config/holidays.ts`), and a single-user filter. Filters live in the URL, so views can be shared.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000, mock data
```

### Real data

```bash
DATA_SOURCE=anthropic ANTHROPIC_ADMIN_KEY=sk-ant-admin... npm run dev
```

- The key must be an **Admin API key** from a Claude Console organization (Console → Settings → Admin keys). Workspace API keys are rejected.
- The key is only read on the server. The browser talks to this app's `/api/*` routes, never to Anthropic directly.

Things to know about the upstream data:

- **Claude Code Analytics** (`/v1/organizations/usage_report/claude_code`) covers Claude Code usage authenticated against your Console organization. Usage under Pro/Max/Team/Enterprise subscriptions isn't included; that's in the Claude Enterprise Analytics API or the claude.ai analytics page. It returns one day per request, so a 90-day view makes 90+ calls. Past days are cached in memory.
- **Usage & Cost Analytics** (`/v1/organizations/analytics/cost`) starts at 2026-01-01, looks back at most 365 days, and lags 4–24 hours. Requests are split into 31-day chunks automatically.
- "Estimated cost" on the Claude Code tabs is Anthropic's per-model estimate. "Cost & usage" shows billed amounts after discounts, before credits.

## Test

```bash
npm test             # unit tests (Vitest): aggregation, dates, query parsing, mock + real source
npm run test:e2e     # Playwright on mock data (first time: npx playwright install chromium)
npm run lint
```

## Docker

```bash
docker build -t claude-metrics-viewer .
docker run -p 3000:3000 -e DATA_SOURCE=anthropic -e ANTHROPIC_ADMIN_KEY=sk-ant-admin... claude-metrics-viewer
```

## Layout

```
lib/sources/        MetricsSource interface; mock.ts (seeded fake org) and anthropic.ts (Admin API)
lib/aggregate.ts    raw records → dashboard view models (pure, unit-tested)
lib/service.ts      loads data for a query and aggregates it
app/api/*           server routes: claude-code, cost, seats, raw
components/         Dashboard (tabs + filters), charts (Recharts), ui (tiles, tables)
```

There is no auth on the dashboard itself. Put it behind your SSO or ingress auth before exposing it, since it shows per-user activity and cost.
