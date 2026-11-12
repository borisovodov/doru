import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import playwright from 'eslint-plugin-playwright';
import reactHooks from 'eslint-plugin-react-hooks';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const tsFiles = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
const testFiles = ['**/tests/**/*.ts', 'apps/*/tests/**/*.ts', 'scripts/**/*.test.ts'];

// @eslint-react provides the general React/DOM/JSX rules; the official
// react-hooks plugin owns the hooks and React Compiler rules. Turning the
// duplicates off keeps each finding attributable to one plugin.
const eslintReactHookDuplicates = {
  '@eslint-react/rules-of-hooks': 'off',
  '@eslint-react/exhaustive-deps': 'off',
  '@eslint-react/error-boundaries': 'off',
  '@eslint-react/purity': 'off',
  '@eslint-react/set-state-in-effect': 'off',
  '@eslint-react/set-state-in-render': 'off',
  '@eslint-react/static-components': 'off',
  '@eslint-react/unsupported-syntax': 'off',
  '@eslint-react/use-memo': 'off',
};

export default defineConfig(
  globalIgnores([
    '**/node_modules/**',
    '**/out/**',
    '**/dist/**',
    '**/release/**',
    '**/coverage/**',
    '**/.vite/**',
    '**/.vitepress/cache/**',
    '**/.vitepress/dist/**',
    '**/storybook-static/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/corpus-run/**',
    'apps/website/docs/**',
    'apps/desktop/build/llama/**',
    'apps/desktop/build/Icon.icon/**',
    'packages/features/src/notices/generated.ts',
  ]),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: tsFiles,
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
    rules: {
      // Event handlers are routinely written as `() => setOpen(false)`.
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      // Template literals routinely interpolate numeric ids and counts.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // GEDCOM model interfaces extend a base type to brand a structure.
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      // Service contracts are async even when a method has no await today.
      '@typescript-eslint/require-await': 'off',
      // Domain services are plain objects; their methods do not use `this`.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: [
      'apps/desktop/src/renderer/**/*.{ts,tsx}',
      'packages/{ui,features,workbench}/src/**/*.{ts,tsx}',
      'apps/website/.vitepress/**/*.{ts,mts,tsx}',
    ],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: ['**/*.tsx'],
    extends: [eslintReact.configs['strict-type-checked'], reactHooks.configs.flat['recommended-latest']],
    rules: {
      ...eslintReactHookDuplicates,
      // The app loads IPC-backed data into local state inside effects and
      // keeps latest props in refs. Moving the data layer out of effects is
      // a separate architectural change, not a lint fix.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['**/*.d.ts', 'scripts/capture-screenshots.ts'],
    rules: {
      // Ambient type references pull in the shared preload API declaration.
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    files: testFiles,
    plugins: { vitest },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'error',
      'vitest/no-identical-title': 'error',
      'vitest/no-import-node-test': 'error',
      'vitest/valid-expect': 'error',
    },
  },
  {
    files: ['e2e/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
    rules: {
      // The drag tests must wait for the pointer-driven animation to settle;
      // platform-specific menu paths are inherent to the Electron shell.
      'playwright/no-wait-for-timeout': 'off',
      'playwright/no-conditional-in-test': 'off',
    },
  },
  {
    files: [...testFiles, 'e2e/**/*.ts'],
    rules: {
      // Bounding-box helpers in e2e and non-null fixture values in tests are
      // deliberately concise; production code keeps the strict rule.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Test assertions and fixtures intentionally use `expect.any(...)` and
      // untyped mock values; tests are still fully typechecked.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/db/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@doru/platform',
                '@doru/platform/*',
                '@doru/workbench',
                '@doru/workbench/*',
                '@doru/ui',
                '@doru/ui/*',
                '@doru/features',
                '@doru/features/*',
              ],
              message: '@doru/core is the domain layer: no UI, workbench, features or platform imports.',
            },
            {
              group: ['electron', 'react', 'react-dom'],
              message: '@doru/core must stay free of Electron and React.',
            },
            {
              group: ['node:sqlite'],
              message: 'SQLite is only touched in packages/core/src/db.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/db/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@doru/platform',
                '@doru/platform/*',
                '@doru/workbench',
                '@doru/workbench/*',
                '@doru/ui',
                '@doru/ui/*',
                '@doru/features',
                '@doru/features/*',
              ],
              message: '@doru/core is the domain layer: no UI, workbench, features or platform imports.',
            },
            {
              group: ['electron', 'react', 'react-dom'],
              message: '@doru/core must stay free of Electron and React.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/ai/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@doru/platform',
                '@doru/platform/*',
                '@doru/workbench',
                '@doru/workbench/*',
                '@doru/ui',
                '@doru/ui/*',
                '@doru/features',
                '@doru/features/*',
              ],
              message: '@doru/ai is an agent layer: no UI, workbench, features or platform imports.',
            },
            {
              group: ['electron', 'react', 'react-dom'],
              message: '@doru/ai must stay free of Electron and React.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/gedcom/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@doru/*', 'electron', 'react', 'react-dom'],
              message: '@doru/gedcom is a standalone GEDCOM package: no app, UI or Electron imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/platform/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@doru/core',
                '@doru/core/*',
                '@doru/ai',
                '@doru/ai/*',
                '@doru/gedcom',
                '@doru/gedcom/*',
                '@doru/ui',
                '@doru/ui/*',
                '@doru/features',
                '@doru/features/*',
                '@doru/workbench',
                '@doru/workbench/*',
              ],
              message: '@doru/platform is the base layer: it cannot depend on domain or UI packages.',
            },
            {
              group: ['electron', 'react', 'react-dom'],
              message: '@doru/platform must stay free of Electron and React.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/{ui,features,workbench}/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'node:*'],
              message: 'UI packages run in the renderer: no Electron or Node built-ins.',
            },
            {
              group: ['@doru/ai', '@doru/ai/*', '!@doru/ai/reasoning'],
              allowTypeImports: true,
              message: 'UI packages may use AI types, but runtime AI lives in the main process.',
            },
          ],
        },
      ],
    },
  },
  {
    // The reasoning-level table is pure data shared with the renderer; it has
    // no Node dependencies and is intentionally imported as a value.
    files: ['packages/features/src/settings/reasoning.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
  {
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['electron', 'node:*'],
              message: 'The renderer talks to the main process through the preload API, not Electron or Node.',
            },
            {
              group: ['@doru/ai', '@doru/ai/*', '!@doru/ai/reasoning'],
              allowTypeImports: true,
              message: 'The renderer may use AI types, but runtime AI lives in the main process.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
