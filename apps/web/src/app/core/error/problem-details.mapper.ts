import { problemDetailsSchema } from '@my-fit-track/contracts';
import { HttpErrorResponse } from '@angular/common/http';
import { ZodError } from 'zod';

import { type AppError, isAppError } from './app-error';

/**
 * Turns whatever failed on the wire into an {@link AppError}. A component that
 * branches on `HttpErrorResponse.status` is inventing a second error path.
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    return fromHttp(error);
  }

  if (error instanceof ZodError) {
    return {
      code: 'CONTRACT_MISMATCH',
      title: 'The server response did not match the contract',
      status: 200,
    };
  }

  return {
    code: 'CONTRACT_MISMATCH',
    title: 'Something went wrong',
    status: 0,
  };
}

function fromHttp(error: HttpErrorResponse): AppError {
  if (error.status === 0) {
    return {
      code: 'NETWORK',
      title: 'Could not reach the server',
      detail: 'Check your connection and try again.',
      status: 0,
    };
  }

  const parsed = problemDetailsSchema.safeParse(error.error);
  if (parsed.success) {
    return {
      code: parsed.data.code,
      title: parsed.data.title,
      detail: parsed.data.detail,
      status: parsed.data.status,
      traceId: parsed.data.traceId,
      errors: parsed.data.errors,
    };
  }

  return {
    code: 'CONTRACT_MISMATCH',
    title: 'The server returned an unexpected error',
    status: error.status,
  };
}
