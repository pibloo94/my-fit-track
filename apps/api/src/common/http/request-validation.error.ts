import { type ValidationIssue } from '@my-fit-track/contracts';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown by the Zod pipe when a request body, query or param fails the contract.
 * The exception filter maps this to RFC 9457 `VALIDATION_FAILED` and keeps the
 * per-field issues, which a generic `BadRequestException` would flatten away.
 */
export class RequestValidationError extends HttpException {
  constructor(readonly issues: readonly ValidationIssue[]) {
    super('Validation failed', HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
