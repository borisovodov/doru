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
    await welcomeApp.evaluate(
      ({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height);
      },
      { width: WIDTH, height: HEIGHT },
    );
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
      names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
      sex: 'M',
      facts: [
        { id: 'B1', personId: 'I1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } } },
        { id: 'D1', personId: 'I1', tag: 'DEAT', date: { quality: 'exact', component: { year: 1998 } } },
      ],
    });
    await window.doru.addPerson(projectPath, {
      id: 'I2',
      names: [{ id: 'N2', given: 'Maria', surname: 'Ivanova' }],
      sex: 'F',
      facts: [{ id: 'B2', personId: 'I2', tag: 'BIRT', date: { quality: 'exact', component: { year: 1926 } } }],
    });
    await window.doru.addPerson(projectPath, {
      id: 'I3',
      names: [{ id: 'N3', given: 'Petr', surname: 'Ivanov' }],
      sex: 'M',
      facts: [{ id: 'B3', personId: 'I3', tag: 'BIRT', date: { quality: 'exact', component: { year: 1950 } } }],
    });
    await window.doru.addPerson(projectPath, {
      id: 'I4',
      names: [{ id: 'N4', given: 'Anna', surname: 'Ivanova' }],
      sex: 'F',
      facts: [{ id: 'B4', personId: 'I4', tag: 'BIRT', date: { quality: 'exact', component: { year: 1953 } } }],
    });
    await window.doru.addPerson(projectPath, {
      id: 'I5',
      names: [{ id: 'N5', given: 'Elena', surname: 'Petrova' }],
      sex: 'F',
      facts: [{ id: 'B5', personId: 'I5', tag: 'BIRT', date: { quality: 'exact', component: { year: 1952 } } }],
    });
    await window.doru.addPerson(projectPath, {
      id: 'I6',
      names: [{ id: 'N6', given: 'Sergei', surname: 'Ivanov' }],
      sex: 'M',
      facts: [{ id: 'B6', personId: 'I6', tag: 'BIRT', date: { quality: 'exact', component: { year: 1975 } } }],
    });
    await window.doru.addFamily(projectPath, { id: 'F1', partners: ['I1', 'I2'], children: ['I3', 'I4'] });
    await window.doru.addFamily(projectPath, { id: 'F2', partners: ['I3', 'I5'], children: ['I6'] });
  }, project);

  await page.reload();
  await page.waitForSelector('.react-flow__node', { timeout: 20_000 });

  await app.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height);
    },
    { width: WIDTH, height: HEIGHT },
  );
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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
