import type { UserRow } from "@/lib/aggregate";
import { handler } from "@/lib/route";
import { usersPage } from "@/lib/service";

const SORTABLE = new Set<keyof UserRow>(["label", "sessions", "linesAdded", "linesRemoved", "commits", "prs", "acceptRate", "costCents", "activeDays", "lastActive"]);

export const GET = handler((q, sp) => {
  const sort = sp.get("sort") as keyof UserRow;
  return usersPage(q, {
    q: sp.get("q") ?? "",
    sort: SORTABLE.has(sort) ? sort : "sessions",
    desc: sp.get("desc") !== "false",
    page: Math.max(1, Number(sp.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 25)),
  });
});
