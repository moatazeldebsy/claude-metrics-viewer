import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeCodeRecord, ClaudeCodeReportPage } from "@/lib/anthropic-types";
import { addDays, splitRange, toDay } from "@/lib/dates";
import type { CostItem, CostQuery, Member, MetricsSource } from "./types";

const MAX_COST_RANGE_DAYS = 31; // Usage & Cost Analytics API limit per request

/** Reads real data with an Admin API key (sk-ant-admin...). Server-side only. */
export class AnthropicSource implements MetricsSource {
  private client: Anthropic;
  private dayCache = new Map<string, ClaudeCodeRecord[]>();

  constructor(apiKey: string, client?: Anthropic) {
    this.client = client ?? new Anthropic({ apiKey });
  }

  async claudeCodeDay(day: string): Promise<ClaudeCodeRecord[]> {
    const hit = this.dayCache.get(day);
    if (hit) return hit;

    // Not wrapped by the SDK yet; use its generic GET so auth, retries and headers stay consistent.
    const records: ClaudeCodeRecord[] = [];
    let page: string | null = null;
    do {
      const res: ClaudeCodeReportPage = await this.client.get("/v1/organizations/usage_report/claude_code", {
        query: { starting_at: day, limit: 1000, ...(page ? { page } : {}) },
      });
      records.push(...res.data);
      page = res.has_more ? res.next_page : null;
    } while (page);

    // Data lands within ~1h; only cache days that are safely complete.
    if (day < addDays(toDay(new Date()), -1)) this.dayCache.set(day, records);
    return records;
  }

  async cost({ from, to, groupBy, daily }: CostQuery): Promise<CostItem[]> {
    const out: CostItem[] = [];
    for (const chunk of splitRange(from, to, MAX_COST_RANGE_DAYS)) {
      const rows = this.client.beta.organization.analytics.cost.list({
        starting_at: `${chunk.from}T00:00:00Z`,
        ending_at: `${addDays(chunk.to, 1)}T00:00:00Z`,
        group_by: groupBy,
        ...(daily ? { time_bucket_width: "1d" as const, order_by: "time" as const, order: "asc" as const } : {}),
        limit: 1000,
      });
      for await (const row of rows) out.push(row);
    }
    return out;
  }

  async members(): Promise<Member[]> {
    const out: Member[] = [];
    for await (const u of this.client.beta.organization.users.list({ limit: 100 })) {
      out.push({ id: u.id, email: u.email, name: u.name, role: u.role, added_at: u.added_at });
    }
    return out;
  }
}
