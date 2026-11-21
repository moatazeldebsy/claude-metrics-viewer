import type { ClaudeCodeModelBreakdown, ClaudeCodeRecord } from "../anthropic-types";
import { eachDay, isWeekend } from "../dates";
import type { CostItem, CostGroupBy, CostQuery, Member, MetricsSource } from "./types";

// Deterministic fake organization. Every value is derived from a seed so the
// same day always yields the same records, and shapes match the real API.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const FIRST = ["Ada", "Ben", "Chen", "Dara", "Eli", "Fatima", "Goran", "Hana", "Ivan", "Jade", "Kofi", "Lena", "Mateo", "Nia", "Omar", "Priya", "Quinn", "Rosa", "Sami", "Tara", "Uma", "Viktor", "Wen", "Yara", "Zane", "Aiko", "Bruno", "Carla", "Dev", "Esme"];
const LAST = ["Abara", "Berg", "Costa", "Dahl", "Eze", "Fischer", "Garcia", "Hall", "Ito", "Jensen", "Khan", "Lund", "Moreau", "Nakamura", "Okafor", "Park", "Quist", "Rossi", "Silva", "Tanaka", "Ueda", "Varga", "Weber", "Xu", "Yilmaz", "Zhang", "Adler", "Brandt", "Cho", "Diaz", "Engel", "Ford", "Gupta", "Haas", "Iqbal", "Janssen", "Kowalski", "Lopez", "Meyer", "Novak"];
const TERMINALS = ["vscode", "iTerm.app", "tmux", "ghostty", "jetbrains"];

// Department → share of members who use Claude Code. Spread wide so adoption gaps are visible.
const DEPARTMENTS: [string, number][] = [
  ["Platform", 0.92], ["Backend", 0.81], ["Frontend", 0.74], ["Mobile", 0.63], ["Data", 0.7], ["ML Research", 0.88],
  ["Security", 0.55], ["QA", 0.48], ["SRE", 0.77], ["Product", 0.22], ["Design", 0.12], ["Support Eng", 0.35],
];

// $ per million tokens: [input, output]; cache read 0.1x input, cache write 1.25x input.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

interface Persona {
  email: string;
  name: string;
  intensity: number; // 0..1
  activeChance: number; // weekday probability of using Claude Code
  terminal: string;
  model: string;
}

