import { describe, expect, it } from "vitest";
import { MockSource } from "@/lib/sources/mock";

const src = new MockSource();

describe("MockSource.claudeCodeDay", () => {
  it("is deterministic for the same day", async () => {
    expect(await src.claudeCodeDay("2026-11-03")).toEqual(await new MockSource().claudeCodeDay("2026-11-03"));
  });

  it("returns records in the real API shape", async () => {
    const recs = await src.claudeCodeDay("2026-11-03"); // a Tuesday
    expect(recs.length).toBeGreaterThan(5);
    const r = recs[0];
    expect(r.date).toBe("2026-11-03T00:00:00Z");
    expect(["user_actor", "api_actor"]).toContain(r.actor.type);
    expect(r.core_metrics.lines_of_code.added).toBeGreaterThanOrEqual(0);
    expect(r.tool_actions.edit_tool).toHaveProperty("accepted");
    expect(r.model_breakdown[0].estimated_cost.currency).toBe("USD");
  });

  it("has less activity on weekends", async () => {
    const weekday = await src.claudeCodeDay("2026-11-04");
    const sunday = await src.claudeCodeDay("2026-11-08");
    expect(sunday.length).toBeLessThan(weekday.length);
  });

  it("can emit several records for one actor on one day", async () => {
    let found = false;
    for (let d = 1; d <= 20 && !found; d++) {
      const recs = await src.claudeCodeDay(`2026-11-${String(d).padStart(2, "0")}`);
      const ids = recs.map((r) => JSON.stringify(r.actor));
      found = new Set(ids).size < ids.length;
    }
    expect(found).toBe(true);
  });
});

describe("MockSource.cost", () => {
  it("groups by the requested dimension and nulls the rest", async () => {
    const rows = await src.cost({ from: "2026-11-01", to: "2026-11-07", groupBy: ["model"] });
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) {
      expect(r.group.model).not.toBeNull();
      expect(r.group.workspace_id).toBeNull();
      expect(typeof r.cost.amount).toBe("string");
    }
  });

  it("totals match across different groupings", async () => {
    const q = { from: "2026-11-01", to: "2026-11-07" };
    const sum = (rows: { cost: { amount: string } }[]) => rows.reduce((a, r) => a + Number(r.cost.amount), 0);
    const byModel = sum(await src.cost({ ...q, groupBy: ["model"] }));
    const byWs = sum(await src.cost({ ...q, groupBy: ["workspace_id"] }));
    expect(byModel).toBeCloseTo(byWs, 2);
  });

  it("returns one row per day per group when daily", async () => {
    const rows = await src.cost({ from: "2026-11-01", to: "2026-11-03", groupBy: [], daily: true });
    expect(rows.map((r) => r.starting_at)).toEqual([
      "2026-11-01T00:00:00Z",
      "2026-11-02T00:00:00Z",
      "2026-11-03T00:00:00Z",
    ]);
  });
});

describe("MockSource.members", () => {
  it("includes members who never use Claude Code", async () => {
    const members = await src.members();
    expect(members.length).toBeGreaterThanOrEqual(25);
    expect(members.every((m) => m.email.includes("@"))).toBe(true);
  });
});
