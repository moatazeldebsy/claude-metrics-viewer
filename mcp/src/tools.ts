import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getJson, type Params } from "./dashboard.js";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

/** The dashboard's shared filters (parseQuery in claude-metrics-lib/src/query.ts). */
const filters = {
  from: date.optional().describe("First day, YYYY-MM-DD. Default: 27 days before `to`."),
  to: date.optional().describe("Last day, YYYY-MM-DD. Default: yesterday (today with the OpenTelemetry source)."),
  department: z.string().optional().describe("Only this department. Names come from get_dashboard_meta."),
  user: z.string().optional().describe("Only this user (email or API key label, as in get_users)."),
  excludeWeekends: z.boolean().optional().describe("Leave Saturdays and Sundays out of the totals."),
  excludeHolidays: z.boolean().optional().describe("Leave public holidays (the dashboard's holiday country) out of the totals."),
};

const paging = {
  page: z.number().int().min(1).optional().describe("Page number, from 1."),
  pageSize: z.number().int().min(1).max(100).optional().describe("Rows per page, up to 100. Default 25."),
};

type Tool = {
  name: string;
  route: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
};

export const TOOLS: Tool[] = [
  {
    name: "get_dashboard_meta",
    route: "meta",
    title: "Dashboard info",
    description: "Data source (mock, anthropic or otel), the department names, which tabs have data (capabilities), the holiday country, and when the last OpenTelemetry export arrived. Call this first to learn valid department names.",
    input: {},
  },
  {
    name: "get_claude_code_summary",
    route: "claude-code",
    title: "Claude Code summary",
    description: "Claude Code activity for the period: active users, sessions, lines added and removed, tool accept rates, commits, PRs, estimated cost, terminals, models, and daily trends.",
    input: filters,
  },
  {
    name: "get_departments",
    route: "departments",
    title: "Departments",
    description: "Per-department Claude Code adoption (% of members active), engagement mix (power, regular, light, inactive), weekly adoption trend and cost per active user.",
    input: filters,
  },
  {
    name: "get_cost",
    route: "cost",
    title: "Cost and usage",
    description: "Org-wide Claude API cost and token usage by model, workspace, API key, product, service tier and cost type. Needs the Anthropic Admin API source; check capabilities.billedCost in get_dashboard_meta.",
    input: filters,
  },
  {
    name: "get_seats",
    route: "seats",
    title: "Seats",
    description: "Organization members and whether they used Claude Code in the period, to find unused seats. Needs a member list; check capabilities.seats in get_dashboard_meta.",
    input: { ...filters, q: z.string().optional().describe("Search by name or email."), ...paging },
  },
  {
    name: "get_users",
    route: "users",
    title: "Users",
    description: "Per-user Claude Code activity table, paged and sortable: sessions, lines, commits, PRs, accept rate, cost, active days, last active.",
    input: {
      ...filters,
      q: z.string().optional().describe("Search by user."),
      sort: z.enum(["label", "sessions", "linesAdded", "linesRemoved", "commits", "prs", "acceptRate", "costCents", "activeDays", "lastActive"]).optional().describe("Sort column. Default sessions."),
      desc: z.boolean().optional().describe("Sort descending. Default true."),
      ...paging,
    },
  },
];

export function registerTools(server: McpServer, base: string, fetchFn: typeof fetch = fetch) {
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.input, annotations: { readOnlyHint: true, openWorldHint: false } },
      async (args) => {
        try {
          // The input schemas only declare strings, numbers and booleans.
          const data = await getJson(base, tool.route, args as Params, fetchFn);
          return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
        } catch (e) {
          return { isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] };
        }
      },
    );
  }
}
