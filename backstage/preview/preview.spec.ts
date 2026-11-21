import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PAGE = pathToFileURL(path.join(__dirname, 'index.html')).href;

// Each tab and a card title that only that tab shows.
const TABS: [string, string][] = [
  ['Overview', 'Daily active users'],
  ['Departments', 'Engagement mix by department'],
  ['Tool acceptance', 'Accept rate by tool, daily'],
  ['Environments', 'Sessions by terminal'],
  ['Commits & PRs', 'Top contributors'],
  ['Models', 'Tokens and cost by model'],
  ['Cost & usage', 'Cost by service tier'],
  ['Users', 'Sorted, searched and paged on the server'],
  ['Seats', 'Members with no Claude Code activity in this range'],
  ['API response', 'Raw API response'],
];

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', e => errors.push(String(e)));
  return errors;
}

for (const scheme of ['light', 'dark'] as const) {
  test(`every tab renders (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const errors = trackErrors(page);
    await page.goto(PAGE);
    await expect(page.getByText('Data source: mock')).toBeVisible();
    for (const [label, card] of TABS) {
      await page.getByRole('tab', { name: label, exact: true }).click();
      await expect(page.getByText(card, { exact: true }).first()).toBeVisible();
      const slug = label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '');
      await page.screenshot({ path: path.join(__dirname, 'test-results', 'screenshots', `${slug}-${scheme}.png`), fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test('overview KPIs come from the mock data, not placeholders', async ({ page }) => {
  await page.goto(PAGE);
  const tile = page.getByTestId('kpi').filter({ hasText: 'Active users' });
  await expect(tile.getByTestId('kpi-value')).toHaveText(/^\d{1,3}(,\d{3})*$/);
  await expect(page.locator('canvas')).toHaveCount(4);
});

test('users table pages through rows', async ({ page }) => {
  await page.goto(`${PAGE}#users`);
  const first = await page.locator('tbody tr').first().innerText();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('tbody tr').first()).not.toHaveText(first);
  await expect(page.getByText(/26 – 50 of/)).toBeVisible();
});

test('works at phone width without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 900 });
  await page.goto(PAGE);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
