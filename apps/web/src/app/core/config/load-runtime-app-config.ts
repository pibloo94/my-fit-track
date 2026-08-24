import { defaultAppConfig, parseRuntimeAppConfig, type AppConfig } from './app-config';

let runtimeConfig: AppConfig = defaultAppConfig;

export function getRuntimeAppConfig(): AppConfig {
  return runtimeConfig;
}

/**
 * Reads `/app-config.json` so staging/production can point at the API origin
 * without a rebuild. Missing or malformed files keep the same-origin default.
 */
export async function loadRuntimeAppConfig(): Promise<void> {
  try {
    const response = await fetch('/app-config.json');
    if (!response.ok) {
      return;
    }

    runtimeConfig = parseRuntimeAppConfig(await response.json());
  } catch {
    runtimeConfig = defaultAppConfig;
  }
}
