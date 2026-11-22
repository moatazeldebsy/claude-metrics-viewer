# OpenTelemetry data source: design

## Intent

Claude Metrics Viewer is going open source for **organizations**. Today it reads one data source, the Anthropic Admin API, which only sees Claude Code used through a Claude **Console** organization's API keys. Organizations on **claude.ai Team or Enterprise** subscriptions, the most common way companies buy Claude Code, get nothing from it: the Admin API docs say subscription usage "is attributed to their claude.ai organization, and this API doesn't return it."

Claude Code can export OpenTelemetry (OTel) metrics for any plan, and organization admins can switch it on for everyone through managed settings. Adding OTel as a second data source covers those organizations. It also lets one person (an "organization of one") point their own Claude Code at a deployment. That is how the maintainer can test against real data today: they have an individual account, which can't create an Admin key.

## Goals

- A third value for the data source, `otel`, next to `mock` and `anthropic`, in **both** the standalone Nuxt app and the Backstage plugin.
- Claude Code sends metrics to the deployment over OTLP/HTTP. The deployment adds them up per day, user, terminal and model, stores them durably, and serves every Claude Code tab from them through the existing `MetricsSource` interface.
- One shared deployment for a whole team: an ingest token guards the endpoint, and identity comes from the telemetry (`user.email`).
- Departments from telemetry: users or admins tag data with `OTEL_RESOURCE_ATTRIBUTES="department=…"`, falling back to the existing `departmentsFile` CSV.
- The UI is honest about what each source can show. Tabs a source can't fill say so, instead of showing zeros or errors.
- A first-run setup panel: when the source is `otel` and nothing has arrived yet, the page shows the exact environment variables to set, with the deployment's ingest URL filled in.
- Docs: setting it up for one person, for a team through managed settings, and in Backstage.

## Non-goals (this round)

- Merging sources: a deployment uses one data source. Combining Admin API and OTel data, and deduplicating between them, is a later project.
- OTLP over gRPC, and OTel **logs/events** (per-request records with more sensitive content).
- Reading Claude Code's local log files, personal billing views, or other features that only make sense for one person.
- Prometheus or another external metrics store as a backend.
- Billed cost: OTel cost is Claude Code's own estimate.

## Anti-goals (would make it a failure even if it works)

- Storing prompt text, responses, tool inputs or any event content. Only the numbers listed below are kept.
- An ingest endpoint anyone on the network can write to.
- Tabs that look broken (zeros, errors) because the source doesn't provide that data.
- Making the Admin API path, mock data or the existing tests worse.

## Constraints

- **Data layer** (`backstage/packages/claude-metrics-lib`): stays framework-free; the root entry stays browser-safe; anything with I/O goes behind `./server`; relative imports only (see AGENTS.md).
- **Backstage plugins** stay built against Backstage **1.56.2**. Every existing route keeps its `claude-metrics.dashboard.read` check. The ingest route is the one exception (see below).
- Node 24 for the standalone app; the platform template runs the plugin on Node 22.
- **Claude Code facts** (from code.claude.com/docs/en/monitoring-usage):
  - Enable with `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer …"`.
  - Protocol defaults to `http/protobuf` for http(s) endpoints; `http/json` is supported.
  - Metric temporality defaults to **delta**; the default export interval is 60 s.
  - Metrics: `claude_code.session.count`, `claude_code.lines_of_code.count` (`type` added/removed, `model`), `claude_code.commit.count`, `claude_code.pull_request.count`, `claude_code.cost.usage` (USD, estimate, `model`), `claude_code.token.usage` (`type` input/output/cacheRead/cacheCreation, `model`), `claude_code.code_edit_tool.decision` (`tool_name` Edit/Write/NotebookEdit, `decision` accept/reject), `claude_code.active_time.total` (s, `type` user/cli).
  - Standard attributes: `session.id`, `organization.id` (when available), `user.account_uuid`, `user.id` (random, anonymous), `user.email` (when signed in with a Claude account; absent for API-key auth), `terminal.type`, plus any `OTEL_RESOURCE_ATTRIBUTES` keys.
  - Admins can set the variables for everyone in managed settings; Claude Code ignores OTel variables in a repo's `.claude/settings*.json`.

## Approaches considered

1. **A receiver built into the app (picked).** The standalone server and the Backstage backend each accept OTLP/HTTP metrics, aggregate them, and store daily totals. Simplest for users (four environment variables), fits the existing `MetricsSource` design, and can be tested with real Claude Code today.
2. **Query Prometheus.** Users run an OTel Collector plus Prometheus, and the dashboard queries PromQL. Scales well, but small teams and individuals would have to run two extra services, which works against the "organization of one" case. Possible later add-on.
3. **Ingest OTel logs/events.** Richer per-request data, but much more storage and more sensitive content, and metrics already cover every tab. Dropped.

