import { describe, expect, it } from "vitest";
import { parseQuery, QueryError, selectedDays } from "#lib/query";

const p = (s: string) => parseQuery(new URLSearchParams(s), "2026-11-21");

describe("parseQuery", () => {
  it("defaults to the last 28 complete days", () => {
    expect(p("")).toMatchObject({ from: "2026-10-24", to: "2026-11-20", excludeWeekends: false, user: null });
  });

  it("with includeToday (live sources), defaults to the 28 days ending today and allows today", () => {
    const live = (q: string) => parseQuery(new URLSearchParams(q), "2026-11-21", { includeToday: true });
    expect(live("")).toMatchObject({ from: "2026-10-25", to: "2026-11-21" });
    expect(live("from=2026-11-21&to=2026-11-21")).toMatchObject({ from: "2026-11-21", to: "2026-11-21" });
    expect(() => live("to=2026-11-22")).toThrow("to can't be in the future");
    expect(() => p("to=2026-11-21")).toThrow(QueryError);
  });

  it("rejects bad input", () => {
    expect(() => p("from=nope")).toThrow(QueryError);
    expect(() => p("from=2026-11-10&to=2026-11-01")).toThrow(QueryError);
    expect(() => p("to=2026-11-21")).toThrow(QueryError);
    expect(() => p("from=2025-01-01&to=2026-11-20")).toThrow(QueryError);
  });

  it("applies weekend and holiday filters to the selected days", () => {
    const q = parseQuery(new URLSearchParams("from=2026-12-24&to=2026-12-28&excludeWeekends=true&excludeHolidays=true"), "2027-01-10");
    expect(selectedDays(q, "DE")).toEqual(["2026-12-28"]); // DE: 24th bank holiday, 25-26 public, 26-27 weekend
    expect(selectedDays(q, "US")).toEqual(["2026-12-24", "2026-12-28"]); // US: only the 25th
  });
});
