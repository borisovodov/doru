import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { launchApp } from './launch';

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @O1@ OBJE',
  '1 FILE family.jpg',
  '0 @O2@ OBJE',
  '1 FILE unsupported.png',
  '0 @I1@ INDI',
  '1 NAME Ivan /Ivanov/',
  '1 OBJE @O1@',
  '1 OBJE @O2@',
  '0 TRLR',
].join('\n');

test('GEDCOM media is converted to AVIF and unsupported images are skipped', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'doru-ged-media-e2e-'));
  const gedPath = join(dir, 'media-test.ged');
  writeFileSync(gedPath, GEDCOM, 'utf8');
  writeFileSync(
    join(dir, 'family.jpg'),
    await sharp({ create: { width: 6, height: 4, channels: 3, background: '#884422' } })
      .jpeg()
      .toBuffer(),
  );
  writeFileSync(
    join(dir, 'unsupported.png'),
    await sharp({ create: { width: 6, height: 4, channels: 3, background: '#224488' } })
      .png()
      .toBuffer(),
  );

  const { app, page } = await launchApp({ project: gedPath });
  try {
    const state = await page.evaluate(async () => {
      const binding = await window.doru.getCurrentProject();
      if (!binding) throw new Error('no project binding');
      return { binding, media: await window.doru.getAllMedia(binding.path) };
    });

    expect(state.media).toHaveLength(1);
    const [media] = state.media;
    expect(media?.title).toBe('family');
    expect(media?.path).toMatch(/^media\/[0-9a-f-]+\.avif$/);
    expect(media?.absolutePath).toMatch(/\.avif$/);
    const bytes = readFileSync(media?.absolutePath ?? '');
    expect(bytes.toString('ascii', 4, 8)).toBe('ftyp');

    // The AVIF copy is also what the renderer displays.
    await page.getByRole('button', { name: 'Media', exact: true }).click();
    await expect(page.getByRole('complementary', { name: 'Media' })).toBeVisible();
    await page.getByRole('button', { name: /family/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'family' })).toBeVisible();
    const preview = page.getByRole('img', { name: 'family' });
    await expect(preview).toBeVisible();
    await expect.poll(async () => preview.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  } finally {
    await app.close();
  }
});
