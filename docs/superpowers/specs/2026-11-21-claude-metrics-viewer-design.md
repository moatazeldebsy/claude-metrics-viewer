# Claude Metrics Viewer — Plan

## Context
The user wants a dashboard like GitHub's open-source *Copilot Metrics Viewer* (12 tabs: org, teams, languages, editors, chat, agent activity, PRs, models, seats, user metrics, my usage, raw API response, plus a date filter with presets and an "exclude holidays" toggle), but for Claude/Anthropic.

Decisions made:
- **Mock data first**, with real Anthropic API wiring behind a flag.
- Covers **both** Claude Code adoption/productivity and API usage & cost.
- Lives in a **new standalone repo** `~/claude-metrics-viewer`: Next.js + TypeScript, a server-side proxy (the admin key never reaches the browser), and a Dockerfile.

Real data sources (checked against current docs):
1. **Claude Code Analytics API**: `GET /v1/organizations/usage_report/claude_code?starting_at=YYYY-MM-DD&limit&page`.
   - Returns **one UTC day per call**, with cursor pagination and about 1h of lag.
   - Each record has: `actor` (user_actor email or api_actor key name), `terminal_type`, `customer_type`, `is_remote`.
   - `core_metrics`: `num_sessions`, `lines_of_code.added/removed`, `commits_by_claude_code`, `pull_requests_by_claude_code`.
   - `tool_actions`: accepted/rejected counts for edit, multi_edit, write and notebook_edit.
   - `model_breakdown`: tokens plus `estimated_cost` (in cents).
   - An actor can have several records per day, which must be summed.
2. **Usage & Cost Analytics API (beta)**: `/v1/organizations/analytics/usage` and `/cost`, via the TS SDK `client.beta.organization.analytics.{usage,cost}.list`.
   - Can be grouped by model, workspace_id, api_key_id, actor, product, service_tier, and on cost also cost_type/token_type.
   - Max 31 days per request. Starts no earlier than 2026-01-01. 4–24h lag. `amount` is a decimal string in cents.
3. **Members**: `client.beta.organization.users.list`, used to find seats with no activity.

All three need an Admin API key (`sk-ant-admin…`), set as `ANTHROPIC_ADMIN_KEY` on the server.

## Approach
- **Stack:** Next.js (App Router) + TypeScript, Tailwind, Recharts, `@anthropic-ai/sdk`. Vitest for unit tests, Playwright for E2E (already used in this workspace).
- **Data layer:** one `MetricsSource` interface with two implementations, chosen by `DATA_SOURCE=mock|anthropic`:
  - `MockSource`: deterministic seeded generator producing records in the **exact real response shapes** (about 25 users, 90 days, weekday-heavy, several models and terminals). This keeps the switch to real data a config change only.
  - `AnthropicSource`: fetch for the Claude Code endpoint (looping over days, following `next_page`), SDK for analytics usage/cost (splitting ranges into 31-day chunks), SDK for users. Uses a simple in-memory cache keyed by day, since past days don't change.
- **Normalize → aggregate:** pure functions turn raw records into dashboard view models (daily series, per-user totals, per-tool acceptance rate = accepted/(accepted+rejected), and so on). All unit-tested.
- **API routes** (`app/api/*`) run server-side, accept `from`, `to`, `excludeWeekends` and `excludeHolidays`, and return the view models. A `/api/raw` route returns the untouched upstream JSON for the "API response" tab.

## Tabs (Copilot → Claude mapping)
| Tab | Content |
|---|---|
| Overview | KPI tiles (active users, sessions, lines added/removed, commits, PRs, overall accept rate, est. cost); daily active users + sessions trend |
| Tool acceptance | Accept rate and volume per tool (Edit/MultiEdit/Write/NotebookEdit) over time. Replaces Copilot's *suggestions/acceptance* |
| Environments | `terminal_type` breakdown and local vs remote. Replaces *editors* |
| Commits & PRs | Daily commits and PRs by Claude Code; top contributors |
| Models | Tokens (input/output/cache) and cost per model over time |
| Cost & usage | From Analytics API: $ and tokens by workspace, API key, product, service tier, cost/token type |
| Users | Sortable per-user table (sessions, lines, commits, PRs, accept rate, cost, last active) |
| Seats | Org members with no activity in the selected range (members list compared against active actors) |
| API response | Raw JSON viewer |

Global filters: date range, presets (7/28/90 days), exclude weekends, exclude holidays (from a static holiday list in config), and a user filter.

## Non-goals (v1)
- Teams tab: the Console API has no team concept. Could come later via an email→team mapping file.
- Auth/login on the dashboard itself.
- Claude Enterprise Analytics API.
- Persistent DB.
- Alerts.

## File layout (`~/claude-metrics-viewer`)
- `lib/sources/{types.ts,mock.ts,anthropic.ts,index.ts}`: the source interface and its implementations
- `lib/anthropic-types.ts`: raw response types for the Claude Code endpoint (SDK types are used for analytics/users)
- `lib/aggregate.ts`, `lib/dates.ts` (range split, weekend/holiday filters)
- `app/api/{overview,tools,environments,commits,models,cost,users,seats,raw}/route.ts`
- `app/(dashboard)/[tab]/page.tsx` + `components/{KpiTile,TrendChart,BarBreakdown,DataTable,FilterBar,Tabs}.tsx`
- `tests/unit/*.test.ts`, `e2e/*.spec.ts`, `Dockerfile`, `.env.example`, `README.md`
- `docs/superpowers/specs/2026-11-21-claude-metrics-viewer-design.md`: the design doc, committed first

## Steps
1. `git init` the repo, scaffold Next.js + TS + Tailwind, add the design doc. → verify: `npm run dev` serves a blank shell.
2. Raw types + `MockSource` + Vitest tests for its shape and determinism. → verify: `npx vitest run`
3. `aggregate.ts` + `dates.ts`, TDD (multi-record actor summing, accept-rate edge case of 0/0, 31-day split, weekend/holiday exclusion). → verify: vitest green
4. API routes + FilterBar + tabs, built in table order. → verify: each tab renders mock data in the browser
5. `AnthropicSource` (fetch + SDK, pagination, chunking, cache) with unit tests against a mocked fetch/SDK. → verify: vitest; manual run with a real key if the user supplies one later
6. Playwright E2E on mock data: tab navigation, filter changes update KPIs, raw tab shows JSON. → verify: `npx playwright test`
7. Dockerfile + README (env vars, how to switch to real data, required Admin key). → verify: `docker build` and `docker run` serve the dashboard.

## Verification (end-to-end)
- `npm test` and `npx playwright test` both pass on `DATA_SOURCE=mock`.
- `npm run dev`, then open every tab and change the date range and toggles. Numbers should stay internally consistent: the overview's lines total equals the sum in the users table.
- With `DATA_SOURCE=anthropic` and `ANTHROPIC_ADMIN_KEY` set (optional, user-supplied): `/api/raw?source=claude_code&day=…` returns upstream JSON, and the tabs render real data.
