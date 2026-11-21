import { COST_DIMENSIONS } from "#lib/service";
import { dataSourceName, getSource } from "#lib/sources";

// Untouched upstream rows for one day, for the "API response" tab.
export default defineDashboardHandler(async (q, sp) => {
  const day = sp.get("day") ?? q.to;
  const src = getSource();
  const data =
    sp.get("source") === "cost"
      ? await src.cost({ from: day, to: day, groupBy: [...COST_DIMENSIONS], daily: true })
      : await src.claudeCodeDay(day);
  return { dataSource: dataSourceName(), day, data };
});
