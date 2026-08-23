import { PROBLEM_CONTENT_TYPE, problemDetailsSchema } from '@my-fit-track/contracts';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

import { toProblemDetails } from './problem-details.mapper';
import { RequestValidationError } from './request-validation.error';

const source = { traceId: 'trace-1', instance: '/api/v1/probe' };

describe('toProblemDetails', () => {
  it('maps a contract validation failure to 422 with field issues', () => {
    const problem = toProblemDetails({
      ...source,
      exception: new RequestValidationError([{ path: 'limit', message: 'Expected number' }]),
    });

    expect(problemDetailsSchema.parse(problem)).toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
      traceId: 'trace-1',
      instance: '/api/v1/probe',
      errors: [{ path: 'limit', message: 'Expected number' }],
    });
    expect(problem.type).toContain('validation-failed');
  });

  it('maps Nest HTTP exceptions by status, including the throttler', () => {
    expect(toProblemDetails({ ...source, exception: new NotFoundException() }).code).toBe(
      'NOT_FOUND',
    );
    expect(toProblemDetails({ ...source, exception: new ThrottlerException() }).code).toBe(
      'RATE_LIMITED',
    );
    expect(
      toProblemDetails({
        ...source,
        exception: new HttpException('nope', HttpStatus.UNAUTHORIZED),
      }).code,
    ).toBe('UNAUTHENTICATED');
  });

  it('never puts an unexpected error message or stack in the body', () => {
    const exception = new Error('password=super-secret connection failed');
    exception.stack = 'Error: password=super-secret\n    at db.ts:1';
    const problem = toProblemDetails({ ...source, exception });
    const serialized = JSON.stringify(problem);

    expect(problem.status).toBe(500);
    expect(problem.code).toBe('INTERNAL_ERROR');
    expect(problem.detail).toBeUndefined();
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('db.ts');
    expect(problemDetailsSchema.parse(problem)).toEqual(problem);
  });

  it('stays inside the shared contract', () => {
    const problem = toProblemDetails({ ...source, exception: new NotFoundException() });
    expect(problemDetailsSchema.parse(problem).status).toBe(404);
    expect(PROBLEM_CONTENT_TYPE).toBe('application/problem+json');
  });
});
