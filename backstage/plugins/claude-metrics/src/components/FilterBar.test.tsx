import { renderInTestApp } from '@backstage/frontend-test-utils';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { claudeMetricsApiRef } from '../api';
import { fakeApi, META } from '../testUtils';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('labels the holiday switch with the country', async () => {
    const fake = fakeApi({});
    await renderInTestApp(
      <FilterBar departments={META.departments} holidayCountry="DE" />,
      {
        apis: [[claudeMetricsApiRef, fake.api]],
      },
    );
    expect(screen.getByText('Exclude holidays (DE)')).toBeInTheDocument();
  });

  it('searches users on the server with the current filters, without the user filter', async () => {
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
        initialRouteEntries: ['/?user=old@example.com&department=Data'],
      },
    );
    const input = screen.getByRole('combobox', { name: 'User' });
    await userEvent.clear(input);
    await userEvent.type(input, 'ad');
    await waitFor(() =>
      expect(fake.last('user-search')).toEqual(
        expect.objectContaining({ q: 'ad', department: 'Data' }),
      ),
    );
    expect(fake.last('user-search')).not.toHaveProperty('user');
    expect(await screen.findByText('Ada')).toBeInTheDocument();
  });
});
