import { z } from 'zod';

/**
 * The first contract, deliberately trivial: it exists to prove the chain from a shared
 * schema to server-side validation to a typed client, before any domain endpoint
 * depends on that chain working.
 */
export const healthStatusSchema = z.enum(['ok', 'degraded']);

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthResponseSchema = z.strictObject({
  status: healthStatusSchema,
  /** Deployed revision, so a bug report can be tied to a specific build. */
  version: z.string(),
  uptimeSeconds: z.number().int().nonnegative(),
  /** ISO 8601 with an offset, per the "no naive timestamps" convention. */
  checkedAt: z.iso.datetime({ offset: true }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
