import { z } from 'zod';

/**
 * Cursor pagination, used for every unbounded collection.
 *
 * Offset pagination is not offered on these: with rows being inserted while a client
 * pages through history, offsets shift and entries are silently duplicated or skipped.
 * The cursor is an opaque server-generated string precisely so clients cannot build
 * one by hand and depend on its shape.
 */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const cursorPageQuerySchema = z.strictObject({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type CursorPageQuery = z.infer<typeof cursorPageQuerySchema>;

/**
 * Wraps any item schema into a page. `nextCursor` is null on the last page, so a
 * client loops until it is null rather than comparing counts.
 */
export function cursorPageOf<TItem extends z.ZodType>(item: TItem) {
  return z.strictObject({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export interface CursorPage<TItem> {
  items: TItem[];
  nextCursor: string | null;
}
