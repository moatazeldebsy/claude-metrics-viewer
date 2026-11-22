import { ApiState } from '../components/ApiState';
import { ChartCard } from '../components/ChartCard';
import { StackedBarChart } from '../components/charts/StackedBarChart';
import { TrendChart } from '../components/charts/TrendChart';
import { DataGrid } from '../components/DataGrid';
import { KpiTile } from '../components/KpiTile';
import { ChartGrid, KpiGrid, Stack } from '../components/layout';
import {
  fmtCompact,
  fmtInt,
  fmtPct,
  TOOL_NAMES,
  type GridColumn,
  type ToolName,
} from '@moatazeldebsy/claude-metrics-lib';
import { useClaudeCode, type ClaudeCodeResponse } from './useClaudeCode';

const LABELS: Record<ToolName, string> = {
  edit_tool: 'Edit',
  multi_edit_tool: 'MultiEdit',
  write_tool: 'Write',
  notebook_edit_tool: 'NotebookEdit',
};

type Tool = ClaudeCodeResponse['tools'][number];
const columns: GridColumn<Tool>[] = [
  { key: 'tool', title: 'Tool', value: t => LABELS[t.tool] },
  { key: 'accepted', title: 'Accepted', value: t => t.accepted, numeric: true },
  { key: 'rejected', title: 'Rejected', value: t => t.rejected, numeric: true },
  {
    key: 'total',
    title: 'Total',
    value: t => t.accepted + t.rejected,
    numeric: true,
  },
  {
    key: 'rate',
    title: 'Accept rate',
    value: t => t.rate,
    numeric: true,
    format: fmtPct as (v: never) => string,
  },
];

export const ToolsTab = () => (
  <ApiState state={useClaudeCode()}>
    {d => (
      <Stack>
        <KpiGrid>
          {d.tools.map(t => (
            <KpiTile
              key={t.tool}
              label={`${LABELS[t.tool]} accept rate`}
              value={fmtPct(t.rate)}
              hint={`${fmtInt(t.accepted + t.rejected)} proposals`}
            />
          ))}
        </KpiGrid>
        <ChartGrid>
          <ChartCard title="Accept rate by tool, daily">
            <TrendChart
              rows={d.daily.map(p => ({ day: p.day, ...p.toolRates }))}
              series={TOOL_NAMES.map(t => ({ key: t, label: LABELS[t] }))}
              format={fmtPct}
            />
          </ChartCard>
          <ChartCard title="Proposals by tool">
            <StackedBarChart
              rows={d.tools.map(t => ({ ...t, name: LABELS[t.tool] }))}
              xKey="name"
              series={[
                { key: 'accepted', label: 'Accepted' },
                { key: 'rejected', label: 'Rejected' },
              ]}
              format={fmtCompact}
            />
          </ChartCard>
        </ChartGrid>
        <ChartCard title="Table view">
          <DataGrid
            items={d.tools}
            columns={columns}
            sortKey="total"
            rowKey={t => t.tool}
          />
        </ChartCard>
      </Stack>
    )}
  </ApiState>
);
