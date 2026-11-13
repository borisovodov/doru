import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset, IndividualRecord } from '../src/structures';
import { isCensusRecord } from '../src/structures';
import { parseAge551 } from '../src/parsing/types';
import type { SourcePosition } from '../src/errors';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const lines = (text: string): string[] => text.split('\r\n');

function parseOk551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function parseOk70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function ser551(dataset: GedcomDataset): string {
  const result = serializeGedcom551(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err70(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

const H551 = ['0 HEAD', '1 SOUR X', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME T'];
const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

function indi(dataset: GedcomDataset): IndividualRecord {
  const record = dataset.records.find((entry) => entry.tag === 'INDI');
  if (record === undefined) {
    throw new Error('expected INDI');
  }
  return record;
}

const pos: SourcePosition = { line: 1, column: 1, offset: 0 };

describe('the GEDCOM-L Addendum §8.2 AGE corrections', () => {
  test('a plain number is an age in years', () => {
    expect(parseAge551('65', pos)).toEqual({ years: 65 });
    expect(parseAge551('0', pos)).toEqual({ years: 0 });
    expect(parseAge551('> 8', pos)).toEqual({ bound: '>', years: 8 });
  });

  test('the space between a number and its unit is deleted', () => {
    expect(parseAge551('65 y 10 m 25 d', pos)).toEqual({ years: 65, months: 10, days: 25 });
  });

  test('three bare number groups get the ymd units by position', () => {
    expect(parseAge551('65 10 25', pos)).toEqual({ years: 65, months: 10, days: 25 });
  });

  test('three hyphen-separated groups get the ymd units', () => {
    expect(parseAge551('65-10-25', pos)).toEqual({ years: 65, months: 10, days: 25 });
  });

  test('the German J/M/T letters convert to ymd', () => {
    expect(parseAge551('65J 10M 25T', pos)).toEqual({ years: 65, months: 10, days: 25 });
  });

  test('the spelled-out unit words convert to ymd', () => {
    expect(parseAge551('65 years 10 months 25 days', pos)).toEqual({ years: 65, months: 10, days: 25 });
    expect(parseAge551('65 Jahre 10 Monate 25 Tage', pos)).toEqual({ years: 65, months: 10, days: 25 });
    expect(parseAge551('65 yr 10 mo 25 da', pos)).toEqual({ years: 65, months: 10, days: 25 });
  });

  test('weeks convert to days and add to the existing days', () => {
    expect(parseAge551('5 weeks 2 days', pos)).toEqual({ days: 37 });
    expect(parseAge551('5 Wochen', pos)).toEqual({ days: 35 });
    expect(parseAge551('1y 3 weeks', pos)).toEqual({ years: 1, days: 21 });
  });

  test('the inaccuracy prefixes ABT/ABOUT/~ are deleted', () => {
    expect(parseAge551('ABOUT 65y', pos)).toEqual({ years: 65 });
    expect(parseAge551('ABT 65y', pos)).toEqual({ years: 65 });
    expect(parseAge551('~ 65y', pos)).toEqual({ years: 65 });
    expect(parseAge551('~65y', pos)).toEqual({ years: 65 });
  });

  test('negative months/days borrow from the preceding unit (30 days per month)', () => {
    expect(parseAge551('65y -5d', pos)).toEqual({ years: 64, months: 11, days: 25 });
    expect(parseAge551('65 years -5 days', pos)).toEqual({ years: 64, months: 11, days: 25 });
    expect(parseAge551('65y 3m -5d', pos)).toEqual({ years: 65, months: 2, days: 25 });
    expect(parseAge551('65y -1m', pos)).toEqual({ years: 64, months: 11 });
  });

  test('the strict order rule still applies (the corrections do not reorder)', () => {
    expect(() => parseAge551('5d 5y', pos)).toThrow('Age components must appear in the order');
    expect(() => parseAge551('5w', pos)).toThrow('Invalid age component');
    expect(() => parseAge551('65 10', pos)).toThrow('bare-number age must have exactly three groups');
  });

  test('the valid standard spellings are unchanged', () => {
    expect(parseAge551('65y 10m 25d', pos)).toEqual({ years: 65, months: 10, days: 25 });
    expect(parseAge551('< 50y', pos)).toEqual({ bound: '<', years: 50 });
    expect(parseAge551('CHILD', pos)).toEqual({ description: 'CHILD' });
  });

  test('an AGE at level 1 of the INDI record becomes the age at death', () => {
    const dataset = parseOk551([...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 AGE 65', ...SUBM, '0 TRLR'].join('\n'));
    const death = indi(dataset).events?.find((entry) => entry.tag === 'DEAT');
    expect(death?.detail?.age?.payload).toEqual({ years: 65 });
    // The write-back spells it as the standard DEAT.AGE.
    expect(lines(ser551(dataset))).toContain('1 DEAT');
    expect(lines(ser551(dataset))).toContain('2 AGE 65y');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('a level-1 AGE attaches to an existing DEAT event', () => {
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 DEAT', '2 DATE 1900', '1 AGE 65', ...SUBM, '0 TRLR'].join('\n'),
    );
    const death = indi(dataset).events?.find((entry) => entry.tag === 'DEAT');
    expect(death?.detail?.age?.payload).toEqual({ years: 65 });
    expect(death?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1900 });
  });
});

describe('the Hebrew AM year prefix (GEDCOM 5.5.5 p.84)', () => {
  test('@#DHEBREW@ AM 5670 parses as the year 5670', () => {
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 BIRT', '2 DATE @#DHEBREW@ AM 5670', ...SUBM, '0 TRLR'].join('\n'),
    );
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'HEBREW', year: 5670 });
  });

  test('the AM prefix combines with a month and an epoch', () => {
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 BIRT', '2 DATE @#DHEBREW@ AM TSH 5670', ...SUBM, '0 TRLR'].join('\n'),
    );
    const birth = indi(dataset).events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'HEBREW', month: 'TSH', year: 5670 });
    // The BCE epoch is not permitted in the Hebrew calendar; the
    // unparseable date is kept whole as the phrase.
    const epoch = parseGedcom551(
      enc([...H551, '0 @I1@ INDI', '1 BIRT', '2 DATE @#DHEBREW@ AM 5670 B.C.', ...SUBM, '0 TRLR'].join('\n')),
    );
    expect(epoch.ok).toBe(true);
    if (epoch.ok) {
      expect(indi(epoch.value).events?.find((entry) => entry.tag === 'BIRT')?.detail?.date).toEqual({
        value: { kind: 'unknown' },
        phrase: '@#DHEBREW@ AM 5670 B.C.',
      });
    }
  });
});

