import { ApiState } from '../components/ApiState';
import { ChartCard } from '../components/ChartCard';
import { TrendChart } from '../components/charts/TrendChart';
import { KpiTile } from '../components/KpiTile';
import { ChartGrid, KpiGrid, Stack } from '../components/layout';
import {
  fmtCompact,
  fmtInt,
  fmtPct,
  fmtUsd,
} from '@internal/claude-metrics-lib';
import { useClaudeCode } from './useClaudeCode';

export const OverviewTab = () => (
  <ApiState state={useClaudeCode()}>
    {d => (
      <Stack>
        <KpiGrid>
          <KpiTile
            label="Active users"
            value={fmtInt(d.kpis.activeUsers)}
            hint={`+ ${d.kpis.apiActors} API-key actors`}
          />
          <KpiTile label="Sessions" value={fmtInt(d.kpis.sessions)} />
          <KpiTile
            label="Lines added"
            value={fmtInt(d.kpis.linesAdded)}
            hint={`${fmtInt(d.kpis.linesRemoved)} removed`}
          />
          <KpiTile
            label="Accept rate"
            value={fmtPct(d.kpis.acceptRate)}
            hint="Edit, MultiEdit, Write, NotebookEdit"
          />
          <KpiTile label="Commits" value={fmtInt(d.kpis.commits)} />
          <KpiTile label="Pull requests" value={fmtInt(d.kpis.prs)} />
          <KpiTile
            label="Estimated cost"
            value={fmtUsd(d.kpis.costCents)}
            hint="Claude Code only"
          />
          <KpiTile
            label="Cost per active user"
            value={
              d.kpis.activeUsers
                ? fmtUsd(d.kpis.costCents / d.kpis.activeUsers)
                : '—'
            }
          />
        </KpiGrid>
        <ChartGrid>
          <ChartCard title="Daily active users">
            <TrendChart
              rows={d.daily}
              series={[{ key: 'activeUsers', label: 'Active users' }]}
            />
          </ChartCard>
          <ChartCard title="Daily sessions">
            <TrendChart
              rows={d.daily}
              series={[{ key: 'sessions', label: 'Sessions' }]}
            />
          </ChartCard>
          <ChartCard title="Lines of code per day">
            <TrendChart
              rows={d.daily}
              series={[
                { key: 'linesAdded', label: 'Added' },
                { key: 'linesRemoved', label: 'Removed' },
              ]}
              format={fmtCompact}
            />
          </ChartCard>
          <ChartCard
            title="Daily accept rate"
            subtitle="Accepted ÷ (accepted + rejected) tool proposals"
          >
            <TrendChart
              rows={d.daily}
              series={[{ key: 'acceptRate', label: 'Accept rate' }]}
              format={fmtPct}
            />
          </ChartCard>
        </ChartGrid>
      </Stack>
    )}
  </ApiState>
);
