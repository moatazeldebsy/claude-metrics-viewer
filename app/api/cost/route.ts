import { handler } from "@/lib/route";
import { costSummary } from "@/lib/service";

export const GET = handler((q) => costSummary(q));
