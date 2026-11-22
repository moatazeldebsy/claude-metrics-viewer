# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `main` | Yes |
| Latest tagged release | Yes |
| Older releases | No backports |

## Reporting a vulnerability

**Please don't report security vulnerabilities in public GitHub issues.**

Report them privately with a [GitHub security advisory](../../security/advisories/new) on this repository. Include:

- what the vulnerability is and what an attacker could do with it,
- steps to reproduce (a proof of concept if you have one),
- the affected component (standalone dashboard, Backstage frontend plugin, backend plugin, data layer) and version,
- any mitigation you'd suggest.

This is a volunteer-maintained project. We'll acknowledge your report as soon as we can and keep you updated while we work on a fix. We follow coordinated disclosure: once a fix is released we publish an advisory and credit the reporter, unless you'd rather stay anonymous.

## What this project handles, and how to deploy it safely

The dashboard reads organization-wide, per-user activity and cost data with an **Anthropic Admin API key**, a high-privilege credential: an Admin key can also manage the organization's members, workspaces and API keys. Keep these in mind when deploying:

- **The Admin key stays on the server.** The standalone app reads it only in its Nitro server routes, and the Backstage backend plugin marks `claudeMetrics.adminKey` as a secret, so it never reaches the browser. Inject it as the `ANTHROPIC_ADMIN_KEY` environment variable from a secret store; never commit it or bake it into an image. Use a dedicated key you can revoke on its own.
- **The standalone dashboard has no authentication.** Put it behind your SSO or an authenticating proxy before exposing it to anyone. See the [README](README.md).
- **The Backstage plugin requires a signed-in user and the `claude-metrics.dashboard.read` permission** on every route. Access is only restricted if Backstage's permission framework is enabled and your policy handles that permission. See the [integration guide](docs/backstage-integration.md#access-control).
- **Departments CSV files contain employee emails.** Store them with the same care as the key.
- **OpenTelemetry mode stores employee emails and per-person activity** (counts, tokens, estimated cost; never prompts or code) in a SQLite file (standalone) or the plugin's database (Backstage). Protect them like the CSV. See [docs/opentelemetry.md](docs/opentelemetry.md#whats-stored) for what's kept, retention and deleting one person's data.
- **The OTLP ingest endpoint accepts writes from anyone holding an ingest token** (`OTEL_INGEST_TOKENS` / `claudeMetrics.otel.ingestTokens`, a secret). A leaked token lets someone add fake activity, not read any; rotate it as described in the docs. In Backstage, `/api/claude-metrics/otlp` is the only route that doesn't require a signed-in user, because Claude Code can't send a Backstage token; it checks the ingest token instead and serves no data. Ingest is off until a token is configured.

Reports about these areas are especially welcome: anything that exposes the Admin key, bypasses the permission check or the ingest token check, or leaks one user's data to another.
