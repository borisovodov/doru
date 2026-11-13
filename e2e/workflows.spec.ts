import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, openProject } from './launch';
import { seedFamilyTree } from './seed';

test('full workflow through the desktop APIs and UI sections', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-e2e-')), 'family.doru');
  const { app, page } = await launchApp();
  await expect(page.getByRole('region', { name: 'Welcome' })).toBeVisible();

  await openProject(page, project);
  await seedFamilyTree(page, project);

  await page.evaluate(
    async ({ project }) => {
      const persons = await window.doru.listPersons(project);
      if (persons.length !== 3) throw new Error(`persons: ${persons.length}`);

      await window.doru.addPerson(project, {
        id: 'E2E1',
        names: [{ id: 'E2EN1', given: 'E2E', surname: 'Test' }],
        sex: 'U',
        facts: [],
      });

      const stats = await window.doru.treeStats(project);
      if (stats.persons !== 4) throw new Error(`stats: ${JSON.stringify(stats)}`);

      await window.doru.addFamily(project, {
        id: 'E2EF1',
        partners: ['E2E1'],
        children: ['I3'],
      });
      const families = await window.doru.getFamilies(project);
      if (!families.some((f) => f.id === 'E2EF1' && f.partners.includes('E2E1'))) {
        throw new Error('family missing');
      }

      await window.doru.addFact(project, {
        id: 'E2EEV1',
        personId: 'E2E1',
        tag: 'BURI',
        date: { quality: 'exact', component: { year: 2000 } },
        place: 'Testville',
      });
      const events = await window.doru.getFacts(project, 'E2E1');
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

  await page.reload();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Family Tree' })).toBeVisible();

  // The person list now lives in the People sidebar, not in the tree tab.
  await page.getByRole('button', { name: 'People' }).click();
  const peopleSidebar = page.getByRole('complementary', { name: 'People' });
  const peopleList = peopleSidebar.getByRole('list');
  await expect(peopleList.getByRole('button').first()).toBeVisible();

  await peopleList.getByRole('button').first().click();
  await expect(page.getByRole('region', { name: 'Person editor' })).toBeVisible();

  // A fresh profile has no AI provider configured: the agent chat shows the
  // setup placeholder instead of the conversation UI.
  await expect(page.getByRole('region', { name: 'Set up the AI agent' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeHidden();

  // Configuring a provider swaps the placeholder back to the chat panel.
  await page.evaluate(() => window.doru.setAiSettings({ provider: 'ollama', model: 'e2e-model' }));
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Set up the AI agent' })).toBeHidden();

  // Tab drag-and-drop: move the first person tab in front of the tree tab.
  const tabs = page.getByRole('tablist', { name: 'Open tabs' }).getByRole('tab');
  await tabs.first().click();
  await peopleList.getByRole('button').nth(1).click();
  await expect(tabs).toHaveCount(3);
  const orderBefore = await tabs.allTextContents();
  const draggedTab = tabs.nth(1);
  const dropTarget = tabs.nth(0);
  const from = await draggedTab.boundingBox();
  const to = await dropTarget.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  // Cross the drag threshold first so the gesture reliably starts.
  await page.mouse.move(from!.x + from!.width / 2 + 20, from!.y + from!.height / 2);
  await page.mouse.move(to!.x + 2, to!.y + to!.height / 2, { steps: 8 });
  await page.mouse.up();
  // The dragged tab moves to the front and becomes active.
  await expect(tabs).toHaveText([orderBefore[1]!, orderBefore[0]!, orderBefore[2]!]);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

  // Middle-click closes a tab.
  await tabs.first().click({ button: 'middle' });
  await expect(tabs).toHaveCount(2);
  await expect(tabs).toHaveText([orderBefore[0]!, orderBefore[2]!]);

  // Primary sidebar resizing: switch to the people view and drag its sash.
  await page.getByRole('button', { name: 'People' }).click();
  const sideBar = page.getByRole('complementary', { name: 'People' });
  await expect(sideBar).toBeVisible();
  const sideSash = page.getByRole('separator', { name: 'Resize side bar' });
  const sideSashBox = await sideSash.boundingBox();
  const sideBefore = (await sideBar.boundingBox())!.width;
  await page.mouse.move(sideSashBox!.x + sideSashBox!.width / 2, sideSashBox!.y + sideSashBox!.height / 2);
  await page.mouse.down();
  // Make the first step explicit, then drag with more steps, so the gesture
  // reliably registers every move.
  await page.mouse.move(sideSashBox!.x + sideSashBox!.width / 2 + 12, sideSashBox!.y + sideSashBox!.height / 2);
  await page.mouse.move(sideSashBox!.x + sideSashBox!.width / 2 + 60, sideSashBox!.y + sideSashBox!.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  const sideAfter = (await sideBar.boundingBox())!.width;
  expect(sideAfter).toBeGreaterThan(sideBefore + 40);

  // The title-bar button toggles the agent chat panel.
  const agentChat = page.getByRole('complementary', { name: 'Agent Chat' });
  await expect(agentChat).toBeVisible();
  await page.getByRole('button', { name: 'Toggle Agent Chat' }).click();
  await expect(agentChat).toBeHidden();
  await page.getByRole('button', { name: 'Toggle Agent Chat' }).click();
  await expect(agentChat).toBeVisible();

  // The same toggle lives in the application menu — the native menu bar on
  // macOS, the in-window menu on Windows/Linux.
  const toggleFromMenu = async () => {
    if ((await page.evaluate(() => window.doru.platform)) === 'darwin') {
      await app.evaluate(({ Menu }) => {
        Menu.getApplicationMenu()?.getMenuItemById('toggle-agent-chat')?.click();
      });
    } else {
      await page.getByRole('button', { name: 'Menu' }).click();
      await page.getByRole('menuitem', { name: 'Toggle Agent Chat' }).click();
    }
  };
  await toggleFromMenu();
  await expect(agentChat).toBeHidden();
  await toggleFromMenu();
  await expect(agentChat).toBeVisible();

  // Agent chat panel resizing: drag its left sash inwards (it grows).
  const agentChatSash = page.getByRole('separator', { name: 'Resize agent chat' });
  const agentChatSashBox = await agentChatSash.boundingBox();
  const agentChatBefore = (await agentChat.boundingBox())!.width;
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
  const agentChatAfter = (await agentChat.boundingBox())!.width;
  expect(agentChatAfter).toBeGreaterThan(agentChatBefore + 30);

  const aiSettings = await page.evaluate(() => window.doru.getAiSettings());
  expect(aiSettings).toHaveProperty('provider');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Settings' })).toBeVisible();
  await expect(page.getByLabel('Theme')).toBeVisible();

  await app.close();
});
