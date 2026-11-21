import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { AnthropicSource } from "#lib/sources/anthropic";

async function* iter<T>(items: T[]) {
  yield* items;
}

function fakeClient() {
  const get = vi.fn(async (_path: string, opts: { query: Record<string, unknown> }) =>
    opts.query.page === "p2"
      ? { data: [{ id: 2 }], has_more: false, next_page: null }
      : { data: [{ id: 1 }], has_more: true, next_page: "p2" },
  );
  const costList = vi.fn((params: Record<string, unknown>) => iter([{ params }]));
  const usersList = vi.fn(() => iter([{ id: "u1", email: "a@x.com", name: "A", role: "developer", added_at: "t", extra: 1 }]));
  const client = { get, beta: { organization: { analytics: { cost: { list: costList } }, users: { list: usersList } } } };
  return { client: client as unknown as Anthropic, get, costList, usersList };
}

describe("AnthropicSource", () => {
  it("follows next_page for the Claude Code report and caches complete days", async () => {
    const f = fakeClient();
    const src = new AnthropicSource("k", f.client);
    expect(await src.claudeCodeDay("2026-01-05")).toEqual([{ id: 1 }, { id: 2 }]);
    expect(f.get).toHaveBeenCalledWith("/v1/organizations/usage_report/claude_code", { query: { starting_at: "2026-01-05", limit: 1000 } });
    await src.claudeCodeDay("2026-01-05");
    expect(f.get).toHaveBeenCalledTimes(2);
  });

  it("splits cost queries into 31-day chunks with exclusive ending_at", async () => {
    const f = fakeClient();
    const rows = await new AnthropicSource("k", f.client).cost({ from: "2026-01-01", to: "2026-02-10", groupBy: ["model"], daily: true });
    expect(rows).toHaveLength(2);
    expect(f.costList.mock.calls.map((c) => [c[0].starting_at, c[0].ending_at])).toEqual([
      ["2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"],
      ["2026-02-01T00:00:00Z", "2026-02-11T00:00:00Z"],
    ]);
    expect(f.costList.mock.calls[0][0]).toMatchObject({ group_by: ["model"], time_bucket_width: "1d", limit: 1000 });
  });

  it("maps members to the dashboard shape", async () => {
    const f = fakeClient();
    expect(await new AnthropicSource("k", f.client, new Map([["a@x.com", "Platform"]])).members()).toEqual([
      { id: "u1", email: "a@x.com", name: "A", role: "developer", added_at: "t", department: "Platform" },
    ]);
  });
});
