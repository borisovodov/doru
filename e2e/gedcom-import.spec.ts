import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp } from './launch';

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
  const { app, page } = await launchApp({ project: gedPath });

  // The window is bound to a not-yet-saved project carrying the file name.
  await expect(page.getByRole('banner')).toContainText('Ivanov family.ged •');
  const state = await page.evaluate(async () => {
    const binding = await window.doru.getCurrentProject();
    return binding;
  });
  expect(state).toMatchObject({ untitled: true, name: 'Ivanov family.ged' });
  expect(state?.path.startsWith('untitled:')).toBe(true);

  // The untitled project holds the imported tree: Ivan, male, from the
  // GEDCOM. The same runtime serves it, so edits work like on a saved file.
  const projectPath = state?.path;
  if (!projectPath) {
    throw new Error('no project binding');
  }
  await page.evaluate(
    async ({ projectPath }) => {
      const imported = await window.doru.listPersons(projectPath);
      if (imported.length !== 1) throw new Error(`expected 1 imported person, got ${imported.length}`);
      const [ivan] = imported;
      if (ivan?.names[0]?.given !== 'Ivan' || ivan?.sex !== 'M') {
        throw new Error(`unexpected imported person: ${JSON.stringify(imported)}`);
      }
      await window.doru.addPerson(projectPath, {
        id: 'GED1',
        names: [{ id: 'GEDN1', given: 'Stub', surname: 'Imported' }],
        sex: 'U',
        facts: [],
      });
      const after = await window.doru.treeStats(projectPath);
      if (after.persons !== 2) throw new Error(`expected 2 persons, got ${after.persons}`);
    },
    { projectPath },
  );

  // The save action is offered for unsaved projects.
  await expect(page.getByRole('banner').getByRole('button', { name: 'Save' })).toBeVisible();

  await app.close();
});
