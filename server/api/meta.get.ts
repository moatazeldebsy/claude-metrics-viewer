import { holidayCountry } from "#lib/holidays";
import { departmentList } from "#lib/service";
import { dataSourceName } from "#lib/sources";

export default defineDashboardHandler(async () => ({
  dataSource: dataSourceName(),
  holidayCountry: holidayCountry(),
  departments: await departmentList(),
}));
