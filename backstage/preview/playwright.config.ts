import { defineConfig } from '@playwright/test';

// Checks the static preview page; no server needed (it is opened from disk).
export default defineConfig({
  testDir: '.',
  testMatch: 'preview.spec.ts',
  reporter: 'list',
  outputDir: 'test-results',
  use: { viewport: { width: 1440, height: 1000 } },
});
