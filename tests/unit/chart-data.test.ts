import { describe, expect, it } from "vitest";
import { isolatedPointRadius, modelCostRows } from "#lib/chart-data";

describe("isolatedPointRadius", () => {
  it("gives a dot only to values with no value on either side, so a lone day stays visible", () => {
    expect(isolatedPointRadius([null, null, 1])).toEqual([0, 0, 3]);
    expect(isolatedPointRadius([1, null, 0.5, null])).toEqual([3, 0, 3, 0]);
    expect(isolatedPointRadius([null, 1, 1, null])).toEqual([0, 0, 0, 0]);
    expect(isolatedPointRadius([0.5])).toEqual([3]);
    expect(isolatedPointRadius([])).toEqual([]);
  });
});

describe("modelCostRows", () => {
  it("fills days a model wasn't used with 0, so the daily cost line reaches today", () => {
    const daily = [
      { day: "2026-11-21", modelCost: {} },
      { day: "2026-11-22", modelCost: { opus: 23 } },
    ];
    expect(modelCostRows(daily, ["opus", "sonnet"])).toEqual([
      { day: "2026-11-21", opus: 0, sonnet: 0 },
      { day: "2026-11-22", opus: 23, sonnet: 0 },
    ]);
  });
});
