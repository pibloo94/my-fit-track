import boundaries from 'eslint-plugin-boundaries';

/**
 * Architectural boundaries, made executable.
 *
 * Rationale in docs/ARCHITECTURE.md#enforced-import-rules. These are the rules that
 * erode first under time pressure, and a circular dependency is far cheaper to
 * prevent than to untangle, so they are enforced rather than reviewed.
 *
 * This lives in its own module, separate from eslint.config.mjs, so that
 * tools/boundaries.test.mjs can exercise the very same policy objects the real lint
 * run uses. A boundary rule nobody has seen reject anything is not evidence of a
 * clean codebase.
 */

/** A dependency target in the same module as the file being checked. */
const sameModule = (type) => ({
  element: { type, captured: { module: '{{ from.element.captured.module }}' } },
});

/** A dependency target of any of the given types, in any module. */
const anyOfType = (...types) => ({ element: { type: types } });

/**
 * Order matters: layered paths are declared before the catch-all module pattern,
 * because the first matching descriptor wins.
 */
export const elements = [
  {
    type: 'api-presentation',
    pattern: 'apps/api/src/modules/*/api/**',
    capture: ['module'],
    partialMatch: false,
  },
  {
    type: 'api-application',
    pattern: 'apps/api/src/modules/*/application/**',
    capture: ['module'],
    partialMatch: false,
  },
  {
    type: 'api-domain',
    pattern: 'apps/api/src/modules/*/domain/**',
    capture: ['module'],
    partialMatch: false,
  },
  {
    type: 'api-infrastructure',
    pattern: 'apps/api/src/modules/*/infrastructure/**',
    capture: ['module'],
    partialMatch: false,
  },
  {
    type: 'api-module',
    pattern: 'apps/api/src/modules/*',
    capture: ['module'],
    partialMatch: false,
  },
  { type: 'api-common', pattern: 'apps/api/src/common/**', partialMatch: false },
  { type: 'api-platform', pattern: 'apps/api/src/infrastructure/**', partialMatch: false },
  // Element patterns match folders, so this covers the files directly in src/.
  { type: 'api-root', pattern: 'apps/api/src', partialMatch: false },
  { type: 'contracts', pattern: 'packages/contracts/**', partialMatch: false },
  { type: 'tooling', pattern: 'packages/config/**', partialMatch: false },
];

/**
 * Without a TypeScript-aware resolver, extensionless imports resolve to nothing and
 * the plugin silently skips them, which makes every policy below pass vacuously.
 */
export const resolver = {
  typescript: { project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] },
};

export const violationMessage =
  '"{{from.element.type}}" is not allowed to import "{{to.element.type}}". ' +
  'The policies live in eslint.boundaries.mjs; the reasoning is in ' +
  'docs/ARCHITECTURE.md#enforced-import-rules.';

export const policies = [
  {
    // The domain layer is pure: no framework, no persistence, no transport, not even
    // the wire contract. This is what lets it be tested without a Nest harness or a
    // database.
    from: { element: { type: 'api-domain' } },
    allow: { to: sameModule('api-domain') },
  },
  {
    from: { element: { type: 'api-application' } },
    allow: {
      to: [
        sameModule('api-domain'),
        sameModule('api-application'),
        sameModule('api-infrastructure'),
        anyOfType('api-common', 'api-platform', 'contracts'),
      ],
    },
  },
  {
    // Controllers delegate to the application layer; they do not reach into
    // infrastructure.
    from: { element: { type: 'api-presentation' } },
    allow: {
      to: [
        sameModule('api-application'),
        sameModule('api-domain'),
        sameModule('api-presentation'),
        anyOfType('api-common', 'contracts'),
      ],
    },
  },
  {
    from: { element: { type: 'api-infrastructure' } },
    allow: {
      to: [
        sameModule('api-domain'),
        sameModule('api-infrastructure'),
        anyOfType('api-common', 'api-platform', 'contracts'),
      ],
    },
  },
  {
    // Simple modules with no domain logic: controller -> service -> Prisma. A module
    // never imports another module; it emits an in-process event.
    from: { element: { type: 'api-module' } },
    allow: {
      to: [sameModule('api-module'), anyOfType('api-common', 'api-platform', 'contracts')],
    },
  },
  {
    from: { element: { type: 'api-common' } },
    allow: { to: anyOfType('api-common', 'contracts') },
  },
  {
    from: { element: { type: 'api-platform' } },
    allow: { to: anyOfType('api-common', 'api-platform', 'contracts') },
  },
  {
    from: { element: { type: 'api-root' } },
    allow: {
      to: anyOfType(
        'api-root',
        'api-module',
        'api-presentation',
        'api-common',
        'api-platform',
        'contracts',
      ),
    },
  },
  {
    // The contract package depends on Zod only, so both sides can consume it.
    from: { element: { type: 'contracts' } },
    allow: { to: anyOfType('contracts') },
  },
];

/**
 * Dependencies internal to a single element are not checked, so relative imports
 * within one module need no allowance.
 */
export const boundariesConfig = {
  files: ['apps/**/*.ts', 'packages/**/*.ts'],
  plugins: { boundaries },
  settings: {
    'import/resolver': resolver,
    'boundaries/elements': elements,
  },
  rules: {
    'boundaries/dependencies': [
      'error',
      {
        default: 'disallow',
        // The policies list only what is allowed, so every violation is reported by
        // this default message rather than by a per-policy one.
        message: violationMessage,
        policies,
      },
    ],
  },
};

/**
 * Package purity rules. These are about external dependencies rather than internal
 * layering, so they are expressed as import restrictions.
 */
export const purityConfigs = [
  {
    files: ['packages/contracts/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', '@angular/*', '@prisma/*', 'prisma', 'fastify', 'fastify/*'],
              message:
                'packages/contracts must depend only on Zod. A framework import here makes it unusable by the other side.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@my-fit-track/api', '@my-fit-track/api/*', '@my-fit-track/web'],
              message:
                'Apps are deployable units and must not import each other. Move shared code to packages/.',
            },
          ],
        },
      ],
    },
  },
];
