import { type ProblemDetails } from '@my-fit-track/contracts';
import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import { toAppError } from './problem-details.mapper';

const problem: ProblemDetails = {
  type: 'https://api.myfittracker.app/problems/not-found',
  title: 'Not found',
  status: 404,
  detail: 'The requested resource does not exist.',
  code: 'NOT_FOUND',
  traceId: 'trace-web-1',
};

describe('toAppError', () => {
  it('reads a well-formed RFC 9457 body, including the traceId', () => {
    const error = new HttpErrorResponse({
      status: 404,
      error: problem,
      headers: undefined,
    });

    expect(toAppError(error)).toEqual({
      code: 'NOT_FOUND',
      title: 'Not found',
      detail: 'The requested resource does not exist.',
      status: 404,
      traceId: 'trace-web-1',
      errors: undefined,
    });
  });

  it('treats a dropped connection as NETWORK, not as a contract mismatch', () => {
    const error = new HttpErrorResponse({
      status: 0,
      statusText: 'Unknown Error',
      url: '/api/v1/health',
    });
    expect(toAppError(error).code).toBe('NETWORK');
  });

  it('does not invent a problem code when the body is not RFC 9457', () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: { message: 'Internal server error' },
    });
    expect(toAppError(error).code).toBe('CONTRACT_MISMATCH');
    expect(toAppError(error).status).toBe(500);
  });

  it('maps a Zod failure on a 200 to CONTRACT_MISMATCH', () => {
    expect(toAppError(new ZodError([])).code).toBe('CONTRACT_MISMATCH');
  });
});
