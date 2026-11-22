# @moatazeldebsy/claude-metrics-mcp

An MCP server that lets Claude query a running [Claude Metrics](https://github.com/moatazeldebsy/claude-metrics-viewer) dashboard. Ask things like "which departments have the lowest Claude Code adoption this month?" or "who opened the most PRs with Claude Code last week?"

It's a thin read-only wrapper over the dashboard's `/api/*` routes, so it returns the same numbers as the dashboard, from whatever data source the dashboard uses (mock, Anthropic Admin API, or OpenTelemetry).

## Tools

| Tool | Dashboard route | |
|---|---|---|
| `get_dashboard_meta` | `/api/meta` | Data source, department names, which tabs have data, last OpenTelemetry export |
| `get_claude_code_summary` | `/api/claude-code` | Active users, sessions, lines, accept rates, commits, PRs, cost, terminals, models, daily trends |
| `get_departments` | `/api/departments` | Adoption, engagement mix, weekly trend, cost per active user |
| `get_cost` | `/api/cost` | Claude API cost and usage by model, workspace, API key, product, tier, type |
| `get_seats` | `/api/seats` | Members and whether they used Claude Code |
| `get_users` | `/api/users` | Per-user table, paged and sortable |

All but `get_dashboard_meta` take the dashboard's filters: `from`, `to` (YYYY-MM-DD), `department`, `user`, `excludeWeekends`, `excludeHolidays`.

## Use it

The easiest way is the Claude Code plugin, which sets this up and asks for the dashboard URL:

```text
/plugin marketplace add moatazeldebsy/claude-metrics-viewer
/plugin install metrics-viewer@metrics-viewer
```

Or add it to any MCP client directly:

```bash
claude mcp add claude-metrics -e CLAUDE_METRICS_URL=http://localhost:3000 -- npx -y @moatazeldebsy/claude-metrics-mcp
```

`CLAUDE_METRICS_URL` is the dashboard's origin (default `http://localhost:3000`).

**Supported dashboards:** the standalone app. It has no auth of its own, so put it behind your SSO and run this server where it can reach it. The Backstage plugin's API needs a signed-in Backstage user, so it isn't supported yet.

## Develop

```bash
npm install && npm run build && npm test
# integration tests against a live dashboard (npm run dev in the repo root):
CLAUDE_METRICS_URL=http://localhost:3000 npm test
```

Release: bump `version`, then push a tag `mcp-vX.Y.Z`.
