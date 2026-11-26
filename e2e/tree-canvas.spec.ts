import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp } from './launch';
import { seedFamilyTree } from './seed';

test('canvas editing cycle: add a child, reparent by drag, undo everything', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-canvas-e2e-')), 'family.doru');
  const { app, page } = await launchApp({ project });

  // Seed: the base family, give Ivan a second family (Kid2), and give
  // Kid2 an empty family of their own (the reparent drop target).
  await seedFamilyTree(page, project);
  await page.evaluate(
    async ({ project }) => {
      await window.doru.addPerson(project, {
        id: 'KID2',
        names: [{ id: 'NKID2', given: 'Kid2', surname: 'Ivanov' }],
        sex: 'U',
        facts: [],
      });
      await window.doru.addFamily(project, { id: 'F3', partners: ['I1'], children: ['KID2'] });
      await window.doru.addFamily(project, { id: 'F4', partners: ['KID2'], children: [] });
    },
    { project },
  );
  await page.reload();
  await expect(page.getByRole('group', { name: 'Ivan Ivanov', exact: true })).toBeVisible({ timeout: 20_000 });

  // Refocus on Ivan and look at his descendants (Petr + Kid2).
  await page.getByRole('group', { name: 'Ivan Ivanov', exact: true }).dblclick();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Descendants' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByRole('group', { name: 'Kid2 Ivanov', exact: true })).toBeVisible();

  // Add a child to Ivan via the card toolbar: the new card edits in place.
  const ivan = page.getByRole('group', { name: 'Ivan Ivanov', exact: true });
  const ibox = await ivan.boundingBox();
  await page.mouse.click(ibox!.x + ibox!.width / 2, ibox!.y + ibox!.height / 2);
  await page.getByRole('button', { name: 'Add child' }).click();
  const draftCard = page.getByRole('form', { name: 'Add the first person', exact: true });
  await expect(draftCard).toBeVisible();
  await draftCard.getByRole('textbox', { name: 'Given name' }).fill('TestKid');
  await draftCard.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('group', { name: 'TestKid', exact: true })).toBeVisible();

  // Drag TestKid onto Kid2 → reparents into family F4.
  const kid = page.getByRole('group', { name: 'TestKid', exact: true });
  const kid2 = page.getByRole('group', { name: 'Kid2 Ivanov', exact: true });
  const kbox = await kid.boundingBox();
  const k2box = await kid2.boundingBox();
  // Card re-parenting starts from the grip in the top-left corner; dragging
  // the card body pans the canvas.
  await page.mouse.move(kbox!.x + 8, kbox!.y + 7);
  await page.mouse.down();
  // Cross the 4px drag threshold first so the gesture reliably starts.
  await page.mouse.move(kbox!.x + 28, kbox!.y + 7);
  await page.mouse.move(k2box!.x + k2box!.width / 2, k2box!.y + k2box!.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(900);

  const kidId = await page.evaluate(async (p) => {
    const persons = await window.doru.listPersons(p);
    return persons.find((person) => person.names.some((name) => name.given === 'TestKid'))?.id;
  }, project);
  expect(kidId).toBeDefined();
  const afterReparent = await page.evaluate((p) => window.doru.getFamilies(p), project);
  const f1 = afterReparent.find((family) => family.id === 'F1');
  const f4 = afterReparent.find((family) => family.id === 'F4');
  expect(f1?.children).not.toContain(kidId);
  expect(f4?.children).toContain(kidId);

  // One undo restores the reparent (the whole compound op).
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(900);
  const afterUndoReparent = await page.evaluate((p) => window.doru.getFamilies(p), project);
  expect(afterUndoReparent.find((family) => family.id === 'F1')?.children).toContain(kidId);
  expect(afterUndoReparent.find((family) => family.id === 'F4')?.children).not.toContain(kidId);

  // A second undo removes the added person entirely.
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(900);
  const afterUndoAdd = await page.evaluate(async (p) => {
    const persons = await window.doru.listPersons(p);
    return persons.some((person) => person.names.some((name) => name.given === 'TestKid'));
  }, project);
  expect(afterUndoAdd).toBe(false);

  await app.close();
});

test('clicking a person in the People sidebar focuses the canvas', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-sidebar-e2e-')), 'family.doru');
  const { app, page } = await launchApp({ project });
  await seedFamilyTree(page, project);
  await page.reload();
  await expect(page.getByRole('group', { name: 'Ivan Ivanov', exact: true })).toBeVisible({ timeout: 20_000 });

  // Open the People view and click Ivan in the sidebar list.
  await page.getByRole('button', { name: 'People' }).click();
  const peopleList = page.getByRole('complementary', { name: 'People' }).getByRole('list');
  await expect(peopleList.getByRole('button').first()).toBeVisible();
  await peopleList.getByRole('button', { name: /Ivan Ivanov/ }).click();

  // The canvas (kept alive in the hidden pane) refocuses on Ivan.
  await expect(page.getByRole('list', { name: 'Focus trail', includeHidden: true })).toHaveText(/Ivan Ivanov/);
  await app.close();
});

