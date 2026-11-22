import { Alert } from '@backstage/ui';
import { ApiState } from '../components/ApiState';
import { ChartCard } from '../components/ChartCard';
import { HBarChart } from '../components/charts/HBarChart';
import { TrendChart } from '../components/charts/TrendChart';
import { KpiTile } from '../components/KpiTile';
import { ChartGrid, KpiGrid, Stack } from '../components/layout';
import { useDashboard } from '../hooks/useDashboard';
import { useFilters } from '../hooks/useFilters';
import { useCapabilities } from '../hooks/useMeta';
import { NotAvailable } from '../components/NotAvailable';
import { fmtUsd } from '@moatazeldebsy/claude-metrics-lib';

const DIMS = {
  model: 'model',
  workspace_id: 'workspace',
  api_key_id: 'API key',
  product: 'product',
  service_tier: 'service tier',
  cost_type: 'cost type',
} as const;

interface CostSummary {
  totalCents: number;
  listCents: number;
  daily: { day: string; cents: number }[];
  by: Record<keyof typeof DIMS, { key: string; cents: number }[]>;
}

const BilledCost = () => {
  const f = useFilters();
  const filtered = Boolean(f.param('user') || f.param('department'));
  return (
    <Stack>
      {filtered && (
        <Alert
          status="info"
          icon
          description="Organization-wide figures: the department and user filters don’t apply here, because the cost API has no department dimension."
        />
      )}
      <ApiState state={useDashboard<CostSummary>('cost')}>
        {d => {
          const days = d.daily.filter(x => x.cents > 0).length || 1;
          return (
            <Stack>
              <KpiGrid>
                <KpiTile
                  label="Total cost"
                  value={fmtUsd(d.totalCents)}
                  hint="After discounts, before credits"
                />
                <KpiTile label="List price" value={fmtUsd(d.listCents)} />
                <KpiTile
                  label="Discounts"
                  value={fmtUsd(d.listCents - d.totalCents)}
                  hint="Batch and other discounts"
                />
                <KpiTile
                  label="Average per day"
                  value={fmtUsd(d.totalCents / days)}
                />
              </KpiGrid>
              <ChartCard
                title="Daily cost"
                subtitle="Usage & Cost Analytics API. Data can lag 4 to 24 hours."
              >
                <TrendChart
                  rows={d.daily}
                  series={[{ key: 'cents', label: 'Cost' }]}
                  format={fmtUsd}
                />
              </ChartCard>
              <ChartGrid>
                {(Object.keys(DIMS) as (keyof typeof DIMS)[]).map(dim => (
                  <ChartCard key={dim} title={`Cost by ${DIMS[dim]}`}>
                    <HBarChart
                      data={d.by[dim].map(r => ({
                        key: r.key,
                        value: r.cents,
                      }))}
                      format={fmtUsd}
                    />
                  </ChartCard>
                ))}
              </ChartGrid>
            </Stack>
          );
        }}
      </ApiState>
    </Stack>
  );
};

export const CostTab = () =>
  useCapabilities().billedCost ? (
    <BilledCost />
  ) : (
    <NotAvailable
      title="Cost & usage isn't available with OpenTelemetry data"
      reason="Billed cost comes from the Admin API. With OpenTelemetry data, Overview and Models show Claude Code's estimated cost."
    />
  );
