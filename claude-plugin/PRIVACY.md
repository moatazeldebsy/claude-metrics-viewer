# Privacy policy: metrics-viewer plugin

Last updated: 2026-11-23

The `metrics-viewer` Claude Code plugin has one component, the `connect-telemetry` skill. It ships no scripts, hooks or MCP servers. This page describes every piece of data the plugin handles.

## Who receives data

**Nobody but you.** The plugin author, Anthropic (beyond normal Claude Code use) and any other third party receive nothing from this plugin. Every request the skill makes goes to a Claude Metrics dashboard that you (or your organization) run and whose address you type in.

## What the skill asks you for

- The dashboard's ingest **endpoint** (a URL).
- An **ingest token**, a secret from your dashboard's configuration that only allows writing metrics.
- Optionally a **department** name.

The skill uses these only in the steps below. It doesn't display the full token back to you.

## What the skill sends

1. One `POST <endpoint>/v1/metrics` with an **empty** OTLP payload (`{"resourceMetrics":[]}`) and your token, to test the endpoint and token. No usage data is sent.
2. One `GET <dashboard>/api/meta`, after you start a new Claude Code session, to check whether metrics have arrived. This request carries no data about you.

## What the skill stores

Only after you confirm, it adds these keys to the `env` block of `~/.claude/settings.json` on your computer:

| Key | Value |
|---|---|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` |
| `OTEL_METRICS_EXPORTER` | `otlp` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | your endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS` | `Authorization=Bearer <your token>` |
| `OTEL_RESOURCE_ATTRIBUTES` (optional) | `department=<name>` |

It keeps every other key in the file and never changes permissions. For a team, it only prints a managed-settings block for you to deploy, and writes nothing.

## What happens after setup

Once these settings are in place, **Claude Code itself**, not the plugin, exports OpenTelemetry **metrics** to your endpoint about every 60 seconds. These are counts of sessions, lines of code added and removed, commits, pull requests, tokens, estimated cost, and edit-tool accept or reject decisions. Claude Code attaches attributes such as your user email, account ID, session ID, organization ID, terminal type and model. It does not export your prompts, Claude's responses, or your code. The skill turns on only the metrics exporter, not logs or traces.

Your dashboard stores daily totals of these metrics according to its own settings (for example `TELEMETRY_RETENTION_DAYS`, 400 days by default in the standalone app). That data is under the control of whoever runs the dashboard.

See Claude Code's [monitoring documentation](https://code.claude.com/docs/en/monitoring-usage) for the full list of metrics and attributes.

## How to undo it

Remove the keys above from `env` in `~/.claude/settings.json` and start a new Claude Code session. Telemetry export stops. To remove data already sent, delete it from your dashboard (for the standalone app, its `TELEMETRY_DB` file).

## Contact

Questions or concerns: open an issue at https://github.com/moatazeldebsy/claude-metrics-viewer/issues. For security issues, see [SECURITY.md](https://github.com/moatazeldebsy/claude-metrics-viewer/blob/main/SECURITY.md).
