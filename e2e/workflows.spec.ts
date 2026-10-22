import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFamilyTree } from './seed';

const root = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(root, '../apps/desktop');

test('full workflow through the desktop APIs and UI sections', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-e2e-data-'));
  const args = ['.'];
  if (process.env['CI'] === 'true') {
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
    async ({ project }) => {
      const summary = await window.doru.openProjectPath(project);
      if (!summary) throw new Error('project open failed');
    },
    { project },
  );
  await seedFamilyTree(home, project);

  await home.evaluate(
    async ({ project }) => {
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
        children: ['I3'],
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

      const undo = await window.doru.undo(project);
      if (!undo.canRedo) throw new Error('undo failed');
      await window.doru.redo(project);
    },
    { project },
  );

  const page = home;
  await page.reload();
  await expect(page.locator('.workbench')).toBeVisible();
  await expect(page.locator('.editor-pane.active .tree-canvas')).toBeVisible();

  // The person list now lives in the People sidebar, not in the tree tab.
  await page.locator('.activity-bar .activity-bar-item').nth(1).click();
  await expect(page.locator('.person-list li').first()).toBeVisible();

  await page.locator('.person-list li').first().click();
  await expect(page.locator('.person-editor')).toBeVisible();
  await expect(page.locator('.chat-panel')).toBeVisible();

  // Tab drag-and-drop: move the first person tab in front of the tree tab.
  await page.locator('.tab-bar .tab').first().click();
  await page.locator('.person-list li').nth(1).click();
  await expect(page.locator('.tab-bar .tab')).toHaveCount(3);
  const tabLabels = page.locator('.tab-bar .tab .tab-label');
  const orderBefore = await tabLabels.allTextContents();
  const draggedTab = page.locator('.tab-bar .tab').nth(1);
  const dropTarget = page.locator('.tab-bar .tab').nth(0);
  const from = await draggedTab.boundingBox();
  const to = await dropTarget.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  // Cross the drag threshold first so the gesture reliably starts.
  await page.mouse.move(from!.x + from!.width / 2 + 20, from!.y + from!.height / 2);
  await page.mouse.move(to!.x + 2, to!.y + to!.height / 2, { steps: 8 });
  await expect(page.locator('.tab-drag-ghost')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.tab-drag-ghost')).toBeHidden();
  // The dragged tab moves to the front and becomes active.
  await expect(tabLabels).toHaveText([orderBefore[1]!, orderBefore[0]!, orderBefore[2]!]);
  await expect(page.locator('.tab-bar .tab').first()).toHaveClass(/active/);

  // Middle-click closes a tab.
  const labelsAfterReorder = page.locator('.tab-bar .tab .tab-label');
  await page.locator('.tab-bar .tab').first().click({ button: 'middle' });
  await expect(page.locator('.tab-bar .tab')).toHaveCount(2);
  await expect(labelsAfterReorder).toHaveText([orderBefore[0]!, orderBefore[2]!]);

  // Primary sidebar resizing: switch to the people view and drag its sash.
  await page.locator('.activity-bar .activity-bar-item').nth(1).click();
  await expect(page.locator('.side-bar')).toBeVisible();
  const sideSash = page.locator('.side-sash');
  const sideSashBox = await sideSash.boundingBox();
  const sideBefore = (await page.locator('.side-bar').boundingBox())!.width;
  await page.mouse.move(
    sideSashBox!.x + sideSashBox!.width / 2,
    sideSashBox!.y + sideSashBox!.height / 2,
  );
  await page.mouse.down();
  // Make the first step explicit, then drag with more steps, so the gesture
  // reliably registers every move.
  await page.mouse.move(
    sideSashBox!.x + sideSashBox!.width / 2 + 12,
    sideSashBox!.y + sideSashBox!.height / 2,
  );
  await page.mouse.move(
    sideSashBox!.x + sideSashBox!.width / 2 + 60,
    sideSashBox!.y + sideSashBox!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  const sideAfter = (await page.locator('.side-bar').boundingBox())!.width;
  expect(sideAfter).toBeGreaterThan(sideBefore + 40);

  // The title-bar button toggles the agent chat panel.
  await expect(page.locator('.agent-chat-panel')).toBeVisible();
  await page.locator('.title-bar-action').click();
  await expect(page.locator('.agent-chat-panel')).toBeHidden();
  await page.locator('.title-bar-action').click();
  await expect(page.locator('.agent-chat-panel')).toBeVisible();

  // The same toggle lives in the application menu (View section).
  const toggleFromMenu = () =>
    app.evaluate(({ Menu }) => {
      Menu.getApplicationMenu()?.getMenuItemById('toggle-agent-chat')?.click();
    });
  await toggleFromMenu();
  await expect(page.locator('.agent-chat-panel')).toBeHidden();
  await toggleFromMenu();
  await expect(page.locator('.agent-chat-panel')).toBeVisible();

  // Agent chat panel resizing: drag its left sash inwards (it grows).
  const agentChatSash = page.locator('.agent-chat-sash');
  const agentChatSashBox = await agentChatSash.boundingBox();
  const agentChatBefore = (await page.locator('.agent-chat-panel').boundingBox())!.width;
  await page.mouse.move(
    agentChatSashBox!.x + agentChatSashBox!.width / 2,
    agentChatSashBox!.y + agentChatSashBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    agentChatSashBox!.x + agentChatSashBox!.width / 2 - 10,
    agentChatSashBox!.y + agentChatSashBox!.height / 2,
  );
  await page.mouse.move(
    agentChatSashBox!.x + agentChatSashBox!.width / 2 - 50,
    agentChatSashBox!.y + agentChatSashBox!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  const agentChatAfter = (await page.locator('.agent-chat-panel').boundingBox())!.width;
  expect(agentChatAfter).toBeGreaterThan(agentChatBefore + 30);

  const aiSettings = await page.evaluate(() => window.doru.getAiSettings());
  expect(aiSettings).toHaveProperty('provider');

  await page.locator('.activity-bar .activity-bar-bottom').click();
  await expect(page.locator('.settings-view')).toBeVisible();
  await expect(page.getByLabel('Theme')).toBeVisible();

  await app.close();
});
