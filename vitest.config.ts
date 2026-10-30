import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/*/tests/**/*.test.ts',
      'apps/*/tests/**/*.test.ts',
      'scripts/tests/**/*.test.ts',
    ],
    // SQLite-backed tests open a real database per test; slow CI runners
    // (Windows) take seconds per test and flake on the 5s default.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      // View components (.tsx) are exercised by the Playwright e2e suite;
      // the unit-coverage gate tracks the logic underneath them.
      exclude: ['**/*.tsx'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 65,
        statements: 65,
        functions: 56,
        branches: 63,
      },
    },
  },
});
