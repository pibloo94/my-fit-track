import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Repository tooling, plus the Pages proxy Function: it is deployment glue that
    // the Angular test builder cannot see. Application tests live in each workspace.
    include: ['tools/**/*.test.mjs', 'apps/web/functions-test/**/*.test.ts'],
    // The boundary tests write fixture files to shared paths under apps/api/src.
    fileParallelism: false,
  },
});
