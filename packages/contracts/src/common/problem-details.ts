import { z } from 'zod';

/**
 * RFC 9457 Problem Details. Every error response the API produces has this shape, so
 * a client needs one error path rather than one per endpoint.
 *
 * `type`, `title`, `status`, `detail` and `instance` are the members defined by the
 * RFC. The rest are our extensions, which the RFC explicitly permits.
 */
export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/**
 * Stable, machine-readable error codes. Clients branch on these, never on `title` or
 * `detail`, which are prose and may be reworded or translated at any time.
 */
export const problemCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'TOKEN_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'ENTITLEMENT_REQUIRED',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'IDEMPOTENCY_KEY_REUSED',
  'INTERNAL_ERROR',
]);

export type ProblemCode = z.infer<typeof problemCodeSchema>;

/** One invalid field. `path` is dotted, so nested and array positions are addressable. */
export const validationIssueSchema = z.strictObject({
  path: z.string(),
  message: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const problemDetailsSchema = z.strictObject({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: problemCodeSchema,
  /**
   * Correlates the response with the server logs for that request. Surfacing it in
   * the UI is what turns "it failed" into a report someone can act on.
   */
  traceId: z.string(),
  /** Present only for VALIDATION_FAILED. */
  errors: z.array(validationIssueSchema).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
