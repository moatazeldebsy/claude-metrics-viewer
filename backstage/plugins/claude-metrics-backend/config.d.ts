export interface Config {
  claudeMetrics?: {
    /**
     * `mock` (default) serves a seeded 1,200-person org; `anthropic` calls the Admin API; `otel`
     * serves Claude Code OpenTelemetry metrics sent to /api/claude-metrics/otlp.
     */
    dataSource?: 'mock' | 'anthropic' | 'otel';
    /**
     * Anthropic Admin API key (Console → Settings → Admin keys). Required for `anthropic`.
     * @visibility secret
     */
    adminKey?: string;
    /** CSV with `email,department` columns, exported from your HR system or IdP. */
    departmentsFile?: string;
    /** Country (or region like `US-CA`) for the exclude-holidays filter. Default `US`. */
    holidayCountry?: string;
    /** OpenTelemetry ingest (dataSource: otel). */
    otel?: {
      /**
       * Bearer tokens Claude Code must send (OTEL_EXPORTER_OTLP_HEADERS). Ingest is disabled without one.
       * @visibility secret
       */
      ingestTokens?: string[];
      /** Days of daily totals to keep. Default 400; 0 keeps everything. */
      retentionDays?: number;
    };
  };
}
