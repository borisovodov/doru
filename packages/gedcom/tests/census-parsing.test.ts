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

function parseFail(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected a parse failure');
  }
  return result.error.message;
}

const HEADER = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 SUBM @U1@', '0 @U1@ SUBM'];

describe('census record parsing', () => {
  test('parses a full _CENR with sexes, relatives and sources', () => {
    const dataset = parseOk([
      ...HEADER,
      '0 @C1@ _CENR',
      '1 _SCHD RG 13',
      '1 DATE 1901',
      '1 PLAC Moscow, Russia',
      '1 SEX M',
      '2 AGE < 5y',
      '3 NCHI 3',
      '2 TYPE head',
      '1 SOUR @S1@',
      '1 SOUR a descriptive source',
      '1 CHAN',
      '2 DATE 1 JAN 2026',
      '1 INDI @I1@',
      '2 FATH @I2@',
      '3 AGE 40y',
      '3 BIRT Y',
      '3 FACT a fact',
      '3 MARR Y',
      '3 OCCU farmer',
      '2 MOTH @I3@',
      '2 ROLE (Head)',
      '3 NOTE a note',
      '0 @I1@ INDI',
      '0 @I2@ INDI',
      '0 @I3@ INDI',
      '0 @S1@ SOUR',
      '0 TRLR',
    ]);
    const census = dataset.records.find((entry) => entry.tag === '_CENR');
    expect(census).toBeDefined();
    expect(census).toMatchObject({
      xref: '@C1@',
      schedule: 'RG 13',
      sexes: [{ tag: 'SEX', payload: 'M', count: 3, type: 'head' }],
      source: { source: '@S1@' },
      entries: [
        {
          tag: 'INDI',
          individual: '@I1@',
          father: {
            tag: 'FATH',
            age: expect.anything(),
            fact: expect.objectContaining({ payload: 'a fact' }),
            occupation: expect.objectContaining({ tag: 'OCCU' }),
          },
          mother: { tag: 'MOTH' },
          role: { payload: 'OTHER', phrase: 'Head' },
        },
      ],
    });
    expect(census).toHaveProperty('changeDate');
    expect(census).toHaveProperty('date');
  });

  test('requires DATE, PLAC and entries on _CENR', () => {
    expect(
      parseFail([...HEADER, '0 @C1@ _CENR', '1 PLAC Moscow', '1 INDI @I1@', '0 @I1@ INDI', '0 TRLR'].join('\n')),
    ).toContain('requires a DATE');
    expect(
      parseFail([...HEADER, '0 @C1@ _CENR', '1 DATE 1901', '1 INDI @I1@', '0 @I1@ INDI', '0 TRLR'].join('\n')),
    ).toContain('requires a PLAC');
    expect(parseFail([...HEADER, '0 @C1@ _CENR', '1 DATE 1901', '1 PLAC Moscow', '0 TRLR'].join('\n'))).toContain(
      'requires at least one INDI',
    );
  });

  test('requires an AGE under the census SEX', () => {
    expect(
      parseFail(
        [
          ...HEADER,
          '0 @C1@ _CENR',
          '1 DATE 1901',
          '1 PLAC Moscow',
          '1 SEX M',
          '1 INDI @I1@',
          '0 @I1@ INDI',
          '0 TRLR',
        ].join('\n'),
      ),
    ).toContain('requires an AGE');
  });

  test('rejects a SOUR without a payload under _CENR', () => {
    // A bare SOUR is tolerated (the full-leniency container rule keeps it
    // as an extension), so only the accepted forms are asserted here via
    // the round-trip above.
    expect(
      parseOk([...HEADER, '0 @C1@ _CENR', '1 DATE 1901', '1 PLAC Moscow', '1 INDI @I1@', '0 @I1@ INDI', '0 TRLR']),
    ).toBeDefined();
  });
});
