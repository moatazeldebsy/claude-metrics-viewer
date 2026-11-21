import { ApiState } from '../components/ApiState';
import { ChartCard } from '../components/ChartCard';
import { HBarChart } from '../components/charts/HBarChart';
import { DataGrid } from '../components/DataGrid';
import { KpiTile } from '../components/KpiTile';
import { ChartGrid, KpiGrid, Stack } from '../components/layout';
import { fmtInt, fmtPct, type GridColumn } from '../lib';
import { useClaudeCode, type ClaudeCodeResponse } from './useClaudeCode';

type Term = ClaudeCodeResponse['terminals'][number];
const columns: GridColumn<Term>[] = [
  { key: 'terminal', title: 'Terminal', value: t => t.terminal },
  { key: 'users', title: 'Users', value: t => t.users, numeric: true },
  { key: 'sessions', title: 'Sessions', value: t => t.sessions, numeric: true },
];

export const EnvironmentsTab = () => (
  <ApiState state={useClaudeCode()}>
    {d => {
      const { localSessions, remoteSessions } = d.remoteSplit;
      const total = localSessions + remoteSessions;
      return (
        <Stack>
          <KpiGrid>
            <KpiTile
              label="Terminals in use"
              value={fmtInt(d.terminals.length)}
            />
            <KpiTile
              label="Local sessions"
              value={fmtInt(localSessions)}
              hint={total ? fmtPct(localSessions / total) : undefined}
            />
            <KpiTile
              label="Remote sessions"
              value={fmtInt(remoteSessions)}
              hint={total ? fmtPct(remoteSessions / total) : undefined}
            />
          </KpiGrid>
          <ChartGrid>
            <ChartCard title="Sessions by terminal">
              <HBarChart
                data={d.terminals.map(t => ({
                  key: t.terminal,
                  value: t.sessions,
                }))}
                format={fmtInt}
              />
            </ChartCard>
            <ChartCard title="Users by terminal">
              <DataGrid
                items={d.terminals}
                columns={columns}
                sortKey="sessions"
                rowKey={t => t.terminal}
              />
            </ChartCard>
          </ChartGrid>
        </Stack>
      );
    }}
  </ApiState>
);
