// MetricsSource backed by Claude Code OpenTelemetry metrics that a host stored in a TelemetryStore.
import type { ClaudeCodeModelBreakdown, ClaudeCodeRecord } from "../anthropic-types";
import type { TelemetryCounter, TelemetryRow } from "../telemetry/rows";
import type { TelemetryStore } from "../telemetry/store";
import type { CostItem, Member, MetricsSource, SourceCapabilities } from "./types";

const n = (r: Partial<Record<TelemetryCounter, number>>, k: TelemetryCounter) => r[k] ?? 0;

export class OtelSource implements MetricsSource {
  constructor(
    private readonly store: TelemetryStore,
    /** email (lowercase) → department, from DEPARTMENTS_FILE. Also the member list when non-empty. */
    private readonly csvDepartments: Map<string, string>,
  ) {}

  capabilities(): SourceCapabilities {
    return { billedCost: false, seats: this.csvDepartments.size > 0, rawUpstream: false, remoteSplit: false, includesToday: true };
  }

  async claudeCodeDay(day: string): Promise<ClaudeCodeRecord[]> {
    const groups = new Map<string, TelemetryRow[]>();
    for (const r of await this.store.records(day)) {
      const key = JSON.stringify([r.actorKind, r.actor, r.terminal]);
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    return [...groups.values()].map((rows) => {
      const first = rows[0]!;
      const total: Partial<Record<TelemetryCounter, number>> = {};
      for (const r of rows) for (const [k, v] of Object.entries(r.counters)) total[k as TelemetryCounter] = (total[k as TelemetryCounter] ?? 0) + (v ?? 0);
      const byModel = new Map<string, Partial<Record<TelemetryCounter, number>>>();
      for (const r of rows) {
        if (!r.model) continue;
        const m = byModel.get(r.model) ?? {};
        for (const [k, v] of Object.entries(r.counters)) m[k as TelemetryCounter] = (m[k as TelemetryCounter] ?? 0) + (v ?? 0);
        byModel.set(r.model, m);
      }
      const model_breakdown: ClaudeCodeModelBreakdown[] = [...byModel].map(([model, c]) => ({
        model,
        tokens: { input: n(c, "tokensInput"), output: n(c, "tokensOutput"), cache_read: n(c, "tokensCacheRead"), cache_creation: n(c, "tokensCacheCreation") },
        estimated_cost: { currency: "USD", amount: Math.round(n(c, "costUsd") * 100) },
      }));
      return {
        date: `${day}T00:00:00Z`,
        actor: first.actorKind === "user" ? { type: "user_actor", email_address: first.actor } : { type: "api_actor", api_key_name: first.actor },
        organization_id: "",
        customer_type: "subscription",
        terminal_type: first.terminal,
        subscription_type: null,
        is_remote: false,
        core_metrics: {
          num_sessions: n(total, "sessions"),
          lines_of_code: { added: n(total, "linesAdded"), removed: n(total, "linesRemoved") },
          commits_by_claude_code: n(total, "commits"),
          pull_requests_by_claude_code: n(total, "prs"),
        },
        tool_actions: {
          edit_tool: { accepted: n(total, "editAccepted"), rejected: n(total, "editRejected") },
          multi_edit_tool: { accepted: 0, rejected: 0 },
          write_tool: { accepted: n(total, "writeAccepted"), rejected: n(total, "writeRejected") },
          notebook_edit_tool: { accepted: n(total, "notebookAccepted"), rejected: n(total, "notebookRejected") },
        },
        model_breakdown,
      } satisfies ClaudeCodeRecord;
    });
  }

  async cost(): Promise<CostItem[]> {
    return [];
  }

  /** CSV members first (their CSV department wins), then telemetry users the CSV doesn't list. */
  async members(): Promise<Member[]> {
    const member = (email: string, department: string | null): Member => ({
      id: email,
      email,
      name: email.split("@")[0] ?? email,
      role: "user",
      added_at: "",
      department,
    });
    const out = new Map<string, Member>();
    for (const [email, department] of this.csvDepartments) out.set(email.toLowerCase(), member(email, department));
    for (const u of await this.store.users()) {
      if (u.actorKind !== "user" || out.has(u.actor.toLowerCase())) continue;
      out.set(u.actor.toLowerCase(), member(u.actor, u.department));
    }
    return [...out.values()];
  }

  lastReceivedAt(): Promise<string | null> {
    return this.store.lastReceivedAt();
  }
}
