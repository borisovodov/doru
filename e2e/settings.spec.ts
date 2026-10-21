import { test, expect, _electron as electron } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop');

const palette = {
  'bg-canvas': '#123456',
  fg: '#ffffff',
};

test('the theme dropdown lists valid themes, hides broken ones, and persists the choice', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'doru-settings-'));
  mkdirSync(join(userData, 'themes'), { recursive: true });
  writeFileSync(
    join(userData, 'themes', 'custom.json'),
    JSON.stringify({ name: 'Custom Theme', dark: palette, light: palette }, null, 2),
  );
  // Invalid palette: "dark" must be an object of CSS values, not a string.
  writeFileSync(join(userData, 'themes', 'broken.json'), '{ "dark": "nope" }\n');

  const app = await electron.launch({
    args: ['.'],
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const page = await app.firstWindow();
  await expect(page.locator('.welcome-page')).toBeVisible();

  await page.locator('.activity-bar .activity-bar-bottom').click();
  await expect(page.locator('.settings-view select')).toBeVisible();

  const options = await page.locator('.settings-view select option').allTextContents();
  expect(options).toContain('Custom Theme');
  expect(options.join('|')).not.toContain('broken');

  await page.locator('.settings-view select').selectOption('custom');

  // The choice is persisted into settings.json…
  await expect
    .poll(() => readFileSync(join(userData, 'settings.json'), 'utf8'))
    .toContain('"theme": "custom"');
  // …and the app applies it.
  await expect
    .poll(async () => (await page.evaluate(() => window.doru.getThemeState())).theme)
    .toBe('custom');

  await app.close();
});
