import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop');

async function launchApp() {
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
  return { app, page: await app.firstWindow() };
}

test('app launches and shows the welcome screen', async () => {
  const { app, page } = await launchApp();
  await expect(page).toHaveTitle('Dóru');
  await expect(page.locator('.workbench')).toBeVisible();
  await expect(page.locator('.welcome-page')).toBeVisible();
  await app.close();
});

test('settings link opens the third-party notices tab', async () => {
  const { app, page } = await launchApp();
  await page.locator('.activity-bar-item.activity-bar-bottom').click();
  await expect(page.locator('.settings-view')).toBeVisible();
  await page.getByRole('button', { name: 'Third-party notices' }).click();
  await expect(page.locator('.notices-view')).toBeVisible();
  // The generated list carries an entry per project; React is guaranteed.
  const reactEntry = page
    .locator('.notices-entry')
    .filter({ has: page.getByRole('link', { name: 'react', exact: true }) });
  await expect(reactEntry).toBeVisible();
  // The license texts are expandable and reproduced verbatim.
  await reactEntry.locator('summary').click();
  await expect(reactEntry.locator('pre', { hasText: 'Meta Platforms' })).toBeVisible();
  await app.close();
});
