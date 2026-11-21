import { describe, expect, it } from "vitest";
import { addDays, eachDay, filterDays, isWeekend, splitRange } from "#lib/dates";

describe("dates", () => {
  it("addDays crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("eachDay is inclusive", () => {
    expect(eachDay("2026-11-01", "2026-11-03")).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(eachDay("2026-11-03", "2026-11-01")).toEqual([]);
  });

  it("isWeekend uses UTC", () => {
    expect(isWeekend("2026-11-21")).toBe(true); // Saturday
    expect(isWeekend("2026-11-23")).toBe(false); // Monday
  });

  it("splitRange makes chunks of at most N days that cover the range exactly", () => {
    const chunks = splitRange("2026-01-01", "2026-03-15", 31);
    expect(chunks).toEqual([
      { from: "2026-01-01", to: "2026-01-31" },
      { from: "2026-02-01", to: "2026-03-03" },
      { from: "2026-03-04", to: "2026-03-15" },
    ]);
    expect(splitRange("2026-01-01", "2026-01-01", 31)).toEqual([{ from: "2026-01-01", to: "2026-01-01" }]);
  });

  it("filterDays drops weekends and holidays only when asked", () => {
    const days = eachDay("2026-12-24", "2026-12-28"); // Thu..Mon
    const holidays = ["2026-12-25"];
    expect(filterDays(days, { holidays })).toEqual(days);
    expect(filterDays(days, { excludeWeekends: true })).toEqual(["2026-12-24", "2026-12-25", "2026-12-28"]);
    expect(filterDays(days, { excludeWeekends: true, excludeHolidays: true, holidays })).toEqual([
      "2026-12-24",
      "2026-12-28",
    ]);
  });
});
