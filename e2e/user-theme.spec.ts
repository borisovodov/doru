import { test, expect, _electron as electron } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/desktop');

const palette = {
  'bg-canvas': '#123456',
  'bg-chrome': '#223344',
  'bg-chrome-active': 'rgba(255, 255, 255, 0.07)',
  'bg-raised': '#334455',
  'bg-popover': '#445566',
  'bg-input': '#223344',
  fg: '#ffffff',
  'fg-muted': '#cccccc',
  'fg-faint': '#999999',
  border: 'rgba(255, 255, 255, 0.1)',
  'border-strong': 'rgba(255, 255, 255, 0.2)',
  accent: '#ff0000',
  'accent-hover': '#ff3333',
  'accent-active': '#cc0000',
  'on-accent': '#ffffff',
  'accent-alpha': 'rgba(255, 0, 0, 0.15)',
  'overlay-hover': 'rgba(255, 255, 255, 0.06)',
  'overlay-pressed': 'rgba(255, 255, 255, 0.1)',
  success: '#00ff00',
  warning: '#ffff00',
  danger: '#ff0000',
  info: '#00ffff',
  ring: '0 0 0 0.5px rgba(255, 255, 255, 0.14)',
};

test('a user theme with a bundled id overrides it', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'doru-usertheme-'));
  writeFileSync(join(userData, 'doru.json'), '{"theme":"doru"}\n');
  mkdirSync(join(userData, 'themes'), { recursive: true });
  writeFileSync(
    join(userData, 'themes', 'doru.json'),
    JSON.stringify({ name: 'My Dóru', dark: palette, light: palette }, null, 2),
  );

  const app = await electron.launch({
    args: ['.'],
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const page = await app.firstWindow();
  await page.locator('.workbench').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () =>
      getComputedStyle(document.documentElement).getPropertyValue('--doru-accent').trim() ===
      '#ff0000',
    undefined,
    { timeout: 10_000 },
  );
  const canvas = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--doru-bg-canvas').trim(),
  );
  expect(canvas).toBe('#123456');
  await app.close();
});
