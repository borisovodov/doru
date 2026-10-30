// Vitest config for the local-model eval gate. The eval needs multi-GB model
// files and a downloaded llama-server binary, so it never runs as part of the
// regular suite (`npm test` collects only the default vitest.config.ts
// include patterns). Run it explicitly:
//
//   npx vitest run --config scripts/eval-ai.vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/eval-ai.test.ts'],
    testTimeout: 900_000,
    hookTimeout: 360_000,
  },
});
