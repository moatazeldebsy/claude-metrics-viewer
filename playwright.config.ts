import { defineConfig, devices } from "@playwright/test";

// Nuxt allows one dev server per project, so reuse the usual port (and a running server) locally.
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/api/meta`,
    reuseExistingServer: !process.env.CI,
    env: { DATA_SOURCE: "mock" },
    timeout: 120_000,
  },
});
