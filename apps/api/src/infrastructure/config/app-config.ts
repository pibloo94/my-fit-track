export const APP_CONFIG = Symbol('APP_CONFIG');

export type NodeEnv = 'development' | 'test' | 'production';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

/**
 * Validated runtime configuration. Nothing in the process reads `process.env`
 * after bootstrap: a missing value fails here, not on the first request that
 * happens to need it.
 */
export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly host: string;
  readonly appVersion: string;
  readonly logLevel: LogLevel;
  readonly corsOrigins: readonly string[];
  readonly databaseUrl: string;
  readonly rateLimit: {
    readonly ttlMs: number;
    readonly limit: number;
  };
}

/** Origins the Capacitor wrapper will use. Always allowed, even if env omits them. */
export const CAPACITOR_ORIGINS = ['capacitor://localhost', 'https://localhost'] as const;

export const DEFAULT_DEV_ORIGINS = ['http://localhost:4200'] as const;

/** Matches `docker-compose.yml`. Used when development omits `DATABASE_URL`. */
export const DEFAULT_DEV_DATABASE_URL =
  'postgresql://myfittrack:myfittrack@localhost:5432/myfittrack?schema=public';

/**
 * Closed local port so `/health` fails in milliseconds instead of hanging.
 * Integration tests override `DATABASE_URL` with a Testcontainers URI.
 */
export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://unused:unused@127.0.0.1:1/unused?connect_timeout=1';
