// @ts-check
// Daily OpenTelemetry totals for Claude Metrics (claudeMetrics.dataSource: otel).

const COUNTERS = [
  'sessions', 'lines_added', 'lines_removed', 'commits', 'prs', 'cost_usd',
  'tokens_input', 'tokens_output', 'tokens_cache_read', 'tokens_cache_creation',
  'edit_accepted', 'edit_rejected', 'write_accepted', 'write_rejected',
  'notebook_accepted', 'notebook_rejected', 'active_seconds_user', 'active_seconds_cli',
];

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('claude_metrics_telemetry_rows', table => {
    table.string('day', 10).notNullable();
    table.string('actor_kind', 8).notNullable();
    table.string('actor', 320).notNullable();
    table.string('terminal', 128).notNullable();
    table.string('model', 128).notNullable();
    for (const c of COUNTERS) table.double(c).notNullable().defaultTo(0);
    table.primary(['day', 'actor_kind', 'actor', 'terminal', 'model']);
  });
  await knex.schema.createTable('claude_metrics_telemetry_users', table => {
    table.string('actor_kind', 8).notNullable();
    table.string('actor', 320).notNullable();
    table.string('department', 256).nullable();
    table.string('last_seen', 10).notNullable();
    table.primary(['actor_kind', 'actor']);
  });
  await knex.schema.createTable('claude_metrics_telemetry_meta', table => {
    table.string('key', 64).primary();
    table.string('value', 64).notNullable();
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTable('claude_metrics_telemetry_meta');
  await knex.schema.dropTable('claude_metrics_telemetry_users');
  await knex.schema.dropTable('claude_metrics_telemetry_rows');
};
