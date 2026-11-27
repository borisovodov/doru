import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, openProject } from './launch';

test('the media sidebar offers files and links', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-media-add-e2e-')), 'media.doru');
  const { app, page } = await launchApp();
  try {
    await openProject(page, project);
    await page.getByRole('button', { name: 'Media', exact: true }).click();
    await page.getByRole('button', { name: 'Add media' }).click();

    await expect(page.getByRole('menuitem', { name: 'From computer…' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'From link' }).click();
    await expect(page.getByRole('textbox', { name: 'Link' })).toBeVisible();
    await expect(page.getByText('Direct link to a JPEG or AVIF image.')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('textbox', { name: 'Link' })).toHaveCount(0);
  } finally {
    await app.close();
  }
});
