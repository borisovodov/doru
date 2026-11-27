import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp } from './launch';
import { seedFamilyTree } from './seed';

test('window history navigates tree focus and editor tabs', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-navigation-e2e-')), 'family.doru');
  const { app, page } = await launchApp({ project });
  await seedFamilyTree(page, project);
  await page.reload();

  const ivan = page.getByRole('group', { name: 'Ivan Ivanov', exact: true });
  const petr = page.getByRole('group', { name: 'Petr Ivanov', exact: true });
  const back = page.getByRole('button', { name: 'Back', exact: true });
  const forward = page.getByRole('button', { name: 'Forward', exact: true });
  const treeTab = page.getByRole('tab', { name: 'Family Tree' });
  const personTab = page.getByRole('tab', { name: /Ivan Ivanov/ });

  await expect(ivan).toBeVisible({ timeout: 20_000 });
  await expect(back).toBeVisible();
  await expect(back).toBeDisabled();
  await expect(forward).toBeDisabled();

  // Default focus is Petr; double-clicking Ivan is a tree navigation.
  await expect(petr).toHaveAttribute('aria-current', 'true');
  await ivan.dblclick();
  await expect(ivan).toHaveAttribute('aria-current', 'true');

  await back.click();
  await expect(petr).toHaveAttribute('aria-current', 'true');
  await forward.click();
  await expect(ivan).toHaveAttribute('aria-current', 'true');

  const platform = await page.evaluate(() => window.doru.platform);
  const backKey = platform === 'darwin' ? 'Meta+[' : 'Alt+ArrowLeft';
  const forwardKey = platform === 'darwin' ? 'Meta+]' : 'Alt+ArrowRight';
  await page.keyboard.press(backKey);
  await expect(petr).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press(forwardKey);
  await expect(ivan).toHaveAttribute('aria-current', 'true');

  // Opening the person editor is a tab navigation; Back returns to the tree
  // location it was opened from.
  await ivan.click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(personTab).toHaveAttribute('aria-selected', 'true');

  await back.click();
  await expect(treeTab).toHaveAttribute('aria-selected', 'true');
  await expect(ivan).toHaveAttribute('aria-current', 'true');

  await forward.click();
  await expect(personTab).toHaveAttribute('aria-selected', 'true');

  // Manual tab switches belong to the history as well.
  await treeTab.click();
  await expect(treeTab).toHaveAttribute('aria-selected', 'true');
  await back.click();
  await expect(personTab).toHaveAttribute('aria-selected', 'true');

  await app.close();
});
