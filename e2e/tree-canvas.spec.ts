import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFamilyTree } from './seed';

const root = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(root, '../apps/desktop');

test('canvas editing cycle: add a child, reparent by drag, undo everything', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-canvas-e2e-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-canvas-e2e-data-'));
  const args = ['.', project];
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

  // Seed: the base family, give Ivan a second family (Kid2), and give
  // Kid2 an empty family of their own (the reparent drop target).
  await seedFamilyTree(page, project);
  await page.evaluate(
    async ({ project }) => {
      await window.doru.addPerson(project, {
        id: 'KID2',
        names: [{ given: 'Kid2', surname: 'Ivanov' }],
        sex: 'U',
      });
      await window.doru.addFamily(project, { id: 'F3', parents: ['I1'], children: ['KID2'] });
      await window.doru.addFamily(project, { id: 'F4', parents: ['KID2'], children: [] });
    },
    { project },
  );
  await page.reload();
  await page.waitForSelector('.react-flow__node', { timeout: 20_000 });

  const dblclickCard = (name: string) =>
    page.evaluate((label) => {
      const el = [...document.querySelectorAll('.person-card')].find((node) =>
        node.textContent?.includes(label),
      );
      el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    }, name);

  // Refocus on Ivan and look at his descendants (Petr + Kid2).
  await dblclickCard('Ivan Ivanov');
  await page.waitForTimeout(600);
  await page.locator('.tree-direction button').nth(1).click();
  await page.waitForTimeout(600);
  await expect(page.locator('.person-card', { hasText: 'Kid2' }).first()).toBeVisible();

  // Add a child to Ivan via the card toolbar and the form.
  const ivan = page.locator('.person-card', { hasText: 'Ivan Ivanov' }).first();
  const ibox = await ivan.boundingBox();
  await page.mouse.click(ibox!.x + ibox!.width / 2, ibox!.y + ibox!.height / 2);
  await page.locator('.card-toolbar button').nth(0).click();
  await page.locator('.person-form input').nth(0).fill('TestKid');
  await page.locator('.person-form-actions button.primary').click();
  await expect(page.locator('.person-card', { hasText: 'TestKid' }).first()).toBeVisible();

  // Drag TestKid onto Kid2 → reparents into family F4.
  const kid = page.locator('.person-card', { hasText: 'TestKid' }).first();
  const kid2 = page.locator('.person-card', { hasText: 'Kid2' }).first();
  const kbox = await kid.boundingBox();
  const k2box = await kid2.boundingBox();
  await page.mouse.move(kbox!.x + kbox!.width / 2, kbox!.y + kbox!.height / 2);
  await page.mouse.down();
  // Cross the 4px drag threshold first so the gesture reliably starts.
  await page.mouse.move(kbox!.x + kbox!.width / 2 + 20, kbox!.y + kbox!.height / 2);
  await page.mouse.move(
    k2box!.x + k2box!.width / 2,
    k2box!.y + k2box!.height / 2,
    { steps: 10 },
  );
  // The valid drop target is highlighted while dragging.
  await expect(kid2).toHaveClass(/drop-target/);
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
  const userData = mkdtempSync(join(tmpdir(), 'doru-sidebar-e2e-data-'));
  const args = ['.', project];
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
  await seedFamilyTree(page, project);
  await page.reload();
  await page.waitForSelector('.react-flow__node', { timeout: 20_000 });

  // Open the People view and click Ivan in the sidebar list.
  await page.locator('.activity-bar .activity-bar-item').nth(1).click();
  await expect(page.locator('.person-list li').first()).toBeVisible();
  await page.locator('.person-list li', { hasText: 'Ivan Ivanov' }).first().click();

  // The canvas (kept alive in the hidden pane) refocuses on Ivan.
  await expect(page.locator('.tree-breadcrumbs')).toHaveText(/Ivan Ivanov/);
  await app.close();
});

test('rename, search and delete with undo on the canvas', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-ops-e2e-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-ops-e2e-data-'));
  const args = ['.', project];
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
  await seedFamilyTree(page, project);
  await page.reload();
  await page.waitForSelector('.react-flow__node', { timeout: 20_000 });

  const clickCard = async (name: string) => {
    const card = page.locator('.person-card', { hasText: name }).first();
    const box = await card.boundingBox();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(250);
  };

  // Rename Petr via the card toolbar (prefilled form).
  await clickCard('Petr');
  await page.locator('.card-toolbar button').nth(3).click();
  await expect(page.locator('.person-form input').nth(0)).toHaveValue('Petr');
  await page.locator('.person-form input').nth(0).fill('Petya');
  await page.locator('.person-form-actions button.primary').click();
  await expect(page.locator('.person-card', { hasText: 'Petya Ivanov' }).first()).toBeVisible();

  // Undo the rename.
  await page.keyboard.press('Meta+z');
  await expect(page.locator('.person-card', { hasText: 'Petr Ivanov' }).first()).toBeVisible();
  await expect(page.locator('.person-card', { hasText: 'Petya Ivanov' })).toHaveCount(0);

  // Search jumps to a person.
  await page.locator('.tree-search input').fill('Maria');
  await expect(page.locator('.tree-search-results button').first()).toBeVisible();
  await page.locator('.tree-search-results button').first().click();
  await expect(page.locator('.tree-breadcrumbs')).toHaveText(/Maria Ivanova/);
  // Wait for the re-layout and the fit to settle before clicking cards.
  await expect(page.locator('.person-card.focus')).toHaveText(/Maria Ivanova/);
  await page.waitForTimeout(400);

  // Delete the focused person (Maria) and undo the whole compound op.
  await clickCard('Maria Ivanova');
  await page.locator('.card-toolbar button').nth(5).click();
  await expect(page.locator('.person-card', { hasText: 'Maria Ivanova' })).toHaveCount(0);
  await page.keyboard.press('Meta+z');
  await expect(page.locator('.person-card', { hasText: 'Maria Ivanova' }).first()).toBeVisible();

  await app.close();
});

test('an empty tree offers to add the first person', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-empty-e2e-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-empty-e2e-data-'));
  const args = ['.', project];
  if (process.env['CI'] === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const window = await app.firstWindow();
  await window.waitForSelector('.workbench', { timeout: 20_000 });
  await window.reload();
  await expect(window.locator('.tree-canvas-empty')).toBeVisible();
  await expect(window.locator('.tree-canvas-first')).toBeVisible();
  await window.locator('.tree-canvas-first').click();
  // The new-person editor tab opens.
  await expect(window.locator('.person-editor')).toBeVisible();
  await app.close();
});
