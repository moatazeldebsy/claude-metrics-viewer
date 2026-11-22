# @moatazeldebsy/claude-metrics-lib

The data layer of [Claude Metrics](https://github.com/moatazeldebsy/claude-metrics-viewer): Anthropic Admin API, OpenTelemetry and mock data sources, aggregation, departments, holidays, palette and formatters. It's shared by the standalone Nuxt app and the Backstage plugins.

- `@moatazeldebsy/claude-metrics-lib` is browser-safe (types, formatters, palette).
- `@moatazeldebsy/claude-metrics-lib/server` is the Node entry (data sources and aggregation).

You don't install this directly; [`@moatazeldebsy/backstage-plugin-claude-metrics`](https://www.npmjs.com/package/@moatazeldebsy/backstage-plugin-claude-metrics) and its backend depend on it. The API isn't stable outside those plugins.
