import { test, expect, _electron as electron } from '@playwright/test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop');

test('app launches and shows the workbench', async () => {
  const args = ['.'];
  if (process.env.CI === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({ args, cwd: appDir });
  const window = await app.firstWindow();
  await expect(window).toHaveTitle('Doru');
  await expect(window.locator('.workbench')).toBeVisible();
  await app.close();
});
