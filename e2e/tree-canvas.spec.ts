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

test('canvas editing cycle: add a child, reparent by drag, undo everything', async () => {
  const project = join(mkdtempSync(join(tmpdir(), 'doru-canvas-e2e-')), 'family.doru');
  const userData = mkdtempSync(join(tmpdir(), 'doru-canvas-e2e-data-'));
  const args = ['.', project];
  if (process.env.CI === 'true') {
    args.push('--no-sandbox');
  }
  const app = await electron.launch({
    args,
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  const window = await app.firstWindow();
  await window.waitForSelector('.workbench', { timeout: 20_000 });

  // Seed: import the fixture, give Ivan a second family (Kid2), and give
  // Kid2 an empty family of their own (the reparent drop target).
  await window.evaluate(
    async ({ project, fixture }) => {
      await window.doru.importGedcomFile(project, fixture);
      await window.doru.addPerson(project, {
        id: 'KID2',
        names: [{ given: 'Kid2', surname: 'Ivanov' }],
        sex: 'U',
      });
      await window.doru.addFamily(project, { id: 'F3', parents: ['@I1@'], children: ['KID2'] });
      await window.doru.addFamily(project, { id: 'F4', parents: ['KID2'], children: [] });
    },
    { project, fixture },
  );
  await window.reload();
  await window.waitForSelector('.react-flow__node', { timeout: 20_000 });

  const dblclickCard = (name: string) =>
    window.evaluate((label) => {
      const el = [...document.querySelectorAll('.person-card')].find((node) =>
        node.textContent?.includes(label),
      );
      el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    }, name);

  // Refocus on Ivan and look at his descendants (Petr + Kid2).
  await dblclickCard('Ivan Ivanov');
  await window.waitForTimeout(600);
  await window.locator('.tree-direction button').nth(1).click();
  await window.waitForTimeout(600);
  await expect(window.locator('.person-card', { hasText: 'Kid2' }).first()).toBeVisible();

  // Add a child to Ivan via the card toolbar and the form.
  const ivan = window.locator('.person-card', { hasText: 'Ivan Ivanov' }).first();
  const ibox = await ivan.boundingBox();
  await window.mouse.click(ibox!.x + ibox!.width / 2, ibox!.y + ibox!.height / 2);
  await window.locator('.card-toolbar button').nth(0).click();
  await window.locator('.person-form input').nth(0).fill('TestKid');
  await window.locator('.person-form-actions button.primary').click();
  await expect(window.locator('.person-card', { hasText: 'TestKid' }).first()).toBeVisible();

  // Drag TestKid onto Kid2 → reparents into family F3.
  const kid = window.locator('.person-card', { hasText: 'TestKid' }).first();
  const kid2 = window.locator('.person-card', { hasText: 'Kid2' }).first();
  const kbox = await kid.boundingBox();
  const k2box = await kid2.boundingBox();
  await window.mouse.move(kbox!.x + kbox!.width / 2, kbox!.y + kbox!.height / 2);
  await window.mouse.down();
  // Cross the 4px drag threshold first so the gesture reliably starts.
  await window.mouse.move(kbox!.x + kbox!.width / 2 + 20, kbox!.y + kbox!.height / 2);
  await window.mouse.move(
    k2box!.x + k2box!.width / 2,
    k2box!.y + k2box!.height / 2,
    { steps: 10 },
  );
  await window.mouse.up();
  await window.waitForTimeout(900);

  const kidId = await window.evaluate(async (p) => {
    const persons = await window.doru.listPersons(p);
    return persons.find((person) => person.names.some((name) => name.given === 'TestKid'))?.id;
  }, project);
  expect(kidId).toBeDefined();
  const afterReparent = await window.evaluate((p) => window.doru.getFamilies(p), project);
  const f1 = afterReparent.find((family) => family.id === '@F1@');
  const f4 = afterReparent.find((family) => family.id === 'F4');
  expect(f1?.children).not.toContain(kidId);
  expect(f4?.children).toContain(kidId);

  // One undo restores the reparent (the whole compound op).
  await window.keyboard.press('Meta+z');
  await window.waitForTimeout(900);
  const afterUndoReparent = await window.evaluate((p) => window.doru.getFamilies(p), project);
  expect(afterUndoReparent.find((family) => family.id === '@F1@')?.children).toContain(kidId);
  expect(afterUndoReparent.find((family) => family.id === 'F4')?.children).not.toContain(kidId);

  // A second undo removes the added person entirely.
  await window.keyboard.press('Meta+z');
  await window.waitForTimeout(900);
  const afterUndoAdd = await window.evaluate(async (p) => {
    const persons = await window.doru.listPersons(p);
    return persons.some((person) => person.names.some((name) => name.given === 'TestKid'));
  }, project);
  expect(afterUndoAdd).toBe(false);

  await app.close();
});
