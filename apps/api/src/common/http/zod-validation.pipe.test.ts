import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { RequestValidationError } from './request-validation.error';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.strictObject({
  name: z.string().min(1),
  limit: z.coerce.number().int().min(1),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value, including coerced query strings', () => {
    expect(pipe.transform({ name: 'squat', limit: '10' })).toEqual({ name: 'squat', limit: 10 });
  });

  it('rejects unknown properties instead of stripping them', () => {
    try {
      pipe.transform({ name: 'squat', limit: 10, extra: true });
      expect.unreachable('unknown properties must fail');
    } catch (error) {
      expect(error).toBeInstanceOf(RequestValidationError);
      expect((error as RequestValidationError).issues.some((issue) => issue.path === 'extra')).toBe(
        true,
      );
    }
  });

  it('rejects a value that does not match the schema', () => {
    expect(() => pipe.transform({ name: 'squat', limit: 'nope' })).toThrow(RequestValidationError);
  });
});
