import type { UserRow } from "@/lib/aggregate";
import type { Member } from "@/lib/sources/types";

export interface UserOption {
  value: string; // filter value: email for members, actor label for API keys
  label: string;
  department: string | null;
}

/** Typeahead over members and API actors. Prefix matches rank first, then shorter values. */
export function searchUsers(members: Member[], apiActors: string[], q: string, limit = 20): UserOption[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const options: UserOption[] = [
    ...members.map((m) => ({ value: m.email, label: `${m.name} · ${m.email}`, department: m.department })),
    ...apiActors.map((a) => ({ value: a, label: a, department: null })),
  ];
  const score = (o: UserOption) => {
    const v = o.value.toLowerCase();
    const l = o.label.toLowerCase();
    if (v.startsWith(needle) || l.startsWith(needle)) return 0;
    if (v.includes(needle) || l.includes(needle)) return 1;
    return -1;
  };
  return options
    .map((o) => ({ o, s: score(o) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s || a.o.value.length - b.o.value.length || a.o.value.localeCompare(b.o.value))
    .slice(0, limit)
    .map((x) => x.o);
}

export interface UserPageQuery {
  q: string;
  sort: keyof UserRow;
  desc: boolean;
  page: number; // 1-based
  pageSize: number;
}

export function pageUsers(rows: UserRow[], { q, sort, desc, page, pageSize }: UserPageQuery) {
  const needle = q.trim().toLowerCase();
  const filtered = needle ? rows.filter((r) => r.label.toLowerCase().includes(needle)) : rows;
  const sorted = [...filtered].sort((a, b) => {
    const va = a[sort];
    const vb = b[sort];
    const cmp = va == null ? -1 : vb == null ? 1 : typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return desc ? -cmp : cmp;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: sorted.slice((p - 1) * pageSize, p * pageSize), total: sorted.length, page: p, pages };
}
