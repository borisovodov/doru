// Dev helper: verifies tab drag-and-drop reordering against the dev server.
// Usage: npm run dev (in another terminal), then: node scripts/ui-drag.mjs
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, 'apps/desktop');

const userData = mkdtempSync(join(tmpdir(), 'doru-drag-data-'));
const app = await electron.launch({
  args: ['.'],
  cwd: appDir,
  env: {
    ...process.env,
    DORU_USER_DATA: userData,
    ELECTRON_RENDERER_URL: process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173',
  },
});
const window = await app.firstWindow();
window.on('console', (msg) => {
  if (msg.text().startsWith('dnd')) {
    console.log('[renderer]', msg.text());
  }
});
await window.setViewportSize({ width: 1440, height: 900 });
await window.waitForSelector('.workbench', { timeout: 20_000 });

const project = join(mkdtempSync(join(tmpdir(), 'doru-drag-project-')), 'family.doru');
await window.evaluate(
  async ({ project, fixture }) => {
    await window.doru.openProjectPath(project);
    await window.doru.importGedcomFile(project, fixture);
  },
  { project, fixture: join(root, 'e2e', 'fixtures', 'small.ged') },
);
await window.waitForSelector('.editor-pane.active');

const labels = () =>
  window.$$eval('.tab-bar .tab .tab-label', (els) => els.map((el) => el.textContent));

// Open two person tabs (switching back to the tree tab in between, since
// opening a person tab activates it and hides the tree pane).
const items = window.locator('.person-list li');
// The import races the project-bound reload; nudge the UI via the search
// field so the tree list reflects the imported persons.
await window.locator('.tree-toolbar input').fill('ivan');
await items.first().waitFor({ timeout: 20_000 });
await window.locator('.tree-toolbar input').fill('');
await items.nth(2).waitFor({ timeout: 20_000 });
console.log('persons:', await items.count());
await items.nth(0).click();
await window.waitForTimeout(150);
await window.locator('.tab-bar .tab').first().click();
await items.nth(1).click();
await window.waitForTimeout(200);

console.log('before:', await labels());
console.log('tab count:', await window.locator('.tab-bar .tab').count());

const dragByMouse = async (fromIndex, toIndex, toXOffset) => {
  const from = await window.locator('.tab-bar .tab').nth(fromIndex).boundingBox();
  const to = await window.locator('.tab-bar .tab').nth(toIndex).boundingBox();
  await window.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await window.mouse.down();
  await window.mouse.move(to.x + toXOffset, to.y + to.height / 2, { steps: 8 });
  await window.mouse.up();
  await window.waitForTimeout(200);
};

// Drag the second tab (first person) onto the right half of the last tab
// -> drops after it.
const tabs = window.locator('.tab-bar .tab');
const lastWidth = (await tabs.last().boundingBox()).width;
await dragByMouse(1, await tabs.count() - 1, lastWidth - 6);

console.log('after: ', await labels());

// Drag the last tab back before the first tab.
await dragByMouse(await tabs.count() - 1, 0, 2);
console.log('back:  ', await labels());

await app.close();
