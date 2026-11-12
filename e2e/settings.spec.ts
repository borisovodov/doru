import { test, expect } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp } from './launch';

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

  const { app, page } = await launchApp({ userData });
  await expect(page.getByRole('region', { name: 'Welcome' })).toBeVisible();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const themeSelect = page.getByLabel('Theme');
  await expect(themeSelect).toBeVisible();

  const options = await themeSelect.locator('option').allTextContents();
  expect(options).toContain('Custom Theme');
  expect(options.join('|')).not.toContain('broken');

  await themeSelect.selectOption('custom');

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
