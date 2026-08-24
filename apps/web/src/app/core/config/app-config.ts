import { InjectionToken } from '@angular/core';

export interface AppConfig {
  /**
   * Origin of the API, without a trailing slash. Empty means "same origin",
   * which is what the Vite/Angular proxy uses in development.
   */
  readonly apiBaseUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export const defaultAppConfig: AppConfig = {
  apiBaseUrl: '',
};

export function parseRuntimeAppConfig(raw: unknown): AppConfig {
  if (typeof raw !== 'object' || raw === null || !('apiBaseUrl' in raw)) {
    return defaultAppConfig;
  }

  const apiBaseUrl = raw.apiBaseUrl;
  if (typeof apiBaseUrl !== 'string') {
    return defaultAppConfig;
  }

  const trimmed = apiBaseUrl.trim().replace(/\/$/, '');
  if (trimmed === '') {
    return defaultAppConfig;
  }

  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    return defaultAppConfig;
  }

  return { apiBaseUrl: trimmed };
}
