import { describe, expect, it } from 'vitest';

import { healthResponseSchema } from './health.contract.js';

const valid = {
  status: 'ok',
  version: '1.0.0',
  uptimeSeconds: 42,
  checkedAt: '2026-08-23T18:00:00.000Z',
};

describe('healthResponseSchema', () => {
  it('accepts a well-formed response', () => {
    expect(healthResponseSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a status outside the enum', () => {
    expect(() => healthResponseSchema.parse({ ...valid, status: 'fine' })).toThrow();
  });

  it('rejects a timestamp without an offset', () => {
    expect(() =>
      healthResponseSchema.parse({ ...valid, checkedAt: '2026-08-23T18:00:00' }),
    ).toThrow(/* the "no naive timestamps" convention has to hold at the boundary */);
  });

  it('rejects a negative uptime', () => {
    expect(() => healthResponseSchema.parse({ ...valid, uptimeSeconds: -1 })).toThrow();
  });
});
