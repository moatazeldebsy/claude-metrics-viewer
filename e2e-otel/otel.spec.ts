import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const kpi = (page: Page, label: string) =>
  page.getByTestId("kpi").filter({ has: page.getByText(label, { exact: true }) }).getByTestId("kpi-value");

test.describe.configure({ mode: "serial" });

test("shows the setup panel before any telemetry arrives", async ({ page, baseURL }) => {
  await page.goto("/");
  const panel = page.getByTestId("telemetry-setup");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("OTEL_EXPORTER_OTLP_ENDPOINT");
  await expect(panel).toContainText(baseURL!);
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
});

test("shows the posted telemetry on Overview", async ({ page, request }) => {
  const res = await request.post("/v1/metrics", {
    headers: { "content-type": "application/json", authorization: "Bearer e2e" },
    data: readFileSync("tests/fixtures/otlp/claude-code-metrics.json", "utf8"),
  });
  expect(res.status()).toBe(200);
  await page.goto("/");
  await expect(page.getByTestId("telemetry-setup")).toHaveCount(0);
  await expect(page.getByText("OpenTelemetry", { exact: true })).toBeVisible();
  await expect(kpi(page, "Active users")).toHaveText("1");
  await expect(kpi(page, "Sessions")).toHaveText("1");
});

test("explains what isn't available with OpenTelemetry data", async ({ page }) => {
  await page.goto("/?tab=cost");
  await expect(page.getByTestId("not-available")).toContainText("Billed cost comes from the Admin API");
  await page.goto("/?tab=seats");
  await expect(page.getByTestId("not-available")).toContainText("Seats need a member list");
  await expect(page.getByRole("tab", { name: "API response" })).toHaveCount(0);
});

test("hides the local/remote split on Environments", async ({ page }) => {
  await page.goto("/?tab=environments");
  await expect(kpi(page, "Terminals in use")).toHaveText("1");
  await expect(page.getByText("Local sessions", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Remote sessions", { exact: true })).toHaveCount(0);
});

test("hides seat-based department numbers without a departments CSV", async ({ page }) => {
  await page.goto("/?tab=departments");
  await expect(page.getByText("Add a departments CSV to see adoption and inactive seats.")).toBeVisible();
  await expect(page.getByText("Org adoption", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Inactive seats", { exact: true })).toHaveCount(0);
});
