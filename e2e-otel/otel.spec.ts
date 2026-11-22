import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const kpi = (page: Page, label: string) =>
  page.getByTestId("kpi").filter({ has: page.getByText(label, { exact: true }) }).getByTestId("kpi-value");

test.describe.configure({ mode: "serial" });

// The fixture was recorded on 2026-11-22; restamp it to now so it stays inside the default range.
const nowNs = String(BigInt(Date.now()) * 1_000_000n);
const fixture = readFileSync("tests/fixtures/otlp/claude-code-metrics.json", "utf8").replace(
  /"(start)?[tT]imeUnixNano":\s*"\d+"/g,
  (_m, start) => `"${start ? "startTimeUnixNano" : "timeUnixNano"}":"${nowNs}"`,
);

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
    data: fixture,
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
  await expect(page.getByTestId("departments-csv-note")).toHaveText(
    "Adoption and inactive seats need the full member list, not just people who've used Claude Code. Add a departments CSV (DEPARTMENTS_FILE) to see them.",
  );
  await expect(page.getByText("Org adoption", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Inactive seats", { exact: true })).toHaveCount(0);
});

test("ingest refuses a missing token and an oversized body before storing anything", async ({ request }) => {
  const noToken = await request.post("/v1/metrics", { headers: { "content-type": "application/json" }, data: fixture });
  expect(noToken.status()).toBe(401);
  const big = await request.post("/v1/metrics", {
    headers: { "content-type": "application/x-protobuf", authorization: "Bearer e2e" },
    data: Buffer.alloc(6 * 1024 * 1024),
  });
  expect(big.status()).toBe(413);
});
