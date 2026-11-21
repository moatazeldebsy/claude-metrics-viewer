import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "#lib": path.resolve(import.meta.dirname, "lib") } },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
