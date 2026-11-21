import type { UserRow } from "#lib/aggregate";
import { usersPage } from "#lib/service";

const SORTABLE = new Set<keyof UserRow>(["label", "sessions", "linesAdded", "linesRemoved", "commits", "prs", "acceptRate", "costCents", "activeDays", "lastActive"]);

export default defineDashboardHandler((q, sp) => {
  const sort = sp.get("sort") as keyof UserRow;
  return usersPage(q, {
    q: sp.get("q") ?? "",
    sort: SORTABLE.has(sort) ? sort : "sessions",
    desc: sp.get("desc") !== "false",
    page: intParam(sp, "page", 1),
    pageSize: intParam(sp, "pageSize", 25, 100),
  });
});
