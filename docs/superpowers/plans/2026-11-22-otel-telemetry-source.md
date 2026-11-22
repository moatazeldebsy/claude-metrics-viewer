# OpenTelemetry Data Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third data source, `otel`, that ingests Claude Code's OpenTelemetry metrics over OTLP/HTTP, stores daily totals, and serves every Claude Code tab in both the standalone dashboard and the Backstage plugin.

**Architecture:** The data layer (`@internal/claude-metrics-lib`, `./server` entry) gets the pure parts: an OTLP decoder (JSON, protobuf, gzip), a mapper from data points to daily rows, a `TelemetryStore` interface with an in-memory implementation, an ingest handler (auth, content types, errors), and `OtelSource implements MetricsSource`. Each host supplies a durable store and a route: SQLite via `node:sqlite` in Nuxt, Knex via `coreServices.database` in Backstage. Both register the store with `registerTelemetryStore()`. Sources declare capabilities, which `/meta` returns and both UIs use to hide what a source can't provide.

**Tech Stack:** TypeScript, Nuxt 4/Nitro, Vitest, Playwright, Backstage 1.56.2 (backend plugin + Knex, Backstage UI frontend), Jest/supertest/RTL, `node:sqlite`, `node:zlib`, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-11-22-otel-telemetry-source-design.md`

## Global Constraints

- **Data layer** (`backstage/packages/claude-metrics-lib`):
  - the root entry stays browser-safe: everything in this plan goes behind `./server`;
  - relative imports only;
  - no new npm dependencies (`node:*` built-ins only);
  - no `node:sqlite` import in the lib.
- **Backstage workspace** stays on the 1.56.2 release. The ingest route is the only route without `claude-metrics.dashboard.read`.
- **Settings:**
  - standalone env: `DATA_SOURCE=otel`, `OTEL_INGEST_TOKENS` (comma-separated), `TELEMETRY_DB` (default `./.data/telemetry.db`), `TELEMETRY_RETENTION_DAYS` (default `400`; `0` = keep);
  - Backstage config: `claudeMetrics.dataSource: otel`, `claudeMetrics.otel.ingestTokens` (string array, `@visibility secret`), `claudeMetrics.otel.retentionDays` (default 400).
- **Routes:** standalone `POST /v1/metrics`; Backstage `POST /api/claude-metrics/otlp/v1/metrics`. Users set `OTEL_EXPORTER_OTLP_ENDPOINT` to the standalone origin, or to `<backstage-backend>/api/claude-metrics/otlp`.
- **Ingest responses:**
  - no tokens configured → `503` `OTLP ingest is disabled: no ingest tokens are configured.`;
  - bad or missing token → `401`;
  - body over 5 MB → `413`;
  - unsupported content type → `415`;
  - undecodable body → `400`;
  - cumulative temporality → `400` `Cumulative temporality isn't supported. Remove OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative (Claude Code sends delta by default).`;
  - success → `200` with `{}` (JSON) or an empty body (protobuf).
- **Only these values are stored:** day, actor, terminal, model, and the metric totals and department listed in Task 3. Nothing else from telemetry: no session ids, prompts or other attributes.
- **Data source labels:** `mock`, `anthropic`, `otel`. The UI shows `otel` as "OpenTelemetry".
- Every tab change is made in **both** UIs (`app/components/tabs/*.vue` and `backstage/plugins/claude-metrics/src/tabs/*.tsx`).
- Commit messages follow Conventional Commits, with no Claude co-author trailer.

## Review Focus

1. **Claude Code's default protocol** (`http/protobuf`, no `OTEL_EXPORTER_OTLP_PROTOCOL` set) must work. Task 2 decodes the real protobuf fixture.
2. **Gzip-compressed bodies** (`Content-Encoding: gzip`, from `OTEL_EXPORTER_OTLP_COMPRESSION=gzip`) must be accepted. Task 4 test.
3. **Header casing:** a lowercase `authorization` header or a `bearer` prefix in any case must authenticate. Task 4 test.
4. **Concurrent POSTs** from many users must not lose increments. Tasks 5 and 7 test parallel `add`s.
5. **A batch with only non-`claude_code.*` metrics, or an empty batch,** returns `200` and stores nothing, without creating users. Task 4 test.

---