The maintainer handed the "how" to the designer; approach 1 is the designer's call.

## Design (decided)

### Data flow

```
Claude Code ──OTLP/HTTP POST /v1/metrics (Bearer ingest token)──▶ receiver
   receiver: decode → keep claude_code.* points → map to daily rows → store.add(rows)
dashboard routes ─▶ OtelSource implements MetricsSource ─▶ store.query(day) ─▶ ClaudeCodeRecord[]
```

### In the data layer (`./server` entry)

- **`decodeOtlpMetrics(body, contentType)`**: accepts OTLP/HTTP `application/json` and `application/x-protobuf`. Throws a clear, user-facing error for anything else (gRPC, unknown content types).
- **`toTelemetryRows(request)`**: a pure function. It keeps only `claude_code.*` metrics and turns each data point into increments keyed by:
  - **day**: UTC date of the point's time;
  - **actor**: `user_actor` with `user.email`. With no email (API-key auth), an `api_actor` whose name is a stable pseudonymous label derived from `user.id`, so the existing "(API key)" handling and KPIs apply unchanged;
  - **terminal**: `terminal.type`;
  - **model**: where present;
  - the user's **department** from the resource attribute `department` is recorded on the user, not on each daily row (see "Decisions after review").

  Delta temporality is summed. Cumulative points are rejected with a message telling the user to remove `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`. Everything else (session ids, prompt-related attributes, unknown metrics) is dropped.
- **`TelemetryStore` interface**: `add(rows, users)` (atomic increments, safe under concurrent posts), `records(day)` returning the summed rows for a day, `users()` returning the distinct actors seen with their latest telemetry department and first/last seen dates, `lastReceivedAt()`, and `prune(beforeDay)` for retention.
- **Wiring**: `getSource()` stays env-driven for `mock` and `anthropic`. For `otel`, each host builds its store and hands it over once at startup through a new `registerTelemetryStore(store)` in `./server`; `getSource()` builds the `OtelSource` from it, and throws a clear error if `DATA_SOURCE=otel` but no store was registered. The Admin API and mock paths don't change.
- **`OtelSource implements MetricsSource`**:
  - `claudeCodeDay(day)` builds `ClaudeCodeRecord`s with `customer_type: "subscription"`, `actor: user_actor`, and `terminal_type` from the rows; it fills `core_metrics`, `tool_actions` (Edit → `edit_tool`, Write → `write_tool`, NotebookEdit → `notebook_edit_tool`; `multi_edit_tool` stays 0) and `model_breakdown` (tokens by type; `estimated_cost` in cents);
  - `members()` returns the CSV members when a `departmentsFile` is configured (plus users seen in telemetry who aren't in it, as Unassigned, matching today's rule), otherwise the users seen in telemetry. Departments: CSV first, telemetry `department` attribute for users the CSV doesn't list;
  - `cost()` returns `[]`.
- **Source capabilities**: each source declares what it provides, `{ billedCost, seats, rawUpstream, remoteSplit }`. `/meta` returns them. For `otel`:
  - `billedCost: false`;
  - `rawUpstream: false`;
  - `remoteSplit: false` (OTel has no local/remote signal, so the Environments tab hides that split rather than showing everything as local);
  - `seats`: **true only when a `departmentsFile` CSV is configured**. The CSV is then the member list, so adoption, inactive seats and the Seats tab are real. Without a CSV it's `false` (designer's call, see "Decisions after review").
- **Active time** (`claude_code.active_time.total`) is stored but has no tab this round. That keeps a later "active hours" view possible without re-ingesting.

### Hosts

- **Standalone (Nuxt/Nitro):**
  - route `POST /v1/metrics` (so `OTEL_EXPORTER_OTLP_ENDPOINT=https://<host>` works without a path);
  - storage in a SQLite file at a configurable path (`TELEMETRY_DB`, default `./.data/telemetry.db`), preferably through Node's built-in `node:sqlite` to avoid native build steps;
  - settings: `DATA_SOURCE=otel`, `OTEL_INGEST_TOKENS`.
  - The Docker docs mount a volume for the database.
- **Backstage backend plugin:**
  - route `POST /api/claude-metrics/otlp/v1/metrics`, so `OTEL_EXPORTER_OTLP_ENDPOINT=https://<backstage>/api/claude-metrics/otlp`;
  - storage through Backstage's `coreServices.database` (Knex; SQLite in dev, Postgres in production) with a migration;
  - config `claudeMetrics.dataSource: otel` and `claudeMetrics.otel.ingestTokens`.
  - The ingest route is registered with an unauthenticated httpRouter auth policy (Claude Code has no Backstage token) and sits **outside** the permission middleware. It checks its own ingest token instead.