// 30 x 40 = 1,200 members with unique first.last emails.
const MEMBERS: Member[] = LAST.flatMap((last, li) =>
  FIRST.map((first, fi) => {
    const i = li * FIRST.length + fi;
    const r = rng(`member|${i}`);
    return {
      id: `user_${String(i + 1).padStart(4, "0")}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
      name: `${first} ${last}`,
      role: i === 0 ? "admin" : i < 20 ? "developer" : "claude_code_user",
      added_at: `2026-0${1 + (i % 9)}-15T09:00:00Z`,
      department: DEPARTMENTS[Math.floor(r() * DEPARTMENTS.length)]![0],
    };
  }),
);

const ADOPTION = new Map(DEPARTMENTS);

// A member uses Claude Code with their department's adoption probability.
const PERSONAS: Persona[] = MEMBERS.flatMap((m, i) => {
  const r = rng(m.email);
  if (r() > (ADOPTION.get(m.department!) ?? 0.5)) return [];
  return [{
    email: m.email,
    name: m.name,
    intensity: 0.2 + r() * 0.8,
    activeChance: 0.15 + r() * 0.75,
    terminal: TERMINALS[i % TERMINALS.length]!,
    model: i % 4 === 0 ? "claude-sonnet-5-5" : "claude-opus-5-5",
  }];
});

const USER_IDS = new Map(MEMBERS.map((m) => [m.email, m.id]));
const userId = (email: string) => USER_IDS.get(email) ?? email;

const BOTS = ["ci-review-bot", "release-notes-bot"];

const int = (r: () => number, max: number) => Math.floor(r() * max);
const tools = (r: () => number, n: number, acceptRate: number) => {
  const total = int(r, n);
  const accepted = Math.round(total * acceptRate);
  return { accepted, rejected: total - accepted };
};

function modelBreakdown(r: () => number, primary: string, scale: number): ClaudeCodeModelBreakdown[] {
  const used = [primary, ...(r() < 0.6 ? ["claude-haiku-5-5"] : [])];
  return used.map((model) => {
    const k = model === primary ? 1 : 0.3;
    const input = Math.round((20_000 + r() * 180_000) * scale * k);
    const output = Math.round(input * (0.15 + r() * 0.2));
    const cache_read = Math.round(input * (2 + r() * 4));
    const cache_creation = Math.round(input * (0.1 + r() * 0.2));
    const [pi, po] = PRICES[model]!;
    const dollars = (input * pi + output * po + cache_read * pi * 0.1 + cache_creation * pi * 1.25) / 1e6;
    return {
      model,
      tokens: { input, output, cache_read, cache_creation },
      estimated_cost: { currency: "USD" as const, amount: Math.round(dollars * 100) },
    };
  });
}

function record(day: string, actor: ClaudeCodeRecord["actor"], terminal: string, isRemote: boolean, intensity: number, model: string, r: () => number): ClaudeCodeRecord {
  const s = intensity;
  const acceptRate = 0.78 + r() * 0.2;
  return {
    date: `${day}T00:00:00Z`,
    actor,
    organization_id: ORG_ID,
    customer_type: "api",
    terminal_type: terminal,
    subscription_type: null,
    is_remote: isRemote,
    core_metrics: {
      num_sessions: 1 + int(r, 8 * s),
      lines_of_code: { added: int(r, 1800 * s), removed: int(r, 700 * s) },
      commits_by_claude_code: int(r, 9 * s),
      pull_requests_by_claude_code: int(r, 3 * s),
    },
    tool_actions: {
      edit_tool: tools(r, 70 * s, acceptRate),
      multi_edit_tool: tools(r, 20 * s, acceptRate - 0.05),
      write_tool: tools(r, 15 * s, acceptRate - 0.03),
      notebook_edit_tool: tools(r, 4 * s, acceptRate - 0.1),
    },
    model_breakdown: modelBreakdown(r, model, s),
  };
}

function generateDay(day: string): ClaudeCodeRecord[] {
  const weekend = isWeekend(day);
  const out: ClaudeCodeRecord[] = [];
  for (const p of PERSONAS) {
    const r = rng(`${day}|${p.email}`);
    if (r() > p.activeChance * (weekend ? 0.15 : 1)) continue;
    const actor = { type: "user_actor" as const, email_address: p.email };
    out.push(record(day, actor, p.terminal, false, p.intensity, p.model, r));
    // Some days a user also runs remote sessions: a second record for the same actor.
    if (r() < 0.25) out.push(record(day, actor, "remote", true, p.intensity * 0.5, p.model, r));
  }
  for (const bot of BOTS) {
    const r = rng(`${day}|${bot}`);
    if (weekend && r() < 0.7) continue;
    out.push(record(day, { type: "api_actor", api_key_name: bot }, "github-actions", true, 0.4, "claude-sonnet-5-5", r));
  }
  return out;
}

// ---- Usage & Cost Analytics facts ----------------------------------------

type Fact = Pick<CostItem["group"], "model" | "workspace_id" | "api_key_id" | "product" | "service_tier" | "cost_type" | "actor"> & {
  day: string;
  cents: number;
  requests: number;
};

const API_TRAFFIC = [
  { workspace_id: "wrkspc_prod", api_key_id: "apikey_prod_web", product: "api", model: "claude-sonnet-5-5", daily: 9000, tier: "standard" as const },
  { workspace_id: "wrkspc_prod", api_key_id: "apikey_prod_batch", product: "api", model: "claude-haiku-5-5", daily: 1200, tier: "batch" as const },
  { workspace_id: "wrkspc_prod", api_key_id: null, product: "managed_agents", model: "claude-opus-5-5", daily: 6000, tier: "standard" as const },
  { workspace_id: "wrkspc_staging", api_key_id: "apikey_staging", product: "api", model: "claude-opus-5-5", daily: 1500, tier: "standard" as const },
  { workspace_id: "wrkspc_data", api_key_id: "apikey_data_etl", product: "api", model: "claude-haiku-5-5", daily: 800, tier: "batch" as const },
];

function factsForDay(day: string): Fact[] {
  const facts: Fact[] = [];
  for (const rec of generateDay(day)) {
    const actor =
      rec.actor.type === "user_actor"
        ? { type: "user_actor" as const, user_id: userId(rec.actor.email_address), email_address: rec.actor.email_address, name: null, deleted: false }
        : { type: "api_actor" as const, api_key_id: `apikey_${rec.actor.api_key_name}` };
    for (const m of rec.model_breakdown) {
      facts.push({
        day, model: m.model, workspace_id: "wrkspc_claude_code", api_key_id: null, product: "claude_code",
        service_tier: "standard", cost_type: "tokens", actor, cents: m.estimated_cost.amount, requests: rec.core_metrics.num_sessions * 40,
      });
    }
  }
  const r = rng(`api|${day}`);
  const dip = isWeekend(day) ? 0.45 : 1;
  for (const t of API_TRAFFIC) {
    const cents = t.daily * dip * (0.8 + r() * 0.4);
    const base = { day, model: t.model, workspace_id: t.workspace_id, api_key_id: t.api_key_id, product: t.product, service_tier: t.tier, actor: null };
    facts.push({ ...base, cost_type: "tokens", cents, requests: Math.round(cents * 3) });
    if (t.product === "managed_agents") {
      facts.push({ ...base, cost_type: "session_usage", cents: cents * 0.12, requests: 0 });
      facts.push({ ...base, cost_type: "web_search", cents: cents * 0.05, requests: 0 });
    }
  }
  return facts;
}

const NULL_GROUP: CostItem["group"] = {
  actor: null, actor_type: null, agent_id: null, api_key_id: null, claude_tag_category: null, claude_tag_user_id: null,
  context_window: null, cost_type: null, deployment_id: null, environment_id: null, inference_geo: null, model: null,
  product: null, rbac_group_id: null, service_tier: null, session_id: null, slack_channel_id: null, speed: null,
  token_type: null, user_profile_id: null, workspace_id: null,
};

export class MockSource implements MetricsSource {
  async claudeCodeDay(day: string): Promise<ClaudeCodeRecord[]> {
    return generateDay(day);
  }

  async cost({ from, to, groupBy, daily }: CostQuery): Promise<CostItem[]> {
    const rows = new Map<string, CostItem>();
    for (const day of eachDay(from, to)) {
      for (const f of factsForDay(day)) {
        const group = { ...NULL_GROUP };
        for (const g of groupBy) assignGroup(group, g, f);
        const start = daily ? day : from;
        const key = `${start}|${JSON.stringify(group)}`;
        const row = rows.get(key) ?? {
          starting_at: `${start}T00:00:00Z`,
          ending_at: `${daily ? day : to}T23:59:59Z`,
          group,
          cost: { amount: "0", list_amount: "0", currency: "USD", requests: 0 },
        };
        row.cost.amount = (Number(row.cost.amount) + f.cents).toFixed(4);
        row.cost.list_amount = (Number(row.cost.list_amount) + f.cents * (f.service_tier === "batch" ? 2 : 1)).toFixed(4);
        row.cost.requests = (row.cost.requests ?? 0) + f.requests;
        rows.set(key, row);
      }
    }
    return [...rows.values()].sort((a, b) => a.starting_at.localeCompare(b.starting_at) || Number(b.cost.amount) - Number(a.cost.amount));
  }

  async members(): Promise<Member[]> {
    return MEMBERS;
  }
}

function assignGroup(group: CostItem["group"], g: CostGroupBy, f: Fact) {
  switch (g) {
    case "actor":
      group.actor = f.actor;
      break;
    case "actor_type":
      group.actor_type = f.actor?.type ?? null;
      break;
    case "model":
    case "workspace_id":
    case "api_key_id":
    case "product":
    case "service_tier":
    case "cost_type":
      (group as unknown as Record<string, unknown>)[g] = f[g];
      break;
  }
}
