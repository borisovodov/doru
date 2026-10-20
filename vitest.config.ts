import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts'],
    // SQLite-backed tests open a real database per test; slow CI runners
    // (Windows) take seconds per test and flake on the 5s default.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      reporter: ['text', 'json-summary'],
      // The gate is enforced by `npm run test:coverage` and in CI.
      // Each value sits just below the achieved workspace coverage
      // (lines 67.29%, statements 66.68%, branches 65.35%, functions
      // 58.42%) so small refactors cannot trip the gate.
      thresholds: {
        lines: 65,
        statements: 65,
        functions: 56,
        branches: 63,
      },
    },
  },
});
