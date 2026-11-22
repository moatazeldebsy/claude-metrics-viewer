---
name: connect-telemetry
description: Connect Claude Code's OpenTelemetry metrics export to a Claude Metrics dashboard (standalone Nuxt app or the Backstage plugin), then check that data arrives. Use when the user wants their own or their team's Claude Code usage to show up in Claude Metrics, asks to "connect telemetry", "send metrics to the dashboard", set up OTEL for Claude Metrics, or sees the dashboard's "waiting for the first export" setup panel.
---

# Connect Claude Code to Claude Metrics

Claude Metrics can build its dashboard from Claude Code's own OpenTelemetry (OTLP) metrics export, so no Anthropic Admin API key is needed. That covers one person on Pro or Max, and teams on any plan. This skill sets the four environment variables Claude Code needs and checks that the dashboard receives the export.

Full reference: https://github.com/moatazeldebsy/claude-metrics-viewer/blob/main/docs/opentelemetry.md

## 1. Ask for the endpoint and token

Ask the user which dashboard they're connecting to, and get:

| Dashboard | Endpoint (`OTEL_EXPORTER_OTLP_ENDPOINT`) |
|---|---|
| Standalone app | The app's origin only, e.g. `http://localhost:3000`. Claude Code appends `/v1/metrics`. |
| Backstage plugin | `<backend base URL>/api/claude-metrics/otlp`, e.g. `https://backstage.example.com/api/claude-metrics/otlp` |

They also need an **ingest token**: one of the values in the dashboard's `OTEL_INGEST_TOKENS` (standalone) or `claudeMetrics.otel.ingestTokens` (Backstage). If they run the dashboard themselves and have none yet, they can create one with `openssl rand -hex 24` and add it to the dashboard's configuration, then restart the dashboard. Tokens can only write metrics, not read them, but still treat them as secrets: don't echo the token back in full.

Also ask whether this is for **one person** (this machine) or **a team**.

## 2. Check the endpoint before changing anything

Send an empty OTLP/JSON export with the token:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "<endpoint>/v1/metrics" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer <token>" \
  -d '{"resourceMetrics":[]}'
```

| Code | Meaning |
|---|---|
| `200` | Ready. |
| `401` | Wrong token. |
| `503` | The dashboard has no ingest tokens configured. |
| `404` | The dashboard isn't in OpenTelemetry mode. Standalone: start it with `DATA_SOURCE=otel`. Backstage: set `claudeMetrics.dataSource: otel`. Or the endpoint is wrong. |
| connection error | Wrong host or port, or the dashboard isn't running. |

Stop and help fix anything other than `200` before going on.

## 3a. One person: write `~/.claude/settings.json`

Claude Code **ignores `OTEL_*` variables in a project's `.claude/settings.json` and `.claude/settings.local.json`**, and a plugin can't set them either, so they go in the user settings file. Show the user this block and ask before writing it:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "<endpoint>",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <token>"
  }
}
```

On confirmation, read `~/.claude/settings.json` (it may not exist), **merge** these keys into its `env` object, keeping every other key, and write it back as valid JSON. If any of these keys already exist with different values, show the old and new values and ask first.

Optional:
- `"OTEL_RESOURCE_ATTRIBUTES": "department=<name>"` puts this person in a department on the Departments tab. A departments CSV on the dashboard takes precedence.
- Don't set `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`. The dashboard accepts only OTLP/HTTP, and Claude Code's default `http/protobuf` works.

## 3b. A team: print managed settings, don't edit anything

For a team, the same `env` block goes in Claude Code's managed settings (`managed-settings.json`, deployed with MDM), so every machine reports and people can't turn it off. Print the block with their endpoint and a team token, and point them to https://code.claude.com/docs/en/settings for where the file lives on each OS. Don't write managed settings yourself. Suggest one token per team so a token can be rotated without touching everyone; the dashboard accepts several at once.

## 4. Verify

Tell the user to **start a new Claude Code session**, because environment changes apply only to new sessions, and use it for a minute or two. Metrics are exported every 60 seconds and when a session ends. Then:

- **Standalone:** `curl -s <endpoint>/api/meta` and read `telemetry.lastReceivedAt`. A recent timestamp means it works. `null` means nothing has arrived yet.
- **Backstage:** the API needs a signed-in user, so ask them to open the **Claude Metrics** page. The "waiting for the first export" setup panel disappears once data arrives.

If nothing arrives after a few minutes, check that the new session sees the variables (run `env | grep -E 'OTEL|CLAUDE_CODE_ENABLE_TELEMETRY'` from it), and re-run step 2.

## Undo

Remove the four keys (and `OTEL_RESOURCE_ATTRIBUTES`, if added) from `env` in `~/.claude/settings.json`, then start a new session.
