import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeOtlpJson, type AttrValue, type OtlpPoint } from "#lib/telemetry/otlp";
import { CumulativeTemporalityError, toTelemetryBatch } from "#lib/telemetry/rows";

const fixture = decodeOtlpJson(readFileSync("tests/fixtures/otlp/claude-code-metrics.json", "utf8"));
const DAY_NS = BigInt(Date.UTC(2026, 10, 22)) * 1_000_000n; // 2026-11-22T00:00:00Z

const point = (metric: string, value: number, attributes: Record<string, AttrValue> = {}, extra: Partial<OtlpPoint> = {}): OtlpPoint => ({
  metric,
  kind: "sum",
  temporality: "delta",
  timeUnixNano: DAY_NS + 3_600_000_000_000n,
  value,
  attributes: { "user.email": "ada@example.test", "user.id": "u1", "terminal.type": "vscode", ...attributes },
  resource: {},
  ...extra,
});

describe("toTelemetryBatch", () => {
  it("caps over-long values at the stores' column sizes, so one bad attribute can't fail every batch", () => {
    const long = (n: number) => "x".repeat(n);
    const { rows, users } = toTelemetryBatch([
      point("claude_code.session.count", 1, { "user.email": `${long(400)}@example.test`, "terminal.type": long(200), model: long(200), department: long(300) }),
    ]);
    expect([rows[0]!.actor.length, rows[0]!.terminal.length, rows[0]!.model.length]).toEqual([320, 128, 128]);
    expect(users[0]!.department).toHaveLength(256);
  });

  it("maps the fixture to the recorded totals", () => {
    const { rows, users } = toTelemetryBatch(fixture);
    const sum = (k: string) => rows.reduce((s, r) => s + ((r.counters as Record<string, number>)[k] ?? 0), 0);
    expect(rows.every((r) => r.day === "2026-11-22" && r.actor === "ada.lovela@example.test" && r.actorKind === "user" && r.terminal === "vscode")).toBe(true);
    expect(sum("sessions")).toBe(1);
    expect(sum("costUsd")).toBeCloseTo(0.2046018, 7);
    expect([sum("tokensInput"), sum("tokensOutput"), sum("tokensCacheRead"), sum("tokensCacheCreation")]).toEqual([2, 4, 9449, 25328]);
    expect(sum("activeSecondsCli")).toBeCloseTo(2.577, 3);
    expect(rows.find((r) => r.counters.tokensInput)!.model).toBe("claude-opus-5-5");
    expect(rows.find((r) => r.counters.sessions)!.model).toBe("");
    expect(users).toEqual([{ actorKind: "user", actor: "ada.lovela@example.test", department: null, lastSeen: "2026-11-22" }]);
  });

  it("maps lines, commits, PRs and edit decisions", () => {
    const { rows } = toTelemetryBatch([
      point("claude_code.lines_of_code.count", 10, { type: "added", model: "m" }),
      point("claude_code.lines_of_code.count", 4, { type: "removed", model: "m" }),
      point("claude_code.commit.count", 2),
      point("claude_code.pull_request.count", 1),
      point("claude_code.code_edit_tool.decision", 3, { tool_name: "Edit", decision: "accept" }),
      point("claude_code.code_edit_tool.decision", 1, { tool_name: "Write", decision: "reject" }),
      point("claude_code.code_edit_tool.decision", 5, { tool_name: "NotebookEdit", decision: "accept" }),
      point("claude_code.code_edit_tool.decision", 9, { tool_name: "Bash", decision: "accept" }),
    ]);
    const all = Object.assign({}, ...rows.map((r) => r.counters));
    expect(all).toMatchObject({ linesAdded: 10, linesRemoved: 4, commits: 2, prs: 1, editAccepted: 3, writeRejected: 1, notebookAccepted: 5 });
    expect(Object.keys(all)).not.toContain("bash");
  });

  it("turns a user with no email into an api actor with a stable user-<hash> name", () => {
    const a = toTelemetryBatch([point("claude_code.session.count", 1, { "user.email": undefined as never, "user.id": "abc123" })]);
    const b = toTelemetryBatch([point("claude_code.session.count", 1, { "user.email": undefined as never, "user.id": "abc123" })]);
    expect(a.rows[0]!.actorKind).toBe("api");
    expect(a.rows[0]!.actor).toMatch(/^user-[0-9a-f]{10}$/);
    expect(a.rows[0]!.actor).toBe(b.rows[0]!.actor);
    expect(a.rows[0]!.actor).not.toContain("abc123");
  });

  it("throws CumulativeTemporalityError for cumulative sums", () => {
    expect(() => toTelemetryBatch([point("claude_code.session.count", 1, {}, { temporality: "cumulative" })])).toThrow(CumulativeTemporalityError);
  });

  it("ignores non-claude metrics and gauges", () => {
    const { rows, users } = toTelemetryBatch([
      point("http.server.duration", 5),
      point("claude_code.session.count", 1, {}, { kind: "gauge" }),
    ]);
    expect(rows).toEqual([]);
    expect(users).toEqual([]);
  });

  it("splits points across a UTC midnight into two days", () => {
    const { rows } = toTelemetryBatch([
      point("claude_code.session.count", 1, {}, { timeUnixNano: DAY_NS - 1_000_000_000n }),
      point("claude_code.session.count", 1, {}, { timeUnixNano: DAY_NS + 1_000_000_000n }),
    ]);
    expect(rows.map((r) => r.day).sort()).toEqual(["2026-11-21", "2026-11-22"]);
  });

  it("takes the department from resource attributes", () => {
    const { users } = toTelemetryBatch([point("claude_code.session.count", 1, {}, { resource: { department: "Platform" } })]);
    expect(users[0]!.department).toBe("Platform");
  });
});
