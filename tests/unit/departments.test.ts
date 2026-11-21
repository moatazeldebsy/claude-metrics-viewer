import { describe, expect, it } from "vitest";
import { parseDepartmentsCsv } from "#lib/departments";

describe("parseDepartmentsCsv", () => {
  it("skips the header and blanks, lowercases emails, keeps commas in quoted names", () => {
    const m = parseDepartmentsCsv('email,department\nAda@X.com,Platform\n\nben@x.com,"Research, Applied"\nnot-an-email,Foo\n');
    expect([...m]).toEqual([
      ["ada@x.com", "Platform"],
      ["ben@x.com", "Research, Applied"],
    ]);
  });
});
