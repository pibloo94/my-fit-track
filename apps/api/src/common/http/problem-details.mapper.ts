import {
  type ProblemCode,
  type ProblemDetails,
  type ValidationIssue,
} from '@my-fit-track/contracts';
import { HttpException, HttpStatus } from '@nestjs/common';

import { RequestValidationError } from './request-validation.error';

const PROBLEM_TYPE_BASE = 'https://api.myfittracker.app/problems';

export interface ProblemSource {
  readonly exception: unknown;
  readonly traceId: string;
  readonly instance: string;
}

interface ProblemDraft {
  readonly status: number;
  readonly code: ProblemCode;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: readonly ValidationIssue[];
}

const CODE_TITLES: Record<ProblemCode, string> = {
  VALIDATION_FAILED: 'Validation failed',
  UNAUTHENTICATED: 'Unauthenticated',
  TOKEN_EXPIRED: 'Token expired',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflict',
  ENTITLEMENT_REQUIRED: 'Entitlement required',
  QUOTA_EXCEEDED: 'Quota exceeded',
  RATE_LIMITED: 'Too many requests',
  IDEMPOTENCY_KEY_REUSED: 'Idempotency key reused',
  INTERNAL_ERROR: 'Internal server error',
};

function problemType(code: ProblemCode): string {
  return `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replaceAll('_', '-')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Fastify sets `statusCode` and `code` on its own error objects. */
function fastifyStatus(exception: unknown): number | undefined {
  if (!isRecord(exception) || typeof exception['statusCode'] !== 'number') {
    return undefined;
  }
  const status = exception['statusCode'];
  return status >= 400 && status <= 599 ? status : undefined;
}

function draftFromStatus(status: number, fallbackDetail?: string): ProblemDraft {
  switch (status) {
    case 400:
    case 422:
      return {
        status,
        code: 'VALIDATION_FAILED',
        title: CODE_TITLES.VALIDATION_FAILED,
        detail: fallbackDetail ?? 'The request does not match the expected contract.',
      };
    case 401:
      return { status, code: 'UNAUTHENTICATED', title: CODE_TITLES.UNAUTHENTICATED };
    case 403:
      return { status, code: 'FORBIDDEN', title: CODE_TITLES.FORBIDDEN };
    case 404:
      return {
        status,
        code: 'NOT_FOUND',
        title: CODE_TITLES.NOT_FOUND,
        detail: 'The requested resource does not exist.',
      };
    case 409:
      return { status, code: 'CONFLICT', title: CODE_TITLES.CONFLICT };
    case 429:
      return {
        status,
        code: 'RATE_LIMITED',
        title: CODE_TITLES.RATE_LIMITED,
        detail: 'Wait before retrying.',
      };
    default:
      return {
        status: status >= 400 && status < 500 ? status : 500,
        code: status >= 400 && status < 500 ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR',
        title:
          status >= 400 && status < 500
            ? CODE_TITLES.VALIDATION_FAILED
            : CODE_TITLES.INTERNAL_ERROR,
      };
  }
}

function draftFromException(exception: unknown): ProblemDraft {
  if (exception instanceof RequestValidationError) {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: 'VALIDATION_FAILED',
      title: CODE_TITLES.VALIDATION_FAILED,
      detail: 'One or more fields are invalid.',
      errors: exception.issues,
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    // 5xx from our own code still must not leak the exception message: it may
    // contain SQL, file paths or other internals.
    if (status >= 500) {
      return draftFromStatus(HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const response = exception.getResponse();
    const detail = typeof response === 'string' ? response : undefined;
    return draftFromStatus(status, detail);
  }

  const status = fastifyStatus(exception);
  if (status !== undefined && status < 500) {
    return draftFromStatus(status);
  }

  return draftFromStatus(HttpStatus.INTERNAL_SERVER_ERROR);
}

/**
 * Pure mapping from any thrown value to the RFC 9457 document the client sees.
 * Kept free of Nest's HTTP host so the cases can be tested without a server.
 */
export function toProblemDetails(source: ProblemSource): ProblemDetails {
  const draft = draftFromException(source.exception);
  return {
    type: problemType(draft.code),
    title: draft.title,
    status: draft.status,
    ...(draft.detail === undefined ? {} : { detail: draft.detail }),
    instance: source.instance,
    code: draft.code,
    traceId: source.traceId,
    ...(draft.errors === undefined ? {} : { errors: [...draft.errors] }),
  };
}
