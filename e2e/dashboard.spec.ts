import { expect, test, type Page } from "@playwright/test";

const kpi = (page: Page, label: string) =>
  page.getByTestId("kpi").filter({ has: page.getByText(label, { exact: true }) }).locator("div").nth(1);

const num = async (page: Page, label: string) => Number((await kpi(page, label).innerText()).replace(/[^\d.]/g, ""));

test("overview shows KPIs and the mock-data badge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("mock-badge")).toBeVisible();
  await expect(page.getByTestId("kpi")).toHaveCount(8);
  await expect(kpi(page, "Active users")).toHaveText(/^\d+$/);
});

test("every tab renders without an error", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Tool acceptance", "Environments", "Commits & PRs", "Models", "Cost & usage", "Users", "Seats", "API response"]) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Loading…")).toHaveCount(0);
    // Scope to <main>: Next.js adds its own empty role="alert" route announcer.
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  }
});

test("a shorter date range lowers session totals", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Last 28 days" }).click();
  await expect(page).toHaveURL(/from=/);
  const sessions28 = await num(page, "Sessions");
  await page.getByRole("button", { name: "Last 7 days" }).click();
  await expect.poll(() => num(page, "Sessions")).toBeLessThan(sessions28);
});

test("excluding weekends keeps the filter in the URL", async ({ page }) => {
  await page.goto("/");
  // Checkbox state comes from the URL, so click and assert rather than check().
  await page.getByLabel("Exclude weekends").click();
  await expect(page).toHaveURL(/excludeWeekends=true/);
  await expect(page.getByLabel("Exclude weekends")).toBeChecked();
});

test("the user filter narrows to one user", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("User filter").locator("option")).not.toHaveCount(1);
  await page.getByLabel("User filter").selectOption("ada@example.com");
  await expect(kpi(page, "Active users")).toHaveText("1");
});

test("seats lists members without activity", async ({ page }) => {
  await page.goto("/?tab=seats");
  await expect(page.getByTestId("idle-table").locator("tbody tr")).not.toHaveCount(0);
});

test("API response tab shows raw upstream JSON", async ({ page }) => {
  await page.goto("/?tab=api");
  await expect(page.getByTestId("raw-json")).toContainText('"core_metrics"');
  await page.getByLabel("Endpoint").selectOption("cost");
  await expect(page.getByTestId("raw-json")).toContainText('"list_amount"');
});
