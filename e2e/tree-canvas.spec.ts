import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp } from './launch';
import { seedFamilyTree } from './seed';

test('canvas editing cycle: add a child and undo', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-canvas-e2e-')), 'family.doru');
  const { app, page } = await launchApp({ project });

  await seedFamilyTree(page, project);
  await page.reload();
  await expect(page.getByRole('group', { name: 'Ivan Ivanov', exact: true })).toBeVisible({ timeout: 20_000 });
  // The canvas has no chart switcher: ancestors and descendants are always shown.
  await expect(page.getByRole('button', { name: 'Descendants' })).toHaveCount(0);

  // Refocus on Ivan: his ancestors and descendants are always visible.
  await page.getByRole('group', { name: 'Ivan Ivanov', exact: true }).dblclick();
  await page.waitForTimeout(600);

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

  const kidId = await page.evaluate(async (p) => {
    const persons = await window.doru.listPersons(p);
    return persons.find((person) => person.names.some((name) => name.given === 'TestKid'))?.id;
  }, project);
  expect(kidId).toBeDefined();
  const afterAdd = await page.evaluate((p) => window.doru.getFamilies(p), project);
  expect(afterAdd.find((family) => family.id === 'F1')?.children).toContain(kidId);

  // One undo removes the added person and the family link.
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(900);
  const afterUndo = await page.evaluate(async (p) => {
    const [persons, families] = await Promise.all([window.doru.listPersons(p), window.doru.getFamilies(p)]);
    return {
      exists: persons.some((person) => person.names.some((name) => name.given === 'TestKid')),
      children: families.find((family) => family.id === 'F1')?.children ?? [],
    };
  }, project);
  expect(afterUndo.exists).toBe(false);
  expect(afterUndo.children).not.toContain(kidId);

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
  const ivanCard = page.getByRole('group', { name: 'Ivan Ivanov', exact: true, includeHidden: true });
  await expect(ivanCard).toHaveAttribute('aria-current', 'true');
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
  let zoomed = await ivan.boundingBox();
  // Wait for the zoom transition to reach its final scale before hiding the tab.
  await expect.poll(async () => (zoomed = await ivan.boundingBox())?.width ?? 0).toBe(216);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Family Tree' }).click();
  await expect(ivan).toBeVisible();
  await expect
    .poll(async () => {
      const box = await ivan.boundingBox();
      return box === null ? null : { x: box.x, y: box.y, width: box.width, height: box.height };
    })
    .toEqual(zoomed);
  // Allow deferred warnings from the tab switch to reach the listener.
  await page.waitForTimeout(300);

  const errors = await page.evaluate(
    () => (window as Window & { __resizeObserverErrors?: string[] }).__resizeObserverErrors ?? [],
  );
  expect(errors).toEqual([]);
  expect(warnings.filter((warning) => warning.includes('attribution'))).toEqual([]);
  await app.close();
});

test('a card click tolerates tiny pointer movement and the platform zoom modifier zooms', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-canvas-click-e2e-')), 'family.doru');
  const { app, page } = await launchApp({ project });
  await seedFamilyTree(page, project);
  await page.reload();
  const ivan = page.getByRole('group', { name: 'Ivan Ivanov', exact: true });
  await expect(ivan).toBeVisible({ timeout: 20_000 });

  // A normal click often moves the pointer by a pixel. It must still select
  // the card rather than being swallowed by the canvas pan gesture.
  const box = await ivan.boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 1, y);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

  // React Flow treated Meta as the zoom modifier on macOS; the canvas keeps
  // that behaviour while Ctrl remains the modifier on other platforms.
  const zoomModifier = process.platform === 'darwin' ? 'Meta' : 'Control';
  const before = await ivan.boundingBox();
  await page.mouse.move(800, 450);
  await page.keyboard.down(zoomModifier);
  await page.mouse.wheel(0, -120);
  await page.keyboard.up(zoomModifier);
  await expect.poll(async () => (await ivan.boundingBox())?.width ?? 0).toBeGreaterThan(before!.width);

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