### Task 1: Capture real Claude Code OTLP payloads as fixtures

**Files:**
- Create: `tests/fixtures/otlp/claude-code-metrics.json` and `tests/fixtures/otlp/claude-code-metrics.pb`
- Create: `scripts/capture-otlp.mjs` (dev tool: listens on a port and writes each request body and content type to a directory)

**Interfaces:** produces the two fixture files. Later tasks also need the recorded values for one actor (expected session count, lines, tokens by type, cost) in `tests/fixtures/otlp/README.md`.

- [ ] **Step 1:** Write `scripts/capture-otlp.mjs`: `node scripts/capture-otlp.mjs <port> <outDir>`. It answers `200 {}` to every POST and saves `<n>.<json|pb>`.
- [ ] **Step 2:** Capture JSON. The maintainer consented to one short prompt on their account. Run `node scripts/capture-otlp.mjs 4318 <scratch>/json &` and then `CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_METRICS_EXPORTER=otlp OTEL_LOGS_EXPORTER=none OTEL_EXPORTER_OTLP_PROTOCOL=http/json OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 OTEL_METRIC_EXPORT_INTERVAL=2000 claude -p "Reply with the single word: hello"`. Expected: at least one body containing `claude_code.session.count` and `claude_code.token.usage`.
- [ ] **Step 3:** Repeat with `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` into `<scratch>/pb`. Expected: a binary body with content type `application/x-protobuf`.
- [ ] **Step 4:** Sanitise. Replace `user.email`, `user.id`, `user.account_uuid`, `user.account_id`, `organization.id`, `session.id` and any host or path values with **same-length** placeholders. Same length keeps the protobuf length prefixes valid. Use `ada.lovelace@example.test`-style padding for the email. Save the files to the fixture paths and record the expected per-actor totals in the README.
- [ ] **Step 5:** Check that none of the real values remain in the repo: `grep -c` for the real email and organization id across both fixtures. Expected: `0`.
- [ ] **Step 6:** Commit: `test: real Claude Code OTLP metric payloads (sanitised)`.

### Task 2: OTLP decoder (JSON, protobuf)

**Files:**
- Create: `backstage/packages/claude-metrics-lib/src/telemetry/otlp.ts`
- Modify: `backstage/packages/claude-metrics-lib/src/server.ts` (export)
- Test: `tests/unit/otlp-decode.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type AttrValue = string | number | boolean;
  interface OtlpPoint {
    metric: string;                 // e.g. "claude_code.token.usage"
    kind: "sum" | "gauge" | "other";
    temporality: "delta" | "cumulative" | "unspecified";
    timeUnixNano: bigint;
    value: number;
    attributes: Record<string, AttrValue>;   // point attributes
    resource: Record<string, AttrValue>;     // resource attributes
  }
  class OtlpDecodeError extends Error {}
  function decodeOtlpJson(text: string): OtlpPoint[];
  function decodeOtlpProtobuf(bytes: Uint8Array): OtlpPoint[];
  ```
- Protobuf field numbers to decode (opentelemetry-proto):
  - `ExportMetricsServiceRequest.resource_metrics=1`;
  - `ResourceMetrics{resource=1, scope_metrics=2}`;
  - `Resource{attributes=1}`;
  - `ScopeMetrics{metrics=2}`;
  - `Metric{name=1, gauge=5, sum=7}` (skip `histogram=9`, `exponential_histogram=10`, `summary=11` as `kind:"other"`);
  - `Sum{data_points=1, aggregation_temporality=2}` (1 = delta, 2 = cumulative);
  - `Gauge{data_points=1}`;
  - `NumberDataPoint{time_unix_nano=3 fixed64, as_double=4 double, as_int=6 sfixed64, attributes=7}`;
  - `KeyValue{key=1, value=2}`;
  - `AnyValue{string_value=1, bool_value=2, int_value=3, double_value=4}`.

  Unknown fields are skipped by wire type. Write a small in-house decoder: varint, fixed64, length-delimited.
- JSON follows OTLP/JSON: camelCase keys, int64 values as strings, and enums as numbers or names (`AGGREGATION_TEMPORALITY_DELTA`).