### Ingest security

- Bearer token(s) from config. Requests without a valid token get `401`, and nothing is stored.
- If no token is configured, the endpoint is **disabled** (returns `404` or `503` with a message), not open.
- Several tokens are allowed, so one can be rotated or issued per team.
- Body size limit, about 5 MB, configurable.
- The token is compared in constant time and never logged.

### UI (both apps, same behaviour)

- The header tag reads `Data source: OpenTelemetry`.
- **Cost & usage** and **Seats** show an "isn't available with OpenTelemetry data" explanation (one sentence on why, and that Overview and Models show Claude Code's estimated cost). The **API response** tab is hidden for `otel`.
- **First-run panel** (no telemetry received yet): the environment variables for one person, with the ingest URL filled in; the managed-settings snippet for a team; and a "Waiting for data…" state that updates when the first batch arrives.
- Departments, Users, Tools, Environments, Commits and Models work as they do today, from the telemetry.

### Docs

- README: a "Data sources" section with a comparison table (what each covers, who it's for, which tabs work).
- `docs/opentelemetry.md`: setup for one person; for a team through managed settings; tokens and rotation; departments through `OTEL_RESOURCE_ATTRIBUTES`; privacy (what's stored and what isn't); troubleshooting (`claude --debug-file`, `[3P telemetry]` errors, protocol, temporality).
- The integration guide and SECURITY.md cover the Backstage route, the ingest token, and the fact that emails are stored.

### Retention and duplicates

- Daily rows older than `retentionDays` (default 400) are deleted once a day; users not seen within that window are removed too. Setting it to `0` keeps everything. The docs describe how to delete one person's data.
- Counting is **at least once**: if Claude Code's exporter re-sends a batch it already delivered (for example after a timeout), that batch is counted twice. This is rare, the effect is small, and avoiding it would mean storing per-session identifiers. Documented in `docs/opentelemetry.md`.

## Decisions after review

The designer settled these after the builder check (the maintainer can still override them):

1. **Departments tab on `otel`.** Seat-based numbers (adoption, inactive seats, X of Y active, weekly adoption, engagement tiers' "inactive") are only real with a member list. With a `departmentsFile` CSV, the CSV is the member list and the tab works fully. Without one, the tab keeps per-department activity (active users, sessions, lines, commits, accept rate, cost, cost per active user) and hides the seat-based parts, with a one-line note that adding a CSV enables them. Same in both UIs.
2. **Users with no email** become `api_actor`s with a pseudonymous name. They're rare on `otel` (API-key auth usually means the Admin API source fits better), and this keeps existing behaviour: they count as "API-key actors", show "(API key)", and drop out of department filters as API actors do today.
3. **Store wiring** through `registerTelemetryStore()`; source selection for the existing sources is unchanged.
4. **One department per user, latest wins**, the same as the CSV mapping today: a change moves that user's history to the new department. The CSV overrides telemetry; telemetry fills users the CSV doesn't list.
5. **At-least-once counting**, documented, with no idempotency store.
6. **Environments**: the local/remote split is hidden for `otel` (`remoteSplit: false`).
7. **Retention**: `retentionDays`, default 400.

## Testing

- Unit tests:
  - the decoder, JSON and protobuf, with a payload captured from real Claude Code during implementation (sanitised: email, ids and organization replaced) committed as a fixture;
  - mapping edge cases: no email (→ `api_actor`), unknown metrics, cumulative rejected, a day boundary, several models, departments (CSV vs telemetry precedence), retention pruning;
  - store increments, including concurrent `add`s;
  - `OtelSource` → aggregate pipeline output;
  - ingest auth: missing, wrong, rotated and disabled tokens.
- Backend plugin tests: the ingest route accepts a valid token without a Backstage token, and every dashboard route still returns `403` without the permission.
- Both UIs: capability-driven empty states (Cost, Seats, Departments without a CSV, Environments split) and the first-run panel.
- **End to end with real Claude Code:** the maintainer runs `claude` with the four variables pointed at a local deployment and sees their own sessions on the dashboard. A scripted e2e test posts the recorded fixture and checks the Overview KPIs.

## Left to the builder

- Protobuf decoding library: the official OTLP proto definitions plus a small decoder are fine; avoid a heavy dependency tree.
- Exact SQLite and Knex schemas, and the migration naming.
- The pseudonymous label format for users without an email (stable, not reversible to `user.id`).
- Wording and layout of the empty states and the first-run panel, matching each app's existing components.
- Whether `/meta` exposes `lastReceivedAt` for the first-run panel or a small dedicated route does.
