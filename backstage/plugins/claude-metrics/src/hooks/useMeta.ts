import { createContext, useContext } from 'react';
import type { SourceCapabilities } from '@moatazeldebsy/claude-metrics-lib';

/** The backend's /meta response. */
export interface Meta {
  dataSource: 'mock' | 'anthropic' | 'otel';
  holidayCountry: string;
  departments: string[];
  capabilities?: SourceCapabilities;
  telemetry?: { lastReceivedAt: string | null } | null;
}

const ALL: SourceCapabilities = {
  billedCost: true,
  seats: true,
  rawUpstream: true,
  remoteSplit: true,
  includesToday: false,
};

/** Provided by the page once /meta has loaded. */
export const MetaContext = createContext<Meta | undefined>(undefined);

/** What the current data source can show; everything is available until /meta answers. */
export function useCapabilities(): SourceCapabilities {
  return useContext(MetaContext)?.capabilities ?? ALL;
}
