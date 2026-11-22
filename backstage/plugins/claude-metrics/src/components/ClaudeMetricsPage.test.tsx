import { ResponseError } from '@backstage/errors';
import { renderInTestApp } from '@backstage/frontend-test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { claudeMetricsApiRef } from '../api';
import { addDays, toDay } from '@moatazeldebsy/claude-metrics-lib';
import { fakeApi, META } from '../testUtils';
import { ClaudeMetricsPage } from './ClaudeMetricsPage';

const TAB_LABELS = [
  'Overview',
  'Departments',
  'Tool acceptance',
  'Environments',
  'Commits & PRs',
  'Models',
  'Cost & usage',
  'Users',
  'Seats',
  'API response',
];

async function badRequest(message: string) {
  return ResponseError.fromResponse(
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
}

const render = (fake: ReturnType<typeof fakeApi>, url = '/') =>
  renderInTestApp(<ClaudeMetricsPage />, {
    apis: [[claudeMetricsApiRef, fake.api]],
    initialRouteEntries: [url],
  });

describe('ClaudeMetricsPage', () => {
  it('shows the ten tabs in order and the data source', async () => {
    const fake = fakeApi({
      meta: META,
      'claude-code': () => new Promise(() => {}),
    });
    await render(fake);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(TAB_LABELS);
    expect(await screen.findByText('Data source: mock')).toBeInTheDocument();
  });

  it('shows the server message for an invalid range', async () => {
    const today = toDay(new Date());
    const fake = fakeApi({
      meta: META,
      'claude-code': async () => {
        throw await badRequest(
          "to must be before today (UTC); today's data is incomplete",
        );
      },
    });
    await render(fake, `/?to=${today}`);
    expect(
      await screen.findByText(/to must be before today/),
    ).toBeInTheDocument();
  });

  it('the 7-day preset requests the last 7 days ending yesterday', async () => {
    const yesterday = addDays(toDay(new Date()), -1);
    const fake = fakeApi({
      meta: META,
      'claude-code': () => new Promise(() => {}),
    });
    await render(fake);
    fireEvent.click(await screen.findByRole('button', { name: 'Last 7 days' }));
    await waitFor(() =>
      expect(fake.last('claude-code')).toEqual({
        from: addDays(yesterday, -6),
        to: yesterday,
      }),
    );
  });

  it('switching tabs loads that tab', async () => {
    const fake = fakeApi({
      meta: META,
      'claude-code': () => new Promise(() => {}),
      cost: () => new Promise(() => {}),
    });
    await render(fake);
    fireEvent.click(await screen.findByRole('tab', { name: 'Cost & usage' }));
    await waitFor(() => expect(fake.last('cost')).toBeDefined());
  });

  it('a department filter in the URL reaches every request', async () => {
    const fake = fakeApi({
      meta: META,
      'claude-code': () => new Promise(() => {}),
    });
    await render(fake, '/?department=Data');
    await waitFor(() =>
      expect(fake.last('claude-code')).toEqual(
        expect.objectContaining({ department: 'Data' }),
      ),
    );
  });
});
