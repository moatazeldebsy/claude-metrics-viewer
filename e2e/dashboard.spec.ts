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

test("the user picker searches on the server and narrows to one user", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "User filter" }).fill("ada.x");
  await page.getByRole("option", { name: /ada\.xu@example\.com/ }).click();
  await expect(page).toHaveURL(/user=ada\.xu%40example\.com/);
  await expect(page.getByTestId("user-chip")).toContainText("ada.xu@example.com");
  await expect(kpi(page, "Active users")).toHaveText(/^[01]$/);
  await page.getByRole("button", { name: "Clear user filter" }).click();
  await expect(page.getByRole("combobox", { name: "User filter" })).toBeVisible();
});

test("departments tab ranks adoption and drills into a department", async ({ page }) => {
  await page.goto("/?tab=departments");
  await expect(kpi(page, "Org adoption")).toHaveText(/%$/);
  const rows = page.getByTestId("departments-table").locator("tbody tr");
  await expect(rows).toHaveCount(12);
  await rows.filter({ hasText: "Design" }).click();
  await expect(page).toHaveURL(/department=Design/);
  await expect(page.getByLabel("Department filter")).toHaveValue("Design");
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
});

test("users table pages and searches on the server", async ({ page }) => {
  await page.goto("/?tab=users");
  await expect(page.getByTestId("page-info")).toContainText("page 1 of");
  await expect(page.getByTestId("users-table").locator("tbody tr")).toHaveCount(25);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByTestId("page-info")).toContainText("page 2 of");
  await page.getByLabel("Search users").fill("ada.");
  await expect(page.getByTestId("page-info")).toContainText("page 1 of 1");
  for (const cell of await page.getByTestId("users-table").locator("tbody tr td:first-child").allInnerTexts()) expect(cell).toContain("ada.");
});

test("cost tab explains that department filters don't apply", async ({ page }) => {
  await page.goto("/?tab=cost&department=Design");
  await expect(page.getByTestId("cost-filter-note")).toBeVisible();
});

test("seats lists idle members a page at a time", async ({ page }) => {
  await page.goto("/?tab=seats");
  await expect(page.getByTestId("idle-table").locator("tbody tr")).toHaveCount(25);
  await page.getByLabel("Search idle members").fill("Design");
  await expect(page.getByTestId("idle-table").locator("tbody tr").first()).toContainText("Design");
});

test("API response tab shows raw upstream JSON", async ({ page }) => {
  await page.goto("/?tab=api");
  await expect(page.getByTestId("raw-json")).toContainText('"core_metrics"');
  await page.getByLabel("Endpoint").selectOption("cost");
  await expect(page.getByTestId("raw-json")).toContainText('"list_amount"');
});
