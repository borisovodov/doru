import { describe, expect, test } from 'vitest';
import { parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk(text: string | string[]): GedcomDataset {
  const source = Array.isArray(text) ? text.join('\n') : text;
  const result = parseGedcom70(enc(source));
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.value;
}

describe('GenoPro entity records', () => {
  test('parses Occupation and Education records with their fields', () => {
    const dataset = parseOk([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @I1@ INDI',
      '1 OCCUPATIONS @O1@, @O2@, , plain-member',
      '1 EDUCATIONS @E1@',
      '0 @O1@ Occupation',
      '1 PLAC Moscow, Russia',
      '1 DATESTART 1920',
      '1 DATEEND 1930',
      '1 NOTE a note',
      '1 SOURCE @S1@',
      '1 COMPANY Factory',
      '1 INDUSTRY Metals',
      '1 TITL Director',
      '1 DURATION 10 years',
      '0 @O2@ Occupation',
      '0 @E1@ Education',
      '1 PLAC Moscow',
      '0 @S1@ SOUR',
      '0 TRLR',
    ]);
    const occupation = dataset.records.find((entry) => entry.tag === 'Occupation');
    expect(occupation).toMatchObject({
      xref: '@O1@',
      company: 'Factory',
      industry: 'Metals',
      title: 'Director',
      duration: '10 years',
      place: { payload: ['Moscow', 'Russia'] },
      notes: [expect.objectContaining({ payload: 'a note' })],
      citations: [expect.objectContaining({ tag: 'SOUR' })],
      dateStart: expect.anything(),
      dateEnd: expect.anything(),
    });
    const individual = dataset.records.find((entry) => entry.tag === 'INDI');
    expect(individual.occupations).toEqual(['@O1@', '@O2@', 'plain-member']);
    expect(individual.educations).toEqual(['@E1@']);
  });

  test('tolerates a bare GenoPro container line', () => {
    // The lenient container rule keeps the bare line as an extension
    // instead of failing the whole file.
    const dataset = parseOk([
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @U1@',
      '0 @U1@ SUBM',
      '0 @I1@ INDI',
      '1 OCCUPATIONS',
      '0 TRLR',
    ]);
    expect(dataset.records.find((entry) => entry.tag === 'INDI')).toBeDefined();
  });
});
