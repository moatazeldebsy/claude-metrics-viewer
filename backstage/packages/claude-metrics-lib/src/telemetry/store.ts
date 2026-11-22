import type { TelemetryBatch, TelemetryRow, TelemetryUser } from "./rows";

/**
 * Durable storage for daily telemetry totals. Hosts provide an implementation (SQLite in the
 * standalone app, Backstage's database in the plugin) and register it with registerTelemetryStore().
 */
export interface TelemetryStore {
  /** Add the batch's counters to the stored totals. Must not lose increments under concurrent calls. */
  add(batch: TelemetryBatch, receivedAt: string): Promise<void>;
  /** Summed rows for one UTC day, one per key. */
  records(day: string): Promise<TelemetryRow[]>;
  /** Every actor seen, with the latest department reported and the last day seen. */
  users(): Promise<TelemetryUser[]>;
  /** ISO time of the last accepted batch, or null if nothing has arrived yet. */
  lastReceivedAt(): Promise<string | null>;
  /** Delete rows with day < beforeDay and users last seen before it. */
  prune(beforeDay: string): Promise<void>;
}

const rowKey = (r: TelemetryRow) => JSON.stringify([r.day, r.actorKind, r.actor, r.terminal, r.model]);
const userKey = (u: TelemetryUser) => `${u.actorKind}:${u.actor}`;

/** In-memory store, for tests and short-lived experiments. */
export class MemoryTelemetryStore implements TelemetryStore {
  private rows = new Map<string, TelemetryRow>();
  private people = new Map<string, TelemetryUser>();
  private received: string | null = null;

  async add(batch: TelemetryBatch, receivedAt: string): Promise<void> {
    for (const r of batch.rows) {
      const key = rowKey(r);
      const cur = this.rows.get(key) ?? { ...r, counters: {} };
      for (const [k, v] of Object.entries(r.counters)) {
        const c = k as keyof TelemetryRow["counters"];
        cur.counters[c] = (cur.counters[c] ?? 0) + (v ?? 0);
      }
      this.rows.set(key, cur);
    }
    for (const u of batch.users) {
      const prev = this.people.get(userKey(u));
      if (!prev || u.lastSeen >= prev.lastSeen) this.people.set(userKey(u), { ...u, department: u.department ?? prev?.department ?? null });
    }
    if (!this.received || receivedAt > this.received) this.received = receivedAt;
  }

  async records(day: string): Promise<TelemetryRow[]> {
    return [...this.rows.values()].filter((r) => r.day === day).map((r) => ({ ...r, counters: { ...r.counters } }));
  }

  async users(): Promise<TelemetryUser[]> {
    return [...this.people.values()].map((u) => ({ ...u }));
  }

  async lastReceivedAt(): Promise<string | null> {
    return this.received;
  }

  async prune(beforeDay: string): Promise<void> {
    for (const [k, r] of this.rows) if (r.day < beforeDay) this.rows.delete(k);
    for (const [k, u] of this.people) if (u.lastSeen < beforeDay) this.people.delete(k);
  }
}
