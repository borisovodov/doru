// Shared dev-script seeding: the same family the old small.ged fixture
// imported — Ivan (I1) + Maria (I2), their child Petr (I3), in family F1.
import type { Page } from '@playwright/test';

export async function seedFamily(page: Page, project: string): Promise<void> {
  await page.evaluate(async (projectPath) => {
    await window.doru.addPerson(projectPath, {
      id: 'I1',
      names: [{ given: 'Ivan', surname: 'Ivanov' }],
      sex: 'M',
      birth: { year: 1923, quality: 'exact' },
    });
    await window.doru.addPerson(projectPath, {
      id: 'I2',
      names: [{ given: 'Maria', surname: 'Ivanova' }],
      sex: 'F',
    });
    await window.doru.addPerson(projectPath, {
      id: 'I3',
      names: [{ given: 'Petr', surname: 'Ivanov' }],
      sex: 'M',
    });
    await window.doru.addFamily(projectPath, {
      id: 'F1',
      parents: ['I1', 'I2'],
      children: ['I3'],
    });
  }, project);
}
