import { test, expect } from '@playwright/test';
import { launchApp } from './launch';

test('app launches and shows the welcome screen', async () => {
  const { app, page } = await launchApp();
  await expect(page).toHaveTitle('Dóru');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Welcome' })).toBeVisible();
  await app.close();
});

test('New Window shortcut opens a second welcome window', async () => {
  const { app, page } = await launchApp();
  // The native macOS menu consumes the accelerator before the DOM; other
  // platforms go through the renderer keybindings. Both end in one new window.
  const shortcut = process.platform === 'darwin' ? 'Meta+Shift+N' : 'Control+Shift+N';
  const [second] = await Promise.all([app.waitForEvent('window'), page.keyboard.press(shortcut)]);
  await expect(second.getByRole('region', { name: 'Welcome' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Welcome' })).toBeVisible();
  await app.close();
});

test('Search stays hidden until the feature is ready', async () => {
  const { app, page } = await launchApp();

  await expect(page.getByRole('button', { name: 'Search', exact: true })).toHaveCount(0);

  // SEARCH_VISIBLE in @doru/platform is off: the shortcut must not open the
  // unfinished sidebar. Restore the full interaction test when it flips on.
  const isMac = process.platform === 'darwin';
  await page.keyboard.press(isMac ? 'Meta+Shift+F' : 'Control+Shift+F');
  await expect(page.getByRole('complementary', { name: 'Search' })).toHaveCount(0);
  await app.close();
});

test('Media stays hidden until the feature is ready', async () => {
  const { app, page } = await launchApp();

  await expect(page.getByRole('button', { name: 'Media', exact: true })).toHaveCount(0);
  await app.close();
});

test('settings link opens the third-party notices tab', async () => {
  const { app, page } = await launchApp();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Third-party notices' }).click();
  await expect(page.getByRole('region', { name: 'Third-party notices' })).toBeVisible();
  // The generated list carries an entry per project; React is guaranteed.
  const reactEntry = page.getByRole('article', { name: 'react', exact: true });
  await expect(reactEntry).toBeVisible();
  // The license texts are expandable and reproduced verbatim.
  await reactEntry.getByText('MIT', { exact: true }).click();
  await expect(reactEntry).toContainText('Meta Platforms');
  await app.close();
});
