import { loadDepartmentsFile } from '../departments';
import type { TelemetryStore } from '../telemetry/store';
import { AnthropicSource } from './anthropic';
import { MockSource } from './mock';
import { OtelSource } from './otel';
import type { MetricsSource, SourceCapabilities } from './types';

let cached: MetricsSource | undefined;
let telemetryStore: TelemetryStore | undefined;

/**
 * Hosts using DATA_SOURCE=otel build their own durable store (SQLite, Backstage's database) and
 * hand it over once at startup. Passing undefined unregisters it (tests).
 */
export function registerTelemetryStore(
  store: TelemetryStore | undefined,
): void {
  telemetryStore = store;
  cached = undefined;
}

/** The store registered by the host, for its ingest route. */
export function getTelemetryStore(): TelemetryStore | undefined {
  return telemetryStore;
}

/**
 * DATA_SOURCE=anthropic uses the real Admin API, DATA_SOURCE=otel the registered telemetry store;
 * anything else uses mock data.
 */
export function getSource(): MetricsSource {
  if (cached) return cached;
  if (process.env.DATA_SOURCE === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_ADMIN_KEY;
    if (!apiKey)
      throw new Error('DATA_SOURCE=anthropic requires ANTHROPIC_ADMIN_KEY');
    cached = new AnthropicSource(
      apiKey,
      undefined,
      loadDepartmentsFile(process.env.DEPARTMENTS_FILE),
    );
  } else if (process.env.DATA_SOURCE === 'otel') {
    if (!telemetryStore)
      throw new Error(
        "DATA_SOURCE=otel needs a telemetry store; the host didn't register one.",
      );
    cached = new OtelSource(
      telemetryStore,
      loadDepartmentsFile(process.env.DEPARTMENTS_FILE),
    );
  } else {
    cached = new MockSource();
  }
  return cached;
}

export const dataSourceName = (): 'mock' | 'anthropic' | 'otel' =>
  process.env.DATA_SOURCE === 'anthropic'
    ? 'anthropic'
    : process.env.DATA_SOURCE === 'otel'
    ? 'otel'
    : 'mock';

export const sourceCapabilities = (): SourceCapabilities =>
  getSource().capabilities();

/** For DATA_SOURCE=otel, when telemetry last arrived (null = never); null for other sources. */
export async function telemetryStatus(): Promise<{
  lastReceivedAt: string | null;
} | null> {
  if (dataSourceName() !== 'otel') return null;
  const src = getSource() as OtelSource;
  return { lastReceivedAt: await src.lastReceivedAt() };
}
