import { expect, test, type Page } from "@playwright/test";

const kpi = (page: Page, label: string) =>
  page.getByTestId("kpi").filter({ has: page.getByText(label, { exact: true }) }).getByTestId("kpi-value");

const num = async (page: Page, label: string) => Number((await kpi(page, label).innerText()).replace(/[^\d.]/g, ""));

/** Pick an option from a Vuetify v-select / v-autocomplete menu. */
async function chooseOption(page: Page, name: string | RegExp) {
  await page.getByRole("option", { name }).click();
}

test("overview shows KPIs and the mock-data badge", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("mock-badge")).toBeVisible();
  await expect(page.getByTestId("kpi")).toHaveCount(8);
  await expect(kpi(page, "Active users")).toHaveText(/^[\d,]+$/);
});

test("every tab renders without an error", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Departments", "Tool acceptance", "Environments", "Commits & PRs", "Models", "Cost & usage", "Users", "Seats", "API response"]) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("main .v-card").first()).toBeVisible();
    await expect(page.getByTestId("api-error")).toHaveCount(0);
  }
});

test("a shorter date range lowers session totals", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Last 28 days" }).click();
  await expect(page).toHaveURL(/from=/);
  await expect(kpi(page, "Sessions")).toHaveText(/\d/);
  const sessions28 = await num(page, "Sessions");
  await page.getByRole("button", { name: "Last 7 days" }).click();
  await expect.poll(() => num(page, "Sessions")).toBeLessThan(sessions28);
});

test("excluding weekends keeps the filter in the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Exclude weekends").check();
  await expect(page).toHaveURL(/excludeWeekends=true/);
});

test("the user picker searches on the server and narrows to one user", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "User" }).fill("ada.x");
  await chooseOption(page, /ada\.xu@example\.com/);
  await expect(page).toHaveURL(/user=ada\.xu(%40|@)example\.com/);
  await expect(kpi(page, "Active users")).toHaveText(/^[01]$/);
  await page.getByLabel("Clear User").click();
  await expect(page).not.toHaveURL(/user=/);
});

test("departments tab ranks adoption and drills into a department", async ({ page }) => {
  await page.goto("/?tab=departments");
  await expect(kpi(page, "Org adoption")).toHaveText(/%$/);
  const rows = page.getByTestId("departments-table").locator("tbody tr");
  await expect(rows).toHaveCount(12);
  await rows.filter({ hasText: /^Design/ }).click();
  await expect(page).toHaveURL(/department=Design/);
  await expect(page.getByTestId("department-filter")).toContainText("Design");
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
});

test("department filter can be picked from the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("department-filter").click();
  await chooseOption(page, "Platform");
  await expect(page).toHaveURL(/department=Platform/);
});

test("users table pages and searches on the server", async ({ page }) => {
  await page.goto("/?tab=users");
  const table = page.getByTestId("users-table");
  await expect(table.locator("tbody tr")).toHaveCount(25);
  await expect(table.locator(".v-data-table-footer__info")).toContainText("1-25 of");
  await page.getByLabel("Next page").click();
  await expect(table.locator(".v-data-table-footer__info")).toContainText("26-50 of");
  await page.getByLabel("Search users").fill("ada.");
  await expect(table.locator(".v-data-table-footer__info")).toContainText("1-");
  await expect.poll(async () => (await table.locator("tbody tr td:first-child").allInnerTexts()).every((t) => t.includes("ada."))).toBe(true);
});

test("cost tab explains that department filters don't apply", async ({ page }) => {
  await page.goto("/?tab=cost&department=Design");
  await expect(page.getByTestId("cost-filter-note")).toBeVisible();
});

test("seats lists idle members a page at a time", async ({ page }) => {
  await page.goto("/?tab=seats");
  const table = page.getByTestId("idle-table");
  await expect(table.locator("tbody tr")).toHaveCount(25);
  await page.getByLabel("Search idle members").fill("Design");
  await expect(table.locator("tbody tr").first()).toContainText("Design");
});

test("API response tab shows raw upstream JSON", async ({ page }) => {
  await page.goto("/?tab=api");
  await expect(page.getByTestId("raw-json")).toContainText('"core_metrics"');
  await page.getByTestId("endpoint-select").click();
  await chooseOption(page, "analytics/cost");
  await expect(page.getByTestId("raw-json")).toContainText('"list_amount"');
});
