import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop');

test('app launches and shows the welcome screen', async () => {
  const args = ['.'];
  if (process.env['CI'] === 'true') {
    args.push('--no-sandbox');
  }
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-data-'));
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const page = await app.firstWindow();
  await expect(page).toHaveTitle('Dóru');
  await expect(page.locator('.workbench')).toBeVisible();
  await expect(page.locator('.welcome-page')).toBeVisible();
  await app.close();
});
