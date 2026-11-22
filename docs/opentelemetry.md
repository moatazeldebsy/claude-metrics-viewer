# OpenTelemetry data source

Claude Code can export usage metrics over OpenTelemetry (OTLP). With `DATA_SOURCE=otel` (standalone) or `claudeMetrics.dataSource: otel` (Backstage), the dashboard receives that export itself and builds its tabs from it. Nothing is read from Anthropic, so this works without an Admin API key:

- **One person on Pro or Max.** You can't create an Admin key, but you can point your own Claude Code at the dashboard. You're an organization of one.
- **A team on any plan,** including Team and Enterprise subscriptions, whose Claude Code usage the Admin API's Claude Code report doesn't include.

What you get: Overview, Departments (activity only, see below), Tool acceptance, Environments (terminals), Commits & PRs, Models and Users, with today's data included. Cost & usage and Seats need the Admin API or a member list and explain that on the tab. The API response tab is hidden. Cost on the Claude Code tabs is Claude Code's own estimate, not your bill.

## Set up the dashboard

**Standalone:**

```bash
DATA_SOURCE=otel OTEL_INGEST_TOKENS=$(openssl rand -hex 24) npm run dev
```

| Variable | Default | |
|---|---|---|
| `OTEL_INGEST_TOKENS` | none | Comma-separated bearer tokens. Ingest returns `503` until one is set. |
| `TELEMETRY_DB` | `./.data/telemetry.db` | SQLite file holding the daily totals. In Docker it's `/app/.data/telemetry.db`: mount a volume there (`-v claude-metrics-data:/app/.data`), see the README. |
| `TELEMETRY_RETENTION_DAYS` | `400` | Days of totals to keep. `0` keeps everything. |

The ingest endpoint is `POST /v1/metrics` on the app's origin, so Claude Code's endpoint is the origin itself, e.g. `http://localhost:3000`.

**Backstage:** see [the integration guide](backstage-integration.md#opentelemetry-instead-of-the-admin-api). The endpoint is `<backend base URL>/api/claude-metrics/otlp`.

Until the first export arrives the dashboard shows a setup panel with the exact settings for its own URL.

## Set up Claude Code

### One person

Add to your shell profile (`~/.zshrc`, `~/.bashrc`):

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <your-ingest-token>"
```

Start a new Claude Code session. Metrics are exported every 60 seconds by default (`OTEL_METRIC_EXPORT_INTERVAL`, in milliseconds), and once more when the session ends.

### A team

Put the same variables under `env` in Claude Code's [managed settings](https://docs.anthropic.com/en/docs/claude-code/settings) (`managed-settings.json`, deployed with your MDM), so every machine reports and people can't turn it off:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://backstage.example.com/api/claude-metrics/otlp",
    "OTEL_EXPORTER_OTLP_HEADERS": "Authorization=Bearer <team-ingest-token>"
  }
}
```

Both OTLP/HTTP encodings work: `http/protobuf` (Claude Code's default) and `http/json`, with or without gzip. gRPC isn't supported, so don't set `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`.

### Tokens and rotation

Ingest tokens only allow writing metrics; they can't read anything. Several tokens can be active at once, so you can give each team its own, or rotate one:

1. Add the new token next to the old one (`OTEL_INGEST_TOKENS=old,new`, or a second entry in `claudeMetrics.otel.ingestTokens`) and restart.
2. Roll the new token out to Claude Code's settings.
3. Remove the old token and restart. Machines still sending it get `401`, and their metrics are dropped.

### Departments

Each person can carry a department as an OpenTelemetry resource attribute:

```bash
export OTEL_RESOURCE_ATTRIBUTES="department=Platform"
```

In managed settings that's one file per department, or set it per machine. The department filter and the Departments tab pick it up; the latest value wins. A departments CSV (`DEPARTMENTS_FILE` / `claudeMetrics.departmentsFile`) takes precedence over the attribute.

Without a CSV the dashboard doesn't know who *could* be using Claude Code, so Departments shows activity only (active users, sessions, acceptance, estimated cost) and hides adoption, engagement tiers and inactive seats. With a CSV, those come back and the Seats tab lists members with no activity.

## What's stored

Per day, per person, per terminal and per model: sessions, lines added and removed, commits, pull requests, estimated cost, tokens (input, output, cache read, cache creation), accepted and rejected edit decisions, and active time. Plus one row per person: their email (or a pseudonym, below), latest department and the last day they were seen.

Not stored: prompts, responses, code, file paths, tool inputs, session IDs or anything from Claude Code's log events. The dashboard only reads metrics; it ignores logs and traces. Other metrics sent to the same endpoint are dropped.

People are identified by the `user.email` attribute Claude Code sends when you're signed in. Without an email (API-key users, for example) the person shows up as `user-` followed by 10 hex characters of a SHA-256 hash of Claude Code's `user.id`, under API actors.

## Retention and deleting data

Daily totals older than the retention window (400 days by default) are deleted once a day, and people not seen within the window are removed too.

To delete one person's data, stop their Claude Code from exporting first, then delete their rows. Standalone:

```bash
sqlite3 .data/telemetry.db \
  "DELETE FROM telemetry_rows WHERE actor = 'ada@example.com';
   DELETE FROM telemetry_users WHERE actor = 'ada@example.com';"
```

Backstage (on the plugin's database, `backstage_plugin_claude-metrics` by default on Postgres):

```sql
DELETE FROM claude_metrics_telemetry_rows WHERE actor = 'ada@example.com';
DELETE FROM claude_metrics_telemetry_users WHERE actor = 'ada@example.com';
```

## How counting works

Claude Code sends *delta* metrics: each export carries what happened since the last one, and the dashboard adds it to the day's totals. Two consequences:

- **At-least-once.** If Claude Code retries an export the dashboard already stored (for example after a timeout), that export is counted twice. This is rare and the numbers are for trends, not billing.
- **Cumulative temporality is rejected** with `400`. If you set `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`, remove it.

Days are UTC, like the rest of the dashboard.

## Troubleshooting

Run Claude Code with a debug log and look for exporter errors:

```bash
claude --debug-file /tmp/claude-debug.log -p "hello"
grep "3P telemetry" /tmp/claude-debug.log
```

| What you see | Cause and fix |
|---|---|
| Setup panel never goes away | Telemetry isn't on: check `CLAUDE_CODE_ENABLE_TELEMETRY=1` and `OTEL_METRICS_EXPORTER=otlp` in the session's environment. Short sessions export at exit; wait for the session to end. |
| `401` in the debug log | The token in `OTEL_EXPORTER_OTLP_HEADERS` isn't in the dashboard's list, or the header is malformed. The format is `Authorization=Bearer <token>`. |
| `503 OTLP ingest is disabled` | No ingest token configured on the dashboard. |
| `404` | The endpoint path is wrong, or the dashboard isn't in otel mode. Set the endpoint to the base URL (Claude Code appends `/v1/metrics`); don't add `/v1/metrics` yourself. |
| `415` | `OTEL_EXPORTER_OTLP_PROTOCOL=grpc`. Use `http/protobuf` or `http/json`. |
| `400 … cumulative temporality` | See *How counting works*. |
| Numbers stop at yesterday | The date range in the URL was set before; pick a preset again. Live data includes today. |
| Everyone is **Unassigned** | No CSV and no `department` resource attribute. |
