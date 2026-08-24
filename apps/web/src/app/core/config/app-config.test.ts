import { describe, expect, it } from 'vitest';

import { defaultAppConfig, parseRuntimeAppConfig } from './app-config';

describe('parseRuntimeAppConfig', () => {
  it('keeps same-origin when the file uses an empty API URL', () => {
    expect(parseRuntimeAppConfig({ apiBaseUrl: '' })).toEqual(defaultAppConfig);
  });

  it('strips a trailing slash from an absolute origin', () => {
    expect(parseRuntimeAppConfig({ apiBaseUrl: 'https://api.example.com/' })).toEqual({
      apiBaseUrl: 'https://api.example.com',
    });
  });

  it('rejects a value that is not an http(s) origin', () => {
    expect(parseRuntimeAppConfig({ apiBaseUrl: 'ftp://files.example.com' })).toEqual(
      defaultAppConfig,
    );
  });
});
