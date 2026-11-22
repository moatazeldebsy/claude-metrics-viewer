# OTLP fixtures

Real OpenTelemetry metric exports from Claude Code 2.1.330 (`claude -p "Reply with the single word: hello"`, Pro plan, VS Code terminal), captured with `scripts/capture-otlp.mjs`.

- `claude-code-metrics.json`: OTLP/HTTP JSON (`OTEL_EXPORTER_OTLP_PROTOCOL=http/json`). The run's two export requests are merged into one request.
- `claude-code-metrics.pb`: OTLP/HTTP protobuf (the default protocol), from a second run. Its two requests are concatenated; protobuf merges the repeated `resource_metrics`, so this decodes as one request.

Sanitised: `user.email`, `user.id`, `user.account_uuid`, `user.account_id`, `organization.id` and `session.id` are replaced with same-length placeholders, which keeps the protobuf length prefixes valid. Nothing else was changed.

## Expected values (JSON fixture)

| | |
|---|---|
| Day (UTC) | 2026-11-22 |
| Actor | `ada.lovela@example.test` (user) |
| Terminal | `vscode` |
| Model | `claude-opus-5-5` |
| `claude_code.session.count` | 1 |
| `claude_code.cost.usage` | 0.2046018 USD (→ 20 cents) |
| `claude_code.token.usage` input / output / cacheRead / cacheCreation | 2 / 4 / 9449 / 25328 |
| `claude_code.active_time.total` (cli) | 2.577 s |

The prompt made no edits, commits or PRs, so `lines_of_code`, `commit`, `pull_request` and `code_edit_tool.decision` don't appear. Tests for those use hand-made points.

The protobuf run has the same metric names with its own values; tests compare names and assert totals are positive.