- [ ] **Step 1: Write failing tests.**
  - `decodes the JSON fixture`: points include `claude_code.session.count` with `temporality: "delta"`, `kind: "sum"`, and a `session.id` attribute; at least one `claude_code.token.usage` point has `attributes.type` in `["input","output","cacheRead","cacheCreation"]` and a `model` string.
  - `protobuf and JSON fixtures decode to the same metric names and totals per metric` (sum of `value` grouped by `metric`; the two captures come from different runs, so compare metric names and assert each total > 0 rather than equal values).
  - `JSON enum names and numbers both map to delta`.
  - `int64 strings and asInt/asDouble values both become numbers`.
  - `malformed protobuf throws OtlpDecodeError`, and `invalid JSON throws OtlpDecodeError`.
- [ ] **Step 2:** Run `npm test -- otlp-decode`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `otlp.ts`.
- [ ] **Step 4:** Run `npm test -- otlp-decode`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(lib): decode OTLP/HTTP metrics (JSON and protobuf)`.

### Task 3: Rows, store interface, `OtelSource`, capabilities

**Files:**
- Create: `src/telemetry/rows.ts`, `src/telemetry/store.ts` (interface + `MemoryTelemetryStore`) and `src/sources/otel.ts` (all under the lib package)
- Modify: `src/sources/types.ts`, `src/sources/index.ts`, `src/sources/mock.ts`, `src/sources/anthropic.ts`, `src/server.ts`
- Test: `tests/unit/telemetry-rows.test.ts`, `tests/unit/otel-source.test.ts`

**Interfaces:**
- Consumes: `OtlpPoint` (Task 2).
- Produces:
  ```ts
  type TelemetryCounter =
    | "sessions" | "linesAdded" | "linesRemoved" | "commits" | "prs" | "costUsd"
    | "tokensInput" | "tokensOutput" | "tokensCacheRead" | "tokensCacheCreation"
    | "editAccepted" | "editRejected" | "writeAccepted" | "writeRejected"
    | "notebookAccepted" | "notebookRejected" | "activeSecondsUser" | "activeSecondsCli";
  interface TelemetryKey { day: string; actorKind: "user" | "api"; actor: string; terminal: string; model: string }  // model "" when the metric has none
  interface TelemetryRow extends TelemetryKey { counters: Partial<Record<TelemetryCounter, number>> }
  interface TelemetryUser { actorKind: "user" | "api"; actor: string; department: string | null; lastSeen: string }
  interface TelemetryBatch { rows: TelemetryRow[]; users: TelemetryUser[] }
  class CumulativeTemporalityError extends Error {}
  function toTelemetryBatch(points: OtlpPoint[]): TelemetryBatch;   // throws CumulativeTemporalityError

  interface TelemetryStore {
    add(batch: TelemetryBatch, receivedAt: string): Promise<void>;
    records(day: string): Promise<TelemetryRow[]>;      // summed per key
    users(): Promise<TelemetryUser[]>;
    lastReceivedAt(): Promise<string | null>;
    prune(beforeDay: string): Promise<void>;            // rows with day < beforeDay; users with lastSeen < beforeDay
  }
  class MemoryTelemetryStore implements TelemetryStore {}

  interface SourceCapabilities { billedCost: boolean; seats: boolean; rawUpstream: boolean; remoteSplit: boolean }
  // MetricsSource gains: capabilities(): SourceCapabilities   (mock + anthropic: all true)
  function registerTelemetryStore(store: TelemetryStore): void;   // resets the cached source
  function sourceCapabilities(): SourceCapabilities;
  function telemetryStatus(): Promise<{ lastReceivedAt: string | null } | null>;  // null unless DATA_SOURCE=otel
  // dataSourceName(): "mock" | "anthropic" | "otel"
  ```
- Mapping (pinned by the spec):
  - **Metric → counter:**
    - `session.count` → `sessions`;
    - `lines_of_code.count` with `type` added/removed → `linesAdded`/`linesRemoved`;
    - `commit.count` → `commits`;
    - `pull_request.count` → `prs`;
    - `cost.usage` → `costUsd`;
    - `token.usage` with `type` input/output/cacheRead/cacheCreation → `tokens*`;
    - `code_edit_tool.decision` with `tool_name` Edit/Write/NotebookEdit and `decision` accept/reject → the matching counter;
    - `active_time.total` with `type` user/cli → `activeSeconds*`.
  - Other metrics, other tool names, and `gauge`/`other` kinds are ignored.
  - **Day:** the UTC date of `timeUnixNano`.
  - **Actor:** `user.email` gives `actorKind "user"`. Otherwise `actorKind "api"`, with actor `user-` followed by the first 10 hex characters of `sha256(user.id)`.
  - **Terminal:** `terminal.type`, or `"unknown"`.
  - **Model:** the `model` attribute, or `""`.
  - **Department:** resource or point attribute `department`, else `null`.
- `OtelSource` (constructor `(store: TelemetryStore, csvDepartments: Map<string, string>)`):
  - `claudeCodeDay(day)` returns one `ClaudeCodeRecord` per (actorKind, actor, terminal):
    - `customer_type: "subscription"`, `subscription_type: null`, `is_remote: false`, `organization_id: ""`;
    - `actor` is `user_actor{email_address}` or `api_actor{api_key_name}`;
    - core metrics are summed across models;
    - `multi_edit_tool` is `{accepted: 0, rejected: 0}`;
    - `model_breakdown` comes from rows with `model !== ""`, with tokens and `estimated_cost.amount = round(costUsd * 100)` cents.
  - `members()`:
    - with CSV entries: one `Member` per CSV email (`id = email`, `name` = email local part, `role: "user"`, `added_at: ""`, CSV department), plus telemetry `user` actors missing from the CSV (with their telemetry department);
    - without a CSV: telemetry `user` actors with their telemetry department.
    - API actors are never members.
  - `cost()` returns `[]`.
  - `capabilities()` returns `{ billedCost: false, seats: csvDepartments.size > 0, rawUpstream: false, remoteSplit: false }`.
- `getSource()` with `DATA_SOURCE=otel` returns a cached `OtelSource` built from the registered store and `loadDepartmentsFile(DEPARTMENTS_FILE)`. With no store registered it throws `DATA_SOURCE=otel needs a telemetry store; the host didn't register one.`

