import type {
  BetaAnalyticsCostGroupBy,
  BetaAnalyticsCostItem,
} from '@anthropic-ai/sdk/resources/beta/organization/analytics/cost';
import type { ClaudeCodeRecord } from '../anthropic-types';

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

/** What a source can provide. The UI hides or explains the parts a source can't fill. */
export interface SourceCapabilities {
  /** Billed cost from the Usage & Cost Analytics API (Cost & usage tab). */
  billedCost: boolean;
  /** A member list, so seats, adoption and idle members are real. */
  seats: boolean;
  /** Raw upstream rows for the API response tab. */
  rawUpstream: boolean;
  /** Local vs remote session split. */
  remoteSplit: boolean;
  /** Data for today is live and complete enough to show (date ranges may end today). */
  includesToday: boolean;
}

export const ALL_CAPABILITIES: SourceCapabilities = {
  billedCost: true,
  seats: true,
  rawUpstream: true,
  remoteSplit: true,
  includesToday: false,
};

export interface MetricsSource {
  capabilities(): SourceCapabilities;
  /** Claude Code records for one UTC day (all pages). */
  claudeCodeDay(day: string): Promise<ClaudeCodeRecord[]>;
  /** Cost rows from the Usage & Cost Analytics API. */
  cost(q: CostQuery): Promise<CostItem[]>;
  members(): Promise<Member[]>;
}
