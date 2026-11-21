import { ConfigReader } from '@backstage/config';
import { applyConfig } from './config';

describe('applyConfig', () => {
  it('requires adminKey when dataSource is anthropic', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(() =>
      applyConfig(
        new ConfigReader({ claudeMetrics: { dataSource: 'anthropic' } }),
        env,
      ),
    ).toThrow(
      'claudeMetrics.adminKey is required when dataSource is anthropic',
    );
  });

  it('maps config onto the env vars lib/ reads', () => {
    const env: NodeJS.ProcessEnv = {};
    applyConfig(
      new ConfigReader({
        claudeMetrics: {
          dataSource: 'anthropic',
          adminKey: 'k',
          departmentsFile: 'd.csv',
          holidayCountry: 'DE',
        },
      }),
      env,
    );
    expect(env).toEqual({
      DATA_SOURCE: 'anthropic',
      ANTHROPIC_ADMIN_KEY: 'k',
      DEPARTMENTS_FILE: 'd.csv',
      HOLIDAY_COUNTRY: 'DE',
    });
  });

  it('leaves existing env alone when claudeMetrics config is absent', () => {
    const env: NodeJS.ProcessEnv = {
      DATA_SOURCE: 'anthropic',
      ANTHROPIC_ADMIN_KEY: 'x',
    };
    applyConfig(new ConfigReader({}), env);
    expect(env).toEqual({ DATA_SOURCE: 'anthropic', ANTHROPIC_ADMIN_KEY: 'x' });
  });
});
