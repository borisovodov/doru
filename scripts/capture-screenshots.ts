// Captures the store screenshots in distribution/metadata/screenshots from a
// built desktop app. Build first, then run:
//   node scripts/capture-screenshots.ts
// The app runs against throwaway temp dirs (isolated DORU_USER_DATA, seeded
// tree file) so the screenshots are deterministic and contain no user data.
/// <reference path="../apps/desktop/src/renderer/src/doru.d.ts" />

import { _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appDir = resolve(root, 'apps/desktop');
const outDir = resolve(root, 'distribution/metadata/screenshots');

/** Store screenshots are 1600x900 PNGs. */
const WIDTH = 1600;
const HEIGHT = 900;

async function main() {
  mkdirSync(outDir, { recursive: true });

  const userData = mkdtempSync(join(tmpdir(), 'doru-shots-data-'));
  const project = join(mkdtempSync(join(tmpdir(), 'doru-shots-')), 'family.doru');

  const app = await electron.launch({
    args: ['.', '--lang=en-US', project],
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: userData },
  });
  try {
    await captureTreeScreenshots(app, project);
  } finally {
    await app.close();
  }

  // Welcome screen (first run, no project).
  const welcomeApp = await electron.launch({
    args: ['.', '--lang=en-US'],
    cwd: appDir,
    env: { ...process.env, DORU_USER_DATA: mkdtempSync(join(tmpdir(), 'doru-shots-data-')) },
  });
  try {
    const welcomePage = await welcomeApp.firstWindow();
    await welcomePage.waitForSelector('.welcome-page', { timeout: 30_000 });
    await welcomeApp.evaluate(({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height);
    }, { width: WIDTH, height: HEIGHT });
    await welcomePage.waitForTimeout(500);
    await welcomePage.screenshot({ path: join(outDir, 'welcome.png') });
  } finally {
    await welcomeApp.close();
  }

  console.log(`Screenshots written to ${outDir}`);
}

async function captureTreeScreenshots(app: ElectronApplication, project: string) {
  const page = await app.firstWindow();
  await page.waitForSelector('.workbench', { timeout: 30_000 });

  // Store screenshots use the English base language; --lang=en-US makes the
  // renderer locale deterministic regardless of the machine's OS locale.
  const language = await page.evaluate(() => navigator.language);
  if (language !== 'en-US') {
    throw new Error(`expected en-US renderer locale, got ${language}`);
  }

  // Seed a small two-generation family through the public tree APIs so the
  // screenshots show a real-looking tree.
  await page.evaluate(async (projectPath) => {
    await window.doru.addPerson(projectPath, {
      id: 'I1',
      names: [{ given: 'Ivan', surname: 'Ivanov' }],
      sex: 'M',
      birth: { year: 1923, quality: 'exact' },
      death: { year: 1998, quality: 'exact' },
    });
    await window.doru.addPerson(projectPath, {
      id: 'I2',
      names: [{ given: 'Maria', surname: 'Ivanova' }],
      sex: 'F',
      birth: { year: 1926, quality: 'exact' },
    });
    await window.doru.addPerson(projectPath, {
      id: 'I3',
      names: [{ given: 'Petr', surname: 'Ivanov' }],
      sex: 'M',
      birth: { year: 1950, quality: 'exact' },
    });
    await window.doru.addPerson(projectPath, {
      id: 'I4',
      names: [{ given: 'Anna', surname: 'Ivanova' }],
      sex: 'F',
      birth: { year: 1953, quality: 'exact' },
    });
    await window.doru.addPerson(projectPath, {
      id: 'I5',
      names: [{ given: 'Elena', surname: 'Petrova' }],
      sex: 'F',
      birth: { year: 1952, quality: 'exact' },
    });
    await window.doru.addPerson(projectPath, {
      id: 'I6',
      names: [{ given: 'Sergei', surname: 'Ivanov' }],
      sex: 'M',
      birth: { year: 1975, quality: 'exact' },
    });
    await window.doru.addFamily(projectPath, { id: 'F1', parents: ['I1', 'I2'], children: ['I3', 'I4'] });
    await window.doru.addFamily(projectPath, { id: 'F2', parents: ['I3', 'I5'], children: ['I6'] });
  }, project);

  await page.reload();
  await page.waitForSelector('.react-flow__node', { timeout: 20_000 });

  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height);
  }, { width: WIDTH, height: HEIGHT });
  await page.waitForTimeout(500);

  // Tree canvas.
  await page.screenshot({ path: join(outDir, 'tree.png') });

  // People sidebar.
  await page.locator('.activity-bar-item').nth(1).click();
  await page.waitForSelector('.person-list');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'people.png') });

  // Person editor tab.
  await page.locator('.person-list li').first().click();
  await page.waitForSelector('.person-editor');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, 'person.png') });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
