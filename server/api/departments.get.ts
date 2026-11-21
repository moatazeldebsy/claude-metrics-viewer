import { departmentSummary } from "#lib/service";

export default defineDashboardHandler((q) => departmentSummary(q));
