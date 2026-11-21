import { coreApis } from '@backstage/frontend-plugin-api';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { act, screen } from '@testing-library/react';
import { addDays, toDay } from '../lib';
import { useFilters } from './useFilters';

let filters: ReturnType<typeof useFilters>;
const Probe = () => {
  filters = useFilters();
  return <span>probe</span>;
};

const render = async (url = '/') => {
  const app = await renderInTestApp(<Probe />, { initialRouteEntries: [url] });
  await screen.findByText('probe');
  const search = () =>
    new URLSearchParams(
      app.apis.get(coreApis.appHistory)!.getSnapshot().location.search,
    );
  return { search };
};

describe('useFilters', () => {
  it('defaults to the 28 days ending yesterday on the overview tab', async () => {
    const yesterday = addDays(toDay(new Date()), -1);
    await render();
    expect(filters.to).toBe(yesterday);
    expect(filters.from).toBe(addDays(yesterday, -27));
    expect(filters.tab).toBe('overview');
    expect(filters.query).toEqual({
      from: addDays(yesterday, -27),
      to: yesterday,
    });
  });

  it('passes filter params through to the query', async () => {
    await render(
      '/?from=2026-01-01&to=2026-01-31&excludeWeekends=true&department=Data&tab=cost',
    );
    expect(filters.query).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      excludeWeekends: 'true',
      department: 'Data',
    });
    expect(filters.tab).toBe('cost');
  });

  it('set() merges into the URL and drops null values', async () => {
    const { search } = await render('/?user=a@x.com&tab=users');
    await act(async () => filters.set({ department: 'Data', user: null }));
    expect(search().get('department')).toBe('Data');
    expect(search().has('user')).toBe(false);
    expect(search().get('tab')).toBe('users');
  });
});
