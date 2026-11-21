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
  // An empty value counts as unset: `adminKey: ${ANTHROPIC_ADMIN_KEY}` becomes '' when the
  // variable is defined but empty, as Docker Compose's `${VAR:-}` does. getOptionalString
  // rejects empty strings, which would fail startup even on mock data.
  const optionalString = (key: string) => {
    const value = c?.getOptional(key);
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'string') {
      throw new Error(`claudeMetrics.${key} must be a string`);
    }
    return value;
  };
  if (c) {
    set('DATA_SOURCE', optionalString('dataSource'));
    set('ANTHROPIC_ADMIN_KEY', optionalString('adminKey'));
    set('DEPARTMENTS_FILE', optionalString('departmentsFile'));
    set('HOLIDAY_COUNTRY', optionalString('holidayCountry'));
  }
  if (env.DATA_SOURCE === 'anthropic' && !env.ANTHROPIC_ADMIN_KEY) {
    throw new Error(
      'claudeMetrics.adminKey is required when dataSource is anthropic',
    );
  }
}
