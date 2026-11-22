import { resolvePackagePath } from '@backstage/backend-plugin-api';
import {
  TELEMETRY_COUNTERS,
  type TelemetryBatch,
  type TelemetryCounter,
  type TelemetryRow,
  type TelemetryStore,
  type TelemetryUser,
} from '@internal/claude-metrics-lib/server';
import type { Knex } from 'knex';

const ROWS = 'claude_metrics_telemetry_rows';
const USERS = 'claude_metrics_telemetry_users';
const META = 'claude_metrics_telemetry_meta';
const KEY_COLUMNS = ['day', 'actor_kind', 'actor', 'terminal', 'model'];
const column = (c: TelemetryCounter) =>
  c.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);

/** TelemetryStore on the plugin's own database (SQLite in development, Postgres in production). */
export class KnexTelemetryStore implements TelemetryStore {
  static async create(knex: Knex): Promise<KnexTelemetryStore> {
    await knex.migrate.latest({
      directory: resolvePackagePath(
        '@internal/backstage-plugin-claude-metrics-backend',
        'migrations',
      ),
    });
    return new KnexTelemetryStore(knex);
  }

  private constructor(private readonly knex: Knex) {}

  async add(batch: TelemetryBatch, receivedAt: string): Promise<void> {
    await this.knex.transaction(async tx => {
      for (const r of batch.rows) {
        const counters = Object.fromEntries(
          TELEMETRY_COUNTERS.map(c => [column(c), r.counters[c] ?? 0]),
        );
        // Atomic increment: the database adds to the stored value, so concurrent batches can't lose updates.
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
      for (const u of batch.users) {
        const prev = await tx(USERS)
          .where({ actor_kind: u.actorKind, actor: u.actor })
          .first();
        const newer = !prev || u.lastSeen >= prev.last_seen;
        await tx(USERS)
          .insert({
            actor_kind: u.actorKind,
            actor: u.actor,
            department: newer
              ? u.department ?? prev?.department ?? null
              : prev.department,
            last_seen: newer ? u.lastSeen : prev.last_seen,
          })
          .onConflict(['actor_kind', 'actor'])
          .merge();
      }
      const prev = await tx(META).where({ key: 'last_received_at' }).first();
      if (!prev || receivedAt > prev.value) {
        await tx(META)
          .insert({ key: 'last_received_at', value: receivedAt })
          .onConflict('key')
          .merge();
      }
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
