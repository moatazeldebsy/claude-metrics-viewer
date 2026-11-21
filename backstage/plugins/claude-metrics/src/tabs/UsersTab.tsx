import { useApi } from '@backstage/frontend-plugin-api';
import { useCallback } from 'react';
import { claudeMetricsApiRef } from '../api';
import { ChartCard } from '../components/ChartCard';
import { ServerGrid, type PageRequest } from '../components/DataGrid';
import { useFilters } from '../hooks/useFilters';
import { fmtPct, fmtUsd, type GridColumn, type UserRow } from '../lib';

type Row = UserRow & { department: string | null };

const columns: GridColumn<Row>[] = [
  { key: 'label', title: 'User', value: u => u.label },
  { key: 'department', title: 'Department', value: u => u.department },
  {
    key: 'activeDays',
    title: 'Active days',
    value: u => u.activeDays,
    numeric: true,
  },
  { key: 'sessions', title: 'Sessions', value: u => u.sessions, numeric: true },
  {
    key: 'linesAdded',
    title: 'Lines +',
    value: u => u.linesAdded,
    numeric: true,
  },
  { key: 'commits', title: 'Commits', value: u => u.commits, numeric: true },
  { key: 'prs', title: 'PRs', value: u => u.prs, numeric: true },
  {
    key: 'acceptRate',
    title: 'Accept rate',
    value: u => u.acceptRate,
    numeric: true,
    format: fmtPct as (v: never) => string,
  },
  {
    key: 'costCents',
    title: 'Est. cost',
    value: u => u.costCents,
    numeric: true,
    format: fmtUsd as (v: never) => string,
  },
  { key: 'lastActive', title: 'Last active', value: u => u.lastActive },
];

export const UsersTab = () => {
  const api = useApi(claudeMetricsApiRef);
  const { query } = useFilters();
  const fetchPage = useCallback(
    (r: PageRequest) =>
      api.get<{ rows: Row[]; total: number }>('users', {
        ...query,
        q: r.q,
        page: String(r.page),
        pageSize: String(r.pageSize),
        sort: r.sort,
        desc: String(r.desc),
      }),
    [api, query],
  );
  return (
    <ChartCard
      title="Users"
      subtitle="Sorted, searched and paged on the server"
    >
      {/* Remount on filter change so paging restarts at page 1. */}
      <ServerGrid
        key={JSON.stringify(query)}
        columns={columns}
        fetchPage={fetchPage}
        rowKey={u => u.label}
        initialSort="sessions"
        unsortable={['department']}
        searchLabel="Search users"
      />
    </ChartCard>
  );
};
