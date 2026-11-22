import { useApi } from '@backstage/frontend-plugin-api';
import { useCallback, useEffect, useRef, useState } from 'react';
import { claudeMetricsApiRef } from '../api';
import { ChartCard } from '../components/ChartCard';
import { ServerGrid, type PageRequest } from '../components/DataGrid';
import { KpiTile } from '../components/KpiTile';
import { KpiGrid, Stack } from '../components/layout';
import { useFilters } from '../hooks/useFilters';
import { useCapabilities } from '../hooks/useMeta';
import { NotAvailable } from '../components/NotAvailable';
import {
  fmtInt,
  fmtPct,
  type GridColumn,
  type Member,
} from '@internal/claude-metrics-lib';

interface SeatSummary {
  totalSeats: number;
  activeSeats: number;
  idleCount: number;
  idle: { rows: Member[]; total: number; page: number; pages: number };
}

const columns: GridColumn<Member>[] = [
  { key: 'name', title: 'Name', value: m => m.name },
  { key: 'email', title: 'Email', value: m => m.email },
  {
    key: 'department',
    title: 'Department',
    value: m => m.department ?? 'Unassigned',
  },
  { key: 'role', title: 'Role', value: m => m.role },
  {
    key: 'added_at',
    title: 'Member since',
    value: m => m.added_at.slice(0, 10),
  },
];

const Seats = () => {
  const api = useApi(claudeMetricsApiRef);
  const { query } = useFilters();
  const [summary, setSummary] = useState<SeatSummary>();
  // The KPIs come from the paged response; drop them when the filters change, and ignore a
  // response that arrives after newer filters were applied.
  const queryKey = JSON.stringify(query);
  const latestKey = useRef(queryKey);
  latestKey.current = queryKey;
  useEffect(() => setSummary(undefined), [queryKey]);
  const fetchPage = useCallback(
    async (r: PageRequest) => {
      const res = await api.get<SeatSummary>('seats', {
        ...query,
        q: r.q,
        page: String(r.page),
        pageSize: String(r.pageSize),
      });
      if (latestKey.current === queryKey) setSummary(res);
      return res.idle;
    },
    [api, query, queryKey],
  );
  return (
    <Stack>
      {summary && (
        <KpiGrid>
          <KpiTile label="Members" value={fmtInt(summary.totalSeats)} />
          <KpiTile
            label="Used Claude Code"
            value={fmtInt(summary.activeSeats)}
            hint={
              summary.totalSeats
                ? fmtPct(summary.activeSeats / summary.totalSeats)
                : undefined
            }
          />
          <KpiTile label="No activity" value={fmtInt(summary.idleCount)} />
        </KpiGrid>
      )}
      <ChartCard title="Members with no Claude Code activity in this range">
        <ServerGrid
          key={JSON.stringify(query)}
          columns={columns}
          fetchPage={fetchPage}
          rowKey={m => m.id}
          searchLabel="Search idle members"
        />
      </ChartCard>
    </Stack>
  );
};

export const SeatsTab = () =>
  useCapabilities().seats ? (
    <Seats />
  ) : (
    <NotAvailable
      title="Seats aren't available with this data"
      reason="Seats need a member list. Add a departments CSV (claudeMetrics.departmentsFile) to see members with no activity."
    />
  );