- [ ] **Step 1: Write failing tests** (`telemetry-rows.test.ts`, built from the Task 1 JSON fixture and small hand-made points):
  - `maps the fixture to the recorded totals` (values from `tests/fixtures/otlp/README.md`);
  - `no email becomes an api actor with a stable user-<hash> name, not the raw user.id`;
  - `cumulative sum throws CumulativeTemporalityError`;
  - `ignores non-claude metrics and gauges`;
  - `splits a batch across a UTC midnight into two days`;
  - `takes department from resource attributes`.
- [ ] **Step 2: Write failing tests** (`otel-source.test.ts`, using `MemoryTelemetryStore`):
  - `claudeCodeDay builds records that aggregateClaudeCode turns into the expected KPIs` (sessions, lines, commits, PRs, cost cents, accept rate);
  - `model_breakdown has one entry per model with tokens by type`;
  - `members: CSV wins over telemetry department; telemetry fills users not in the CSV`;
  - `capabilities: seats only with a CSV`;
  - `concurrent add calls lose no increments` (100 parallel `add`s of one session → 100);
  - `prune removes old rows and users`;
  - `getSource throws a clear error for otel without a store`;
  - `mock and anthropic sources report all capabilities true`.
- [ ] **Step 3:** Run `npm test -- telemetry otel-source`. Expected: FAIL.
- [ ] **Step 4:** Implement the files listed above.
- [ ] **Step 5:** Run `npm test` (all root unit tests). Expected: PASS, with the existing 47 unchanged.
- [ ] **Step 6:** Commit: `feat(lib): OpenTelemetry source, telemetry store and source capabilities`.

### Task 4: Ingest handler

