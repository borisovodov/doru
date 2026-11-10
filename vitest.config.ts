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
    // (Windows) take tens of seconds per test once the suite runs the
    // whole model through them. 90s keeps a loaded runner from flaking
    // while still catching real hangs.
    testTimeout: 90_000,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      // View components (.tsx) are exercised by the Playwright e2e suite;
      // the unit-coverage gate tracks the logic underneath them.
      exclude: ['**/*.tsx'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
});
