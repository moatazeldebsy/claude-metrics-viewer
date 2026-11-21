import { TOOL_NAMES, type ClaudeCodeActor, type ClaudeCodeRecord, type ToolName } from "./anthropic-types";
import type { CostItem, CostGroupBy, Member } from "./sources/types";

export const acceptRate = (accepted: number, rejected: number): number | null =>
  accepted + rejected === 0 ? null : accepted / (accepted + rejected);

export const actorLabel = (a: ClaudeCodeActor): string =>
  a.type === "user_actor" ? a.email_address : `${a.api_key_name} (API key)`;

const accepted = (r: ClaudeCodeRecord) => TOOL_NAMES.reduce((s, t) => s + r.tool_actions[t].accepted, 0);
const rejected = (r: ClaudeCodeRecord) => TOOL_NAMES.reduce((s, t) => s + r.tool_actions[t].rejected, 0);
const cents = (r: ClaudeCodeRecord) => r.model_breakdown.reduce((s, m) => s + m.estimated_cost.amount, 0);

export interface DayRecords {
  day: string;
  records: ClaudeCodeRecord[];
}

export interface DailyPoint {
  day: string;
  activeUsers: number;
  sessions: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
  prs: number;
  costCents: number;
  acceptRate: number | null;
  toolRates: Record<ToolName, number | null>;
  modelCost: Record<string, number>;
}

export interface UserRow {
  label: string;
  type: ClaudeCodeActor["type"];
  sessions: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
  prs: number;
  accepted: number;
  rejected: number;
  acceptRate: number | null;
  costCents: number;
  activeDays: number;
  lastActive: string;
}

export interface ClaudeCodeSummary {
  kpis: {
    activeUsers: number;
    apiActors: number;
    sessions: number;
    linesAdded: number;
    linesRemoved: number;
    commits: number;
    prs: number;
    acceptRate: number | null;
    costCents: number;
  };
  daily: DailyPoint[];
  tools: { tool: ToolName; accepted: number; rejected: number; rate: number | null }[];
  terminals: { terminal: string; sessions: number; users: number }[];
  remoteSplit: { localSessions: number; remoteSessions: number };
  models: { model: string; input: number; output: number; cacheRead: number; cacheCreation: number; costCents: number }[];
  users: UserRow[];
}

