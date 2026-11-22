import { resolvePackagePath } from '@backstage/backend-plugin-api';
import {
  TELEMETRY_COUNTERS,
  type TelemetryBatch,
  type TelemetryCounter,
  type TelemetryRow,
  type TelemetryStore,
  type TelemetryUser,
} from '@moatazeldebsy/claude-metrics-lib/server';
import type { Knex } from 'knex';

const ROWS = 'claude_metrics_telemetry_rows';
const USERS = 'claude_metrics_telemetry_users';
const META = 'claude_metrics_telemetry_meta';
const KEY_COLUMNS = ['day', 'actor_kind', 'actor', 'terminal', 'model'];
const rowKey = (r: TelemetryRow) => [
  r.day,
  r.actorKind,
  r.actor,
  r.terminal,
  r.model,
];
const compareKeys = (a: string[], b: string[]) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  }
  return 0;
};
const column = (c: TelemetryCounter) =>
  c.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);

/** TelemetryStore on the plugin's own database (SQLite in development, Postgres in production). */
export class KnexTelemetryStore implements TelemetryStore {
  static async create(knex: Knex): Promise<KnexTelemetryStore> {
    await knex.migrate.latest({
      directory: resolvePackagePath(
        '@moatazeldebsy/backstage-plugin-claude-metrics-backend',
        'migrations',
      ),
    });
    return new KnexTelemetryStore(knex);
  }

  private constructor(private readonly knex: Knex) {}

  async add(batch: TelemetryBatch, receivedAt: string): Promise<void> {
    // Rows and users are written in key order, so concurrent batches lock rows in the same order
    // and can't deadlock (Postgres). Every write is one upsert computed by the database, so
    // concurrent batches can't lose increments or overwrite newer data with older.
    const rows = [...batch.rows].sort((a, b) =>
      compareKeys(rowKey(a), rowKey(b)),
    );
    const users = [...batch.users].sort((a, b) =>
      compareKeys([a.actorKind, a.actor], [b.actorKind, b.actor]),
    );
    await this.knex.transaction(async tx => {
      for (const r of rows) {
        const counters = Object.fromEntries(
          TELEMETRY_COUNTERS.map(c => [column(c), r.counters[c] ?? 0]),
        );
        await tx(ROWS)
          .insert({
            day: r.day,
            actor_kind: r.actorKind,
            actor: r.actor,
            terminal: r.terminal,
            model: r.model,
            ...counters,
          })
          .onConflict(KEY_COLUMNS)
          .merge(
            Object.fromEntries(
              TELEMETRY_COUNTERS.map(c => [
                column(c),
                tx.raw('??.?? + excluded.??', [ROWS, column(c), column(c)]),
              ]),
            ),
          );
      }
      for (const u of users) {
        // Latest wins: a batch for an older day doesn't move last_seen back or replace the department.
        const newer = tx.raw('excluded.last_seen >= ??.last_seen', [USERS]);
        await tx(USERS)
          .insert({
            actor_kind: u.actorKind,
            actor: u.actor,
            department: u.department,
            last_seen: u.lastSeen,
          })
          .onConflict(['actor_kind', 'actor'])
          .merge({
            department: tx.raw(
              'CASE WHEN ? THEN COALESCE(excluded.department, ??.department) ELSE ??.department END',
              [newer, USERS, USERS],
            ),
            last_seen: tx.raw(
              'CASE WHEN ? THEN excluded.last_seen ELSE ??.last_seen END',
              [newer, USERS],
            ),
          });
      }
      await tx(META)
        .insert({ key: 'last_received_at', value: receivedAt })
        .onConflict('key')
        .merge({
          value: tx.raw(
            'CASE WHEN excluded.value > ??.value THEN excluded.value ELSE ??.value END',
            [META, META],
          ),
        });
    });
  }

  async records(day: string): Promise<TelemetryRow[]> {
    const rows = await this.knex(ROWS).where({ day });
    return rows.map(r => ({
      day: r.day,
      actorKind: r.actor_kind === 'api' ? 'api' : 'user',
      actor: r.actor,
      terminal: r.terminal,
      model: r.model,
      counters: Object.fromEntries(
        TELEMETRY_COUNTERS.filter(c => Number(r[column(c)]) !== 0).map(c => [
          c,
          Number(r[column(c)]),
        ]),
      ),
    }));
  }

  async users(): Promise<TelemetryUser[]> {
    const rows = await this.knex(USERS).orderBy('actor');
    return rows.map(u => ({
      actorKind: u.actor_kind === 'api' ? 'api' : 'user',
      actor: u.actor,
      department: u.department ?? null,
      lastSeen: u.last_seen,
    }));
  }

  async lastReceivedAt(): Promise<string | null> {
    const row = await this.knex(META)
      .where({ key: 'last_received_at' })
      .first();
    return row?.value ?? null;
  }

  async prune(beforeDay: string): Promise<void> {
    await this.knex(ROWS).where('day', '<', beforeDay).delete();
    await this.knex(USERS).where('last_seen', '<', beforeDay).delete();
  }
}
