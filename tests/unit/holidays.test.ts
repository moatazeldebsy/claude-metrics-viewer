import { describe, expect, it } from "vitest";
import { holidaysFor } from "#lib/holidays";

describe("holidaysFor", () => {
  it("includes public and bank holidays, not observances", () => {
    const de = holidaysFor("DE", [2026]);
    expect(de.has("2026-12-24")).toBe(true); // bank
    expect(de.has("2026-12-25")).toBe(true); // public
    expect(de.has("2026-12-06")).toBe(false); // observance (Advent)
  });

  it("supports a state suffix and ignores unknown countries", () => {
    expect(holidaysFor("US-CA", [2026]).has("2026-07-04")).toBe(true);
    expect(holidaysFor("ZZ", [2026]).size).toBe(0);
  });
});
