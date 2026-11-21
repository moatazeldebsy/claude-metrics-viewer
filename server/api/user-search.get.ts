import { userSearch } from "#lib/service";

export default defineDashboardHandler(async (q, sp) => ({ options: await userSearch(q, sp.get("q") ?? "") }));
