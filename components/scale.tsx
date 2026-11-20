"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { UserRow } from "@/lib/aggregate";
import type { departmentSummary, seatSummary } from "@/lib/service";
import type { Member } from "@/lib/sources/types";
import type { UserOption } from "@/lib/users";
import { HBar, StackedBar, TrendChart } from "./charts";
import { Card, DataTable, fmtInt, fmtPct, fmtUsd, KpiGrid, KpiTile } from "./ui";
import { useJson } from "./useJson";

type Departments = Awaited<ReturnType<typeof departmentSummary>>;
type Seats = Awaited<ReturnType<typeof seatSummary>>;
type Paged<T> = { rows: T[]; total: number; page: number; pages: number };

const input = "rounded-md border border-line bg-surface-1 px-2 py-1 text-sm";

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Typeahead user filter. Queries the server as you type and shows at most 20 matches,
 * so it works the same for 30 users or 30,000.
 */
export function UserPicker({ value, qs, onChange }: { value: string | null; qs: string; onChange: (v: string | null) => void }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();
  const q = useDebounced(text.trim());
  const res = useJson<{ options: UserOption[] }>(open && q ? `/api/user-search?${qs}&q=${encodeURIComponent(q)}` : null);
  const options = res.data?.options ?? [];
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (o: UserOption) => {
    onChange(o.value);
    setText("");
    setOpen(false);
  };

  if (value) {
    return (
      <div className="flex items-center gap-1.5 text-ink-2">User
        <span className="flex items-center gap-1 rounded-md border border-line bg-surface-0 px-2 py-1 text-ink" data-testid="user-chip">
          {value}
          <button type="button" aria-label="Clear user filter" className="text-ink-3 hover:text-ink" onClick={() => onChange(null)}>×</button>
        </span>
      </div>
    );
  }

  return (
    <div ref={boxRef} className="relative flex items-center gap-1.5 text-ink-2">
      <label htmlFor={`${listId}-input`}>User</label>
      <input
        id={`${listId}-input`}
        className={`${input} w-64`}
        placeholder="Search name or email…"
        role="combobox"
        aria-label="User filter"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setHighlight((h) => Math.min(h + 1, options.length - 1));
          else if (e.key === "ArrowUp") setHighlight((h) => Math.max(h - 1, 0));
          else if (e.key === "Enter" && options[highlight]) pick(options[highlight]);
          else if (e.key === "Escape") setOpen(false);
          else return;
          e.preventDefault();
        }}
      />
      {open && q && (
        <ul id={listId} role="listbox" className="absolute right-0 top-full z-20 mt-1 max-h-80 w-80 overflow-auto rounded-lg border border-line bg-surface-1 py-1 shadow-lg">
          {res.loading && <li className="px-3 py-1.5 text-xs text-ink-3">Searching…</li>}
          {!res.loading && options.length === 0 && <li className="px-3 py-1.5 text-xs text-ink-3">No matches</li>}
          {options.map((o, i) => (
            <li key={o.value} role="option" aria-selected={i === highlight}
              className={`cursor-pointer px-3 py-1.5 ${i === highlight ? "bg-surface-0 text-ink" : "text-ink-2"}`}
              onMouseEnter={() => setHighlight(i)} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>
              <div className="truncate">{o.label}</div>
              {o.department && <div className="text-xs text-ink-3">{o.department}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ServerColumn<T> {
  key: string;
  label: string;
  render: (row: T) => string;
  numeric?: boolean;
  sortable?: boolean;
}

/** Table whose sorting and paging happen on the server. */
function PagedTable<T>({ data, columns, sort, desc, onSort, onPage, testId }: {
  data: Paged<T>; columns: ServerColumn<T>[]; sort?: string; desc?: boolean; onSort?: (key: string) => void; onPage: (p: number) => void; testId?: string;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid={testId}>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-2">
              {columns.map((c) => (
                <th key={c.key} className={`px-2 py-2 font-medium ${c.numeric ? "text-right" : ""}`}>
                  {c.sortable && onSort ? (
                    <button type="button" className="hover:text-ink" onClick={() => onSort(c.key)}>
                      {c.label}{sort === c.key ? (desc ? " ↓" : " ↑") : ""}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {columns.map((c) => <td key={c.key} className={`px-2 py-1.5 ${c.numeric ? "tabular text-right" : ""}`}>{c.render(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.total === 0 && <p className="py-6 text-center text-sm text-ink-3">No matches.</p>}
      <div className="mt-3 flex items-center justify-between text-xs text-ink-2">
        <span data-testid="page-info">{fmtInt(data.total)} rows · page {data.page} of {data.pages}</span>
        <div className="flex gap-1">
          <button type="button" className={input} disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</button>
          <button type="button" className={input} disabled={data.page >= data.pages} onClick={() => onPage(data.page + 1)}>Next</button>
        </div>
      </div>
    </>
  );
}

type UserRowWithDept = UserRow & { department: string | null };

export function UsersTab({ qs }: { qs: string }) {
  const [text, setText] = useState("");
  const [sort, setSort] = useState("sessions");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(1);
  const q = useDebounced(text.trim());
  const res = useJson<Paged<UserRowWithDept>>(`/api/users?${qs}&q=${encodeURIComponent(q)}&sort=${sort}&desc=${desc}&page=${page}&pageSize=25`);
  const [last, setLast] = useState<Paged<UserRowWithDept>>();
  if (res.data && res.data !== last) setLast(res.data); // keep showing the previous page while the next loads

  const cols: ServerColumn<UserRowWithDept>[] = [
    { key: "label", label: "User", render: (u) => u.label, sortable: true },
    { key: "department", label: "Department", render: (u) => u.department ?? "—" },
    { key: "activeDays", label: "Active days", render: (u) => fmtInt(u.activeDays), numeric: true, sortable: true },
    { key: "sessions", label: "Sessions", render: (u) => fmtInt(u.sessions), numeric: true, sortable: true },
    { key: "linesAdded", label: "Lines +", render: (u) => fmtInt(u.linesAdded), numeric: true, sortable: true },
    { key: "commits", label: "Commits", render: (u) => fmtInt(u.commits), numeric: true, sortable: true },
    { key: "prs", label: "PRs", render: (u) => fmtInt(u.prs), numeric: true, sortable: true },
    { key: "acceptRate", label: "Accept rate", render: (u) => fmtPct(u.acceptRate), numeric: true, sortable: true },
    { key: "costCents", label: "Est. cost", render: (u) => fmtUsd(u.costCents), numeric: true, sortable: true },
    { key: "lastActive", label: "Last active", render: (u) => u.lastActive, sortable: true },
  ];
  return (
    <Card title="Users" subtitle="Sorted, searched and paged on the server">
      <input className={`${input} mb-3 w-72`} placeholder="Filter by email or key name…" aria-label="Search users" value={text}
        onChange={(e) => { setText(e.target.value); setPage(1); }} />
      {res.error && <p role="alert" className="text-sm">{res.error}</p>}
      {last && (
        <PagedTable data={last} columns={cols} sort={sort} desc={desc} testId="users-table" onPage={setPage}
          onSort={(k) => { setDesc(k === sort ? !desc : true); setSort(k); setPage(1); }} />
      )}
    </Card>
  );
}

export function SeatsTab({ qs }: { qs: string }) {
  const [text, setText] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(text.trim());
  const res = useJson<Seats>(`/api/seats?${qs}&q=${encodeURIComponent(q)}&page=${page}`);
  const [last, setLast] = useState<Seats>();
  if (res.data && res.data !== last) setLast(res.data);
  if (!last) return res.error ? <p role="alert" className="text-sm">{res.error}</p> : <p className="text-sm text-ink-3">Loading…</p>;
  return (
    <>
      <KpiGrid>
        <KpiTile label="Members" value={fmtInt(last.totalSeats)} />
        <KpiTile label="Used Claude Code" value={fmtInt(last.activeSeats)} hint={last.totalSeats ? fmtPct(last.activeSeats / last.totalSeats) : undefined} />
        <KpiTile label="No activity" value={fmtInt(last.idleCount)} />
      </KpiGrid>
      <Card title="Members with no Claude Code activity in this range">
        <input className={`${input} mb-3 w-72`} placeholder="Filter by name, email or department…" aria-label="Search idle members" value={text}
          onChange={(e) => { setText(e.target.value); setPage(1); }} />
        <PagedTable<Member> data={last.idle} testId="idle-table" onPage={setPage} columns={[
          { key: "name", label: "Name", render: (m) => m.name },
          { key: "email", label: "Email", render: (m) => m.email },
          { key: "department", label: "Department", render: (m) => m.department ?? "Unassigned" },
          { key: "role", label: "Role", render: (m) => m.role },
          { key: "added", label: "Member since", render: (m) => m.added_at.slice(0, 10) },
        ]} />
      </Card>
    </>
  );
}

const TIERS = [
  { key: "power", label: "Power (≥60% of days)" },
  { key: "regular", label: "Regular (25–60%)" },
  { key: "light", label: "Light (<25%)" },
  { key: "inactive", label: "Inactive", color: "var(--text-muted)" },
];

export function DepartmentsTab({ qs, onDrill }: { qs: string; onDrill: (department: string) => void }) {
  const res = useJson<Departments>(`/api/departments?${qs}`);
  if (res.error) return <p role="alert" className="text-sm">{res.error}</p>;
  if (!res.data) return <p className="text-sm text-ink-3">Loading…</p>;
  const { rows, weekly, totals } = res.data;
  // Trend: the 8 largest departments, a stable choice so colours follow departments, not rank changes.
  const trendDepts = [...rows].sort((a, b) => b.seats - a.seats || a.department.localeCompare(b.department)).slice(0, 8).map((r) => r.department).sort();
  const lowest = rows.slice(0, 15);
  return (
    <>
      <KpiGrid>
        <KpiTile label="Org adoption" value={fmtPct(totals.adoption)} hint={`${fmtInt(totals.activeUsers)} of ${fmtInt(totals.seats)} seats active`} />
        <KpiTile label="Departments" value={fmtInt(totals.departments)} />
        <KpiTile label="Power users" value={fmtInt(totals.tiers.power)} hint="Active ≥60% of selected days" />
        <KpiTile label="Inactive seats" value={fmtInt(totals.tiers.inactive)} />
      </KpiGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Adoption by department" subtitle={rows.length > 15 ? "15 lowest shown, lowest first" : "Lowest first"}>
          <HBar data={lowest.map((r) => ({ key: r.department, value: r.adoption }))} format={(v) => fmtPct(v)} max={15} />
        </Card>
        <Card title="Engagement mix by department" subtitle="Seats per engagement tier">
          <StackedBar layout="vertical" data={lowest.map((r) => ({ name: r.department, ...r.tiers }))} xKey="name" series={TIERS} format={fmtInt} />
        </Card>
      </div>
      <Card title="Weekly adoption" subtitle="Share of seats active at least once that week · complete weeks · 8 largest departments">
        <TrendChart data={weekly.map((w) => ({ ...w, day: w.week as string }))} series={trendDepts.map((d) => ({ key: d, label: d }))} format={(v) => fmtPct(v)} height={300} />
      </Card>
      <Card title="All departments" subtitle="Click a row to filter the whole dashboard to that department">
        <DataTable rows={rows} initialSort="adoption" initialDesc={false} testId="departments-table" onRowClick={(r) => onDrill(r.department)} columns={[
          { key: "department", label: "Department", value: (r) => r.department },
          { key: "seats", label: "Seats", value: (r) => r.seats, numeric: true },
          { key: "activeUsers", label: "Active", value: (r) => r.activeUsers, numeric: true },
          { key: "adoption", label: "Adoption", value: (r) => r.adoption, numeric: true, format: fmtPct as (v: never) => string },
          { key: "power", label: "Power", value: (r) => r.tiers.power, numeric: true },
          { key: "light", label: "Light", value: (r) => r.tiers.light, numeric: true },
          { key: "spa", label: "Sessions / active", value: (r) => r.sessionsPerActive, numeric: true, format: ((v: number) => v.toFixed(1)) as (v: never) => string },
          { key: "acceptRate", label: "Accept rate", value: (r) => r.acceptRate, numeric: true, format: fmtPct as (v: never) => string },
          { key: "cost", label: "Est. cost", value: (r) => r.costCents, numeric: true, format: fmtUsd as (v: never) => string },
          { key: "cpa", label: "Cost / active", value: (r) => r.costPerActive, numeric: true, format: fmtUsd as (v: never) => string },
        ]} />
      </Card>
    </>
  );
}
