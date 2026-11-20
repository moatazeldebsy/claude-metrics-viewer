import { handler } from "@/lib/route";
import { departmentSummary } from "@/lib/service";

export const GET = handler((q) => departmentSummary(q));
