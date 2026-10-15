import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  retries: 1,
  // A committed test.only must never silently skip the rest of the suite
  // in CI.
  forbidOnly: !!process.env['CI'],
});
