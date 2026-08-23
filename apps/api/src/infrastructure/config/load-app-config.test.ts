import { describe, expect, it } from 'vitest';

import { CAPACITOR_ORIGINS, DEFAULT_DEV_ORIGINS } from './app-config';
import { InvalidAppConfigError, loadAppConfig } from './load-app-config';

describe('loadAppConfig', () => {
  it('applies development defaults, including Capacitor origins', () => {
    const config = loadAppConfig({ NODE_ENV: 'development' });

    expect(config.port).toBe(3000);
    expect(config.appVersion).toBe('dev');
    expect(config.corsOrigins).toEqual([...DEFAULT_DEV_ORIGINS, ...CAPACITOR_ORIGINS]);
    expect(config.rateLimit).toEqual({ ttlMs: 60_000, limit: 120 });
  });

  it('parses a comma-separated origin list and still keeps Capacitor origins', () => {
    const config = loadAppConfig({
      NODE_ENV: 'development',
      CORS_ORIGINS: 'https://app.example.com, https://staging.example.com',
    });

    expect(config.corsOrigins).toEqual([
      'https://app.example.com',
      'https://staging.example.com',
      ...CAPACITOR_ORIGINS,
    ]);
  });

  it('refuses to boot in production without CORS_ORIGINS', () => {
    expect(() => loadAppConfig({ NODE_ENV: 'production' })).toThrow(InvalidAppConfigError);
  });

  it('still allows the Capacitor wrapper when production names a web origin', () => {
    const config = loadAppConfig({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://app.example.com',
      APP_VERSION: '1.2.3',
    });

    expect(config.corsOrigins).toEqual(['https://app.example.com', ...CAPACITOR_ORIGINS]);
    expect(config.appVersion).toBe('1.2.3');
  });

  it('rejects a port that is not a TCP port', () => {
    expect(() => loadAppConfig({ PORT: '70000' })).toThrow(InvalidAppConfigError);
  });
});