test('rename and delete with undo on the canvas', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-ops-e2e-')), 'family.doru');
  const { app, page } = await launchApp({ project });
  await seedFamilyTree(page, project);
  await page.reload();
  await expect(page.getByRole('group', { name: 'Ivan Ivanov', exact: true })).toBeVisible({ timeout: 20_000 });

  const clickCard = async (name: string) => {
    const card = page.getByRole('group', { name, exact: true });
    const box = await card.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(250);
  };

  // Rename Petr via the card toolbar: editing now happens in the person tab.
  await clickCard('Petr Ivanov');
  await page.getByRole('button', { name: 'Edit' }).click();
  const editor = page.getByRole('region', { name: 'Person editor' });
  await expect(editor).toBeVisible();
  await editor.getByRole('textbox', { name: 'Given name' }).first().fill('Petya');
  // Leaving the editor autosaves the rename.
  await page.getByRole('tab', { name: 'Family Tree' }).click();
  await expect(page.getByRole('group', { name: 'Petya Ivanov', exact: true })).toBeVisible();

  // Undo the rename.
  await page.keyboard.press('Meta+z');
  await expect(page.getByRole('group', { name: 'Petr Ivanov', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Petya Ivanov', exact: true })).toHaveCount(0);

  // Focus Maria through the People sidebar, then return to the canvas.
  await page.getByRole('button', { name: 'People' }).click();
  const peopleList = page.getByRole('complementary', { name: 'People' }).getByRole('list');
  await peopleList.getByRole('button', { name: /Maria Ivanova/ }).click();
  await page.getByRole('tab', { name: 'Family Tree' }).click();
  await expect(page.getByRole('group', { name: 'Maria Ivanova', exact: true })).toHaveAttribute('aria-current', 'true');
  await page.waitForTimeout(400);

  // Delete the focused person (Maria) and undo the whole compound op.
  await clickCard('Maria Ivanova');
  await page.getByRole('button', { name: 'Delete person' }).click();
  await expect(page.getByRole('group', { name: 'Maria Ivanova', exact: true })).toHaveCount(0);
  await page.keyboard.press('Meta+z');
  await expect(page.getByRole('group', { name: 'Maria Ivanova', exact: true })).toBeVisible();

  await app.close();
});

test('the canvas does not emit ResizeObserver loop or attribution warnings', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-canvas-errors-e2e-')), 'family.doru');
  const { app, page } = await launchApp({ project });
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning') {
      warnings.push(message.text());
    }
  });
  await page.addInitScript(() => {
    const target = window as Window & { __resizeObserverErrors?: string[] };
    target.__resizeObserverErrors = [];
    const record = (message: string): void => {
      if (message.includes('ResizeObserver')) {
        target.__resizeObserverErrors?.push(message);
      }
    };
    window.addEventListener('error', (event) => {
      record(event.message);
    });
    window.addEventListener('unhandledrejection', (event) => {
      record(String(event.reason ?? ''));
    });
  });
  await seedFamilyTree(page, project);
  await page.reload();
  const ivan = page.getByRole('group', { name: 'Ivan Ivanov', exact: true });
  await expect(ivan).toBeVisible({ timeout: 20_000 });
  // The old attribution warning fired one second after mount.
  await page.waitForTimeout(1_500);

  // Backspace must not remove a selected card from the canvas only.
  await ivan.click();
  await page.keyboard.press('Backspace');
  await expect(ivan).toBeVisible();

  // Zoom, hide the tab, come back: the camera survives a tab switch.
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForTimeout(300);
  const zoomed = await ivan.boundingBox();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Family Tree' }).click();
  await page.waitForTimeout(300);
  expect(await ivan.boundingBox()).toEqual(zoomed);
  await page.waitForTimeout(300);

  const errors = await page.evaluate(
    () => (window as Window & { __resizeObserverErrors?: string[] }).__resizeObserverErrors ?? [],
  );
  expect(errors).toEqual([]);
  expect(warnings.filter((warning) => warning.includes('attribution'))).toEqual([]);
  await app.close();
});

test('an empty tree shows an unfilled card that edits in place', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-empty-e2e-')), 'family.doru');
  const { app, page } = await launchApp({ project });
  await page.reload();
  // The canvas shows the unfilled card; a click turns it into the editor.
  const draft = page.getByRole('group', { name: 'Add the first person', exact: true });
  await expect(draft).toBeVisible();
  await draft.click();
  const form = page.getByRole('form', { name: 'Add the first person', exact: true });
  await expect(form).toBeVisible();
  await form.getByRole('textbox', { name: 'Given name' }).fill('Ivan Ivanov');
  await form.getByRole('button', { name: 'Save' }).click();
  // The person lands on the canvas; the draft card is gone.
  await expect(page.getByRole('group', { name: 'Ivan Ivanov', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Add the first person', exact: true })).toHaveCount(0);
  await app.close();
});
