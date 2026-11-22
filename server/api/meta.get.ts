import { holidayCountry } from "#lib/holidays";
import { departmentList } from "#lib/service";
import { dataSourceName, sourceCapabilities, telemetryStatus } from "#lib/sources";

export default defineDashboardHandler(async () => ({
  dataSource: dataSourceName(),
  holidayCountry: holidayCountry(),
  departments: await departmentList(),
  capabilities: sourceCapabilities(),
  telemetry: await telemetryStatus(),
}));