describe('the census SEX and ROLE typing (MagiKey_CENR_INDI.yaml)', () => {
  test('SEX canonicalizes through the version enum and ROLE types the descriptors', () => {
    const dataset = parseOk551(
      [
        ...H551,
        '0 @C1@ _CENR',
        '1 DATE 2 APR 1911',
        '1 PLAC Rathmines',
        '1 INDI @I1@',
        '2 SEX m',
        '2 ROLE CHIL',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const census = dataset.records.find((r) => r.tag === '_CENR');
    const entry = census !== undefined && isCensusRecord(census) ? census.entries[0] : undefined;
    expect(entry?.sex).toBe('M');
    expect(entry?.role).toEqual({ payload: 'CHIL' });
  });

  test('a bare census role descriptor normalizes to OTHER + phrase and writes back parenthesized', () => {
    const dataset = parseOk70(
      [
        ...H70,
        '0 @C1@ _CENR',
        '1 DATE 2 APR 1911',
        '1 PLAC Rathmines',
        '1 INDI @I1@',
        '2 ROLE Head',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '0 TRLR',
      ].join('\n'),
    );
    const census = dataset.records.find((r) => r.tag === '_CENR');
    const entry = census !== undefined && isCensusRecord(census) ? census.entries[0] : undefined;
    expect(entry?.role).toEqual({ payload: 'OTHER', phrase: 'Head' });
    const out70 = (() => {
      const result = serializeGedcom70(dataset);
      if (!result.ok) {
        throw new Error(JSON.stringify(result));
      }
      return result.value;
    })();
    expect(lines(out70)).toContain('2 ROLE (Head)');
    expect(parseOk70(out70)).toEqual(dataset);
  });

  test('an invalid census SEX is a strict error', () => {
    expect(
      err70(
        [
          ...H70,
          '0 @C1@ _CENR',
          '1 DATE 2 APR 1911',
          '1 PLAC P',
          '1 INDI @I1@',
          '2 SEX Q',
          '0 @I1@ INDI',
          '1 NAME A /B/',
          '0 TRLR',
        ].join('\n'),
      ),
    ).toBe('enum.invalid-value');
  });
});

describe('the MagiKey _AGER bound order (MagiKey-AgeRange.yaml)', () => {
  test('the first bound must be lower than the second', () => {
    expect(
      err70([...H70, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 AGE 20y', '3 _AGER 26-16', '0 TRLR'].join('\n')),
    ).toBe('age.invalid');
    expect(
      err70([...H70, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 AGE 20y', '3 _AGER 16-16', '0 TRLR'].join('\n')),
    ).toBe('age.invalid');
    // The valid range still parses.
    expect(
      parseOk70([...H70, '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 AGE 20y', '3 _AGER 16-26', '0 TRLR'].join('\n')),
    ).toBeTruthy();
  });
});

describe('the 5.5.1 export of the corrected ages', () => {
  test('a corrected AGE exports in the canonical spelling', () => {
    const dataset = parseOk551(
      [...H551, '0 @I1@ INDI', '1 NAME A /B/', '1 DEAT', '2 AGE 65 years 10 months 25 days', ...SUBM, '0 TRLR'].join(
        '\n',
      ),
    );
    const out = lines(ser551(dataset));
    expect(out).toContain('2 AGE 65y 10m 25d');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });
});
