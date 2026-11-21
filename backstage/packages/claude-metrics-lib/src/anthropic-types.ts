// Raw record shape of GET /v1/organizations/usage_report/claude_code.
// Not wrapped by @anthropic-ai/sdk 1.5.0, so typed here from the API docs.

export type ClaudeCodeActor =
  | { type: "user_actor"; email_address: string }
  | { type: "api_actor"; api_key_name: string };

export interface ToolCounts {
  accepted: number;
  rejected: number;
}

export interface ClaudeCodeModelBreakdown {
  model: string;
  tokens: { input: number; output: number; cache_read: number; cache_creation: number };
  estimated_cost: { currency: "USD"; amount: number }; // cents
}

export interface ClaudeCodeRecord {
  date: string; // RFC 3339, UTC midnight
  actor: ClaudeCodeActor;
  organization_id: string;
  customer_type: "api" | "subscription";
  terminal_type: string;
  subscription_type: "enterprise" | "team" | null;
  is_remote: boolean;
  core_metrics: {
    num_sessions: number;
    lines_of_code: { added: number; removed: number };
    commits_by_claude_code: number;
    pull_requests_by_claude_code: number;
  };
  tool_actions: {
    edit_tool: ToolCounts;
    multi_edit_tool: ToolCounts;
    write_tool: ToolCounts;
    notebook_edit_tool: ToolCounts;
  };
  model_breakdown: ClaudeCodeModelBreakdown[];
}

export interface ClaudeCodeReportPage {
  data: ClaudeCodeRecord[];
  has_more: boolean;
  next_page: string | null;
}

export type ToolName = keyof ClaudeCodeRecord["tool_actions"];
export const TOOL_NAMES: ToolName[] = ["edit_tool", "multi_edit_tool", "write_tool", "notebook_edit_tool"];
