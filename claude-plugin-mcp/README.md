# metrics-viewer-mcp: Claude Code plugin

Ask Claude about your [Claude Metrics](https://github.com/moatazeldebsy/claude-metrics-viewer) dashboard: "which departments have the lowest Claude Code adoption this month?", "who opened the most PRs with Claude Code last week?", "what did we spend per model in October?" It adds the read-only [`claude-metrics` MCP server](https://github.com/moatazeldebsy/claude-metrics-viewer/tree/main/mcp), which returns the same numbers the dashboard shows.

## Install

```text
/plugin marketplace add moatazeldebsy/claude-metrics-viewer
/plugin install metrics-viewer-mcp@metrics-viewer
```

Then set your dashboard's URL with `/plugin configure metrics-viewer-mcp@metrics-viewer` (the `dashboard_url` option, default `http://localhost:3000`).

It works with the standalone app. The Backstage plugin's API needs a signed-in user, so it isn't supported yet. To send your Claude Code usage to a dashboard, install [`metrics-viewer`](https://github.com/moatazeldebsy/claude-metrics-viewer/tree/main/claude-plugin) too.

## What it runs, sends and changes

- **MCP server:** `npx -y @moatazeldebsy/claude-metrics-mcp@0.1.0` ([source](https://github.com/moatazeldebsy/claude-metrics-viewer/tree/main/mcp), published with npm provenance), started with `CLAUDE_METRICS_URL` set to your `dashboard_url`.
- It only sends read-only `GET` requests to `<dashboard_url>/api/*` and returns the JSON to Claude. It contacts no other host, stores nothing and changes no settings.
- **No data goes to the plugin author** or any third party.

## License

MIT
