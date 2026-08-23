import { type ProblemCode, type ValidationIssue } from '@my-fit-track/contracts';

/**
 * The only error shape components are allowed to display. Transport details
 * (status text, raw body, stack) stop at the HTTP interceptor.
 */
export type AppErrorCode = ProblemCode | 'NETWORK' | 'CONTRACT_MISMATCH';

export interface AppError {
  readonly code: AppErrorCode;
  readonly title: string;
  readonly detail?: string;
  readonly status: number;
  readonly traceId?: string;
  readonly errors?: readonly ValidationIssue[];
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'title' in value &&
    'status' in value &&
    typeof value.code === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'number'
  );
}
