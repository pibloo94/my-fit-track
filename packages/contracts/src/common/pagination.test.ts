import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  cursorPageOf,
  cursorPageQuerySchema,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './pagination.js';

describe('cursorPageQuerySchema', () => {
  it('applies the default page size when limit is absent', () => {
    expect(cursorPageQuerySchema.parse({})).toEqual({ limit: DEFAULT_PAGE_SIZE });
  });

  it('coerces limit from a query string, which always arrives as text', () => {
    expect(cursorPageQuerySchema.parse({ limit: '35' })).toEqual({ limit: 35 });
  });

  it('caps the page size, so one client cannot request the whole table', () => {
    expect(() => cursorPageQuerySchema.parse({ limit: MAX_PAGE_SIZE + 1 })).toThrow();
  });

  it('rejects a non-integer limit', () => {
    expect(() => cursorPageQuerySchema.parse({ limit: '2.5' })).toThrow();
  });

  it('rejects unknown properties rather than ignoring them', () => {
    expect(() => cursorPageQuerySchema.parse({ offset: 40 })).toThrow();
  });
});

describe('cursorPageOf', () => {
  const page = cursorPageOf(z.strictObject({ id: z.string() }));

  it('accepts a last page, where nextCursor is null', () => {
    expect(page.parse({ items: [{ id: 'a' }], nextCursor: null })).toEqual({
      items: [{ id: 'a' }],
      nextCursor: null,
    });
  });

  it('requires nextCursor to be present, so absence cannot be mistaken for the end', () => {
    expect(() => page.parse({ items: [] })).toThrow();
  });

  it('validates the items against the given schema', () => {
    expect(() => page.parse({ items: [{ id: 7 }], nextCursor: null })).toThrow();
  });
});
