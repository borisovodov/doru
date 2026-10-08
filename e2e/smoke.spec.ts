import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop');

test('app launches and shows the workbench', async () => {
  const args = ['.'];
  if (process.env.CI === 'true') {
    args.push('--no-sandbox');
  }
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-data-'));
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const window = await app.firstWindow();
  await expect(window).toHaveTitle('Dóru');
  await expect(window.locator('.workbench')).toBeVisible();
  await app.close();
});