**Files:**
- Create: `backstage/packages/claude-metrics-lib/src/telemetry/ingest.ts`; modify `src/server.ts`
- Test: `tests/unit/ingest.test.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces:
  ```ts
  interface IngestRequest {
    body: Uint8Array;
    contentType: string | undefined;
    contentEncoding: string | undefined;
    authorization: string | undefined;
  }
  interface IngestResponse { status: number; contentType: string; body: Uint8Array | string }
  function handleOtlpIngest(req: IngestRequest, opts: { tokens: string[]; store: TelemetryStore; now?: Date }): Promise<IngestResponse>;
  const OTLP_MAX_BODY_BYTES = 5 * 1024 * 1024;
  ```
- Behaviour and messages are exactly as in Global Constraints. Tokens are compared in constant time (`crypto.timingSafeEqual` on SHA-256 digests). `gzip` is decoded with `zlib.gunzipSync`, and the size limit applies after decompression too. Error bodies match the request's format: JSON `{ "message": … }` for JSON requests, a plain-text message otherwise.

- [ ] **Step 1: Write failing tests:**
  - `503 when no tokens are configured, and nothing stored`;
  - `401 without a token, with a wrong token`;
  - `accepts lowercase bearer and any header casing` (callers pass the header value; test `"bearer tok"` and `"Bearer tok"`);
  - `200 {} for the JSON fixture, and the store holds the recorded totals`;
  - `200 and an empty body for the protobuf fixture`;
  - `accepts gzip-encoded bodies`;
  - `413 above OTLP_MAX_BODY_BYTES, including after gunzip`;
  - `415 for application/grpc`;
  - `400 with the cumulative message`;
  - `200 and nothing stored for a batch with only other metrics, or an empty batch`;
  - `with two tokens configured, either one is accepted`.
- [ ] **Step 2:** Run `npm test -- ingest`. Expected: FAIL.
- [ ] **Step 3:** Implement `ingest.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(lib): OTLP ingest handler with token auth`.

### Task 5: Standalone host: SQLite store, route, meta, retention

**Files:**
- Create:
  - `server/utils/sqlite-telemetry-store.ts` (`SqliteTelemetryStore implements TelemetryStore`, `node:sqlite` `DatabaseSync`, `INSERT … ON CONFLICT DO UPDATE SET col = col + excluded.col`);
  - `server/plugins/telemetry.ts` (when `DATA_SOURCE=otel`: open `TELEMETRY_DB`, creating its directory, then `registerTelemetryStore`, then prune at startup and every 24 h with an unref'd timer when `TELEMETRY_RETENTION_DAYS > 0`);
  - `server/routes/v1/metrics.post.ts` (reads the raw body, calls `handleOtlpIngest` with tokens from `OTEL_INGEST_TOKENS`, writes the status, content type and body).
- Modify: `server/api/meta.get.ts`, so it returns `{ dataSource, holidayCountry, departments, capabilities: sourceCapabilities(), telemetry: await telemetryStatus() }`.
- Test: `tests/unit/sqlite-telemetry-store.test.ts`

**Interfaces:** consumes Tasks 3 and 4. Produces the `/meta` shape used by Task 6.

- [ ] **Step 1: Write failing tests**, against a temp-file database: the same store contract cases as Task 3 (`records` sums, `users` latest department, `lastReceivedAt`, `prune`, and `concurrent add calls lose no increments` with 100 parallel adds), plus `survives reopening the file`.
- [ ] **Step 2:** Run `npm test -- sqlite-telemetry`. Expected: FAIL.
- [ ] **Step 3:** Implement the three server files and the meta change. If Nitro's bundler doesn't treat `node:sqlite` as a built-in, add it to `nitro.externals`/`rollupConfig.external` in `nuxt.config.ts`.
- [ ] **Step 4:** Run `npm test && npm run typecheck && npm run lint && npm run build`. Expected: all pass.
- [ ] **Step 5:** Manual check. Run `DATA_SOURCE=otel OTEL_INGEST_TOKENS=dev npm run dev`, then `curl -s -XPOST localhost:3000/v1/metrics -H 'content-type: application/json' -H 'authorization: Bearer dev' --data @tests/fixtures/otlp/claude-code-metrics.json`. Expected: `{}`. `/api/claude-code` then returns non-zero `kpis.sessions`.
- [ ] **Step 6:** Commit: `feat: OpenTelemetry ingest and storage in the standalone app`.

### Task 6: Standalone UI: capabilities, first-run panel, e2e

**Files:**
- Modify:
  - `app/pages/index.vue` (label `otel` as "OpenTelemetry"; filter `TABS` to drop `api` when `!capabilities.rawUpstream`; show `<TelemetrySetup>` instead of the tabs while `dataSource === "otel" && telemetry.lastReceivedAt === null`, polling `/api/meta` every 10 s);
  - `app/components/tabs/CostTab.vue` and `SeatsTab.vue` (render `<NotAvailable>` when `!billedCost` / `!seats`);
  - `DepartmentsTab.vue` (when `!seats`: hide the Org adoption, Inactive seats and Power users KPIs, the adoption and engagement charts, weekly adoption, and the seats/adoption/power/light table columns, and show the note "Add a departments CSV to see adoption and inactive seats.");
  - `EnvironmentsTab.vue` (hide the Local/Remote KPIs when `!remoteSplit`).
- Create:
  - `app/components/NotAvailable.vue` (props `title`, `reason`);
  - `app/components/TelemetrySetup.vue` (shows the ingest endpoint `window.location.origin`, the per-user env block from the spec with `<your-ingest-token>`, the managed-settings JSON block, and "Waiting for the first data…");
  - `e2e/otel.spec.ts`.
- Modify: `playwright.config.ts` (a second web server on port 3100 with `DATA_SOURCE=otel OTEL_INGEST_TOKENS=e2e TELEMETRY_DB=test-results/otel-e2e.db`, plus a project for `otel.spec.ts`).
- Copy (reasons, in both UIs):
  - Cost: "Billed cost comes from the Admin API. With OpenTelemetry data, Overview and Models show Claude Code's estimated cost."
  - Seats: "Seats need a member list. Add a departments CSV (`DEPARTMENTS_FILE`) to see members with no activity."

- [ ] **Step 1: Write failing e2e tests** (`e2e/otel.spec.ts`):
  - `shows the setup panel before any telemetry`: the text `OTEL_EXPORTER_OTLP_ENDPOINT` and the origin are visible;
  - `after posting the fixture, Overview shows its sessions`: POST the JSON fixture with `Bearer e2e`, reload, and the Active users KPI is ≥ 1 and the Sessions KPI equals the recorded value;
  - `Cost & usage and Seats explain they aren't available; API response tab is absent`;
  - `Environments has no Local/Remote sessions KPIs`.