export function aggregateClaudeCode(days: DayRecords[]): ClaudeCodeSummary {
  const users = new Map<string, UserRow & { days: Set<string> }>();
  const terminals = new Map<string, { sessions: number; users: Set<string> }>();
  const models = new Map<string, ClaudeCodeSummary["models"][number]>();
  const toolTotals = Object.fromEntries(TOOL_NAMES.map((t) => [t, { accepted: 0, rejected: 0 }])) as Record<ToolName, { accepted: number; rejected: number }>;
  const remoteSplit = { localSessions: 0, remoteSessions: 0 };

  const daily: DailyPoint[] = days.map(({ day, records }) => {
    const active = new Set<string>();
    const dayTools = Object.fromEntries(TOOL_NAMES.map((t) => [t, { accepted: 0, rejected: 0 }])) as typeof toolTotals;
    const p: DailyPoint = {
      day, activeUsers: 0, sessions: 0, linesAdded: 0, linesRemoved: 0, commits: 0, prs: 0, costCents: 0,
      acceptRate: null, toolRates: {} as DailyPoint["toolRates"], modelCost: {},
    };

    for (const r of records) {
      const label = actorLabel(r.actor);
      const c = r.core_metrics;
      if (r.actor.type === "user_actor") active.add(label);
      p.sessions += c.num_sessions;
      p.linesAdded += c.lines_of_code.added;
      p.linesRemoved += c.lines_of_code.removed;
      p.commits += c.commits_by_claude_code;
      p.prs += c.pull_requests_by_claude_code;
      p.costCents += cents(r);

      for (const t of TOOL_NAMES) {
        dayTools[t].accepted += r.tool_actions[t].accepted;
        dayTools[t].rejected += r.tool_actions[t].rejected;
      }

      const u = users.get(label) ?? {
        label, type: r.actor.type, sessions: 0, linesAdded: 0, linesRemoved: 0, commits: 0, prs: 0,
        accepted: 0, rejected: 0, acceptRate: null, costCents: 0, activeDays: 0, lastActive: day, days: new Set<string>(),
      };
      u.sessions += c.num_sessions;
      u.linesAdded += c.lines_of_code.added;
      u.linesRemoved += c.lines_of_code.removed;
      u.commits += c.commits_by_claude_code;
      u.prs += c.pull_requests_by_claude_code;
      u.accepted += accepted(r);
      u.rejected += rejected(r);
      u.costCents += cents(r);
      u.days.add(day);
      if (day > u.lastActive) u.lastActive = day;
      users.set(label, u);

      const term = terminals.get(r.terminal_type) ?? { sessions: 0, users: new Set<string>() };
      term.sessions += c.num_sessions;
      term.users.add(label);
      terminals.set(r.terminal_type, term);
      remoteSplit[r.is_remote ? "remoteSessions" : "localSessions"] += c.num_sessions;

      for (const m of r.model_breakdown) {
        const row = models.get(m.model) ?? { model: m.model, input: 0, output: 0, cacheRead: 0, cacheCreation: 0, costCents: 0 };
        row.input += m.tokens.input;
        row.output += m.tokens.output;
        row.cacheRead += m.tokens.cache_read;
        row.cacheCreation += m.tokens.cache_creation;
        row.costCents += m.estimated_cost.amount;
        models.set(m.model, row);
        p.modelCost[m.model] = (p.modelCost[m.model] ?? 0) + m.estimated_cost.amount;
      }
    }

    let dayAcc = 0;
    let dayRej = 0;
    for (const t of TOOL_NAMES) {
      toolTotals[t].accepted += dayTools[t].accepted;
      toolTotals[t].rejected += dayTools[t].rejected;
      dayAcc += dayTools[t].accepted;
      dayRej += dayTools[t].rejected;
      p.toolRates[t] = acceptRate(dayTools[t].accepted, dayTools[t].rejected);
    }
    p.acceptRate = acceptRate(dayAcc, dayRej);
    p.activeUsers = active.size;
    return p;
  });

  const userRows: UserRow[] = [...users.values()]
    .map(({ days: d, ...u }) => ({ ...u, activeDays: d.size, acceptRate: acceptRate(u.accepted, u.rejected) }))
    .sort((a, b) => b.sessions - a.sessions);

  const sum = (k: keyof Omit<DailyPoint, "day" | "acceptRate" | "toolRates" | "modelCost" | "activeUsers">) =>
    daily.reduce((s, d) => s + d[k], 0);
  const tools = TOOL_NAMES.map((tool) => ({ tool, ...toolTotals[tool], rate: acceptRate(toolTotals[tool].accepted, toolTotals[tool].rejected) }));

  return {
    kpis: {
      activeUsers: userRows.filter((u) => u.type === "user_actor").length,
      apiActors: userRows.filter((u) => u.type === "api_actor").length,
      sessions: sum("sessions"),
      linesAdded: sum("linesAdded"),
      linesRemoved: sum("linesRemoved"),
      commits: sum("commits"),
      prs: sum("prs"),
      acceptRate: acceptRate(
        tools.reduce((s, t) => s + t.accepted, 0),
        tools.reduce((s, t) => s + t.rejected, 0),
      ),
      costCents: sum("costCents"),
    },
    daily,
    tools,
    terminals: [...terminals.entries()]
      .map(([terminal, t]) => ({ terminal, sessions: t.sessions, users: t.users.size }))
      .sort((a, b) => b.sessions - a.sessions),
    remoteSplit,
    models: [...models.values()].sort((a, b) => b.costCents - a.costCents),
    users: userRows,
  };
}

/** Sum cost rows by one group dimension, largest first. */
export function aggregateCost(items: CostItem[], dim: CostGroupBy): { key: string; cents: number }[] {
  const totals = new Map<string, number>();
  for (const it of items) {
    const raw = (it.group as unknown as Record<string, unknown>)[dim];
    const key = raw == null ? "(none)" : typeof raw === "object" ? costActorLabel(raw as Record<string, unknown>) : String(raw);
    totals.set(key, (totals.get(key) ?? 0) + Number(it.cost.amount));
  }
  return [...totals.entries()].map(([key, cents]) => ({ key, cents })).sort((a, b) => b.cents - a.cents);
}

function costActorLabel(a: Record<string, unknown>): string {
  return String(a.email_address ?? a.api_key_id ?? a.service_account_id ?? a.type);
}

export function idleSeats(members: Member[], activeEmails: string[]): Member[] {
  const active = new Set(activeEmails.map((e) => e.toLowerCase()));
  return members.filter((m) => !active.has(m.email.toLowerCase()));
}
