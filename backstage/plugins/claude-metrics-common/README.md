# @moatazeldebsy/backstage-plugin-claude-metrics-common

Shared code for the [Claude Metrics](https://github.com/moatazeldebsy/claude-metrics-viewer) Backstage plugins: the `claude-metrics.dashboard.read` permission. The backend checks it on every route and the frontend checks it before loading the page.

You don't install this directly; the frontend and backend plugins depend on it. Import it in your permission policy to decide who may see the dashboard. See [Access control](https://github.com/moatazeldebsy/claude-metrics-viewer/blob/main/docs/backstage-integration.md#access-control).
