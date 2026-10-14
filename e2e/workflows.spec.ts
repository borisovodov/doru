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
  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-data-'));
  const args = ['.'];
  if (process.env.CI === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const home = await app.firstWindow();
  await expect(home.locator('.welcome-page')).toBeVisible();

  await home.evaluate(
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

      const undo = await window.doru.undo(project);
      if (!undo.canRedo) throw new Error('undo failed');
      await window.doru.redo(project);
    },
    { project, fixture },
  );

  const window = home;
  await window.reload();
  await expect(window.locator('.workbench')).toBeVisible();
  await expect(window.locator('.person-list li').first()).toBeVisible();

  await window.locator('.person-list li').first().click();
  await expect(window.locator('.person-editor')).toBeVisible();
  await expect(window.locator('.chat-panel')).toBeVisible();

  // Tab drag-and-drop: move the first person tab in front of the tree tab.
  await window.locator('.tab-bar .tab').first().click();
  await window.locator('.person-list li').nth(1).click();
  await expect(window.locator('.tab-bar .tab')).toHaveCount(3);
  const tabLabels = window.locator('.tab-bar .tab .tab-label');
  const orderBefore = await tabLabels.allTextContents();
  const draggedTab = window.locator('.tab-bar .tab').nth(1);
  const dropTarget = window.locator('.tab-bar .tab').nth(0);
  const from = await draggedTab.boundingBox();
  const to = await dropTarget.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await window.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await window.mouse.down();
  await window.mouse.move(to!.x + 2, to!.y + to!.height / 2, { steps: 8 });
  await expect(window.locator('.tab-drag-ghost')).toBeVisible();
  await window.mouse.up();
  await expect(window.locator('.tab-drag-ghost')).toBeHidden();
  const orderAfter = await tabLabels.allTextContents();
  expect(orderAfter).toEqual([orderBefore[1], orderBefore[0], orderBefore[2]]);
  // The dragged tab becomes active, like in VS Code.
  await expect(window.locator('.tab-bar .tab').first()).toHaveClass(/active/);

  const aiSettings = await window.evaluate(() => window.doru.getAiSettings());
  expect(aiSettings).toHaveProperty('provider');

  await window.locator('.activity-bar-item[title="Settings"]').click();
  await expect(window.locator('.settings-view')).toBeVisible();
  await expect(window.locator('.settings-view select')).toBeVisible();

  await app.close();
});
