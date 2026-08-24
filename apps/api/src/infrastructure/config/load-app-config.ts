import { z } from 'zod';

import {
  type AppConfig,
  CAPACITOR_ORIGINS,
  DEFAULT_DEV_DATABASE_URL,
  DEFAULT_DEV_ORIGINS,
  DEFAULT_TEST_DATABASE_URL,
  type LogLevel,
  type NodeEnv,
} from './app-config';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);
const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().min(1).default('0.0.0.0'),
    APP_VERSION: z.string().min(1).default('dev'),
    LOG_LEVEL: logLevelSchema.default('info'),
    CORS_ORIGINS: z.string().optional(),
    DATABASE_URL: z.string().min(1).optional(),
    RATE_LIMIT_TTL_MS: z.coerce.number().int().min(1000).default(60_000),
    RATE_LIMIT_LIMIT: z.coerce.number().int().min(1).default(120),
  })
  .superRefine((value, context) => {
    // Production has no implicit localhost allow-list: an empty CORS_ORIGINS there
    // would mean "the browser cannot call us", which is not a default we want.
    if (value.NODE_ENV === 'production' && !value.CORS_ORIGINS?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS is required in production',
      });
    }

    if (value.NODE_ENV === 'production' && !value.DATABASE_URL?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required in production',
      });
    }
  });

export class InvalidAppConfigError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Invalid application configuration:\n${issues.join('\n')}`);
    this.name = 'InvalidAppConfigError';
  }
}

function uniqueOrigins(origins: readonly string[]): string[] {
  return [...new Set(origins)];
}

function resolveDatabaseUrl(nodeEnv: NodeEnv, raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (trimmed !== undefined && trimmed.length > 0) {
    return trimmed;
  }

  return nodeEnv === 'test' ? DEFAULT_TEST_DATABASE_URL : DEFAULT_DEV_DATABASE_URL;
}

function resolveCorsOrigins(raw: string | undefined): string[] {
  const fromEnv = (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (fromEnv.length === 0) {
    return uniqueOrigins([...DEFAULT_DEV_ORIGINS, ...CAPACITOR_ORIGINS]);
  }

  // Capacitor origins are always appended: the native wrapper keeps calling
  // from capacitor://localhost even after the web origin is a real domain.
  return uniqueOrigins([...fromEnv, ...CAPACITOR_ORIGINS]);
}

/**
 * Parses process environment into {@link AppConfig}. Call this before Nest
 * boots: a throw here is a failed deploy, not a failed request.
 */
export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new InvalidAppConfigError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join('.') : 'config';
        return `${path}: ${issue.message}`;
      }),
    );
  }

  const nodeEnv: NodeEnv = parsed.data.NODE_ENV;
  const logLevel: LogLevel = parsed.data.LOG_LEVEL;

  return {
    nodeEnv,
    port: parsed.data.PORT,
    host: parsed.data.HOST,
    appVersion: parsed.data.APP_VERSION,
    logLevel,
    corsOrigins: resolveCorsOrigins(parsed.data.CORS_ORIGINS),
    databaseUrl: resolveDatabaseUrl(nodeEnv, parsed.data.DATABASE_URL),
    rateLimit: {
      ttlMs: parsed.data.RATE_LIMIT_TTL_MS,
      limit: parsed.data.RATE_LIMIT_LIMIT,
    },
  };
}
