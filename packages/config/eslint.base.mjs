import js from '@eslint/js';
import prettierCompat from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Paths that are never linted. */
export const ignores = [
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.angular/**',
  '**/node_modules/**',
  '**/*.d.ts',
  // Written and removed by tools/boundaries.test.mjs. Excluded so that a fixture left
  // behind by an interrupted test run cannot fail the real lint.
  '**/__fixture_*__/**',
  '**/__fixture_*__.ts',
];

/**
 * Type-aware rules, scoped to TypeScript sources only. The scoping matters: the
 * project service cannot resolve files that no tsconfig includes, so applying it
 * to config files would fail to parse them.
 *
 * @param {string} tsconfigRootDir Absolute path used to resolve the project service.
 */
export function typescriptConfig(tsconfigRootDir) {
  return tseslint.config({
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir },
      globals: globals.node,
    },
    rules: {
      // No `any`. Use `unknown` and narrow; a justified escape needs a comment.
      '@typescript-eslint/no-explicit-any': 'error',

      // Silencing the compiler hides the case that will actually happen.
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Floating promises are the most common source of silently lost errors in Node.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'warn',
    },
  });
}

/** Config files and scripts: plain ESM, no type information available. */
export const looseFilesConfig = tseslint.config({
  files: ['**/*.{js,mjs,cjs}'],
  extends: [js.configs.recommended],
  languageOptions: {
    globals: globals.node,
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
  },
});

/** Must come last so formatting-related rules are switched off. */
export const prettierConfig = prettierCompat;
