# metrics-viewer: Claude Code plugin

A Claude Code plugin for [Claude Metrics](https://github.com/moatazeldebsy/claude-metrics-viewer), the dashboard for Claude Code adoption and Claude API usage and cost.

## Install

```text
/plugin marketplace add moatazeldebsy/claude-metrics-viewer
/plugin install metrics-viewer@metrics-viewer
```

## What it does

Set your dashboard's URL with `/plugin configure metrics-viewer@metrics-viewer` (the `dashboard_url` option, default `http://localhost:3000`). The MCP server below uses it.

**`/metrics-viewer:connect-telemetry`** connects Claude Code's OpenTelemetry metrics export to a Claude Metrics dashboard, either the standalone app or the Backstage plugin. Claude also picks it up when you ask to "send my Claude Code usage to the dashboard". It:

1. asks for the dashboard's ingest endpoint and token, and tests them with an empty export;
2. for one person, merges the four `env` settings into `~/.claude/settings.json` after you confirm. Claude Code ignores `OTEL_*` variables in project settings, and plugins can't set them;
3. for a team, prints the managed-settings block to deploy with MDM instead;
4. checks the dashboard received data once you've started a new session.

The dashboard needs `DATA_SOURCE=otel` (standalone) or `claudeMetrics.dataSource: otel` (Backstage). See [the OpenTelemetry guide](https://github.com/moatazeldebsy/claude-metrics-viewer/blob/main/docs/opentelemetry.md).

**Ask Claude about your metrics.** The plugin adds the [`claude-metrics` MCP server](https://github.com/moatazeldebsy/claude-metrics-viewer/tree/main/mcp), so you can ask "which departments have the lowest Claude Code adoption this month?" or "who opened the most PRs with Claude Code last week?" It reads the dashboard's API and returns the same numbers the dashboard shows. It works with the standalone app. The Backstage plugin's API needs a signed-in user, so it isn't supported yet.

## What it runs, sends and changes

- **MCP server:** `npx -y @moatazeldebsy/claude-metrics-mcp@0.1.0` ([source](https://github.com/moatazeldebsy/claude-metrics-viewer/tree/main/mcp), published with npm provenance). It only sends read-only `GET` requests to `<dashboard_url>/api/*` and returns the JSON to Claude. It contacts no other host and stores nothing.
- **connect-telemetry skill:**
  - sends one `POST <endpoint>/v1/metrics` with an empty OTLP payload and your ingest token, to test them;
  - sends `GET <dashboard>/api/meta` to check that data arrived;
  - after you confirm, adds `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_METRICS_EXPORTER`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` and optionally `OTEL_RESOURCE_ATTRIBUTES` to the `env` block of `~/.claude/settings.json`. It changes no other keys and never touches permissions.

  From then on, Claude Code itself exports usage metrics (counts of sessions, lines, commits, PRs, tokens, cost and tool decisions, plus your user and account identifiers as attributes) to the dashboard you chose. It doesn't send prompts or code. To undo, remove those keys.
- **No data goes to the plugin author** or any third party. Everything goes to dashboards you run.

## License

MIT
