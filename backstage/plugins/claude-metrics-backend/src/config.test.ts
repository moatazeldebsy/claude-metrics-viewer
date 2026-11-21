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

  it('refuses to start when env selects anthropic without a key (#7)', () => {
    const env: NodeJS.ProcessEnv = { DATA_SOURCE: 'anthropic' };
    expect(() => applyConfig(new ConfigReader({}), env)).toThrow(
      /adminKey is required/,
    );
  });

  it('treats empty values (e.g. Docker Compose ${VAR:-}) as unset on mock', () => {
    const env: NodeJS.ProcessEnv = {};
    applyConfig(
      new ConfigReader({
        claudeMetrics: {
          dataSource: 'mock',
          adminKey: '',
          departmentsFile: '',
          holidayCountry: '',
        },
      }),
      env,
    );
    expect(env).toEqual({ DATA_SOURCE: 'mock' });
  });

  it('still requires a key on anthropic when adminKey is an empty string', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(() =>
      applyConfig(
        new ConfigReader({
          claudeMetrics: { dataSource: 'anthropic', adminKey: '' },
        }),
        env,
      ),
    ).toThrow(
      'claudeMetrics.adminKey is required when dataSource is anthropic',
    );
  });
});
