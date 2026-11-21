import { describe, expect, it } from "vitest";
import type { UserRow } from "#lib/aggregate";
import { weekStart } from "#lib/dates";
import { aggregateDepartments, engagementTier } from "#lib/departments-agg";
import type { Member } from "#lib/sources/types";
import { pageUsers, searchUsers } from "#lib/users";

const member = (email: string, department: string | null): Member => ({ id: email, email, name: email.split("@")[0], role: "developer", added_at: "", department });
const user = (label: string, activeDays: number, over: Partial<UserRow> = {}): UserRow => ({
  label, type: "user_actor", sessions: 10, linesAdded: 100, linesRemoved: 10, commits: 2, prs: 1, accepted: 8, rejected: 2,
  acceptRate: 0.8, costCents: 500, activeDays, lastActive: "2026-11-10", ...over,
});

describe("weekStart", () => {
  it("returns the Monday of the UTC week", () => {
    expect(weekStart("2026-11-19")).toBe("2026-11-16"); // Thursday
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday
  });
});

describe("engagementTier", () => {
  it("buckets by share of selected days active", () => {
    expect(engagementTier(12, 20)).toBe("power");
    expect(engagementTier(5, 20)).toBe("regular");
    expect(engagementTier(4, 20)).toBe("light");
  });
});

describe("aggregateDepartments", () => {
  const members = [member("a@x.com", "Platform"), member("b@x.com", "Platform"), member("c@x.com", "Design"), member("d@x.com", null)];
  const users = [user("a@x.com", 15), user("c@x.com", 2), user("ghost@x.com", 1), user("ci (API key)", 20, { type: "api_actor" })];
  const days = [
    { day: "2026-11-16", records: [] },
    { day: "2026-11-23", records: [] },
  ];
  const activeByDay = new Map([
    ["2026-11-16", new Set(["a@x.com", "c@x.com"])],
    ["2026-11-23", new Set(["a@x.com"])],
  ]);
  const agg = aggregateDepartments(members, users, days.map((d) => d.day), activeByDay, 20);
  const row = (d: string) => agg.rows.find((r) => r.department === d)!;

  it("computes seats, active users and adoption per department, ignoring API actors", () => {
    expect(row("Platform")).toMatchObject({ seats: 2, activeUsers: 1, adoption: 0.5, costCents: 500, costPerActive: 500 });
    expect(row("Design")).toMatchObject({ seats: 1, activeUsers: 1, adoption: 1 });
    expect(agg.rows.some((r) => r.department.includes("API"))).toBe(false);
  });

  it("puts unmapped members and unknown users in Unassigned", () => {
    expect(row("Unassigned")).toMatchObject({ seats: 2, activeUsers: 1 });
  });

  it("sorts by adoption, lowest first, so laggards surface", () => {
    expect(agg.rows.map((r) => r.department)).toEqual(["Platform", "Unassigned", "Design"]);
  });

  it("splits engagement tiers including inactive seats", () => {
    expect(row("Platform").tiers).toEqual({ power: 1, regular: 0, light: 0, inactive: 1 });
    expect(row("Design").tiers).toEqual({ power: 0, regular: 0, light: 1, inactive: 0 });
  });

  it("reports org totals", () => {
    expect(agg.totals).toMatchObject({ seats: 5, activeUsers: 3, departments: 3 });
  });

  it("builds a weekly adoption trend per department", () => {
    expect(agg.weekly).toEqual([
      { week: "2026-11-16", Platform: 0.5, Design: 1, Unassigned: 0 },
      { week: "2026-11-23", Platform: 0.5, Design: 0, Unassigned: 0 },
    ]);
  });
});

describe("aggregateDepartments weekly trend", () => {
  it("keeps only complete weeks inside the range when there is at least one", () => {
    const days = ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"];
    const agg = aggregateDepartments([member("a@x.com", "Eng")], [], days, new Map(), days.length, { from: "2026-11-14", to: "2026-11-23" });
    expect(agg.weekly.map((w) => w.week)).toEqual(["2026-11-16"]);
  });

  it("falls back to partial weeks for short ranges", () => {
    const days = ["2026-11-18", "2026-11-19"];
    const agg = aggregateDepartments([member("a@x.com", "Eng")], [], days, new Map(), 2, { from: "2026-11-18", to: "2026-11-19" });
    expect(agg.weekly.map((w) => w.week)).toEqual(["2026-11-16"]);
  });
});

describe("searchUsers", () => {
  const members = Array.from({ length: 500 }, (_, i) => member(`user${i}@x.com`, "Eng"));
  it("caps results and ranks prefix matches first", () => {
    const res = searchUsers(members, ["ci-bot (API key)"], "user1", 20);
    expect(res).toHaveLength(20);
    expect(res[0].value).toBe("user1@x.com");
  });
  it("matches names and API actors case-insensitively", () => {
    expect(searchUsers(members, ["ci-bot (API key)"], "CI-B", 20).map((r) => r.value)).toEqual(["ci-bot (API key)"]);
  });
  it("returns nothing for an empty query", () => {
    expect(searchUsers(members, [], "  ", 20)).toEqual([]);
  });
});

describe("pageUsers", () => {
  const rows = Array.from({ length: 60 }, (_, i) => user(`u${String(i).padStart(2, "0")}@x.com`, 1, { sessions: i }));
  it("sorts, filters and pages", () => {
    const p = pageUsers(rows, { q: "", sort: "sessions", desc: true, page: 2, pageSize: 25 });
    expect(p.total).toBe(60);
    expect(p.rows[0].sessions).toBe(34);
    expect(p.rows).toHaveLength(25);
    expect(pageUsers(rows, { q: "u5", sort: "label", desc: false, page: 1, pageSize: 25 }).rows.map((r) => r.label)).toEqual(
      Array.from({ length: 10 }, (_, i) => `u5${i}@x.com`),
    );
  });
  it("clamps a page past the end to the last page", () => {
    expect(pageUsers(rows, { q: "", sort: "sessions", desc: true, page: 99, pageSize: 25 })).toMatchObject({ page: 3, total: 60 });
  });
});
