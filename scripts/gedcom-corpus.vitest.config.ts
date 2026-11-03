// Config for the GEDCOM corpus runner (scripts/gedcom-corpus.test.ts).
// The run walks an external corpus of thousands of files and takes
// minutes, so it never runs as part of `npm test`. Run it explicitly:
//
//   npx vitest run --config scripts/gedcom-corpus.vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/gedcom-corpus.test.ts'],
    testTimeout: 1_800_000,
  },
});
