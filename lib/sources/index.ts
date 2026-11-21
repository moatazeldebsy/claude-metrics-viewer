import { loadDepartmentsFile } from "#lib/departments";
import { AnthropicSource } from "./anthropic";
import { MockSource } from "./mock";
import type { MetricsSource } from "./types";

let cached: MetricsSource | undefined;

/** DATA_SOURCE=anthropic uses the real Admin API; anything else uses mock data. */
export function getSource(): MetricsSource {
  if (cached) return cached;
  if (process.env.DATA_SOURCE === "anthropic") {
    const apiKey = process.env.ANTHROPIC_ADMIN_KEY;
    if (!apiKey) throw new Error("DATA_SOURCE=anthropic requires ANTHROPIC_ADMIN_KEY");
    cached = new AnthropicSource(apiKey, undefined, loadDepartmentsFile(process.env.DEPARTMENTS_FILE));
  } else {
    cached = new MockSource();
  }
  return cached;
}

export const dataSourceName = () => (process.env.DATA_SOURCE === "anthropic" ? "anthropic" : "mock");
