import { seatSummary } from "#lib/service";

export default defineDashboardHandler((q, sp) =>
  seatSummary(q, { text: sp.get("q") ?? "", page: intParam(sp, "page", 1), pageSize: intParam(sp, "pageSize", 25, 100) }),
);
