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

/**
 * Process liveness only. It deliberately touches no dependency: the platform health
 * check calls it every few seconds, and a database ping there would keep a
 * scale-to-zero database awake permanently (ADR-015).
 */
export const livenessResponseSchema = z.strictObject({
  status: z.literal('alive'),
});

export type LivenessResponse = z.infer<typeof livenessResponseSchema>;
