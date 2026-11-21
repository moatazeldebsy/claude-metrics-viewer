import { ApiState } from '../components/ApiState';
import { ChartCard } from '../components/ChartCard';
import { HBarChart } from '../components/charts/HBarChart';
import { StackedBarChart } from '../components/charts/StackedBarChart';
import { TrendChart } from '../components/charts/TrendChart';
import { DataGrid } from '../components/DataGrid';
import { KpiTile } from '../components/KpiTile';
import { ChartGrid, KpiGrid, Stack } from '../components/layout';
import { useDashboard } from '../hooks/useDashboard';
import { useFilters } from '../hooks/useFilters';
import {
  fmtFixed1,
  fmtInt,
  fmtPct,
  fmtUsd,
  type DepartmentRow,
  type GridColumn,
  type SeriesDef,
} from '@internal/claude-metrics-lib';

interface DepartmentSummary {
  rows: DepartmentRow[];
  weekly: ({ week: string } & Record<string, number | string>)[];
  totals: {
    departments: number;
    seats: number;
    activeUsers: number;
    adoption: number;
    tiers: Record<'power' | 'regular' | 'light' | 'inactive', number>;
  };
}

const TIERS: SeriesDef[] = [
  { key: 'power', label: 'Power (≥60% of days)' },
  { key: 'regular', label: 'Regular (25–60%)' },
  { key: 'light', label: 'Light (<25%)' },
  { key: 'inactive', label: 'Inactive', color: 'muted' },
];

const pct = fmtPct as (v: never) => string;
const usd = fmtUsd as (v: never) => string;
const columns: GridColumn<DepartmentRow>[] = [
  { key: 'department', title: 'Department', value: r => r.department },
  { key: 'seats', title: 'Seats', value: r => r.seats, numeric: true },
  {
    key: 'activeUsers',
    title: 'Active',
    value: r => r.activeUsers,
    numeric: true,
  },
  {
    key: 'adoption',
    title: 'Adoption',
    value: r => r.adoption,
    numeric: true,
    format: pct,
  },
  { key: 'power', title: 'Power', value: r => r.tiers.power, numeric: true },
  { key: 'light', title: 'Light', value: r => r.tiers.light, numeric: true },
  {
    key: 'spa',
    title: 'Sessions / active',
    value: r => r.sessionsPerActive,
    numeric: true,
    format: fmtFixed1 as (v: never) => string,
  },
  {
    key: 'acceptRate',
    title: 'Accept rate',
    value: r => r.acceptRate,
    numeric: true,
    format: pct,
  },
  {
    key: 'cost',
    title: 'Est. cost',
    value: r => r.costCents,
    numeric: true,
    format: usd,
  },
  {
    key: 'cpa',
    title: 'Cost / active',
    value: r => r.costPerActive,
    numeric: true,
    format: usd,
  },
];

/** The 8 largest departments: a stable pick so colours follow departments, not rank changes. */
const trendSeries = (rows: DepartmentRow[]): SeriesDef[] =>
  [...rows]
    .sort(
      (a, b) => b.seats - a.seats || a.department.localeCompare(b.department),
    )
    .slice(0, 8)
    .map(r => r.department)
    .sort()
    .map(dep => ({ key: dep, label: dep }));

export const DepartmentsTab = () => {
  const f = useFilters();
  return (
    <ApiState state={useDashboard<DepartmentSummary>('departments')}>
      {d => {
        const lowest = d.rows.slice(0, 15);
        return (
          <Stack>
            <KpiGrid>
              <KpiTile
                label="Org adoption"
                value={fmtPct(d.totals.adoption)}
                hint={`${fmtInt(d.totals.activeUsers)} of ${fmtInt(
                  d.totals.seats,
                )} seats active`}
              />
              <KpiTile
                label="Departments"
                value={fmtInt(d.totals.departments)}
              />
              <KpiTile
                label="Power users"
                value={fmtInt(d.totals.tiers.power)}
                hint="Active ≥60% of selected days"
              />
              <KpiTile
                label="Inactive seats"
                value={fmtInt(d.totals.tiers.inactive)}
              />
            </KpiGrid>
            <ChartGrid>
              <ChartCard
                title="Adoption by department"
                subtitle={
                  d.rows.length > 15
                    ? '15 lowest shown, lowest first'
                    : 'Lowest first'
                }
              >
                <HBarChart
                  data={lowest.map(r => ({
                    key: r.department,
                    value: r.adoption,
                  }))}
                  format={fmtPct}
                  max={15}
                  foldOther={false}
                />
              </ChartCard>
              <ChartCard
                title="Engagement mix by department"
                subtitle="Seats per engagement tier"
              >
                <StackedBarChart
                  horizontal
                  rows={lowest.map(r => ({ name: r.department, ...r.tiers }))}
                  xKey="name"
                  series={TIERS}
                  format={fmtInt}
                />
              </ChartCard>
            </ChartGrid>
            <ChartCard
              title="Weekly adoption"
              subtitle="Share of seats active at least once that week · complete weeks · 8 largest departments"
            >
              <TrendChart
                rows={d.weekly.map(w => ({ ...w, day: String(w.week) }))}
                series={trendSeries(d.rows)}
                format={fmtPct}
                height={300}
              />
            </ChartCard>
            <ChartCard
              title="All departments"
              subtitle="Click a row to filter the whole dashboard to that department"
            >
              <DataGrid
                items={d.rows}
                columns={columns}
                rowKey={r => r.department}
                sortKey="adoption"
                sortDesc={false}
                onRowClick={r => f.set({ department: r.department, tab: null })}
              />
            </ChartCard>
          </Stack>
        );
      }}
    </ApiState>
  );
};
