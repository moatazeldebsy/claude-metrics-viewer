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

## License

MIT
