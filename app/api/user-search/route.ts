import { handler } from "@/lib/route";
import { userSearch } from "@/lib/service";

export const GET = handler(async (q, sp) => ({ options: await userSearch(q, sp.get("q") ?? "") }));
