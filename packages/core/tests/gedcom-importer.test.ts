import { describe, expect, it } from 'vitest';
import { ReadGedcomImporter } from '../src/gedcom/importer';

const gedcom = `0 HEAD
1 GEDC
2 VERS 5.5.1
0 @I1@ INDI
1 NAME Ivan /Ivanov/
1 SEX M
1 BIRT
2 DATE 12 MAR 1923
0 @I2@ INDI
1 NAME Maria /Ivanova/
1 SEX F
0 @I3@ INDI
1 NAME Petr /Ivanov/
1 SEX M
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR
`;

function toBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe('ReadGedcomImporter', () => {
  it('maps individuals with names, sex, and birth dates', () => {
    const doc = new ReadGedcomImporter().import(toBuffer(gedcom));

    expect(doc.persons.size).toBe(3);
    expect(doc.persons.get('@I1@')).toEqual({
      id: '@I1@',
      names: [{ full: 'Ivan /Ivanov/' }],
      sex: 'M',
      birth: { year: 1923, quality: 'exact' },
    });
    expect(doc.persons.get('@I2@')?.sex).toBe('F');
    expect(doc.persons.get('@I2@')?.birth).toBeUndefined();
  });

  it('maps families with parents and children', () => {
    const doc = new ReadGedcomImporter().import(toBuffer(gedcom));

    expect(doc.families.get('@F1@')).toEqual({
      id: '@F1@',
      parents: ['@I1@', '@I2@'],
      children: ['@I3@'],
    });
  });
});
