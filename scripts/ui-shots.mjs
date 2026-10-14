// Dev helper: launches the app against the running dev server and captures
// screenshots of the main UI states in dark and light theme.
// Usage: npm run dev  (in another terminal), then: node scripts/ui-shots.mjs
import { _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, 'apps/desktop');
const fixture = join(root, 'e2e', 'fixtures', 'small.ged');
const outDir = join(root, '.ui-shots');
const viewport = { width: 1440, height: 900 };

mkdirSync(outDir, { recursive: true });

const userData = mkdtempSync(join(tmpdir(), 'doru-shots-data-'));
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
await window.setViewportSize(viewport);
await window.waitForSelector('.workbench', { timeout: 20_000 });

const shot = async (name) => {
  await window.waitForTimeout(350); // let layout settle
  await window.screenshot({ path: join(outDir, name) });
  console.log('shot:', name);
};

const setTheme = (kind) =>
  app.evaluate(({ nativeTheme }, k) => {
    nativeTheme.themeSource = k;
  }, kind);

// 1. Welcome, dark
await setTheme('dark');
await shot('01-welcome-dark.png');

// 2. Welcome, light
await setTheme('light');
await shot('02-welcome-light.png');

// 3. Open a project, import fixture, tree view
const project = join(mkdtempSync(join(tmpdir(), 'doru-shots-project-')), 'family.doru');
await window.evaluate(
  async ({ project, fixture }) => {
    await window.doru.openProjectPath(project);
    await window.doru.importGedcomFile(project, fixture);
  },
  { project, fixture },
);
await window.waitForSelector('.editor-pane.active');
await shot('03-tree-light.png');

// 4. Tree, dark
await setTheme('dark');
await shot('04-tree-dark.png');

// 5. People sidebar
await window.evaluate(() => {
  const items = [...document.querySelectorAll('.activity-bar .activity-bar-item:not(.activity-bar-bottom)')];
  items[1]?.click();
});
await window.waitForTimeout(300);
await shot('05-people-light.png');

// 6. Open a person editor
await window.evaluate(() => {
  const links = [...document.querySelectorAll('.person-list a, .person-list button, .tree-person')];
  if (links.length > 0) links[0].click();
});
await window.waitForTimeout(500);
await shot('06-person-light.png');

// 7. Settings
await window.evaluate(() => {
  document.querySelector('.activity-bar .activity-bar-bottom')?.click();
});
await window.waitForTimeout(500);
await shot('07-settings-light.png');

await app.close();
console.log('done');
