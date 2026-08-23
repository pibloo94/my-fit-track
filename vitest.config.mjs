import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Repository tooling only. Application tests live in each workspace.
    include: ['tools/**/*.test.mjs'],
    // The boundary tests write fixture files to shared paths under apps/api/src.
    fileParallelism: false,
  },
});
