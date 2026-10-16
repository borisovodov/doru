// Dev helper: launches the app against the running dev server and captures
// screenshots of the main UI states in dark and light theme.
// Usage: npm run dev  (in another terminal), then: node scripts/ui-shots.ts
import { _electron as electron } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFamily } from './seed-family.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, 'apps/desktop');
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
    ELECTRON_RENDERER_URL: process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173',
  },
});
const page = await app.firstWindow();
await page.setViewportSize(viewport);
await page.waitForSelector('.workbench', { timeout: 20_000 });

const shot = async (name: string) => {
  await page.waitForTimeout(350); // let layout settle
  await page.screenshot({ path: join(outDir, name) });
  console.log('shot:', name);
};

const setTheme = (kind: 'dark' | 'light') =>
  app.evaluate(({ nativeTheme }, themeKind) => {
    nativeTheme.themeSource = themeKind;
  }, kind);

// 1. Welcome, dark
await setTheme('dark');
await shot('01-welcome-dark.png');

// 2. Welcome, light
await setTheme('light');
await shot('02-welcome-light.png');

// 3. Open a project, seed the family, tree view
const project = join(mkdtempSync(join(tmpdir(), 'doru-shots-project-')), 'family.doru');
await page.evaluate(
  async ({ project }) => {
    await window.doru.openProjectPath(project);
  },
  { project },
);
await seedFamily(page, project);
await page.waitForSelector('.editor-pane.active');
await shot('03-tree-light.png');

// 4. Tree, dark
await setTheme('dark');
await shot('04-tree-dark.png');

// 5. People sidebar
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.activity-bar .activity-bar-item:not(.activity-bar-bottom)')];
  (items[1] as HTMLElement | undefined)?.click();
});
await page.waitForTimeout(300);
await shot('05-people-light.png');

// 6. Open a person editor
await page.evaluate(() => {
  const links = [...document.querySelectorAll('.person-list a, .person-list button, .tree-person')];
  if (links.length > 0) (links[0] as HTMLElement).click();
});
await page.waitForTimeout(500);
await shot('06-person-light.png');

// 7. Settings
await page.evaluate(() => {
  (document.querySelector('.activity-bar .activity-bar-bottom') as HTMLElement | null)?.click();
});
await page.waitForTimeout(500);
await shot('07-settings-light.png');

await app.close();
console.log('done');
