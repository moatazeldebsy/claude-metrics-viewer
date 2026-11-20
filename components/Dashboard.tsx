"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ClaudeCodeSummary, UserRow } from "@/lib/aggregate";
import { TOOL_NAMES, type ToolName } from "@/lib/anthropic-types";
import { addDays, toDay } from "@/lib/dates";
import type { costSummary } from "@/lib/service";
import { HBar, StackedBar, TrendChart } from "./charts";
import { DepartmentsTab, SeatsTab, UserPicker, UsersTab } from "./scale";
import { Card, DataTable, fmtCompact, fmtInt, fmtPct, fmtUsd, KpiGrid, KpiTile } from "./ui";
import { useJson } from "./useJson";

type CC = Omit<ClaudeCodeSummary, "users"> & { topContributors: UserRow[] };
type Cost = Awaited<ReturnType<typeof costSummary>>;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "departments", label: "Departments" },
  { id: "tools", label: "Tool acceptance" },
  { id: "environments", label: "Environments" },
  { id: "commits", label: "Commits & PRs" },
  { id: "models", label: "Models" },
  { id: "cost", label: "Cost & usage" },
  { id: "users", label: "Users" },
  { id: "seats", label: "Seats" },
  { id: "api", label: "API response" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TOOL_LABELS: Record<ToolName, string> = { edit_tool: "Edit", multi_edit_tool: "MultiEdit", write_tool: "Write", notebook_edit_tool: "NotebookEdit" };
const FILTER_KEYS = ["from", "to", "excludeWeekends", "excludeHolidays", "user", "department"];

export function Dashboard({ dataSource }: { dataSource: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.id === sp.get("tab"))?.id ?? "overview") as TabId;

  const yesterday = addDays(toDay(new Date()), -1);
  const to = sp.get("to") ?? yesterday;
  const from = sp.get("from") ?? addDays(to, -27);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  const filterQs = new URLSearchParams({ from, to });
  for (const k of FILTER_KEYS.slice(2)) if (sp.get(k)) filterQs.set(k, sp.get(k)!);
  const qs = filterQs.toString();

  const needsCC = ["overview", "tools", "environments", "commits", "models"].includes(tab);
  const cc = useJson<CC>(needsCC ? `/api/claude-code?${qs}` : null);
  const cost = useJson<Cost>(tab === "cost" ? `/api/cost?${qs}` : null);
  const meta = useJson<{ departments: string[] }>("/api/meta");

  const active = needsCC ? cc : tab === "cost" ? cost : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Claude Metrics Viewer</h1>
          <p className="text-sm text-ink-2">Claude Code adoption and Claude API usage &amp; cost</p>
        </div>
        {dataSource === "mock" && (
          <span className="rounded-full border border-line bg-surface-1 px-3 py-1 text-xs text-ink-2" data-testid="mock-badge">
            Mock data, set DATA_SOURCE=anthropic for real data
          </span>
        )}
      </header>

      <FilterBar from={from} to={to} yesterday={yesterday} sp={sp} qs={qs} departments={meta.data?.departments ?? []} onChange={setParams} />

      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setParams({ tab: t.id === "overview" ? null : t.id })}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t.id ? "border-accent font-medium text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="mt-4 space-y-4">
        {active?.loading && <p className="text-sm text-ink-3">Loading…</p>}
        {active?.error && <p className="rounded-lg border border-line bg-surface-1 p-3 text-sm" role="alert">Couldn’t load data: {active.error}</p>}
        {cc.data && tab === "overview" && <Overview d={cc.data} />}
        {cc.data && tab === "tools" && <Tools d={cc.data} />}
        {cc.data && tab === "environments" && <Environments d={cc.data} />}
        {cc.data && tab === "commits" && <Commits d={cc.data} />}
        {cc.data && tab === "models" && <Models d={cc.data} />}
        {tab === "departments" && <DepartmentsTab qs={qs} onDrill={(department) => setParams({ department, tab: null })} />}
        {tab === "users" && <UsersTab key={qs} qs={qs} />}
        {cost.data && tab === "cost" && <CostTab d={cost.data} filtered={Boolean(sp.get("user") || sp.get("department"))} />}
        {tab === "seats" && <SeatsTab key={qs} qs={qs} />}
        {tab === "api" && <RawTab day={to} />}
      </main>
    </div>
  );
}

