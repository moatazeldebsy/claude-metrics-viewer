import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TelemetryBatch } from "#lib/telemetry/rows";
import { SqliteTelemetryStore } from "../../server/utils/sqlite-telemetry-store";

const DAY = "2026-11-22";
const row = (actor: string, counters: TelemetryBatch["rows"][number]["counters"], model = "", day = DAY): TelemetryBatch["rows"][number] =>
  ({ day, actorKind: "user", actor, terminal: "vscode", model, counters });
const user = (actor: string, department: string | null = null, lastSeen = DAY) => ({ actorKind: "user" as const, actor, department, lastSeen });

let dir: string;
let file: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "telemetry-"));
  file = join(dir, "nested", "telemetry.db");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("SqliteTelemetryStore", () => {
  it("sums rows per key and returns them per day", async () => {
    const store = new SqliteTelemetryStore(file);
    await store.add({ rows: [row("a@x.test", { sessions: 1, costUsd: 0.25 }), row("a@x.test", { tokensInput: 5 }, "opus")], users: [user("a@x.test")] }, "2026-11-22T10:00:00.000Z");
    await store.add({ rows: [row("a@x.test", { sessions: 2, costUsd: 0.5 })], users: [] }, "2026-11-22T11:00:00.000Z");
    const rows = await store.records(DAY);
    const plain = rows.find((r) => r.model === "")!;
    expect(plain.counters.sessions).toBe(3);
    expect(plain.counters.costUsd).toBeCloseTo(0.75);
    expect(rows.find((r) => r.model === "opus")!.counters.tokensInput).toBe(5);
    expect(await store.records("2026-11-21")).toEqual([]);
    expect(await store.lastReceivedAt()).toBe("2026-11-22T11:00:00.000Z");
  });

  it("keeps the latest department and last-seen day per user", async () => {
    const store = new SqliteTelemetryStore(file);
    await store.add({ rows: [], users: [user("a@x.test", "Data", "2026-11-20")] }, "t1");
    await store.add({ rows: [], users: [user("a@x.test", "Platform", "2026-11-22")] }, "t2");
    await store.add({ rows: [], users: [user("a@x.test", "Old", "2026-11-01")] }, "t3");
    await store.add({ rows: [], users: [user("a@x.test", null, "2026-11-22")] }, "t4");
    expect(await store.users()).toEqual([user("a@x.test", "Platform", "2026-11-22")]);
  });

  it("loses no increments under concurrent add calls", async () => {
    const store = new SqliteTelemetryStore(file);
    await Promise.all(Array.from({ length: 100 }, () => store.add({ rows: [row("a@x.test", { sessions: 1 })], users: [user("a@x.test")] }, "t")));
    expect((await store.records(DAY))[0]!.counters.sessions).toBe(100);
  });

  it("prunes old rows and users", async () => {
    const store = new SqliteTelemetryStore(file);
    await store.add({ rows: [row("old@x.test", { sessions: 1 }, "", "2025-01-01"), row("new@x.test", { sessions: 1 })], users: [user("old@x.test", null, "2025-01-01"), user("new@x.test")] }, "t");
    await store.prune("2026-01-01");
    expect(await store.records("2025-01-01")).toEqual([]);
    expect((await store.users()).map((u) => u.actor)).toEqual(["new@x.test"]);
  });

  it("survives reopening the file", async () => {
    const first = new SqliteTelemetryStore(file);
    await first.add({ rows: [row("a@x.test", { commits: 2 })], users: [user("a@x.test")] }, "2026-11-22T10:00:00.000Z");
    first.close();
    const second = new SqliteTelemetryStore(file);
    expect((await second.records(DAY))[0]!.counters.commits).toBe(2);
    expect(await second.lastReceivedAt()).toBe("2026-11-22T10:00:00.000Z");
  });
});
