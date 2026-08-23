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
