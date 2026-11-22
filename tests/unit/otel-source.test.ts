import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { aggregateClaudeCode } from "#lib/aggregate";
import { getSource, registerTelemetryStore, sourceCapabilities, telemetryStatus, dataSourceName } from "#lib/sources";
import { AnthropicSource } from "#lib/sources/anthropic";
import { MockSource } from "#lib/sources/mock";
import { OtelSource } from "#lib/sources/otel";
import { decodeOtlpJson } from "#lib/telemetry/otlp";
import { toTelemetryBatch, type TelemetryBatch } from "#lib/telemetry/rows";
import { MemoryTelemetryStore } from "#lib/telemetry/store";

const fixtureBatch = toTelemetryBatch(decodeOtlpJson(readFileSync("tests/fixtures/otlp/claude-code-metrics.json", "utf8")));
const DAY = "2026-11-22";
const row = (actor: string, counters: TelemetryBatch["rows"][number]["counters"], model = "", day = DAY): TelemetryBatch["rows"][number] =>
  ({ day, actorKind: "user", actor, terminal: "vscode", model, counters });
const user = (actor: string, department: string | null = null, lastSeen = DAY) => ({ actorKind: "user" as const, actor, department, lastSeen });

afterEach(() => {
  delete process.env.DATA_SOURCE;
  registerTelemetryStore(undefined);
});

describe("OtelSource", () => {
  it("builds records that aggregateClaudeCode turns into the expected KPIs", async () => {
    const store = new MemoryTelemetryStore();
    await store.add(fixtureBatch, "2026-11-22T10:00:00Z");
    await store.add({
      rows: [row("ada.lovela@example.test", { linesAdded: 10, linesRemoved: 2, commits: 1, prs: 1, editAccepted: 3, editRejected: 1 })],
      users: [],
    }, "2026-11-22T10:01:00Z");
    const src = new OtelSource(store, new Map());
    const records = await src.claudeCodeDay(DAY);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ customer_type: "subscription", terminal_type: "vscode", actor: { type: "user_actor", email_address: "ada.lovela@example.test" } });
    const { kpis } = aggregateClaudeCode([{ day: DAY, records }]);
    expect(kpis).toMatchObject({ activeUsers: 1, sessions: 1, linesAdded: 10, linesRemoved: 2, commits: 1, prs: 1, costCents: 20, acceptRate: 0.75 });
  });

  it("gives one model_breakdown entry per model with tokens by type", async () => {
    const store = new MemoryTelemetryStore();
    await store.add({ rows: [
      row("a@x.test", { tokensInput: 5, tokensOutput: 7, costUsd: 0.5 }, "opus"),
      row("a@x.test", { tokensInput: 1, tokensCacheRead: 9 }, "haiku"),
      row("a@x.test", { sessions: 1 }),
    ], users: [user("a@x.test")] }, "t");
    const [rec] = await new OtelSource(store, new Map()).claudeCodeDay(DAY);
    expect(rec!.model_breakdown.sort((x, y) => x.model.localeCompare(y.model))).toEqual([
      { model: "haiku", tokens: { input: 1, output: 0, cache_read: 9, cache_creation: 0 }, estimated_cost: { currency: "USD", amount: 0 } },
      { model: "opus", tokens: { input: 5, output: 7, cache_read: 0, cache_creation: 0 }, estimated_cost: { currency: "USD", amount: 50 } },
    ]);
    expect(rec!.tool_actions.multi_edit_tool).toEqual({ accepted: 0, rejected: 0 });
  });

  it("members: the CSV wins over telemetry departments, and telemetry fills users the CSV lacks", async () => {
    const store = new MemoryTelemetryStore();
    await store.add({ rows: [], users: [user("ada@x.test", "Telemetry"), user("ben@x.test", "Data"), { actorKind: "api", actor: "user-0123456789", department: null, lastSeen: DAY }] }, "t");
    const csv = new Map([["ada@x.test", "Platform"], ["cy@x.test", "Design"]]);
    const members = await new OtelSource(store, csv).members();
    const byEmail = Object.fromEntries(members.map((m) => [m.email, m.department]));
    expect(byEmail).toEqual({ "ada@x.test": "Platform", "cy@x.test": "Design", "ben@x.test": "Data" });
    const noCsv = await new OtelSource(store, new Map()).members();
    expect(Object.fromEntries(noCsv.map((m) => [m.email, m.department]))).toEqual({ "ada@x.test": "Telemetry", "ben@x.test": "Data" });
  });

  it("reports seats only when a CSV is configured", () => {
    const store = new MemoryTelemetryStore();
    expect(new OtelSource(store, new Map()).capabilities()).toEqual({ billedCost: false, seats: false, rawUpstream: false, remoteSplit: false, includesToday: true });
    expect(new OtelSource(store, new Map([["a@x.test", "D"]])).capabilities().seats).toBe(true);
  });

  it("returns no cost rows", async () => {
    expect(await new OtelSource(new MemoryTelemetryStore(), new Map()).cost({ from: DAY, to: DAY, groupBy: ["model"] })).toEqual([]);
  });
});

describe("MemoryTelemetryStore", () => {
  it("loses no increments under concurrent add calls", async () => {
    const store = new MemoryTelemetryStore();
    await Promise.all(Array.from({ length: 100 }, () => store.add({ rows: [row("a@x.test", { sessions: 1 })], users: [user("a@x.test")] }, "t")));
    expect((await store.records(DAY))[0]!.counters.sessions).toBe(100);
  });

  it("prunes old rows and users", async () => {
    const store = new MemoryTelemetryStore();
    await store.add({ rows: [row("old@x.test", { sessions: 1 }, "", "2025-01-01"), row("new@x.test", { sessions: 1 })], users: [user("old@x.test", null, "2025-01-01"), user("new@x.test")] }, "2026-11-22T00:00:00Z");
    await store.prune("2026-01-01");
    expect(await store.records("2025-01-01")).toEqual([]);
    expect((await store.users()).map((u) => u.actor)).toEqual(["new@x.test"]);
    expect(await store.lastReceivedAt()).toBe("2026-11-22T00:00:00Z");
  });
});

describe("source wiring", () => {
  it("throws a clear error for DATA_SOURCE=otel without a store", () => {
    process.env.DATA_SOURCE = "otel";
    registerTelemetryStore(undefined);
    expect(() => getSource()).toThrow("DATA_SOURCE=otel needs a telemetry store; the host didn't register one.");
  });

  it("serves the registered store for DATA_SOURCE=otel", async () => {
    process.env.DATA_SOURCE = "otel";
    const store = new MemoryTelemetryStore();
    registerTelemetryStore(store);
    expect(dataSourceName()).toBe("otel");
    expect(getSource()).toBeInstanceOf(OtelSource);
    expect(sourceCapabilities().billedCost).toBe(false);
    expect(await telemetryStatus()).toEqual({ lastReceivedAt: null });
  });

  it("mock and anthropic sources report every capability", async () => {
    const all = { billedCost: true, seats: true, rawUpstream: true, remoteSplit: true, includesToday: false };
    expect(new MockSource().capabilities()).toEqual(all);
    expect(new AnthropicSource("sk-ant-admin-test").capabilities()).toEqual(all);
    registerTelemetryStore(undefined);
    expect(await telemetryStatus()).toBeNull();
  });
});
