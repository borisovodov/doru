import { test, expect } from '@playwright/test';
import { launchApp } from './launch';

test('app launches and shows the welcome screen', async () => {
  const { app, page } = await launchApp();
  await expect(page).toHaveTitle('Dóru');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Welcome' })).toBeVisible();
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
