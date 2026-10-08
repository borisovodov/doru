import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const root = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(root, '../apps/desktop');
const fixture = resolve(root, 'fixtures', 'small.ged');

test('full workflow through the desktop APIs and UI sections', async () => {
  const project = mkdtempSync(join(tmpdir(), 'doru-e2e-'));
  const args = ['.'];
  if (process.env.CI === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({ args, cwd: appDir });
  const window = await app.firstWindow();
  await expect(window.locator('.workbench')).toBeVisible();

  await window.evaluate(
    async ({ project, fixture }) => {
      const summary = await window.doru.openProjectPath(project);
      if (!summary) throw new Error('project open failed');

      const imported = await window.doru.importGedcomFile(project, fixture);
      if (!imported || imported.importedPersons !== 3) {
        throw new Error(`import failed: ${JSON.stringify(imported)}`);
      }

      const persons = await window.doru.listPersons(project);
      if (persons.length !== 3) throw new Error(`persons: ${persons.length}`);

      await window.doru.addPerson(project, {
        id: 'E2E1',
        names: [{ given: 'E2E', surname: 'Test' }],
        sex: 'U',
      });

      const stats = await window.doru.treeStats(project);
      if (stats.persons !== 4) throw new Error(`stats: ${JSON.stringify(stats)}`);

      await window.doru.addFamily(project, {
        id: 'E2EF1',
        parents: ['E2E1'],
        children: ['@I3@'],
      });
      const families = await window.doru.getFamilies(project);
      if (!families.some((f) => f.id === 'E2EF1' && f.parents.includes('E2E1'))) {
        throw new Error('family missing');
      }

      await window.doru.addEvent(project, {
        id: 'E2EEV1',
        type: 'BURI',
        date: { year: 2000, quality: 'exact' },
        place: 'Testville',
        personId: 'E2E1',
      });
      const events = await window.doru.getEvents(project, 'E2E1');
      if (events.length !== 1 || events[0]?.place !== 'Testville') {
        throw new Error('event missing');
      }

      await window.doru.addNote(project, {
        id: 'E2EN1',
        text: 'Check the archive',
        targetType: 'person',
        targetId: 'E2E1',
      });
      const notes = await window.doru.listNotes(project, 'E2E1');
      if (notes.length !== 1) throw new Error('note missing');

      const gedcom = await window.doru.getGedcomText(project);
      if (!gedcom.includes('E2E')) throw new Error('gedcom export missing person');

      const theme = await window.doru.getTheme(project);
      if (!theme.css.includes('Doru theme')) throw new Error('theme missing');

      const settings = await window.doru.getProjectSettings(project);
      if (settings.nameFormat !== 'given-first') throw new Error('settings missing');

      const undo = await window.doru.undo(project);
      if (!undo.canRedo) throw new Error('undo failed');
      await window.doru.redo(project);
    },
    { project, fixture },
  );

  await window.locator('.person-list li').first().click();
  await expect(window.locator('.person-editor')).toBeVisible();
  await expect(window.locator('.chat-panel')).toBeVisible();

  await app.close();
});
