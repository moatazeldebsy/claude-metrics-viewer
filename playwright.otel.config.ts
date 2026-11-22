import { defineConfig, devices } from "@playwright/test";

// OpenTelemetry mode needs its own server (DATA_SOURCE=otel), and Nuxt allows one dev server per
// project, so these tests run after the mock suite (see the test:e2e script), never alongside it.
const PORT = Number(process.env.E2E_OTEL_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e-otel",
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/api/meta`,
    reuseExistingServer: false,
    env: { DATA_SOURCE: "otel", OTEL_INGEST_TOKENS: "e2e", TELEMETRY_DB: `test-results/otel-e2e-${Date.now()}.db` },
    timeout: 120_000,
  },
});
