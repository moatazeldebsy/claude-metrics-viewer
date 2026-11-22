import { ApiState } from '../components/ApiState';
import { ChartCard } from '../components/ChartCard';
import { TrendChart } from '../components/charts/TrendChart';
import { DataGrid } from '../components/DataGrid';
import { Stack } from '../components/layout';
import {
  fmtCompact,
  fmtUsd,
  modelCostRows,
  type GridColumn,
} from '@moatazeldebsy/claude-metrics-lib';
import { useClaudeCode, type ClaudeCodeResponse } from './useClaudeCode';

type Model = ClaudeCodeResponse['models'][number];
const compact = fmtCompact as (v: never) => string;
const columns: GridColumn<Model>[] = [
  { key: 'model', title: 'Model', value: m => m.model },
  {
    key: 'input',
    title: 'Input',
    value: m => m.input,
    numeric: true,
    format: compact,
  },
  {
    key: 'output',
    title: 'Output',
    value: m => m.output,
    numeric: true,
    format: compact,
  },
  {
    key: 'cacheRead',
    title: 'Cache read',
    value: m => m.cacheRead,
    numeric: true,
    format: compact,
  },
  {
    key: 'cacheCreation',
    title: 'Cache write',
    value: m => m.cacheCreation,
    numeric: true,
    format: compact,
  },
  {
    key: 'cost',
    title: 'Est. cost',
    value: m => m.costCents,
    numeric: true,
    format: fmtUsd as (v: never) => string,
  },
];

export const ModelsTab = () => (
  <ApiState state={useClaudeCode()}>
    {d => (
      <Stack>
        <ChartCard title="Estimated Claude Code cost per model, daily">
          <TrendChart
            rows={modelCostRows(
              d.daily,
              d.models.map(m => m.model),
            )}
            series={d.models.map(m => ({ key: m.model, label: m.model }))}
            format={fmtUsd}
          />
        </ChartCard>
        <ChartCard title="Tokens and cost by model">
          <DataGrid
            items={d.models}
            columns={columns}
            sortKey="cost"
            rowKey={m => m.model}
          />
        </ChartCard>
      </Stack>
    )}
  </ApiState>
);
