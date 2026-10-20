import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(root, '../apps/desktop');

const GEDCOM = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '0 @I1@ INDI',
  '1 NAME Ivan /Ivanov/',
  '1 SEX M',
  '0 TRLR',
].join('\n');

test('opening a GEDCOM file opens a not-yet-saved project', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'doru-ged-e2e-'));
  const gedPath = join(dir, 'Ivanov family.ged');
  writeFileSync(gedPath, GEDCOM, 'utf8');
  const userData = mkdtempSync(join(tmpdir(), 'doru-ged-e2e-data-'));
  const args = ['.', gedPath];
  if (process.env['CI'] === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('.workbench', { timeout: 20_000 });

  // The window is bound to a not-yet-saved project carrying the file name.
  await expect(page.locator('.title-bar-title')).toHaveText('Ivanov family.ged •');
  const state = await page.evaluate(async () => {
    const binding = await window.doru.getCurrentProject();
    return binding;
  });
  expect(state).toMatchObject({ untitled: true, name: 'Ivanov family.ged' });
  expect(state?.path.startsWith('untitled:')).toBe(true);

  // The untitled project is a working (for now empty) tree: adding a person
  // goes through the same runtime as a saved project.
  const projectPath = state?.path;
  if (!projectPath) {
    throw new Error('no project binding');
  }
  await page.evaluate(
    async ({ projectPath }) => {
      const before = await window.doru.treeStats(projectPath);
      if (before.persons !== 0) throw new Error(`expected empty tree, got ${before.persons}`);
      await window.doru.addPerson(projectPath, {
        id: 'GED1',
        names: [{ given: 'Stub', surname: 'Imported' }],
        sex: 'U',
      });
      const after = await window.doru.treeStats(projectPath);
      if (after.persons !== 1) throw new Error(`expected 1 person, got ${after.persons}`);
    },
    { projectPath },
  );

  // The save action is offered for unsaved projects.
  await expect(page.locator('.title-bar-action[aria-label]').first()).toBeVisible();

  await app.close();
});
