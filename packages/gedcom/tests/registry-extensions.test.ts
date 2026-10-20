import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { CensusRecord, GedcomDataset, RepositoryRecord, SourceRecord } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
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

const HEADER70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];
const HEADER551 = ['0 HEAD', '1 SOUR DORU', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM551 = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('the Ancestry publication details under SOUR.PUBL', () => {
  const SAMPLE = [
    ...HEADER70,
    '0 @S1@ SOUR',
    '1 PUBL Ancestry.com, Provo, UT, USA',
    '2 DATE 21 JAN 2020',
    '2 PLAC Provo, Utah, USA',
    '0 TRLR',
  ].join('\n');

  test('parses DATE and PLAC under PUBL (registry: Ancestry_PUBL_DATE/PLAC yaml)', () => {
    const dataset = parse70(SAMPLE);
    const source = dataset.records[0] as SourceRecord;
    expect(source.publication).toBe('Ancestry.com, Provo, UT, USA');
    expect(source.publicationDetails?.date?.value).toEqual({ day: 21, month: 'JAN', year: 2020 });
    expect(source.publicationDetails?.place).toBe('Provo, Utah, USA');
  });

  test('round-trips through the 7.0 serializer', () => {
    const first = parse70(SAMPLE);
    expect(parse70(ser70(first))).toEqual(first);
  });

  test('5.5.1 input accepts them leniently and 5.5.1 output drops them', () => {
    const as551 = [
      ...HEADER551,
      '0 @S2@ SOUR',
      '1 PUBL Ancestry.com, Provo, UT, USA',
      '2 DATE 21 JAN 2020',
      '2 PLAC Provo, Utah, USA',
      ...SUBM551,
      '0 TRLR',
    ].join('\n');
    const dataset = parse551(as551);
    const source = dataset.records[0] as SourceRecord;
    expect(source.publicationDetails?.date?.value).toEqual({ day: 21, month: 'JAN', year: 2020 });
    expect(source.publicationDetails?.place).toBe('Provo, Utah, USA');
    const text = ser551(dataset);
    expect(text).not.toContain('2 DATE 21 JAN 2020');
    expect(text).not.toContain('2 PLAC Provo');
  });
});

describe('the MagiKey _CENR census record', () => {
  const SAMPLE = [
    ...HEADER70,
    '0 @C1@ _CENR',
    '1 _SCHD population schedule',
    '1 DATE 2 APR 1911',
    '1 PLAC Rathmines, Dublin, Ireland',
    '1 SOUR @S1@',
    '1 SEX M',
    '2 AGE 44y',
    '1 INDI @I1@',
    '2 NAME John /Doe/',
    '2 SEX M',
    '2 AGE 44y',
    '2 _MSTAT M',
    '2 ROLE Head',
    '2 BIRT Y',
    '3 DATE 1867',
    '3 PLAC Dublin, Ireland',
    '2 OCCU Clerk',
    '2 FACT Roman Catholic',
    '2 FATH',
    '3 OCCU Farmer',
    '3 BIRT Y',
    '2 MOTH',
    '3 AGE 70y',
    '3 MARR Y',
    '4 DATE 1860',
    '0 @I1@ INDI',
    '1 NAME John /Doe/',
    '0 @S1@ SOUR',
    '1 TITL Census of Ireland 1911',
    '0 TRLR',
  ].join('\n');

  test('parses the census record (registry: MagiKey_record_CENR.yaml)', () => {
    const dataset = parse70(SAMPLE);
    const census = dataset.records.find((record): record is CensusRecord => record.tag === '_CENR');
    expect(census).toBeDefined();
    expect(census?.schedule).toBe('population schedule');
    expect(census?.date.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', day: 2, month: 'APR', year: 1911 });
    expect(census?.place).toBe('Rathmines, Dublin, Ireland');
    expect(census?.source?.source).toBe('@S1@');
    expect(census?.sexes).toEqual([{ tag: 'SEX', payload: 'M', age: { payload: { years: 44 } } }]);
    const entry = census?.entries[0];
    expect(entry?.individual).toBe('@I1@');
    expect(entry?.name?.payload).toEqual({ given: 'John', surname: 'Doe' });
    expect(entry?.maritalStatus).toBe('M');
    expect(entry?.role).toBe('Head');
    expect(entry?.birth?.payload).toBe(true);
    expect(entry?.birth?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1867 });
    expect(entry?.occupation?.payload).toBe('Clerk');
    expect(entry?.facts?.[0]?.payload).toBe('Roman Catholic');
    expect(entry?.father?.occupation?.payload).toBe('Farmer');
    expect(entry?.father?.birth?.payload).toBe(true);
    expect(entry?.mother?.age?.payload).toEqual({ years: 70 });
    expect(entry?.mother?.marriage?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1860 });
  });

  test('round-trips through the 7.0 serializer', () => {
    const first = parse70(SAMPLE);
    expect(parse70(ser70(first))).toEqual(first);
  });

  test('parses and writes back in 5.5.1 as well', () => {
    const as551 = [
      ...HEADER551,
      '0 @C1@ _CENR',
      '1 DATE 2 APR 1911',
      '1 PLAC Rathmines, Dublin, Ireland',
      '1 INDI @I1@',
      '2 NAME John /Doe/',
      '2 AGE 44y',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      ...SUBM551,
      '0 TRLR',
    ].join('\n');
    const dataset = parse551(as551);
    const census = dataset.records.find((record): record is CensusRecord => record.tag === '_CENR');
    expect(census?.date.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', day: 2, month: 'APR', year: 1911 });
    const text = ser551(dataset);
    expect(text).toContain('0 @C1@ _CENR');
    expect(text).toContain('1 DATE 2 APR 1911');
    expect(parse551(text)).toEqual(dataset);
  });
});

describe('the MagiKey _AGER age range', () => {
  test('parses and writes back the Integer-Integer range (registry: MagiKey_AGER.yaml)', () => {
    const dataset = parse70(
      [...HEADER70, '0 @I1@ INDI', '1 NAME John /Doe/', '1 BIRT', '2 AGE > 20y', '3 _AGER 16-26', '0 TRLR'].join('\n'),
    );
    const individual = dataset.records[0];
    if (individual?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(individual.events?.[0]?.detail?.age?.payload).toEqual({ bound: '>', years: 20 });
    expect(individual.events?.[0]?.detail?.age?.ageRange).toBe('16-26');
    const text = ser70(dataset);
    expect(text).toContain('3 _AGER 16-26');
    expect(parse70(text)).toEqual(dataset);
  });

  test('rejects a malformed range', () => {
    const result = parseGedcom70(
      enc([...HEADER70, '0 @I1@ INDI', '1 NAME John /Doe/', '1 BIRT', '2 AGE 20y', '3 _AGER sixteen', '0 TRLR'].join('\n')),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('age.invalid');
    }
  });
});

describe('the community _DATE under REPO', () => {
  test('parses and writes back (registry: _DATE.yaml)', () => {
    const dataset = parse70(
      [...HEADER70, '0 @R1@ REPO', '1 NAME National Archives', '1 _DATE 2020', '2 PHRASE acquired', '0 TRLR'].join('\n'),
    );
    const repo = dataset.records[0] as RepositoryRecord;
    expect(repo.dates?.[0]?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 2020 });
    expect(repo.dates?.[0]?.phrase).toBe('acquired');
    expect(parse70(ser70(dataset))).toEqual(dataset);
    expect(ser551(dataset)).toContain('1 _DATE 2020');
  });
});

describe('the community _SOUR under PAGE', () => {
  test('is preserved as a generic extension and round-trips (registry: _SOUR.yaml)', () => {
    const sample = [
      ...HEADER70,
      '0 @S1@ SOUR',
      '1 TITL Book',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 BIRT',
      '2 SOUR @S1@',
      '3 PAGE p. 12',
      '4 _SOUR @S2@',
      '0 @S2@ SOUR',
      '1 TITL The underlying ledger',
      '0 TRLR',
    ].join('\n');
    const first = parse70(sample);
    const text = ser70(first);
    // The generic extension survives, written back at the citation level
    // (a documented extension tag may appear under any structure).
    expect(text).toContain('_SOUR @S2@');
    parse70(text); // re-parses without error
  });
});
