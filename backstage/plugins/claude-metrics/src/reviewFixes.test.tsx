import { ResponseError } from '@backstage/errors';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { claudeMetricsApiRef } from './api';
import seats from './__fixtures__/seats.json';
import { ClaudeMetricsPage } from './components/ClaudeMetricsPage';
import { FilterBar } from './components/FilterBar';
import { fakeApi, META } from './testUtils';
import { router, RouterSpy } from './testRouter';
import { SeatsTab } from './tabs/SeatsTab';
import { UsersTab } from './tabs/UsersTab';

const badRequest = (message: string) =>
  ResponseError.fromResponse(
    new Response(
      JSON.stringify({
        error: { name: 'InputError', message },
        response: { statusCode: 400 },
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    ),
  );
const failWith = (message: string) => async () => {
  throw await badRequest(message);
};

describe('review fixes', () => {
  it('Users tab shows the server message for an invalid range (#1)', async () => {
    const fake = fakeApi({ users: failWith('from must be on or before to') });
    await renderInTestApp(<UsersTab />, {
      apis: [[claudeMetricsApiRef, fake.api]],
    });
    expect(
      await screen.findByText(/from must be on or before to/),
    ).toBeInTheDocument();
  });

  it('Seats tab shows the server message for an invalid range (#1)', async () => {
    const fake = fakeApi({ seats: failWith('from must be on or before to') });
    await renderInTestApp(<SeatsTab />, {
      apis: [[claudeMetricsApiRef, fake.api]],
    });
    expect(
      await screen.findByText(/from must be on or before to/),
    ).toBeInTheDocument();
  });

  it('a malformed date in the URL shows the server message instead of crashing (#2)', async () => {
    const fake = fakeApi({
      meta: META,
      'claude-code': failWith('from/to must be YYYY-MM-DD'),
    });
    await renderInTestApp(<ClaudeMetricsPage />, {
      apis: [[claudeMetricsApiRef, fake.api]],
      initialRouteEntries: ['/?from=2026-02-30&to=abc'],
    });
    expect(
      await screen.findByText(/from\/to must be YYYY-MM-DD/),
    ).toBeInTheDocument();
    expect(screen.getByText('Date range')).toBeInTheDocument();
  });

  it('meta is fetched once, without the filters (#6)', async () => {
    const fake = fakeApi({
      meta: META,
      'claude-code': () => new Promise(() => {}),
    });
    await renderInTestApp(<ClaudeMetricsPage />, {
      apis: [[claudeMetricsApiRef, fake.api]],
      initialRouteEntries: ['/?department=Data'],
    });
    await screen.findByText('Data source: mock');
    expect(
      fake.calls.filter(c => c.route === 'meta').map(c => c.params),
    ).toEqual([{}]);
  });

  it('clearing the user field removes the user filter (#3)', async () => {
    const fake = fakeApi({ 'user-search': { options: [] } });
    await renderInTestApp(
      <>
        <FilterBar departments={META.departments} holidayCountry="US" />
        <RouterSpy />
      </>,
      {
        apis: [[claudeMetricsApiRef, fake.api]],
        initialRouteEntries: ['/?user=ada@example.com'],
      },
    );
    const search = () => router.search();
    await userEvent.clear(screen.getByRole('combobox', { name: 'User' }));
    await waitFor(() => expect(search().has('user')).toBe(false));
  });

  it('picking a user shows their name in the field (#3)', async () => {
    const fake = fakeApi({
      'user-search': {
        options: [
          { value: 'ada@example.com', label: 'Ada', department: 'Data' },
        ],
      },
    });
    await renderInTestApp(
      <FilterBar departments={META.departments} holidayCountry="US" />,
      {
        apis: [[claudeMetricsApiRef, fake.api]],
      },
    );
    const input = screen.getByRole('combobox', {
      name: 'User',
    }) as HTMLInputElement;
    await userEvent.type(input, 'ad');
    await userEvent.click(await screen.findByRole('option', { name: /Ada/ }));
    await waitFor(() => expect(input.value).toBe('Ada'));
  });

  it('Seats KPIs ignore a stale response from the previous filters (#4)', async () => {
    let releaseOld: () => void = () => {};
    const fake = fakeApi({
      seats: (p: Record<string, string>) =>
        p.from === '2026-01-01'
          ? new Promise(resolve => {
              releaseOld = () => resolve({ ...seats, totalSeats: 111 });
            })
          : { ...seats, totalSeats: 999 },
    });
    await renderInTestApp(
      <>
        <SeatsTab />
        <RouterSpy />
      </>,
      {
        apis: [[claudeMetricsApiRef, fake.api]],
        initialRouteEntries: ['/?from=2026-01-01&to=2026-01-28'],
      },
    );
    await waitFor(() => expect(fake.last('seats')?.from).toBe('2026-01-01'));
    await act(async () => router.navigate('/?from=2026-02-01&to=2026-02-28'));
    expect(await screen.findByText('999')).toBeInTheDocument();
    await act(async () => releaseOld());
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('111')).not.toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
  });
});
