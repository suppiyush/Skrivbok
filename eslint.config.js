import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/generated/**'] },

  js.configs.recommended,

  // Type-aware rules apply to TypeScript sources only. Plain .js files (this
  // config, scripts) are not in any tsconfig program and would crash the
  // type-checked rules.
  ...tseslint.configs.recommendedTypeChecked.map((c) => ({ ...c, files: ['**/*.ts'] })),

  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused vars are errors, but `_`-prefixed args are intentional escapes
      // (Express error handlers must keep the 4-arg signature).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Every promise must be awaited or explicitly voided — silent unhandled
      // rejections were a real source of bugs in the legacy server.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/require-await': 'error',
      'no-console': 'error', // use the pino logger, never console
      eqeqeq: ['error', 'always'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/config/env.js', '**/config/env'],
              importNames: ['default'],
              message: 'Import the named `env` export, not a default.',
            },
          ],
        },
      ],
    },
  },

  // Config files and scripts run outside the type-checked program.
  {
    files: ['**/*.config.js', '**/scripts/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  prettier,
);
