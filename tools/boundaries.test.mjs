import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { boundariesConfig, purityConfigs } from '../eslint.boundaries.mjs';

/**
 * These tests exist because the boundary policies were, at one point, passing while
 * enforcing nothing: eslint-plugin-boundaries skips any import it cannot resolve, and
 * it cannot resolve extensionless TypeScript imports without a resolver. The policies
 * looked correct and rejected nothing. So every rule that matters is asserted here
 * against a case that must be rejected and a case that must be allowed.
 *
 * Fixtures are written to real paths under apps/api/src, because both the element
 * patterns and the module resolver work on actual file locations. They are excluded
 * from the real lint and typecheck runs, so a leftover fixture cannot break the build.
 */
const REPO_ROOT = join(import.meta.dirname, '..');
const MODULES = 'apps/api/src/modules';
const A = `${MODULES}/__fixture_a__`;
const B = `${MODULES}/__fixture_b__`;
const COMMON_FIXTURE = 'apps/api/src/common/__fixture_result__.ts';
const WEB = 'apps/web/src/app/features';
const WEB_A = `${WEB}/__fixture_a__`;
const WEB_B = `${WEB}/__fixture_b__`;
const WEB_CORE_LEAK = 'apps/web/src/app/core/__fixture_leak__.ts';

/** Targets that fixtures import. Written to disk so imports actually resolve. */
const targets = {
  [`${A}/domain/entity.ts`]: 'export interface Entity {\n  readonly id: string;\n}\n',
  [`${A}/infrastructure/entity.repository.ts`]: 'export class EntityRepository {}\n',
  [`${A}/application/entity.service.ts`]: 'export class EntityService {}\n',
  [`${A}/api/entity.controller.ts`]: 'export class EntityController {}\n',
  [`${B}/other.service.ts`]: 'export class OtherService {}\n',
  // common/ will hold real code, so only this one file is created and removed.
  [COMMON_FIXTURE]: 'export type Result<T> = { value: T };\n',
  [`${WEB_A}/domain/model.ts`]: 'export interface HealthView {\n  readonly id: string;\n}\n',
  [`${WEB_A}/data-access/api.ts`]: 'export class HealthApi {}\n',
  [`${WEB_B}/data-access/other.ts`]: 'export class OtherApi {}\n',
};

/**
 * Each case is one import, from one place to another, with the verdict we expect.
 * `expected` is null when the import must be allowed, or a substring of the message
 * when it must be reported.
 */
const cases = [
  {
    name: 'domain may use its own domain',
    file: `${A}/domain/rules.ts`,
    from: './entity',
    imported: 'Entity',
    expected: null,
  },
  {
    name: 'domain may not reach into infrastructure',
    file: `${A}/domain/leak.ts`,
    from: '../infrastructure/entity.repository',
    imported: 'EntityRepository',
    expected: '"api-domain" is not allowed to import "api-infrastructure"',
  },
  {
    name: 'domain may not reach into the application layer',
    file: `${A}/domain/leak-application.ts`,
    from: '../application/entity.service',
    imported: 'EntityService',
    expected: '"api-domain" is not allowed to import "api-application"',
  },
  {
    name: 'domain may not depend on shared utilities either',
    file: `${A}/domain/leak-common.ts`,
    from: '../../../common/__fixture_result__',
    imported: 'Result',
    expected: '"api-domain" is not allowed to import "api-common"',
  },
  {
    name: 'application may use its own domain',
    file: `${A}/application/uses-domain.ts`,
    from: '../domain/entity',
    imported: 'Entity',
    expected: null,
  },
  {
    name: 'application may use its own infrastructure',
    file: `${A}/application/uses-infrastructure.ts`,
    from: '../infrastructure/entity.repository',
    imported: 'EntityRepository',
    expected: null,
  },
  {
    name: 'controllers may use their own application layer',
    file: `${A}/api/uses-application.ts`,
    from: '../application/entity.service',
    imported: 'EntityService',
    expected: null,
  },
  {
    name: 'controllers may not reach into infrastructure',
    file: `${A}/api/leak.ts`,
    from: '../infrastructure/entity.repository',
    imported: 'EntityRepository',
    expected: '"api-presentation" is not allowed to import "api-infrastructure"',
  },
  {
    name: 'a layered module may not reach into another module',
    file: `${A}/application/cross-module.ts`,
    from: '../../__fixture_b__/other.service',
    imported: 'OtherService',
    expected: '"api-application" is not allowed to import "api-module"',
  },
  {
    name: 'a simple module may not reach into another module',
    file: `${B}/cross-module.ts`,
    from: '../__fixture_a__/application/entity.service',
    imported: 'EntityService',
    expected: '"api-module" is not allowed to import "api-application"',
  },
  {
    name: 'a presentational component may use its own domain model',
    file: `${WEB_A}/ui/card.ts`,
    from: '../domain/model',
    imported: 'HealthView',
    expected: null,
  },
  {
    name: 'a presentational component may not fetch',
    file: `${WEB_A}/ui/leak.ts`,
    from: '../data-access/api',
    imported: 'HealthApi',
    expected: '"web-feature-ui" is not allowed to import "web-feature-data"',
  },
  {
    name: 'one feature may not import another feature',
    file: `${WEB_A}/pages/cross.ts`,
    from: '../../__fixture_b__/data-access/other',
    imported: 'OtherApi',
    expected: '"web-feature-pages" is not allowed to import "web-feature-data"',
  },
];

