# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: preview.spec.ts >> works at phone width without horizontal scroll
- Location: backstage/preview/preview.spec.ts:59:1

# Error details

```
Error: page.goto: net::ERR_FILE_NOT_FOUND at file:///Users/moataznabil/claude-metrics-viewer/backstage/preview/index.html
Call log:
  - navigating to "file:///Users/moataznabil/claude-metrics-viewer/backstage/preview/index.html", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test, type Page } from '@playwright/test';
  2  | import path from 'node:path';
  3  | import { pathToFileURL } from 'node:url';
  4  | 
  5  | const PAGE = pathToFileURL(path.join(__dirname, 'index.html')).href;
  6  | 
  7  | // Each tab and a card title that only that tab shows.
  8  | const TABS: [string, string][] = [
  9  |   ['Overview', 'Daily active users'],
  10 |   ['Departments', 'Engagement mix by department'],
  11 |   ['Tool acceptance', 'Accept rate by tool, daily'],
  12 |   ['Environments', 'Sessions by terminal'],
  13 |   ['Commits & PRs', 'Top contributors'],
  14 |   ['Models', 'Tokens and cost by model'],
  15 |   ['Cost & usage', 'Cost by service tier'],
  16 |   ['Users', 'Sorted, searched and paged on the server'],
  17 |   ['Seats', 'Members with no Claude Code activity in this range'],
  18 |   ['API response', 'Raw API response'],
  19 | ];
  20 | 
  21 | function trackErrors(page: Page) {
  22 |   const errors: string[] = [];
  23 |   page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  24 |   page.on('pageerror', e => errors.push(String(e)));
  25 |   return errors;
  26 | }
  27 | 
  28 | for (const scheme of ['light', 'dark'] as const) {
  29 |   test(`every tab renders (${scheme})`, async ({ page }) => {
  30 |     await page.emulateMedia({ colorScheme: scheme });
  31 |     const errors = trackErrors(page);
  32 |     await page.goto(PAGE);
  33 |     await expect(page.getByText('Data source: mock')).toBeVisible();
  34 |     for (const [label, card] of TABS) {
  35 |       await page.getByRole('tab', { name: label, exact: true }).click();
  36 |       await expect(page.getByText(card, { exact: true }).first()).toBeVisible();
  37 |       const slug = label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '');
  38 |       await page.screenshot({ path: path.join(__dirname, 'screenshots', `${slug}-${scheme}.png`), fullPage: true });
  39 |     }
  40 |     expect(errors).toEqual([]);
  41 |   });
  42 | }
  43 | 
  44 | test('overview KPIs come from the mock data, not placeholders', async ({ page }) => {
  45 |   await page.goto(PAGE);
  46 |   const tile = page.getByTestId('kpi').filter({ hasText: 'Active users' });
  47 |   await expect(tile.getByTestId('kpi-value')).toHaveText(/^\d{1,3}(,\d{3})*$/);
  48 |   await expect(page.locator('canvas')).toHaveCount(4);
  49 | });
  50 | 
  51 | test('users table pages through rows', async ({ page }) => {
  52 |   await page.goto(`${PAGE}#users`);
  53 |   const first = await page.locator('tbody tr').first().innerText();
  54 |   await page.getByRole('button', { name: 'Next page' }).click();
  55 |   await expect(page.locator('tbody tr').first()).not.toHaveText(first);
  56 |   await expect(page.getByText(/26 – 50 of/)).toBeVisible();
  57 | });
  58 | 
  59 | test('works at phone width without horizontal scroll', async ({ page }) => {
  60 |   await page.setViewportSize({ width: 400, height: 900 });
> 61 |   await page.goto(PAGE);
     |              ^ Error: page.goto: net::ERR_FILE_NOT_FOUND at file:///Users/moataznabil/claude-metrics-viewer/backstage/preview/index.html
  62 |   const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  63 |   expect(overflow).toBeLessThanOrEqual(0);
  64 | });
  65 | 
```