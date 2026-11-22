import { discoveryApiRef } from '@backstage/frontend-plugin-api';
import { mockApis, renderInTestApp } from '@backstage/frontend-test-utils';
import { screen, waitFor } from '@testing-library/react';
import { toDay } from '@moatazeldebsy/claude-metrics-lib';
import type { ReactNode } from 'react';
import { claudeMetricsApiRef } from '../api';
import claudeCode from '../__fixtures__/claude-code.json';
import departments from '../__fixtures__/departments.json';
import { MetaContext, type Meta } from '../hooks/useMeta';
import { CostTab } from '../tabs/CostTab';
import { DepartmentsTab } from '../tabs/DepartmentsTab';
import { EnvironmentsTab } from '../tabs/EnvironmentsTab';
import { SeatsTab } from '../tabs/SeatsTab';
import { fakeApi, META } from '../testUtils';
import { ClaudeMetricsPage } from './ClaudeMetricsPage';
import { TelemetrySetup } from './TelemetrySetup';

const OTEL_CAPS = {
  billedCost: false,
  seats: false,
  rawUpstream: false,
  remoteSplit: false,
  includesToday: true,
};
const otelMeta = (lastReceivedAt: string | null): Meta => ({
  ...META,
  dataSource: 'otel',
  capabilities: OTEL_CAPS,
  telemetry: { lastReceivedAt },
});
const withMeta = (meta: Meta, node: ReactNode) => (
  <MetaContext.Provider value={meta}>{node}</MetaContext.Provider>
);
const discovery = mockApis.discovery({ baseUrl: 'http://localhost:7007' });

describe('OpenTelemetry mode', () => {
  it('setup panel shows the plugin ingest URL', async () => {
    await renderInTestApp(<TelemetrySetup />, {
      apis: [[discoveryApiRef, discovery]],
    });
    expect(
      await screen.findByText(
        /OTEL_EXPORTER_OTLP_ENDPOINT=http:\/\/localhost:7007\/api\/claude-metrics\/otlp/,
      ),
    ).toBeInTheDocument();
  });

  it('page shows the setup panel and no tabs until telemetry arrives', async () => {
    const fake = fakeApi({
      meta: otelMeta(null),
      'claude-code': () => new Promise(() => {}),
    });
    await renderInTestApp(<ClaudeMetricsPage />, {
      apis: [
        [claudeMetricsApiRef, fake.api],
        [discoveryApiRef, discovery],
      ],
    });
    expect(await screen.findByTestId('telemetry-setup')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('page labels the source and hides the API response tab once data has arrived', async () => {
    const fake = fakeApi({
      meta: otelMeta('2026-11-22T10:00:00Z'),
      'claude-code': () => new Promise(() => {}),
    });
    await renderInTestApp(<ClaudeMetricsPage />, {
      apis: [
        [claudeMetricsApiRef, fake.api],
        [discoveryApiRef, discovery],
      ],
    });
    expect(
      await screen.findByText('Data source: OpenTelemetry'),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('tab', { name: 'Overview' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'API response' }),
    ).not.toBeInTheDocument();
    // Live data: the default range ends today, not yesterday.
    await waitFor(() =>
      expect(fake.last('claude-code')?.to).toBe(toDay(new Date())),
    );
  });

  it('Cost and Seats explain why they are not available', async () => {
    const fake = fakeApi({});
    await renderInTestApp(withMeta(otelMeta('t'), <CostTab />), {
      apis: [[claudeMetricsApiRef, fake.api]],
    });
    expect(
      await screen.findByText(/Billed cost comes from the Admin API/),
    ).toBeInTheDocument();
    await renderInTestApp(withMeta(otelMeta('t'), <SeatsTab />), {
      apis: [[claudeMetricsApiRef, fake.api]],
    });
    expect(
      await screen.findByText(/Seats need a member list/),
    ).toBeInTheDocument();
    expect(fake.calls).toEqual([]);
  });

  it('Departments hides seat-based numbers without seats', async () => {
    const fake = fakeApi({ departments });
    await renderInTestApp(withMeta(otelMeta('t'), <DepartmentsTab />), {
      apis: [[claudeMetricsApiRef, fake.api]],
    });
    expect(
      await screen.findByText(
        "Adoption and inactive seats need the full member list, not just people who've used Claude Code. Add a departments CSV (claudeMetrics.departmentsFile) to see them.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Org adoption')).not.toBeInTheDocument();
    expect(screen.queryByText('Inactive seats')).not.toBeInTheDocument();
  });

  it('Environments hides the local/remote split', async () => {
    const fake = fakeApi({ 'claude-code': claudeCode });
    await renderInTestApp(withMeta(otelMeta('t'), <EnvironmentsTab />), {
      apis: [[claudeMetricsApiRef, fake.api]],
    });
    expect(await screen.findByText('Terminals in use')).toBeInTheDocument();
    expect(screen.queryByText('Local sessions')).not.toBeInTheDocument();
  });
});