/** The real policies, with a syntax-only parser so no tsconfig has to include fixtures. */
const eslint = new ESLint({
  cwd: REPO_ROOT,
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
    boundariesConfig,
    ...purityConfigs,
  ],
});

const fixtureFiles = { ...targets };
for (const testCase of cases) {
  fixtureFiles[testCase.file] =
    `import { ${testCase.imported} } from '${testCase.from}';\n\n` +
    `export const used = ${testCase.imported};\n`;
}

async function messagesFor(relativePath) {
  const [result] = await eslint.lintFiles([join(REPO_ROOT, relativePath)]);
  return (result?.messages ?? []).map((message) => message.message);
}

beforeAll(async () => {
  await Promise.all(
    Object.entries(fixtureFiles).map(async ([relativePath, contents]) => {
      const absolutePath = join(REPO_ROOT, relativePath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, contents, 'utf8');
    }),
  );
});

afterAll(async () => {
  await rm(join(REPO_ROOT, A), { recursive: true, force: true });
  await rm(join(REPO_ROOT, B), { recursive: true, force: true });
  await rm(join(REPO_ROOT, COMMON_FIXTURE), { force: true });
  await rm(join(REPO_ROOT, WEB_A), { recursive: true, force: true });
  await rm(join(REPO_ROOT, WEB_B), { recursive: true, force: true });
  await rm(join(REPO_ROOT, WEB_CORE_LEAK), { force: true });
});

describe('architectural boundaries', () => {
  it.each(cases)('$name', async ({ file, expected }) => {
    const messages = await messagesFor(file);

    if (expected === null) {
      expect(messages).toEqual([]);
    } else {
      expect(messages.join('\n')).toContain(expected);
    }
  });

  it('reports an unresolved import instead of silently allowing it', async () => {
    // Guards the failure mode that made these policies vacuous: if resolution breaks,
    // this import becomes "unknown" and every policy above starts passing for free.
    const relativePath = `${A}/domain/resolves.ts`;
    await writeFile(
      join(REPO_ROOT, relativePath),
      "import { Entity } from './entity';\n\nexport const used: Entity | null = null;\n",
      'utf8',
    );

    const [result] = await eslint.lintFiles([join(REPO_ROOT, relativePath)]);
    const resolved = await eslint.calculateConfigForFile(join(REPO_ROOT, relativePath));

    expect(result?.messages ?? []).toEqual([]);
    expect(resolved.settings['import/resolver']).toHaveProperty('typescript');
  });

  it('rejects core importing a feature', async () => {
    await mkdir(dirname(join(REPO_ROOT, WEB_CORE_LEAK)), { recursive: true });
    await writeFile(
      join(REPO_ROOT, WEB_CORE_LEAK),
      "import { HealthView } from '../features/__fixture_a__/domain/model';\n\nexport const used = HealthView;\n",
      'utf8',
    );

    const messages = await messagesFor(WEB_CORE_LEAK);
    expect(messages.join('\n')).toContain(
      '"web-core" is not allowed to import "web-feature-domain"',
    );
  });
});

describe('package purity', () => {
  it('rejects a framework import inside the contract package', async () => {
    const relativePath = 'packages/contracts/src/leak.ts';
    const absolutePath = join(REPO_ROOT, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(
      absolutePath,
      "import { Injectable } from '@nestjs/common';\n\nexport const used = Injectable;\n",
      'utf8',
    );

    try {
      const messages = await messagesFor(relativePath);
      expect(messages.join('\n')).toContain('packages/contracts must depend only on Zod');
    } finally {
      await rm(absolutePath, { force: true });
    }
  });

  it('rejects one app importing another', async () => {
    const relativePath = 'apps/api/src/modules/__fixture_b__/imports-web.ts';
    const absolutePath = join(REPO_ROOT, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(
      absolutePath,
      "import { thing } from '@my-fit-track/web';\n\nexport const used = thing;\n",
      'utf8',
    );

    const messages = await messagesFor(relativePath);
    expect(messages.join('\n')).toContain('Apps are deployable units');
  });
});
