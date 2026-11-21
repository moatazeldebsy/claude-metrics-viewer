import { Config } from '@backstage/config';

/**
 * `lib/` reads its settings from env vars. Copy the `claudeMetrics` config block onto them;
 * keys that are not configured leave the env as it is.
 */
export function applyConfig(
  config: Config,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const c = config.getOptionalConfig('claudeMetrics');
  if (!c) return;
  const set = (name: string, value: string | undefined) => {
    if (value !== undefined) env[name] = value;
  };
  const dataSource = c.getOptionalString('dataSource');
  const adminKey = c.getOptionalString('adminKey');
  if (dataSource === 'anthropic' && !adminKey && !env.ANTHROPIC_ADMIN_KEY) {
    throw new Error(
      'claudeMetrics.adminKey is required when dataSource is anthropic',
    );
  }
  set('DATA_SOURCE', dataSource);
  set('ANTHROPIC_ADMIN_KEY', adminKey);
  set('DEPARTMENTS_FILE', c.getOptionalString('departmentsFile'));
  set('HOLIDAY_COUNTRY', c.getOptionalString('holidayCountry'));
}
