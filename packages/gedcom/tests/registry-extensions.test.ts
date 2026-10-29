import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { CensusRecord, GedcomDataset, IndividualRecord, RepositoryRecord, SourceRecord } from '../src/structures';

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

  test('parses the NCHI count under the census SEX AGE (registry: MagiKey_CENR_SEX_AGE.yaml)', () => {
    const dataset = parse70(
      [
        ...HEADER70,
        '0 @C1@ _CENR',
        '1 DATE 2 APR 1911',
        '1 PLAC Musterort',
        '1 SEX M',
        '2 AGE 16y',
        '3 _AGER 16-26',
        '3 NCHI 3',
        '1 INDI @I1@',
        '2 NAME John /Doe/',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '0 TRLR',
      ].join('\n'),
    );
    const census = dataset.records.find((record): record is CensusRecord => record.tag === '_CENR');
    expect(census?.sexes?.[0]?.age?.payload).toEqual({ years: 16 });
    expect(census?.sexes?.[0]?.age?.ageRange).toBe('16-26');
    expect(census?.sexes?.[0]?.count).toBe(3);
    const text = ser70(dataset);
    expect(text).toContain('3 NCHI 3');
    expect(parse70(text)).toEqual(dataset);
    const text551 = ser551(dataset);
    expect(text551).toContain('3 NCHI 3');
    const reparsed551 = parse551(text551);
    const census551 = reparsed551.records.find((record): record is CensusRecord => record.tag === '_CENR');
    expect(census551).toEqual(census);
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
    expect(ser551(dataset)).toContain('1 _DATE INT 2020 (acquired)');
  });
});

describe('the community _SOUR under PAGE', () => {
  test('is typed as a relocated citation and stays under its PAGE (registry: _SOUR.yaml)', () => {
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
      '5 PAGE ledger p. 3',
      '5 QUAY 2',
      '0 @S2@ SOUR',
      '1 TITL The underlying ledger',
      '0 TRLR',
    ].join('\n');
    const first = parse70(sample);
    const citation = (first.records[1] as IndividualRecord).events?.[0]?.detail?.citations?.[0];
    expect(citation?.page).toEqual({
      tag: 'PAGE',
      payload: 'p. 12',
      citations: [
        {
          tag: 'SOUR',
          source: '@S2@',
          page: { tag: 'PAGE', payload: 'ledger p. 3' },
          quality: '2',
        },
      ],
    });
    // The relocated citation is written back under the PAGE line,
    // position preserved, and the round trip is lossless.
    const text = ser70(first);
    expect(text).toContain('3 PAGE p. 12\r\n4 _SOUR @S2@\r\n5 PAGE ledger p. 3\r\n5 QUAY 2');
    expect(parse70(text)).toEqual(first);
  });

  test('keeps other underscore extensions under their PAGE too', () => {
    const sample = [
      ...HEADER70,
      '0 @S1@ SOUR',
      '1 TITL Book',
      '0 @I1@ INDI',
      '1 BIRT',
      '2 SOUR @S1@',
      '3 PAGE p. 12',
      '4 _FOO note',
      '0 TRLR',
    ].join('\n');
    const first = parse70(sample);
    const citation = (first.records[1] as IndividualRecord).events?.[0]?.detail?.citations?.[0];
    expect(citation?.page?.extensions).toEqual([{ tag: '_FOO', payload: 'note', children: [] }]);
    const text = ser70(first);
    expect(text).toContain('3 PAGE p. 12\r\n4 _FOO note');
    expect(parse70(text)).toEqual(first);
  });

  test('round-trips through 5.5.1 with the position preserved', () => {
    const sample = [
      ...HEADER70,
      '0 @S1@ SOUR',
      '1 TITL Book',
      '0 @I1@ INDI',
      '1 BIRT',
      '2 SOUR @S1@',
      '3 PAGE p. 12',
      '4 _SOUR @S2@',
      '0 @S2@ SOUR',
      '1 TITL The underlying ledger',
      '0 TRLR',
    ].join('\n');
    const first = parse70(sample);
    const text = ser551(first);
    expect(text).toContain('3 PAGE p. 12\r\n4 _SOUR @S2@');
    const reparsed = parse551(text);
    const citation = (reparsed.records[1] as IndividualRecord).events?.[0]?.detail?.citations?.[0];
    expect(citation?.page).toEqual({
      tag: 'PAGE',
      payload: 'p. 12',
      citations: [{ tag: 'SOUR', source: '@S2@' }],
    });
  });
});

