// Runs the built server (dist/index.js) over stdio against a live dashboard.
// Start one on mock data (`npm run dev` in the repo root), build this package, then:
//   CLAUDE_METRICS_URL=http://localhost:3000 npm test
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { TOOLS } from "./tools.js";

const base = process.env.CLAUDE_METRICS_URL;
const range = { from: "2026-10-01", to: "2026-10-28" };

describe.skipIf(!base)("against a live dashboard", () => {
  const client = new Client({ name: "integration-test", version: "0" });

  beforeAll(async () => {
    const server = fileURLToPath(new URL("../dist/index.js", import.meta.url));
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [server], env: { CLAUDE_METRICS_URL: base! } }));
  });
  afterAll(() => client.close());

  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const res = (await client.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
    return { isError: res.isError ?? false, text: res.content[0]!.text };
  };

  it("lists every tool as read-only", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });

  it.each(TOOLS.map((t) => [t.name, t.route] as const))("%s returns the same JSON as GET /api/%s", async (name, route) => {
    const args = name === "get_dashboard_meta" ? {} : range;
    const res = await call(name, args);
    expect(res.isError).toBe(false);
    const direct = await (await fetch(`${base}/api/${route}?${new URLSearchParams(args)}`)).json();
    expect(JSON.parse(res.text)).toEqual(direct);
  });

  it("passes filters and paging through", async () => {
    const res = JSON.parse((await call("get_users", { ...range, sort: "commits", pageSize: 5, page: 2 })).text) as { rows: unknown[] };
    expect(res.rows).toHaveLength(5);
  });

  it("returns the dashboard's 400 as a tool error", async () => {
    const res = await call("get_claude_code_summary", { from: "2026-10-28", to: "2026-10-01" });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/^400 /);
  });

  it("rejects malformed dates before calling the dashboard", async () => {
    const res = await call("get_cost", { from: "October" });
    expect(res.isError).toBe(true);
  });
});
