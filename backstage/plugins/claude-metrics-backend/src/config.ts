import { Config } from '@backstage/config';

/**
 * `lib/` reads its settings from env vars. Copy the `claudeMetrics` config block onto them;
 * keys that are not configured leave the env as it is. Fails fast when the effective settings
 * select the Anthropic source without an Admin key, wherever each value came from.
 */
export function applyConfig(
  config: Config,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const c = config.getOptionalConfig('claudeMetrics');
  const set = (name: string, value: string | undefined) => {
    if (value !== undefined) env[name] = value;
  };
  if (c) {
    set('DATA_SOURCE', c.getOptionalString('dataSource'));
    set('ANTHROPIC_ADMIN_KEY', c.getOptionalString('adminKey'));
    set('DEPARTMENTS_FILE', c.getOptionalString('departmentsFile'));
    set('HOLIDAY_COUNTRY', c.getOptionalString('holidayCountry'));
  }
  if (env.DATA_SOURCE === 'anthropic' && !env.ANTHROPIC_ADMIN_KEY) {
    throw new Error(
      'claudeMetrics.adminKey is required when dataSource is anthropic',
    );
  }
}
