import { ApiState } from '../components/ApiState';
import { ChartCard } from '../components/ChartCard';
import { TrendChart } from '../components/charts/TrendChart';
import { DataGrid } from '../components/DataGrid';
import { KpiTile } from '../components/KpiTile';
import { KpiGrid, Stack } from '../components/layout';
import { fmtFixed1, fmtInt, type GridColumn, type UserRow } from '../lib';
import { useClaudeCode } from './useClaudeCode';

const columns: GridColumn<UserRow>[] = [
  { key: 'label', title: 'User', value: u => u.label },
  { key: 'commits', title: 'Commits', value: u => u.commits, numeric: true },
  { key: 'prs', title: 'PRs', value: u => u.prs, numeric: true },
  {
    key: 'linesAdded',
    title: 'Lines added',
    value: u => u.linesAdded,
    numeric: true,
  },
];

export const CommitsTab = () => (
  <ApiState state={useClaudeCode()}>
    {d => (
      <Stack>
        <KpiGrid>
          <KpiTile
            label="Commits by Claude Code"
            value={fmtInt(d.kpis.commits)}
          />
          <KpiTile
            label="Pull requests by Claude Code"
            value={fmtInt(d.kpis.prs)}
          />
          <KpiTile
            label="Commits per active user"
            value={
              d.kpis.activeUsers
                ? fmtFixed1(d.kpis.commits / d.kpis.activeUsers)
                : '—'
            }
          />
          <KpiTile
            label="Lines added per commit"
            value={
              d.kpis.commits ? fmtInt(d.kpis.linesAdded / d.kpis.commits) : '—'
            }
          />
        </KpiGrid>
        <ChartCard title="Commits and pull requests per day">
          <TrendChart
            rows={d.daily}
            series={[
              { key: 'commits', label: 'Commits' },
              { key: 'prs', label: 'Pull requests' },
            ]}
          />
        </ChartCard>
        <ChartCard title="Top contributors">
          <DataGrid
            items={d.topContributors}
            columns={columns}
            sortKey="commits"
            rowKey={u => u.label}
          />
        </ChartCard>
      </Stack>
    )}
  </ApiState>
);
