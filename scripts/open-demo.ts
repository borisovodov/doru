// Dev helper: populates the demo project (`~/Downloads/Doru Demo.doru`) and
// opens it in a window against the dev server.
//
// NOTE: once the project exists, prefer launching the app natively — a
// Playwright-harnessed window does not resize like a real one:
//
//   DORU_USER_DATA="<tmp>/doru-demo-data" \
//     ELECTRON_RENDERER_URL="http://localhost:5173" \
//     npx electron apps/desktop "$HOME/Downloads/Doru Demo.doru"
//
// Usage: npm run dev (in another terminal), then: node scripts/open-demo.ts
import { _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PersonRecord, Sex } from '@doru/core';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, 'apps/desktop');

const userData = mkdtempSync(join(tmpdir(), 'doru-demo-data-'));
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
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForSelector('.workbench', { timeout: 20_000 });

const project = join(homedir(), 'Downloads', 'Doru Demo.doru');
// id: [given, surname, sex, birthYear, deathYear?]
type PersonSeed = [given: string, surname: string, sex: Sex, birthYear: number, deathYear?: number];
const persons: Record<string, PersonSeed> = {
  N1: ['Nikolai', 'Ivanov', 'M', 1900, 1972],
  N2: ['Anna', 'Ivanova', 'F', 1905, 1980],
  N3: ['Piotr', 'Smirnov', 'M', 1898, 1975],
  N4: ['Olga', 'Smirnova', 'F', 1902, 1990],
  P1: ['Ivan', 'Ivanov', 'M', 1923, 2001],
  P2: ['Maria', 'Ivanova', 'F', 1927, 2005],
  P3: ['Sergey', 'Ivanov', 'M', 1926, 1998],
  P4: ['Vera', 'Ivanova', 'F', 1929, 2010],
  P5: ['Mikhail', 'Ivanov', 'M', 1955],
  P6: ['Nadezhda', 'Ivanova', 'F', 1957],
  P7: ['Elena', 'Volkova', 'F', 1958],
  P8: ['Dmitry', 'Volkov', 'M', 1954],
  P9: ['Petr', 'Ivanov', 'M', 1950, 2018],
  P10: ['Irina', 'Ivanova', 'F', 1954],
  P11: ['Svetlana', 'Ivanova', 'F', 1962],
  P12: ['Alexey', 'Ivanov', 'M', 1978],
  P13: ['Ksenia', 'Ivanova', 'F', 1981],
  P14: ['Daria', 'Ivanova', 'F', 1981],
  P15: ['Kirill', 'Ivanov', 'M', 1988],
  P16: ['Yulia', 'Ivanova', 'F', 1990],
  P17: ['Marina', 'Volkova', 'F', 1983],
  P18: ['Ivan', 'Petrov', 'M', 1980],
  P19: ['Egor', 'Volkov', 'M', 1986],
  P20: ['Polina', 'Ivanova', 'F', 1985],
  P21: ['Sofia', 'Ivanova', 'F', 2010],
  P22: ['Timofey', 'Ivanov', 'M', 2013],
  P23: ['Maksim', 'Ivanov', 'M', 2015],
  P24: ['Liza', 'Petrova', 'F', 2012],
};
// fam: [parents, children]
const families: Record<string, [string[], string[]]> = {
  F1: [['N1', 'N2'], ['P1', 'P3']],
  F2: [['N3', 'N4'], ['P2']],
  F3: [['P1', 'P2'], ['P9', 'P5', 'P7']],
  F4: [['P3', 'P4'], ['P9']],
  F5: [['P5', 'P6'], ['P20']],
  F6: [['P7', 'P8'], ['P17', 'P19']],
  F7: [['P9', 'P10'], ['P12', 'P14']],
  F8: [['P9', 'P11'], ['P15']],
  F9: [['P12', 'P13'], ['P21', 'P22']],
  F10: [['P15', 'P16'], ['P23']],
  F11: [['P17', 'P18'], ['P24']],
};

await page.evaluate(
  async ({ project, persons, families }) => {
    await window.doru.openProjectPath(project);
    const existing = new Set((await window.doru.listPersons(project)).map((p) => p.id));
    for (const [id, [given, surname, sex, birthYear, deathYear]] of Object.entries(persons)) {
      if (existing.has(id)) {
        continue;
      }
      const person: PersonRecord = { id, names: [{ given, surname }], sex };
      if (birthYear !== undefined) {
        person.birth = { year: birthYear, quality: 'exact' };
      }
      if (deathYear !== undefined) {
        person.death = { year: deathYear, quality: 'exact' };
      }
      await window.doru.addPerson(project, person);
    }
    const existingFamilies = new Set((await window.doru.getFamilies(project)).map((f) => f.id));
    for (const [id, [parents, children]] of Object.entries(families)) {
      if (!existingFamilies.has(id)) {
        await window.doru.addFamily(project, { id, parents, children });
      }
    }
    // A bit of extra content so the card badges are visible in the demo.
    const notes = await window.doru.listNotes(project);
    if (notes.length === 0) {
      await window.doru.addNote(project, {
        id: 'DEMONOTE1',
        text: 'Born in Nikolskoye; the metric book was found in the state archive.',
        targetType: 'person',
        targetId: 'P9',
      });
      await window.doru.addSource(
        project,
        { id: 'DEMOSRC1', title: 'Metric book, 1950', author: 'State Archive' },
        'person',
        'P9',
      );
      await window.doru.addSource(
        project,
        { id: 'DEMOSRC2', title: 'The Ivanov family archive' },
        'person',
        'P1',
      );
    }
  },
  { project, persons, families },
);
await page.reload();
await page.waitForSelector('.react-flow__node', { timeout: 20_000 });
console.log('demo project open:', project);
console.log('nodes:', await page.locator('.react-flow__node').count());
console.log('edges:', await page.locator('.react-flow__edge').count());

// Keep the window open until the user closes it.
await new Promise<void>((resolve) => app.on('close', () => resolve()));
