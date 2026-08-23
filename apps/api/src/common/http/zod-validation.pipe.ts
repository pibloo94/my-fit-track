import { type ValidationIssue } from '@my-fit-track/contracts';
import { type PipeTransform } from '@nestjs/common';
import { type ZodError, type ZodType } from 'zod';

import { RequestValidationError } from './request-validation.error';

export function zodIssuesOf(error: ZodError): ValidationIssue[] {
  return error.issues.flatMap((issue) => {
    // Zod reports extra keys with an empty path and a `keys` list. Address
    // each key so the client can highlight the field that does not belong.
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ path: key, message: issue.message }));
    }
    return [
      {
        path: issue.path.length > 0 ? issue.path.map(String).join('.') : '',
        message: issue.message,
      },
    ];
  });
}

/**
 * Parses a request value against a contract schema. Unknown properties fail
 * rather than being stripped, because a stripped field is a silent contract
 * change.
 *
 * Apply per parameter (`@Body(new ZodValidationPipe(schema))`), not globally:
 * a global pipe cannot know which schema belongs to which argument.
 */
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown): TSchema['_output'] {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new RequestValidationError(zodIssuesOf(parsed.error));
    }
    return parsed.data;
  }
}
