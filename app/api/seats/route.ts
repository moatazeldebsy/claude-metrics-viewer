import { handler } from "@/lib/route";
import { seatSummary } from "@/lib/service";

export const GET = handler((q, sp) =>
  seatSummary(q, { text: sp.get("q") ?? "", page: Math.max(1, Number(sp.get("page")) || 1), pageSize: 25 }),
);
