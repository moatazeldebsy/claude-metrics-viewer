import { handler } from "@/lib/route";
import { departmentList } from "@/lib/service";

export const GET = handler(async () => ({ departments: await departmentList() }));
