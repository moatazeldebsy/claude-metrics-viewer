import { describe, expect, it } from "vitest";
import type { ClaudeCodeRecord } from "#lib/anthropic-types";
import { acceptRate, actorLabel, aggregateClaudeCode, aggregateCost, idleSeats } from "#lib/aggregate";
import type { CostItem } from "#lib/sources/types";

function rec(day: string, email: string, over: Partial<{ sessions: number; added: number; edit: [number, number]; terminal: string; remote: boolean; cents: number; model: string }> = {}): ClaudeCodeRecord {
  const o = { sessions: 1, added: 10, edit: [4, 1] as [number, number], terminal: "vscode", remote: false, cents: 100, model: "claude-opus-5-5", ...over };
  const zero = { accepted: 0, rejected: 0 };
  return {
    date: `${day}T00:00:00Z`,
    actor: email.startsWith("bot:") ? { type: "api_actor", api_key_name: email.slice(4) } : { type: "user_actor", email_address: email },
    organization_id: "org",
    customer_type: "api",
    terminal_type: o.terminal,
    subscription_type: null,
    is_remote: o.remote,
    core_metrics: { num_sessions: o.sessions, lines_of_code: { added: o.added, removed: 2 }, commits_by_claude_code: 1, pull_requests_by_claude_code: 0 },
    tool_actions: { edit_tool: { accepted: o.edit[0], rejected: o.edit[1] }, multi_edit_tool: zero, write_tool: zero, notebook_edit_tool: zero },
    model_breakdown: [{ model: o.model, tokens: { input: 1000, output: 200, cache_read: 0, cache_creation: 0 }, estimated_cost: { currency: "USD", amount: o.cents } }],
  };
}

describe("acceptRate", () => {
  it("is null when nothing was proposed", () => {
    expect(acceptRate(0, 0)).toBeNull();
    expect(acceptRate(9, 1)).toBeCloseTo(0.9);
  });
});

describe("actorLabel", () => {
  it("uses email for users and key name for API actors", () => {
    expect(actorLabel({ type: "user_actor", email_address: "a@x.com" })).toBe("a@x.com");
    expect(actorLabel({ type: "api_actor", api_key_name: "ci" })).toBe("ci (API key)");
  });
});

describe("aggregateClaudeCode", () => {
  const days = [
    { day: "2026-11-02", records: [rec("2026-11-02", "a@x.com"), rec("2026-11-02", "a@x.com", { terminal: "remote", remote: true, sessions: 2 }), rec("2026-11-02", "b@x.com")] },
    { day: "2026-11-03", records: [rec("2026-11-03", "a@x.com", { edit: [0, 5] }), rec("2026-11-03", "bot:ci")] },
    { day: "2026-11-04", records: [] },
  ];
  const agg = aggregateClaudeCode(days);

  it("sums several records for one actor on one day and counts them as one active user", () => {
    expect(agg.daily[0]).toMatchObject({ day: "2026-11-02", activeUsers: 2, sessions: 4 });
    const a = agg.users.find((u) => u.label === "a@x.com")!;
    expect(a.sessions).toBe(4);
    expect(a.activeDays).toBe(2);
    expect(a.lastActive).toBe("2026-11-03");
  });

  it("keeps empty days in the series", () => {
    expect(agg.daily.map((d) => d.day)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(agg.daily[2]).toMatchObject({ activeUsers: 0, sessions: 0, acceptRate: null });
  });

  it("counts only human users in activeUsers totals and reports bots separately", () => {
    expect(agg.kpis.activeUsers).toBe(2);
    expect(agg.kpis.apiActors).toBe(1);
  });

  it("computes overall and per-tool accept rates", () => {
    // edits: 4+4+4 accepted, 1+1+1 rejected on day 1; 0/5 and 4/1 on day 2 => 16 / 25
    expect(agg.kpis.acceptRate).toBeCloseTo(16 / 25);
    const edit = agg.tools.find((t) => t.tool === "edit_tool")!;
    expect(edit).toMatchObject({ accepted: 16, rejected: 9 });
    expect(agg.tools.find((t) => t.tool === "write_tool")!.rate).toBeNull();
  });

  it("breaks down terminals and local vs remote", () => {
    expect(agg.terminals.find((t) => t.terminal === "remote")).toMatchObject({ sessions: 2, users: 1 });
    expect(agg.remoteSplit).toEqual({ localSessions: 4, remoteSessions: 2 });
  });

  it("totals cost and tokens per model; kpi totals equal the user table sums", () => {
    expect(agg.models).toEqual([{ model: "claude-opus-5-5", input: 5000, output: 1000, cacheRead: 0, cacheCreation: 0, costCents: 500 }]);
    const sum = (k: "linesAdded" | "costCents" | "commits") => agg.users.reduce((s, u) => s + u[k], 0);
    expect(agg.kpis.linesAdded).toBe(sum("linesAdded"));
    expect(agg.kpis.costCents).toBe(sum("costCents"));
    expect(agg.kpis.commits).toBe(sum("commits"));
  });
});

describe("aggregateCost", () => {
  const item = (model: string | null, amount: string): CostItem =>
    ({ starting_at: "", ending_at: "", group: { model }, cost: { amount, list_amount: amount, currency: "USD", requests: 1 } }) as unknown as CostItem;

  it("sums amounts by a dimension, largest first, labelling nulls", () => {
    expect(aggregateCost([item("a", "1.5"), item("b", "10"), item("a", "2"), item(null, "1")], "model")).toEqual([
      { key: "b", cents: 10 },
      { key: "a", cents: 3.5 },
      { key: "(none)", cents: 1 },
    ]);
  });
});

describe("idleSeats", () => {
  it("lists members with no Claude Code activity, case-insensitive", () => {
    const members = [
      { id: "1", email: "A@x.com", name: "A", role: "developer", added_at: "", department: null },
      { id: "2", email: "z@x.com", name: "Z", role: "developer", added_at: "", department: null },
    ];
    expect(idleSeats(members, ["a@x.com"]).map((m) => m.id)).toEqual(["2"]);
  });
});
