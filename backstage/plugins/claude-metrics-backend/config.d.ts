export interface Config {
  claudeMetrics?: {
    /** `mock` (default) serves a seeded 1,200-person org; `anthropic` calls the Admin API. */
    dataSource?: 'mock' | 'anthropic';
    /**
     * Anthropic Admin API key (Console → Settings → Admin keys). Required for `anthropic`.
     * @visibility secret
     */
    adminKey?: string;
    /** CSV with `email,department` columns, exported from your HR system or IdP. */
    departmentsFile?: string;
    /** Country (or region like `US-CA`) for the exclude-holidays filter. Default `US`. */
    holidayCountry?: string;
  };
}
