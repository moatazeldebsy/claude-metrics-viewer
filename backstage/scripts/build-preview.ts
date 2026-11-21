/**
 * Builds backstage/preview/index.html: a static picture of the Claude Metrics plugin inside
 * Backstage. The numbers are real output of @internal/claude-metrics-lib on the seeded mock org, for a fixed range so
 * the file only changes when the data layer does.
 *
 *   npx tsx backstage/scripts/build-preview.ts      (from the repo root)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  claudeCodeSummary,
  costSummary,
  COST_DIMENSIONS,
  dataSourceName,
  departmentList,
  departmentSummary,
  getSource,
  holidayCountry,
  PALETTE,
  seatSummary,
  usersPage,
  type DashboardQuery,
} from '../packages/claude-metrics-lib/src/server';

const FROM = '2026-10-24';
const TO = '2026-11-20';
const q: DashboardQuery = { from: FROM, to: TO, excludeWeekends: false, excludeHolidays: false, user: null, department: null };

async function main() {
  const src = getSource();
  const [claudeCode, departments, cost, users, seats, departmentNames, rawClaudeCode, rawCost] = await Promise.all([
    claudeCodeSummary(q),
    departmentSummary(q),
    costSummary(q),
    usersPage(q, { q: '', sort: 'sessions', desc: true, page: 1, pageSize: 100 }),
    seatSummary(q, { page: 1, pageSize: 25 }),
    departmentList(),
    src.claudeCodeDay(TO),
    src.cost({ from: TO, to: TO, groupBy: [...COST_DIMENSIONS], daily: true }),
  ]);
  const data = {
    range: { from: FROM, to: TO },
    meta: { dataSource: dataSourceName(), holidayCountry: holidayCountry(), departments: departmentNames },
    palette: PALETTE,
    claudeCode,
    departments,
    cost,
    users,
    seats,
    // The raw tab shows the first few upstream rows; the full day is thousands of records.
    raw: {
      claude_code: { dataSource: dataSourceName(), day: TO, data: rawClaudeCode.slice(0, 3) },
      cost: { dataSource: dataSourceName(), day: TO, data: rawCost.slice(0, 3) },
    },
  };

  const dir = path.join(import.meta.dirname, '..', 'preview');
  const body = readFileSync(path.join(dir, 'template.html'), 'utf8').replace(
    '/*__PREVIEW_DATA__*/null',
    JSON.stringify(data).replace(/</g, '\\u003c'),
  );
  // template.html holds the page body; wrap it so index.html opens straight from disk.
  writeFileSync(path.join(dir, 'index.html'), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
  console.log(`wrote preview/index.html (${Math.round(body.length / 1024)} KB)`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
