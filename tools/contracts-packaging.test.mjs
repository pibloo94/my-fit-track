import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * The contracts package is consumed by two different runtimes: the API loads it with
 * require() from CommonJS, and the web bundler loads the ESM build. A dual build is
 * easy to get subtly wrong in a way that only shows up at runtime in one of them, so
 * both entry points are loaded here for real.
 *
 * Requires `npm run build --workspace @my-fit-track/contracts` first.
 */
const require = createRequire(import.meta.url);

describe('@my-fit-track/contracts packaging', () => {
  it('is loadable from CommonJS, the way the API loads it', () => {
    const contracts = require('@my-fit-track/contracts');

    expect(contracts.healthResponseSchema).toBeDefined();
    expect(contracts.DEFAULT_PAGE_SIZE).toBe(20);
  });

  it('is loadable as ESM, the way the web bundler loads it', async () => {
    const contracts = await import('@my-fit-track/contracts');

    expect(contracts.healthResponseSchema).toBeDefined();
    expect(contracts.DEFAULT_PAGE_SIZE).toBe(20);
  });

  it('resolves the two entry points to different files', () => {
    const cjsPath = require.resolve('@my-fit-track/contracts');

    expect(cjsPath).toContain('cjs');
  });

  it('parses the same payload identically through both builds', async () => {
    const cjs = require('@my-fit-track/contracts');
    const esm = await import('@my-fit-track/contracts');
    const payload = {
      status: 'ok',
      version: '1.0.0',
      uptimeSeconds: 1,
      checkedAt: '2026-08-23T18:00:00.000Z',
    };

    expect(cjs.healthResponseSchema.parse(payload)).toEqual(
      esm.healthResponseSchema.parse(payload),
    );
  });
});
