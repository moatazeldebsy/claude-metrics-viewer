# @moatazeldebsy/backstage-plugin-claude-metrics-backend

Backend plugin for [Claude Metrics](https://github.com/moatazeldebsy/claude-metrics-viewer). It serves `/api/claude-metrics/*` for the frontend plugin, [`@moatazeldebsy/backstage-plugin-claude-metrics`](https://www.npmjs.com/package/@moatazeldebsy/backstage-plugin-claude-metrics). Data comes from the Anthropic Admin API, from Claude Code's own OpenTelemetry export, or from built-in mock data.

## Install

```bash
yarn --cwd packages/backend add @moatazeldebsy/backstage-plugin-claude-metrics-backend
```

```ts
// packages/backend/src/index.ts, before backend.start()
backend.add(import('@moatazeldebsy/backstage-plugin-claude-metrics-backend'));
```

## Configure

```yaml
claudeMetrics:
  dataSource: anthropic          # mock (default) | anthropic | otel
  adminKey: ${ANTHROPIC_ADMIN_KEY}
  departmentsFile: /etc/claude-metrics/departments.csv   # optional
  holidayCountry: US             # optional
```

The Admin API key is read only here and never reaches the browser. Every route requires a signed-in user **and** the `claude-metrics.dashboard.read` permission, so you can limit the dashboard to managers in your permission policy.

See the [integration guide](https://github.com/moatazeldebsy/claude-metrics-viewer/blob/main/docs/backstage-integration.md) for the OpenTelemetry setup, Kubernetes secrets, access control and troubleshooting.
