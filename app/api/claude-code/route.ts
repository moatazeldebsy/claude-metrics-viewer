import { handler } from "@/lib/route";
import { claudeCodeSummary } from "@/lib/service";

export const GET = handler((q) => claudeCodeSummary(q));
