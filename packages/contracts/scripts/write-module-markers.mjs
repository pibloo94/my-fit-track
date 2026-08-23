import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * tsc emits .js for both builds, so Node needs a per-directory marker to know how to
 * interpret each one. Without these, the ESM output is parsed as CommonJS and fails
 * on its first `import`.
 */
const markers = {
  cjs: { type: 'commonjs' },
  esm: { type: 'module' },
};

const dist = join(import.meta.dirname, '..', 'dist');

await Promise.all(
  Object.entries(markers).map(([directory, contents]) =>
    writeFile(join(dist, directory, 'package.json'), `${JSON.stringify(contents, null, 2)}\n`),
  ),
);
