import { healthResponseSchema } from '@my-fit-track/contracts';
import { describe, expect, it } from 'vitest';

import { toHealthSnapshot } from './health.mapper';

describe('toHealthSnapshot', () => {
  it('parses the wire date so templates never see a string', () => {
    const dto = healthResponseSchema.parse({
      status: 'ok',
      version: 'test-1.0.0',
      uptimeSeconds: 12,
      checkedAt: '2026-08-23T18:00:00.000Z',
    });

    const snapshot = toHealthSnapshot(dto);

    expect(snapshot.checkedAt).toBeInstanceOf(Date);
    expect(snapshot.checkedAt.toISOString()).toBe('2026-08-23T18:00:00.000Z');
    expect(snapshot.version).toBe('test-1.0.0');
  });
});
