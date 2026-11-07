import type { Page } from '@playwright/test';

/**
 * Seeds the small family that the old GEDCOM fixture used to import:
 * Ivan (I1) + Maria (I2), their child Petr (I3), in family F1.
 * Uses the public tree APIs, so it exercises the same IPC paths as the UI.
 */
export async function seedFamilyTree(page: Page, project: string): Promise<void> {
  await page.evaluate(async (projectPath) => {
    await window.doru.addPerson(projectPath, {
      id: 'I1',
      names: [{ id: 'N1', given: 'Ivan', surname: 'Ivanov' }],
      sex: 'M',
      facts: [{ id: 'B1', personId: 'I1', tag: 'BIRT', date: { quality: 'exact', component: { year: 1923 } } }],
    });
    await window.doru.addPerson(projectPath, {
      id: 'I2',
      names: [{ id: 'N2', given: 'Maria', surname: 'Ivanova' }],
      sex: 'F',
      facts: [],
    });
    await window.doru.addPerson(projectPath, {
      id: 'I3',
      names: [{ id: 'N3', given: 'Petr', surname: 'Ivanov' }],
      sex: 'M',
      facts: [],
    });
    await window.doru.addFamily(projectPath, {
      id: 'F1',
      partners: ['I1', 'I2'],
      children: ['I3'],
    });
  }, project);
}
