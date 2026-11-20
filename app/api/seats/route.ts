import { handler } from "@/lib/route";
import { seatSummary } from "@/lib/service";

export const GET = handler((q) => seatSummary(q));
