import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "#lib": path.resolve(import.meta.dirname, "backstage/packages/claude-metrics-lib/src") } },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
