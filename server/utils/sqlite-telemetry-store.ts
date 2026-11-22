// Durable TelemetryStore for the standalone app: one SQLite file through Node's built-in node:sqlite.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TELEMETRY_COUNTERS, type TelemetryBatch, type TelemetryCounter, type TelemetryRow, type TelemetryUser } from "#lib/telemetry/rows";
import type { TelemetryStore } from "#lib/telemetry/store";

const KEY_COLUMNS = ["day", "actor_kind", "actor", "terminal", "model"] as const;
const column = (c: TelemetryCounter) => c.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);

export class SqliteTelemetryStore implements TelemetryStore {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS telemetry_rows (
        ${KEY_COLUMNS.map((k) => `${k} TEXT NOT NULL`).join(", ")},
        ${TELEMETRY_COUNTERS.map((c) => `${column(c)} REAL NOT NULL DEFAULT 0`).join(", ")},
        PRIMARY KEY (${KEY_COLUMNS.join(", ")})
      );
      CREATE TABLE IF NOT EXISTS telemetry_users (
        actor_kind TEXT NOT NULL, actor TEXT NOT NULL, department TEXT, last_seen TEXT NOT NULL,
        PRIMARY KEY (actor_kind, actor)
      );
      CREATE TABLE IF NOT EXISTS telemetry_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `);
  }

  async add(batch: TelemetryBatch, receivedAt: string): Promise<void> {
    const cols = TELEMETRY_COUNTERS.map(column);
    const upsertRow = this.db.prepare(`
      INSERT INTO telemetry_rows (${[...KEY_COLUMNS, ...cols].join(", ")})
      VALUES (${[...KEY_COLUMNS, ...cols].map(() => "?").join(", ")})
      ON CONFLICT (${KEY_COLUMNS.join(", ")}) DO UPDATE SET ${cols.map((c) => `${c} = ${c} + excluded.${c}`).join(", ")}
    `);
    const upsertUser = this.db.prepare(`
      INSERT INTO telemetry_users (actor_kind, actor, department, last_seen) VALUES (?, ?, ?, ?)
      ON CONFLICT (actor_kind, actor) DO UPDATE SET
        department = CASE WHEN excluded.last_seen >= last_seen THEN COALESCE(excluded.department, department) ELSE department END,
        last_seen = MAX(last_seen, excluded.last_seen)
    `);
    const setReceived = this.db.prepare(`
      INSERT INTO telemetry_meta (key, value) VALUES ('last_received_at', ?)
      ON CONFLICT (key) DO UPDATE SET value = MAX(value, excluded.value)
    `);
    this.db.exec("BEGIN");
    try {
      for (const r of batch.rows) {
        upsertRow.run(r.day, r.actorKind, r.actor, r.terminal, r.model, ...TELEMETRY_COUNTERS.map((c) => r.counters[c] ?? 0));
      }
      for (const u of batch.users) upsertUser.run(u.actorKind, u.actor, u.department, u.lastSeen);
      setReceived.run(receivedAt);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  async records(day: string): Promise<TelemetryRow[]> {
    const rows = this.db.prepare("SELECT * FROM telemetry_rows WHERE day = ?").all(day) as Record<string, string | number>[];
    return rows.map((r) => ({
      day: String(r.day),
      actorKind: r.actor_kind === "api" ? "api" : "user",
      actor: String(r.actor),
      terminal: String(r.terminal),
      model: String(r.model),
      counters: Object.fromEntries(TELEMETRY_COUNTERS.filter((c) => Number(r[column(c)]) !== 0).map((c) => [c, Number(r[column(c)])])),
    }));
  }

  async users(): Promise<TelemetryUser[]> {
    const rows = this.db.prepare("SELECT * FROM telemetry_users ORDER BY actor").all() as Record<string, string | null>[];
    return rows.map((u) => ({
      actorKind: u.actor_kind === "api" ? "api" : "user",
      actor: String(u.actor),
      department: u.department ?? null,
      lastSeen: String(u.last_seen),
    }));
  }

  async lastReceivedAt(): Promise<string | null> {
    const row = this.db.prepare("SELECT value FROM telemetry_meta WHERE key = 'last_received_at'").get() as { value: string } | undefined;
    return row?.value ?? null;
  }

  async prune(beforeDay: string): Promise<void> {
    this.db.prepare("DELETE FROM telemetry_rows WHERE day < ?").run(beforeDay);
    this.db.prepare("DELETE FROM telemetry_users WHERE last_seen < ?").run(beforeDay);
  }

  close(): void {
    this.db.close();
  }
}
