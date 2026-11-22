import { describe, expect, it, vi } from "vitest";
import { buildUrl, dashboardUrl, DashboardError, getJson } from "./dashboard.js";

describe("dashboardUrl", () => {
  it("uses CLAUDE_METRICS_URL without a trailing slash, else localhost", () => {
    expect(dashboardUrl({ CLAUDE_METRICS_URL: "https://m.example.com/" })).toBe("https://m.example.com");
    expect(dashboardUrl({ CLAUDE_METRICS_URL: "" })).toBe("http://localhost:3000");
    expect(dashboardUrl({})).toBe("http://localhost:3000");
  });
});

describe("buildUrl", () => {
  it("adds set params and leaves out undefined and empty ones", () => {
    const url = new URL(buildUrl("http://localhost:3000", "users", { from: "2026-11-01", to: undefined, q: "", excludeWeekends: true, page: 2 }));
    expect(url.pathname).toBe("/api/users");
    expect(Object.fromEntries(url.searchParams)).toEqual({ from: "2026-11-01", excludeWeekends: "true", page: "2" });
  });

  it("keeps a path prefix on the base", () => {
    expect(buildUrl("https://example.com/metrics", "meta")).toBe("https://example.com/metrics/api/meta");
  });
});

const reply = (status: number, body: string) => vi.fn(async () => new Response(body, { status }));

describe("getJson", () => {
  it("returns parsed JSON", async () => {
    await expect(getJson("http://h", "meta", {}, reply(200, '{"dataSource":"mock"}'))).resolves.toEqual({ dataSource: "mock" });
  });

  it("surfaces the dashboard's error message with the status", async () => {
    const err = getJson("http://h", "cost", { from: "bad" }, reply(400, '{"statusCode":400,"message":"from must be YYYY-MM-DD"}'));
    await expect(err).rejects.toThrow(DashboardError);
    await expect(err).rejects.toThrow(/^400 from http:\/\/h\/api\/cost\?from=bad: from must be YYYY-MM-DD$/);
  });

  it("keeps a non-JSON error body", async () => {
    await expect(getJson("http://h", "meta", {}, reply(502, "Bad Gateway"))).rejects.toThrow(/502 .*: Bad Gateway/);
  });

  it("explains an unreachable dashboard", async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(getJson("http://h", "meta", {}, fetchFn)).rejects.toThrow(/Can't reach the Claude Metrics dashboard at http:\/\/h \(fetch failed\)/);
  });

  it("rejects a non-JSON 200", async () => {
    await expect(getJson("http://h", "meta", {}, reply(200, "<html>"))).rejects.toThrow(/didn't return JSON/);
  });
});
