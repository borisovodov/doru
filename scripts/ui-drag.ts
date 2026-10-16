// Dev helper: verifies tab drag-and-drop reordering against the dev server.
// Usage: npm run dev (in another terminal), then: node scripts/ui-drag.ts
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFamily } from './seed-family.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, 'apps/desktop');

const userData = mkdtempSync(join(tmpdir(), 'doru-drag-data-'));
const app = await electron.launch({
  args: ['.'],
  cwd: appDir,
  env: {
    ...process.env,
    DORU_USER_DATA: userData,
    ELECTRON_RENDERER_URL: process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173',
  },
});
const page = await app.firstWindow();
page.on('console', (msg) => {
  if (msg.text().startsWith('dnd')) {
    console.log('[renderer]', msg.text());
  }
});
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForSelector('.workbench', { timeout: 20_000 });

const project = join(mkdtempSync(join(tmpdir(), 'doru-drag-project-')), 'family.doru');
await page.evaluate(
  async ({ project }) => {
    await window.doru.openProjectPath(project);
  },
  { project },
);
await seedFamily(page, project);
await page.waitForSelector('.editor-pane.active');
// The seed happens through the IPC directly, so the renderer still shows
// pre-seed state; reload the window to re-bind the project and load the
// persons.
await page.reload();
await page.waitForSelector('.editor-pane.active .tree-canvas');

const labels = () =>
  page.$$eval('.tab-bar .tab .tab-label', (els) => els.map((el) => el.textContent));

// Open two person tabs from the People sidebar (switching back to the tree
// tab in between, since opening a person tab activates it and hides the
// tree pane).
await page.locator('.activity-bar .activity-bar-item').nth(1).click();
const items = page.locator('.person-list li');
await items.first().waitFor({ timeout: 20_000 });
await items.nth(2).waitFor({ timeout: 20_000 });
console.log('persons:', await items.count());
await items.nth(0).click();
await page.waitForTimeout(150);
await page.locator('.tab-bar .tab').first().click();
await items.nth(1).click();
await page.waitForTimeout(200);

console.log('before:', await labels());
console.log('tab count:', await page.locator('.tab-bar .tab').count());

const dragByMouse = async (fromIndex: number, toIndex: number, toXOffset: number) => {
  const from = await page.locator('.tab-bar .tab').nth(fromIndex).boundingBox();
  const to = await page.locator('.tab-bar .tab').nth(toIndex).boundingBox();
  if (!from || !to) {
    throw new Error(`tab bounds missing for ${fromIndex} -> ${toIndex}`);
  }
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + toXOffset, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
};

// Drag the second tab (first person) onto the right half of the last tab
// -> drops after it.
const tabs = page.locator('.tab-bar .tab');
const lastBox = await tabs.last().boundingBox();
if (!lastBox) {
  throw new Error('last tab bounds missing');
}
const lastWidth = lastBox.width;
await dragByMouse(1, await tabs.count() - 1, lastWidth - 6);

console.log('after: ', await labels());

// Drag the last tab back before the first tab.
await dragByMouse(await tabs.count() - 1, 0, 2);
console.log('back:  ', await labels());

await app.close();
