import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  readonly traceId: string;
}

/**
 * Request-scoped store so log lines and the exception filter share the same
 * `traceId` without threading the Fastify request through every service.
 */
export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function currentTraceId(): string | undefined {
  return requestContext.getStore()?.traceId;
}
