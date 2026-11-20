import { handler } from "@/lib/route";
import { dataSourceName, getSource } from "@/lib/sources";
import { COST_DIMENSIONS } from "@/lib/service";

// Untouched upstream rows for one day, for the "API response" tab.
export const GET = handler(async (q, sp) => {
  const day = sp.get("day") ?? q.to;
  const src = getSource();
  const data =
    sp.get("source") === "cost"
      ? await src.cost({ from: day, to: day, groupBy: [...COST_DIMENSIONS], daily: true })
      : await src.claudeCodeDay(day);
  return { dataSource: dataSourceName(), day, data };
});
