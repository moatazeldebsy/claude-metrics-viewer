import { renderInTestApp, mockApis } from '@backstage/frontend-test-utils';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { screen } from '@testing-library/react';
import { claudeMetricsApiRef } from '../api';
import { fakeApi, META } from '../testUtils';
import { ClaudeMetricsPage } from './ClaudeMetricsPage';

describe('permission gate', () => {
  it('shows a no-access message and loads nothing when the policy denies', async () => {
    const fake = fakeApi({
      meta: META,
      'claude-code': () => new Promise(() => {}),
    });
    const requested: string[] = [];
    await renderInTestApp(<ClaudeMetricsPage />, {
      apis: [
        [claudeMetricsApiRef, fake.api],
        mockApis.permission({
          authorize: req => {
            requested.push(req.permission.name);
            return AuthorizeResult.DENY;
          },
        }),
      ],
    });
    expect(
      await screen.findByText(/You don't have access to Claude Metrics/),
    ).toBeInTheDocument();
    expect(requested).toContain('claude-metrics.dashboard.read');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(fake.calls).toEqual([]);
  });

  // The allowed path is covered by ClaudeMetricsPage.test.tsx, which renders the tabs under the
  // test app's default (allow-all) permission API. A second render here would reuse
  // usePermission's cached DENY from the test above.
});