function FilterBar({ from, to, yesterday, sp, qs, departments, onChange }: {
  from: string; to: string; yesterday: string; sp: URLSearchParams; qs: string; departments: string[]; onChange: (p: Record<string, string | null>) => void;
}) {
  const preset = (days: number) => onChange({ from: addDays(yesterday, -(days - 1)), to: yesterday });
  const input = "rounded-md border border-line bg-surface-1 px-2 py-1 text-sm";
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-1 p-3 text-sm" data-testid="filters">
      <label className="flex items-center gap-1.5 text-ink-2">From
        <input type="date" className={input} value={from} max={to} onChange={(e) => onChange({ from: e.target.value })} aria-label="From date" />
      </label>
      <label className="flex items-center gap-1.5 text-ink-2">To
        <input type="date" className={input} value={to} min={from} max={yesterday} onChange={(e) => onChange({ to: e.target.value })} aria-label="To date" />
      </label>
      <div className="flex gap-1">
        {[7, 28, 90].map((n) => (
          <button key={n} type="button" className="rounded-md border border-line px-2 py-1 hover:bg-surface-0" onClick={() => preset(n)}>Last {n} days</button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-ink-2">
        <input type="checkbox" checked={sp.get("excludeWeekends") === "true"} onChange={(e) => onChange({ excludeWeekends: e.target.checked ? "true" : null })} />
        Exclude weekends
      </label>
      <label className="flex items-center gap-1.5 text-ink-2">
        <input type="checkbox" checked={sp.get("excludeHolidays") === "true"} onChange={(e) => onChange({ excludeHolidays: e.target.checked ? "true" : null })} />
        Exclude holidays
      </label>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-ink-2">Department
          <select className={input} value={sp.get("department") ?? ""} onChange={(e) => onChange({ department: e.target.value || null })} aria-label="Department filter">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <UserPicker value={sp.get("user")} qs={qs} onChange={(user) => onChange({ user })} />
      </div>
    </div>
  );
}

function Overview({ d }: { d: CC }) {
  const k = d.kpis;
  return (
    <>
      <KpiGrid>
        <KpiTile label="Active users" value={fmtInt(k.activeUsers)} hint={`+ ${k.apiActors} API-key actors`} />
        <KpiTile label="Sessions" value={fmtInt(k.sessions)} />
        <KpiTile label="Lines added" value={fmtInt(k.linesAdded)} hint={`${fmtInt(k.linesRemoved)} removed`} />
        <KpiTile label="Accept rate" value={fmtPct(k.acceptRate)} hint="Edit, MultiEdit, Write, NotebookEdit" />
        <KpiTile label="Commits" value={fmtInt(k.commits)} />
        <KpiTile label="Pull requests" value={fmtInt(k.prs)} />
        <KpiTile label="Estimated cost" value={fmtUsd(k.costCents)} hint="Claude Code only" />
        <KpiTile label="Cost per active user" value={k.activeUsers ? fmtUsd(k.costCents / k.activeUsers) : "—"} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Daily active users"><TrendChart data={d.daily} series={[{ key: "activeUsers", label: "Active users" }]} /></Card>
        <Card title="Daily sessions"><TrendChart data={d.daily} series={[{ key: "sessions", label: "Sessions" }]} /></Card>
        <Card title="Lines of code per day"><TrendChart data={d.daily} series={[{ key: "linesAdded", label: "Added" }, { key: "linesRemoved", label: "Removed" }]} format={fmtCompact} /></Card>
        <Card title="Daily accept rate" subtitle="Accepted ÷ (accepted + rejected) tool proposals">
          <TrendChart data={d.daily} series={[{ key: "acceptRate", label: "Accept rate" }]} format={(v) => fmtPct(v)} />
        </Card>
      </div>
    </>
  );
}

function Tools({ d }: { d: CC }) {
  const daily = d.daily.map((p) => ({ day: p.day, ...p.toolRates }));
  return (
    <>
      <KpiGrid>
        {d.tools.map((t) => <KpiTile key={t.tool} label={`${TOOL_LABELS[t.tool]} accept rate`} value={fmtPct(t.rate)} hint={`${fmtInt(t.accepted + t.rejected)} proposals`} />)}
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Accept rate by tool, daily">
          <TrendChart data={daily} series={TOOL_NAMES.map((t) => ({ key: t, label: TOOL_LABELS[t] }))} format={(v) => fmtPct(v)} />
        </Card>
        <Card title="Proposals by tool">
          <StackedBar data={d.tools.map((t) => ({ ...t, name: TOOL_LABELS[t.tool] }))} xKey="name" series={[{ key: "accepted", label: "Accepted" }, { key: "rejected", label: "Rejected" }]} format={fmtCompact} />
        </Card>
      </div>
      <Card title="Table view">
        <DataTable rows={d.tools} initialSort="total" columns={[
          { key: "tool", label: "Tool", value: (t) => TOOL_LABELS[t.tool] },
          { key: "accepted", label: "Accepted", value: (t) => t.accepted, numeric: true },
          { key: "rejected", label: "Rejected", value: (t) => t.rejected, numeric: true },
          { key: "total", label: "Total", value: (t) => t.accepted + t.rejected, numeric: true },
          { key: "rate", label: "Accept rate", value: (t) => t.rate, numeric: true, format: fmtPct as (v: never) => string },
        ]} />
      </Card>
    </>
  );
}

function Environments({ d }: { d: CC }) {
  const { localSessions, remoteSessions } = d.remoteSplit;
  const total = localSessions + remoteSessions;
  return (
    <>
      <KpiGrid>
        <KpiTile label="Terminals in use" value={fmtInt(d.terminals.length)} />
        <KpiTile label="Local sessions" value={fmtInt(localSessions)} hint={total ? fmtPct(localSessions / total) : undefined} />
        <KpiTile label="Remote sessions" value={fmtInt(remoteSessions)} hint={total ? fmtPct(remoteSessions / total) : undefined} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Sessions by terminal"><HBar data={d.terminals.map((t) => ({ key: t.terminal, value: t.sessions }))} format={fmtInt} /></Card>
        <Card title="Users by terminal">
          <DataTable rows={d.terminals} initialSort="sessions" columns={[
            { key: "terminal", label: "Terminal", value: (t) => t.terminal },
            { key: "users", label: "Users", value: (t) => t.users, numeric: true },
            { key: "sessions", label: "Sessions", value: (t) => t.sessions, numeric: true },
          ]} />
        </Card>
      </div>
    </>
  );
}

function Commits({ d }: { d: CC }) {
  const k = d.kpis;
  return (
    <>
      <KpiGrid>
        <KpiTile label="Commits by Claude Code" value={fmtInt(k.commits)} />
        <KpiTile label="Pull requests by Claude Code" value={fmtInt(k.prs)} />
        <KpiTile label="Commits per active user" value={k.activeUsers ? (k.commits / k.activeUsers).toFixed(1) : "—"} />
        <KpiTile label="Lines added per commit" value={k.commits ? fmtInt(k.linesAdded / k.commits) : "—"} />
      </KpiGrid>
      <Card title="Commits and pull requests per day">
        <TrendChart data={d.daily} series={[{ key: "commits", label: "Commits" }, { key: "prs", label: "Pull requests" }]} />
      </Card>
      <Card title="Top contributors">
        <DataTable rows={d.topContributors} initialSort="commits" columns={[
          { key: "label", label: "User", value: (u) => u.label },
          { key: "commits", label: "Commits", value: (u) => u.commits, numeric: true },
          { key: "prs", label: "PRs", value: (u) => u.prs, numeric: true },
          { key: "linesAdded", label: "Lines added", value: (u) => u.linesAdded, numeric: true },
        ]} />
      </Card>
    </>
  );
}

function Models({ d }: { d: CC }) {
  const models = d.models.map((m) => m.model);
  const daily = d.daily.map((p) => ({ day: p.day, ...p.modelCost }));
  return (
    <>
      <Card title="Estimated Claude Code cost per model, daily">
        <TrendChart data={daily} series={models.map((m) => ({ key: m, label: m }))} format={fmtUsd} />
      </Card>
      <Card title="Tokens and cost by model">
        <DataTable rows={d.models} initialSort="cost" columns={[
          { key: "model", label: "Model", value: (m) => m.model },
          { key: "input", label: "Input", value: (m) => m.input, numeric: true, format: fmtCompact as (v: never) => string },
          { key: "output", label: "Output", value: (m) => m.output, numeric: true, format: fmtCompact as (v: never) => string },
          { key: "cacheRead", label: "Cache read", value: (m) => m.cacheRead, numeric: true, format: fmtCompact as (v: never) => string },
          { key: "cacheCreation", label: "Cache write", value: (m) => m.cacheCreation, numeric: true, format: fmtCompact as (v: never) => string },
          { key: "cost", label: "Est. cost", value: (m) => m.costCents, numeric: true, format: fmtUsd as (v: never) => string },
        ]} />
      </Card>
    </>
  );
}

const DIM_LABELS: Record<keyof Cost["by"], string> = {
  model: "Model", workspace_id: "Workspace", api_key_id: "API key", product: "Product", service_tier: "Service tier", cost_type: "Cost type",
};

function CostTab({ d, filtered }: { d: Cost; filtered: boolean }) {
  const days = d.daily.filter((x) => x.cents > 0).length || 1;
  return (
    <>
      {filtered && (
        <p className="rounded-lg border border-line bg-surface-1 p-3 text-sm text-ink-2" data-testid="cost-filter-note">
          Organization-wide figures: the department and user filters don’t apply here, because the cost API has no department dimension.
        </p>
      )}
      <KpiGrid>
        <KpiTile label="Total cost" value={fmtUsd(d.totalCents)} hint="After discounts, before credits" />
        <KpiTile label="List price" value={fmtUsd(d.listCents)} />
        <KpiTile label="Discounts" value={fmtUsd(d.listCents - d.totalCents)} hint="Batch and other discounts" />
        <KpiTile label="Average per day" value={fmtUsd(d.totalCents / days)} />
      </KpiGrid>
      <Card title="Daily cost" subtitle="Usage & Cost Analytics API. Data can lag 4 to 24 hours.">
        <TrendChart data={d.daily} series={[{ key: "cents", label: "Cost" }]} format={fmtUsd} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(DIM_LABELS) as (keyof Cost["by"])[]).map((dim) => (
          <Card key={dim} title={`Cost by ${DIM_LABELS[dim].toLowerCase()}`}>
            <HBar data={d.by[dim].map((r) => ({ key: r.key, value: r.cents }))} format={fmtUsd} />
          </Card>
        ))}
      </div>
    </>
  );
}

function RawTab({ day: initialDay }: { day: string }) {
  const [day, setDay] = useState(initialDay);
  const [source, setSource] = useState<"claude_code" | "cost">("claude_code");
  const raw = useJson<unknown>(`/api/raw?source=${source}&day=${day}&to=${day}&from=${day}`);
  return (
    <Card title="Raw API response" subtitle="Untouched upstream rows for one day">
      <div className="mb-3 flex flex-wrap gap-3 text-sm">
        <select className="rounded-md border border-line bg-surface-1 px-2 py-1" value={source} onChange={(e) => setSource(e.target.value as typeof source)} aria-label="Endpoint">
          <option value="claude_code">usage_report/claude_code</option>
          <option value="cost">analytics/cost</option>
        </select>
        <input type="date" className="rounded-md border border-line bg-surface-1 px-2 py-1" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" />
      </div>
      {raw.error && <p role="alert" className="text-sm">{raw.error}</p>}
      <pre className="max-h-[600px] overflow-auto rounded-lg bg-surface-0 p-3 text-xs" data-testid="raw-json">
        {raw.loading ? "Loading…" : JSON.stringify(raw.data, null, 2)}
      </pre>
    </Card>
  );
}