- [ ] **Step 2:** Run `npx playwright test e2e/otel.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the UI changes.
- [ ] **Step 4:** Run `npm run test:e2e` (both projects) and `npm run lint && npm run typecheck`. Expected: PASS, with the 12 existing mock e2e tests unchanged.
- [ ] **Step 5:** Commit: `feat: OpenTelemetry mode in the standalone dashboard`.

### Task 7: Backstage backend: Knex store, ingest route, config, retention

**Files:**
- Create:
  - `backstage/plugins/claude-metrics-backend/src/telemetry/KnexTelemetryStore.ts`;
  - `backstage/plugins/claude-metrics-backend/migrations/20261122_telemetry.js` (tables `claude_metrics_telemetry_rows` with a composite primary key `(day, actor_kind, actor, terminal, model)` and one numeric column per counter, `claude_metrics_telemetry_users`, and `claude_metrics_telemetry_meta`).
- Modify:
  - `src/plugin.ts`: deps `database`, `scheduler`; when `dataSource` is `otel`, run the migrations (`knex.migrate.latest({ directory: resolvePackagePath('@internal/backstage-plugin-claude-metrics-backend', 'migrations') })`), `registerTelemetryStore`, and schedule `claude-metrics-telemetry-prune` every 24 h; always call `httpRouter.addAuthPolicy({ path: '/otlp', allow: 'unauthenticated' })`;
  - `src/router.ts`: `router.post('/otlp/v1/metrics', express.raw({ type: () => true, limit: '6mb' }), …)` calling `handleOtlpIngest`, registered **before** the permission middleware; `/meta` gains `capabilities` and `telemetry`;
  - `src/config.ts` and `config.d.ts` (`otel.ingestTokens` as `@visibility secret`, `otel.retentionDays`; ingest tokens are passed to the router, not through env);
  - `package.json` (`files` gains `migrations`).
- Test: `src/telemetry/KnexTelemetryStore.test.ts` (Backstage `TestDatabases` with SQLite), plus additions to `src/router.test.ts`.

**Interfaces:** consumes Tasks 3 and 4. `createRouter` gains `telemetry?: { tokens: string[]; store: TelemetryStore }`.

- [ ] **Step 1: Write failing tests:**
  - the store contract cases, including `concurrent add calls lose no increments` and `prune`;
  - router: `POST /otlp/v1/metrics with a valid ingest token and no Backstage token returns 200` (using `mockCredentials.none` and an authorization header carrying the ingest token);
  - `wrong ingest token returns 401`;
  - `dashboard routes still return 403 when the permission policy denies` (the existing tests keep passing);
  - `meta includes capabilities`.
- [ ] **Step 2:** Run `cd backstage && yarn test`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `cd backstage && yarn tsc && yarn lint && yarn test && yarn build`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(backstage): OpenTelemetry ingest and storage in the backend plugin`.