describe('the community _SOUR under a SOUR record', () => {
  test('is typed as a relocated citation and stays under the record (registry: _SOUR.yaml)', () => {
    const sample = [
      ...HEADER70,
      '0 @S1@ SOUR',
      '1 TITL Book',
      '1 _SOUR @S2@',
      '2 PAGE ledger p. 3',
      '2 QUAY 2',
      '0 @S2@ SOUR',
      '1 TITL The underlying ledger',
      '0 TRLR',
    ].join('\n');
    const first = parse70(sample);
    const source = first.records[0] as SourceRecord;
    expect(source.relocatedCitations).toEqual([
      { tag: 'SOUR', source: '@S2@', page: { tag: 'PAGE', payload: 'ledger p. 3' }, quality: '2' },
    ]);
    const text = ser70(first);
    expect(text).toContain('1 _SOUR @S2@\r\n2 PAGE ledger p. 3\r\n2 QUAY 2');
    expect(parse70(text)).toEqual(first);
  });

  test('round-trips through 5.5.1 with the position preserved', () => {
    const sample = [
      ...HEADER70,
      '0 @S1@ SOUR',
      '1 TITL Book',
      '1 _SOUR @S2@',
      '0 @S2@ SOUR',
      '1 TITL The underlying ledger',
      '0 TRLR',
    ].join('\n');
    const first = parse70(sample);
    const text = ser551(first);
    expect(text).toContain('1 _SOUR @S2@');
    const reparsed = parse551(text);
    const source = reparsed.records.find((record) => record.tag === 'SOUR' && record.xref === '@S1@') as SourceRecord;
    expect(source.relocatedCitations).toEqual([{ tag: 'SOUR', source: '@S2@' }]);
  });
});

describe('the MagiKey _CENR census link', () => {
  const SAMPLE = (version: '7.0' | '5.5.1'): string =>
    [
      ...(version === '7.0' ? HEADER70 : [...HEADER551, ...SUBM551]),
      '0 @C1@ _CENR',
      '1 DATE 1 APR 1940',
      '1 PLAC Springfield',
      '1 INDI @I1@',
      '2 NAME John /Doe/',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '2 _CENR @C1@',
      '1 CENS',
      '2 DATE 1 APR 1940',
      '2 _CENR @C1@',
      '1 BIRT',
      '2 DATE 12 MAR 1905',
      '2 _CENR @C1@',
      '1 OCCU Farmer',
      '2 _CENR @C1@',
      '0 TRLR',
    ].join('\n');

  const indi = (dataset: GedcomDataset): Record<string, unknown> => {
    const record = dataset.records.find((r) => r.tag === 'INDI');
    if (record === undefined) {
      throw new Error('expected INDI');
    }
    return record as unknown as Record<string, unknown>;
  };

  test('parses the links under CENS, BIRT, OCCU and NAME (registry: MagiKey_CENR.yaml)', () => {
    const dataset = parse70(SAMPLE('7.0'));
    const person = indi(dataset);
    const names = person['names'] as Array<{ censusLinks?: string[] }>;
    const events = person['events'] as Array<{ tag: string; detail?: { censusLinks?: string[] } }>;
    const attributes = person['attributes'] as Array<{ tag: string; detail?: { censusLinks?: string[] } }>;
    expect(names[0]?.censusLinks).toEqual(['@C1@']);
    expect(events.find((e) => e.tag === 'CENS')?.detail?.censusLinks).toEqual(['@C1@']);
    expect(events.find((e) => e.tag === 'BIRT')?.detail?.censusLinks).toEqual(['@C1@']);
    expect(attributes.find((a) => a.tag === 'OCCU')?.detail?.censusLinks).toEqual(['@C1@']);
  });

  test('accepts the links on 5.5.1 input too', () => {
    const dataset = parse551(SAMPLE('5.5.1'));
    const person = indi(dataset);
    expect((person['names'] as Array<{ censusLinks?: string[] }>)[0]?.censusLinks).toEqual(['@C1@']);
  });

  test('rejects a dangling link pointer', () => {
    const sample = SAMPLE('7.0').replace('@C1@', '@C9@');
    const result = parseGedcom70(enc(sample));
    if (result.ok) {
      throw new Error('expected an error');
    }
    expect((result.error as { code: string }).code).toBe('document.xref-not-found');
  });

  test('round-trips the links in both versions', () => {
    const first = parse70(SAMPLE('7.0'));
    const text70 = ser70(first);
    expect(text70).toContain('2 _CENR @C1@');
    const via70 = parse70(text70);
    const person70 = indi(via70);
    expect(
      (person70['events'] as Array<{ tag: string; detail?: { censusLinks?: string[] } }>).find((e) => e.tag === 'CENS')
        ?.detail?.censusLinks,
    ).toEqual(['@C1@']);

    const text551 = ser551(first);
    expect(text551).toContain('2 _CENR @C1@');
    const via551 = parse551(text551);
    const person551 = indi(via551);
    expect(
      (person551['events'] as Array<{ tag: string; detail?: { censusLinks?: string[] } }>).find((e) => e.tag === 'CENS')
        ?.detail?.censusLinks,
    ).toEqual(['@C1@']);
  });
});
