import type {
  BetaAnalyticsCostGroupBy,
  BetaAnalyticsCostItem,
} from "@anthropic-ai/sdk/resources/beta/organization/analytics/cost";
import type { ClaudeCodeRecord } from "../anthropic-types";

export type CostItem = BetaAnalyticsCostItem;
export type CostGroupBy = BetaAnalyticsCostGroupBy;

export interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  added_at: string;
  /** From the mock org, or the DEPARTMENTS_FILE mapping for real data. null = unassigned. */
  department: string | null;
}

export interface CostQuery {
  from: string; // YYYY-MM-DD, inclusive
  to: string; // YYYY-MM-DD, inclusive
  groupBy: CostGroupBy[];
  daily?: boolean; // time_bucket_width=1d
}

export interface MetricsSource {
  /** Claude Code records for one UTC day (all pages). */
  claudeCodeDay(day: string): Promise<ClaudeCodeRecord[]>;
  /** Cost rows from the Usage & Cost Analytics API. */
  cost(q: CostQuery): Promise<CostItem[]>;
  members(): Promise<Member[]>;
}
