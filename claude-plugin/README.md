# metrics-viewer: Claude Code plugin

A Claude Code plugin for [Claude Metrics](https://github.com/moatazeldebsy/claude-metrics-viewer), the dashboard for Claude Code adoption and Claude API usage and cost.

## Install

```text
/plugin marketplace add moatazeldebsy/claude-metrics-viewer
/plugin install metrics-viewer@metrics-viewer
```

## What it does

**`/metrics-viewer:connect-telemetry`** connects Claude Code's OpenTelemetry metrics export to a Claude Metrics dashboard, either the standalone app or the Backstage plugin. Claude also picks it up when you ask to "send my Claude Code usage to the dashboard". It:

1. asks for the dashboard's ingest endpoint and token, and tests them with an empty export;
2. for one person, merges the four `env` settings into `~/.claude/settings.json` after you confirm. Claude Code ignores `OTEL_*` variables in project settings, and plugins can't set them;
3. for a team, prints the managed-settings block to deploy with MDM instead;
4. checks the dashboard received data once you've started a new session.

The dashboard needs `DATA_SOURCE=otel` (standalone) or `claudeMetrics.dataSource: otel` (Backstage). See [the OpenTelemetry guide](https://github.com/moatazeldebsy/claude-metrics-viewer/blob/main/docs/opentelemetry.md).

## License

MIT
