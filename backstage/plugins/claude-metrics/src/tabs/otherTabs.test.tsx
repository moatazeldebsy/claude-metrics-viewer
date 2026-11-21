import { renderInTestApp } from '@backstage/frontend-test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { FC } from 'react';
import { claudeMetricsApiRef } from '../api';
import cost from '../__fixtures__/cost.json';
import departments from '../__fixtures__/departments.json';
import rawCost from '../__fixtures__/raw-cost.json';
import seats from '../__fixtures__/seats.json';
import users from '../__fixtures__/users.json';
import { fmtInt, fmtPct, fmtUsd } from '@internal/claude-metrics-lib';
import { fakeApi } from '../testUtils';
import { CostTab } from './CostTab';
import { DepartmentsTab } from './DepartmentsTab';
import { RawTab } from './RawTab';
import { SeatsTab } from './SeatsTab';
import { UsersTab } from './UsersTab';

const render = (Tab: FC, fake: ReturnType<typeof fakeApi>, url = '/') =>
  renderInTestApp(<Tab />, {
    apis: [[claudeMetricsApiRef, fake.api]],
    initialRouteEntries: [url],
  });

const kpi = async (label: string) => {
  const tile = (await screen.findByText(label)).closest(
    '[data-testid="kpi"]',
  ) as HTMLElement;
  return tile.querySelector('[data-testid="kpi-value"]')!.textContent;
};

describe('Departments tab', () => {
  it('shows org adoption and filters the dashboard when a row is clicked', async () => {
    const fake = fakeApi({ departments });
    await render(DepartmentsTab, fake, '/?tab=departments');
    expect(await kpi('Org adoption')).toBe(fmtPct(departments.totals.adoption));
    const firstRow = screen.getAllByRole('row')[1];
    fireEvent.click(firstRow.querySelector('[role="rowheader"]')!);
    const lowest = [...departments.rows].sort(
      (a, b) => a.adoption - b.adoption,
    )[0].department;
    await waitFor(() =>
      expect(fake.last('departments')).toEqual(
        expect.objectContaining({ department: lowest }),
      ),
    );
  });
});

describe('Cost tab', () => {
  it('shows totals and a card per cost dimension', async () => {
    await render(CostTab, fakeApi({ cost }));
    expect(await kpi('Total cost')).toBe(fmtUsd(cost.totalCents));
    for (const label of [
      'model',
      'workspace',
      'API key',
      'product',
      'service tier',
      'cost type',
    ]) {
      expect(screen.getByText(`Cost by ${label}`)).toBeInTheDocument();
    }
    expect(
      screen.queryByText(/Organization-wide figures/),
    ).not.toBeInTheDocument();
  });

  it('explains that department and user filters do not apply', async () => {
    await render(CostTab, fakeApi({ cost }), '/?department=Data');
    expect(
      await screen.findByText(/Organization-wide figures/),
    ).toBeInTheDocument();
  });
});

describe('Users tab', () => {
  it('pages and sorts on the server', async () => {
    const fake = fakeApi({ users: { ...users, total: 60, pages: 3 } });
    await render(UsersTab, fake);
    await waitFor(() =>
      expect(fake.last('users')).toEqual(
        expect.objectContaining({
          page: '1',
          pageSize: '25',
          sort: 'sessions',
          desc: 'true',
          q: '',
        }),
      ),
    );
    expect(await screen.findByText(users.rows[0].label)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() =>
      expect(fake.last('users')).toEqual(
        expect.objectContaining({ page: '2' }),
      ),
    );
    fireEvent.click(screen.getByRole('columnheader', { name: /Est\. cost/ }));
    await waitFor(() =>
      expect(fake.last('users')).toEqual(
        expect.objectContaining({ sort: 'costCents' }),
      ),
    );
  });
});

describe('Seats tab', () => {
  it('shows seat KPIs from the server response', async () => {
    await render(SeatsTab, fakeApi({ seats }));
    expect(await kpi('Members')).toBe(fmtInt(seats.totalSeats));
    expect(await kpi('No activity')).toBe(fmtInt(seats.idleCount));
    expect(screen.getByText(seats.idle.rows[0].email)).toBeInTheDocument();
  });
});

describe('API response tab', () => {
  it('switches endpoint and shows the JSON', async () => {
    const fake = fakeApi({
      raw: (p: Record<string, string>) =>
        p.source === 'cost'
          ? rawCost
          : { dataSource: 'mock', day: p.day, data: [] },
    });
    await render(RawTab, fake);
    await waitFor(() =>
      expect(fake.last('raw')).toEqual(
        expect.objectContaining({ source: 'claude_code' }),
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /usage_report\/claude_code/ }),
    );
    fireEvent.click(
      await screen.findByRole('option', { name: 'analytics/cost' }),
    );
    await waitFor(() =>
      expect(fake.last('raw')).toEqual(
        expect.objectContaining({ source: 'cost' }),
      ),
    );
    expect(await screen.findByTestId('raw-json')).toHaveTextContent(
      '"starting_at"',
    );
  });
});