### Task 8: Backstage frontend: capabilities and first-run panel

**Files:**
- Modify:
  - `src/components/ClaudeMetricsPage.tsx` (the `Meta` type gains `capabilities` and `telemetry`; label "OpenTelemetry"; tabs filtered; `<TelemetrySetup>` while waiting, polling `meta` every 10 s; the ingest URL is `await discoveryApi.getBaseUrl('claude-metrics') + '/otlp'`);
  - `src/tabs/CostTab.tsx`, `SeatsTab.tsx`, `DepartmentsTab.tsx`, `EnvironmentsTab.tsx` (same rules and copy as Task 6).
- Create: `src/components/NotAvailable.tsx` and `src/components/TelemetrySetup.tsx`. Pass capabilities through a small React context (`src/hooks/useCapabilities.ts`) so tabs don't re-fetch `/meta`.
- Test: `src/components/TelemetrySetup.test.tsx` and additions to `src/tabs/otherTabs.test.tsx`.

**Interfaces:** consumes the `/meta` shape from Task 7.

- [ ] **Step 1: Write failing tests:**
  - `setup panel shows OTEL_EXPORTER_OTLP_ENDPOINT with the plugin's /otlp URL while lastReceivedAt is null`;
  - `Cost and Seats render the not-available reasons when capabilities say so`;
  - `Departments hides seat KPIs without seats`;
  - `API response tab is hidden without rawUpstream`.
- [ ] **Step 2:** Run `cd backstage && yarn test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `cd backstage && yarn tsc && yarn lint && yarn test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(backstage): OpenTelemetry mode in the plugin page`.

### Task 9: Docs and end-to-end check with real Claude Code

**Files:**
- Create: `docs/opentelemetry.md`. It covers:
  - one-person setup;
  - team setup through managed settings;
  - tokens and rotation;
  - departments through `OTEL_RESOURCE_ATTRIBUTES`;
  - what is and isn't stored;
  - retention and deleting one person's data;
  - at-least-once counting;
  - troubleshooting with `claude --debug-file`, `[3P telemetry]`, protocol and temporality.
- Modify:
  - `README.md` (a "Data sources" section with a table: what each source covers, who it's for, which tabs work);
  - `docs/backstage-integration.md` (an OTel section: config, the ingest URL, the unauthenticated `/otlp` route guarded by tokens);
  - `SECURITY.md` (the ingest token; emails stored);
  - `AGENTS.md` (the store wiring rule; the ingest route is the only route without the permission);
  - `.env.example` (the new variables).

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2: Real Claude Code, standalone.** Run `DATA_SOURCE=otel OTEL_INGEST_TOKENS=local npm run dev`, then `CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_METRICS_EXPORTER=otlp OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000 OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer local" OTEL_METRIC_EXPORT_INTERVAL=5000 claude -p "Reply with the single word: hello"`. This uses the default protocol, http/protobuf. Expected: the setup panel disappears within about 10 s, and Overview shows 1 active user and at least 1 session.
- [ ] **Step 3: Real Claude Code, Backstage dev harness.** Use `claudeMetrics.dataSource: otel` with `otel.ingestTokens: [local]` and the endpoint `http://localhost:7007/api/claude-metrics/otlp`. Expected: the same result in the plugin page.
- [ ] **Step 4:** Run the full checks in both workspaces and the preview check: `npm test && npm run typecheck && npm run lint && npm run build && npm run test:e2e`, `cd backstage && yarn tsc && yarn lint && yarn test && yarn build`, and `npx tsx backstage/scripts/build-preview.ts && git diff --exit-code backstage/preview/index.html`. Expected: all pass, and the preview is unchanged.
- [ ] **Step 5:** Commit: `docs: OpenTelemetry data source`.
