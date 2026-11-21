import { renderInTestApp } from '@backstage/frontend-test-utils';
import { screen } from '@testing-library/react';
import type { FC } from 'react';
import { claudeMetricsApiRef } from '../api';
import claudeCode from '../__fixtures__/claude-code.json';
import { fmtInt, fmtPct, fmtUsd } from '../lib';
import { fakeApi } from '../testUtils';
import { CommitsTab } from './CommitsTab';
import { EnvironmentsTab } from './EnvironmentsTab';
import { ModelsTab } from './ModelsTab';
import { OverviewTab } from './OverviewTab';
import { ToolsTab } from './ToolsTab';

const render = (Tab: FC) =>
  renderInTestApp(<Tab />, {
    apis: [[claudeMetricsApiRef, fakeApi({ 'claude-code': claudeCode }).api]],
  });

const kpi = async (label: string) => {
  const tile = (await screen.findByText(label)).closest(
    '[data-testid="kpi"]',
  ) as HTMLElement;
  return tile.querySelector('[data-testid="kpi-value"]')!.textContent;
};

const { kpis } = claudeCode;

describe('Claude Code tabs', () => {
  it('Overview shows KPIs and four trend charts', async () => {
    const { container } = await render(OverviewTab);
    expect(await kpi('Active users')).toBe(fmtInt(kpis.activeUsers));
    expect(await kpi('Accept rate')).toBe(fmtPct(kpis.acceptRate));
    expect(await kpi('Cost per active user')).toBe(
      fmtUsd(kpis.costCents / kpis.activeUsers),
    );
    expect(
      screen.getByText(`+ ${kpis.apiActors} API-key actors`),
    ).toBeInTheDocument();
    expect(container.querySelectorAll('canvas')).toHaveLength(4);
  });

  it('Tool acceptance shows a KPI per tool and the table', async () => {
    await render(ToolsTab);
    const edit = claudeCode.tools.find(t => t.tool === 'edit_tool')!;
    expect(await kpi('Edit accept rate')).toBe(fmtPct(edit.rate));
    expect(screen.getByText('Table view')).toBeInTheDocument();
    expect(screen.getAllByText('MultiEdit').length).toBeGreaterThan(0);
  });

  it('Environments shows local/remote session KPIs', async () => {
    await render(EnvironmentsTab);
    expect(await kpi('Terminals in use')).toBe(
      fmtInt(claudeCode.terminals.length),
    );
    expect(await kpi('Local sessions')).toBe(
      fmtInt(claudeCode.remoteSplit.localSessions),
    );
    expect(screen.getByText('Sessions by terminal')).toBeInTheDocument();
  });

  it('Commits & PRs shows commit KPIs and top contributors', async () => {
    await render(CommitsTab);
    expect(await kpi('Commits by Claude Code')).toBe(fmtInt(kpis.commits));
    expect(
      screen.getByText(claudeCode.topContributors[0].label),
    ).toBeInTheDocument();
  });

  it('Models shows the per-model table with estimated cost', async () => {
    await render(ModelsTab);
    const top = [...claudeCode.models].sort(
      (a, b) => b.costCents - a.costCents,
    )[0];
    expect(
      await screen.findByText('Tokens and cost by model'),
    ).toBeInTheDocument();
    expect(screen.getByText(fmtUsd(top.costCents))).toBeInTheDocument();
  });
});
