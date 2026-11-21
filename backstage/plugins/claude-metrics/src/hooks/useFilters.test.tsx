import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { addDays, toDay } from '../lib';
import { useFilters } from './useFilters';

function setup(initial = '/') {
  let location: ReturnType<typeof useLocation> | undefined;
  const Spy = () => {
    location = useLocation();
    return null;
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>
      {children}
      <Spy />
    </MemoryRouter>
  );
  const hook = renderHook(() => useFilters(), { wrapper });
  return { hook, search: () => new URLSearchParams(location!.search) };
}

describe('useFilters', () => {
  it('defaults to the 28 days ending yesterday on the overview tab', () => {
    const yesterday = addDays(toDay(new Date()), -1);
    const { hook } = setup();
    expect(hook.result.current.to).toBe(yesterday);
    expect(hook.result.current.from).toBe(addDays(yesterday, -27));
    expect(hook.result.current.tab).toBe('overview');
    expect(hook.result.current.query).toEqual({
      from: addDays(yesterday, -27),
      to: yesterday,
    });
  });

  it('passes filter params through to the query', () => {
    const { hook } = setup(
      '/?from=2026-01-01&to=2026-01-31&excludeWeekends=true&department=Data&tab=cost',
    );
    expect(hook.result.current.query).toEqual({
      from: '2026-01-01',
      to: '2026-01-31',
      excludeWeekends: 'true',
      department: 'Data',
    });
    expect(hook.result.current.tab).toBe('cost');
  });

  it('set() merges into the URL and drops null values', () => {
    const { hook, search } = setup('/?user=a@x.com&tab=users');
    act(() => hook.result.current.set({ department: 'Data', user: null }));
    expect(search().get('department')).toBe('Data');
    expect(search().has('user')).toBe(false);
    expect(search().get('tab')).toBe('users');
  });
});
