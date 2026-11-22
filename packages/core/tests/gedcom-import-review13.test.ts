import { describe, expect, it } from 'vitest';
import { parse } from '@doru/gedcom';
import { importGedcomDataset } from '../src/import/gedcom';
import { cleanupRepo, makeRepo } from './helpers';

const HEAD = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];

function importText(lines: string[]) {
  const result = parse(new TextEncoder().encode([...lines, '0 TRLR', ''].join('\n')));
  if (!result.ok || result.value.kind !== 'dataset') {
    throw new Error('fixture failed to parse');
  }
  const fixture = makeRepo();
  try {
    importGedcomDataset(result.value.dataset, fixture.repo);
  } catch (error) {
    cleanupRepo(fixture);
    throw error;
  }
  return fixture;
}

describe('GEDCOM import edge slots', () => {
  it('uses the first defined FAMS date on repeated spouse links', () => {
    const fixture = importText([
      ...HEAD,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 FAMS @F1@',
      '1 FAMS @F1@',
      '2 DATE 1 JAN 1900',
      '1 FAMS @F1@',
      '2 DATE 1 JAN 1901',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
    ]);
    try {
      expect(fixture.repo.listFamilies()[0]?.partnerLinks?.[0]?.date?.component?.year).toBe(1900);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('keeps notes from every repeated CHIL entry', () => {
    const fixture = importText([
      ...HEAD,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '0 @I2@ INDI',
      '1 NAME C /D/',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 CHIL @I2@',
      '2 NOTE first',
      '1 CHIL @I2@',
      '2 NOTE second',
    ]);
    try {
      const links = fixture.repo.listFamilies()[0]?.childLinks ?? [];
      expect(links).toHaveLength(1);
      expect(
        fixture.repo
          .listNotesFor('family_child', links[0]!.id)
          .map((note) => note.text)
          .sort(),
      ).toEqual(['first', 'second']);
    } finally {
      cleanupRepo(fixture);
    }
  });

  it('maps a wife-only partner age to the normalized HUSB slot', () => {
    const fixture = importText([
      ...HEAD,
      '0 @I1@ INDI',
      '1 NAME W /One/',
      '0 @F1@ FAM',
      '1 WIFE @I1@',
      '1 MARR',
      '2 WIFE',
      '3 AGE 20y',
    ]);
    try {
      const fact = fixture.repo.listFactsForFamily(fixture.repo.listFamilies()[0]!.id)[0]!;
      expect(fact.ages?.[0]).toMatchObject({ role: 'HUSB', years: 20 });
    } finally {
      cleanupRepo(fixture);
    }
  });
});
