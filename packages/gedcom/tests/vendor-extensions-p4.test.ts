import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { FamilyRecord, GedcomDataset, IndividualRecord } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** The serializers emit CRLF line endings. */
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

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME T'];
const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

function indi551(body: string[]): string {
  return [...H551, '0 @I1@ INDI', ...body, ...SUBM, '0 TRLR'].join('\n');
}

function indi70(body: string[]): string {
  return [...H70, '0 @I1@ INDI', ...body, '0 TRLR'].join('\n');
}

function indi(dataset: GedcomDataset): IndividualRecord {
  const record = dataset.records.find((entry) => entry.xref === '@I1@');
  if (record === undefined || record.tag !== 'INDI') {
    throw new Error('expected INDI @I1@');
  }
  return record;
}

// ---------------------------------------------------------------------------
// The GEDCOM-L FAM F7 marriage status structure
// ---------------------------------------------------------------------------

describe('the GEDCOM-L FAM F7 _STAT structure', () => {
  const SAMPLE = [
    ...H551,
    '0 @F1@ FAM',
    '1 _STAT NOT MARRIED',
    '2 DATE 18 AUG 1888',
    '2 PLAC Musterort',
    '2 NOTE checked',
    '2 SOUR @S2@',
    '1 _STAT NEVER MARRIED',
    '0 @S2@ SOUR',
    '1 TITL Book',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('parses the statuses with their substructures (F7/F7.1)', () => {
    const dataset = parseOk551(SAMPLE);
    const fam = dataset.records.find((record): record is FamilyRecord => record.tag === 'FAM');
    expect(fam?.marriageStatuses?.[0]?.payload).toBe('NOT MARRIED');
    expect(fam?.marriageStatuses?.[0]?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', day: 18, month: 'AUG', year: 1888 });
    expect(fam?.marriageStatuses?.[0]?.place?.payload).toEqual(['Musterort']);
    expect(fam?.marriageStatuses?.[0]?.notes?.[0]).toMatchObject({ tag: 'NOTE', payload: 'checked' });
    expect(fam?.marriageStatuses?.[0]?.citations?.[0]?.source).toBe('@S2@');
    expect(fam?.marriageStatuses?.[1]).toEqual({ payload: 'NEVER MARRIED' });
  });

  test('round-trips through the 5.5.1 serializer (F7 write-back)', () => {
    const dataset = parseOk551(SAMPLE);
    const text = ser551(dataset);
    expect(lines(text)).toContain('1 _STAT NOT MARRIED');
    expect(lines(text)).toContain('2 DATE 18 AUG 1888');
    expect(lines(text)).toContain('2 PLAC Musterort');
    expect(lines(text)).toContain('1 _STAT NEVER MARRIED');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('7.0 writes the same _STAT extension lines', () => {
    const dataset = parseOk551(SAMPLE);
    const text = ser70(dataset);
    expect(lines(text)).toContain('1 _STAT NOT MARRIED');
    expect(lines(text)).toContain('2 DATE 18 AUG 1888');
    const reparsed = parseOk70(text);
    const fam = reparsed.records.find((record): record is FamilyRecord => record.tag === 'FAM');
    expect(fam?.marriageStatuses).toEqual([
      { payload: 'NOT MARRIED', date: { value: { kind: 'date', calendar: 'GREGORIAN', day: 18, month: 'AUG', year: 1888 } }, place: { tag: 'PLAC', payload: ['Musterort'] }, notes: [{ tag: 'NOTE', payload: 'checked' }], citations: [{ tag: 'SOUR', source: '@S2@' }] },
      { payload: 'NEVER MARRIED' },
    ]);
  });

  test('the bare status line of Legacy/AQ/Ages!/GDO/webtrees is the single-entry case', () => {
    const dataset = parseOk551([...H551, '0 @F1@ FAM', '1 _STAT Married', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records.find((record): record is FamilyRecord => record.tag === 'FAM');
    expect(fam?.marriageStatuses).toEqual([{ payload: 'Married' }]);
  });
});

// ---------------------------------------------------------------------------
// The GEDCOM-L agreement Nutzerdef.N5 _SCHEMA block with _DEFN leaves
// ---------------------------------------------------------------------------

describe('the GEDCOM-L N5 _SCHEMA block with _DEFN leaves', () => {
  const SAMPLE = [
    ...H551,
    '1 _SCHEMA',
    '2 INDI',
    '3 NAME',
    '4 _RUFNAME',
    '5 _DEFN In case of multiple given names, German documents often highlight one of them as "Rufname" by underlining it',
    '2 PLAC',
    '3 _GOV',
    '4 _DEFN Identifier of a place in GOV (Genealogisches Ortsverzeichnis)',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('parses the _DEFN leaves like the FTM DEFN spelling', () => {
    const dataset = parseOk551(SAMPLE);
    expect(dataset.header.schema53?.entries).toEqual([
      { context: ['INDI', 'NAME', '_RUFNAME'], definition: 'In case of multiple given names, German documents often highlight one of them as "Rufname" by underlining it' },
      { context: ['PLAC', '_GOV'], definition: 'Identifier of a place in GOV (Genealogisches Ortsverzeichnis)' },
    ]);
  });

  test('round-trips through the 5.5.1 serializer as the SCHEMA block', () => {
    const dataset = parseOk551(SAMPLE);
    const text = ser551(dataset);
    expect(lines(text)).toContain('1 SCHEMA');
    // The second entry's chain is PLAC → _GOV, so its DEFN leaf sits at
    // level 4 (the context starts at level 2).
    expect(lines(text)).toContain('4 DEFN Identifier of a place in GOV (Genealogisches Ortsverzeichnis)');
    expect(parseOk551(text)).toEqual(dataset);
  });
});

// ---------------------------------------------------------------------------
// The GEDCOM-L agreement TODO E1 structure
// ---------------------------------------------------------------------------

describe('the GEDCOM-L TODO E1 _TODO structure', () => {
  const SAMPLE = [
    ...H551,
    '0 @I1@ INDI',
    '1 NAME A /B/',
    '1 _TODO',
    '2 DESC Find the birth record',
    '2 _CAT Vital records',
    '2 _PRTY 0',
    '2 TYPE 0',
    '2 DATE 1 JAN 2020',
    '2 NOTE The church book is missing',
    '2 DATA Ordered a copy from the archive',
    '2 STAT open',
    '2 _CDATE 3 FEB 2020',
    '2 _RDATE 1 MAR 2020',
    '2 REPO @R1@',
    '2 _UID 00000000000000000000000000000000AAAA',
    '0 @R1@ REPO',
    '1 NAME Archive',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('parses the full E1 structure', () => {
    const dataset = parseOk551(SAMPLE);
    const todo = indi(dataset).todos?.[0];
    expect(todo).toMatchObject({
      tag: '_TODO',
      description: 'Find the birth record',
      category: 'Vital records',
      priority: '0',
      type: '0',
      status: 'open',
      data: 'Ordered a copy from the archive',
      repository: '@R1@',
      uids: ['00000000000000000000000000000000AAAA'],
    });
    expect(todo?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', day: 1, month: 'JAN', year: 2020 });
    expect(todo?.closedDate?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', day: 3, month: 'FEB', year: 2020 });
    expect(todo?.notes?.[0]).toMatchObject({ tag: 'NOTE', payload: 'The church book is missing' });
  });

  test('round-trips through both serializers', () => {
    const dataset = parseOk551(SAMPLE);
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
    const reparsed = parseOk70(ser70(dataset));
    const todo70 = (reparsed.records.find((record) => record.tag === 'INDI') as IndividualRecord).todos?.[0];
    expect(todo70).toEqual(indi(dataset).todos?.[0]);
  });

  test('the GenoPro/RootsMagic/Ahnenblatt PRTY spelling shares the priority slot', () => {
    const dataset = parseOk551(indi551(['1 _TODO do it', '2 DESC x', '2 PRTY 5']));
    expect(indi(dataset).todos?.[0]?.priority).toBe('5');
  });
});

// ---------------------------------------------------------------------------
// The further typed vendor tags (FH, BKW, webtrees, FTW, Gen, AB3, AGES!,
// TNG, TMG, PRO-GEN, GenPlus, Heredis/MFT7, RootsMagic)
// ---------------------------------------------------------------------------

describe('the further typed vendor tags on 5.5.1 input', () => {
  const SAMPLE = [
    ...H551,
    '0 @I1@ INDI',
    '1 NAME John /Doe/',
    '2 GIVN John',
    '2 _DATE 2 APR 1911',
    '2 _ALIA J.D.',
    '1 _ATTR Singing',
    '2 TYPE Hobby',
    '1 _MILI',
    '2 DATE 1942',
    '1 _HOL Yad Vashem',
    '1 _ELEC Mayor',
    '1 _EYES blue',
    '1 _BUERGERORT Bern',
    '1 _HEIM Zurich',
    '1 _LIVING',
    '1 _PRIVATE Y',
    '1 _CREA 2 APR 1911',
    '1 _ADPF',
    '1 _ADPM Y',
    '1 _GODP Aunt Rosa',
    '1 _WITN Peter',
    '1 _WEBTAG',
    '2 NAME Homepage',
    '2 URL http://example.com/john',
    '1 OCCU Baker',
    '2 _PRIM Y',
    '1 BIRT',
    '2 PLAC Musterort',
    '3 _AON Mustervillage',
    '1 FAMC @F1@',
    '2 _PEDI foster',
    '0 @F1@ FAM',
    '1 _WITN A friend',
    '1 _CREA 3 APR 1911',
    '0 @I2@ INDI',
    '1 NAME Rosa /Doe/',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('types the tags into the model', () => {
    const dataset = parseOk551(SAMPLE);
    const john = indi(dataset);

    const name = john.names?.[0];
    expect(name?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', day: 2, month: 'APR', year: 1911 });
    expect(name?.aliases).toEqual(['J.D.']);

    expect(john.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Hobby')?.payload).toBe('Singing');
    expect(john.events?.find((entry) => entry.tag === 'EVEN' && entry.type === 'Military')?.detail?.date).toBeDefined();
    expect(john.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Holocaust')?.payload).toBe('Yad Vashem');
    expect(john.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Elected')?.payload).toBe('Mayor');
    expect(john.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Eye color')?.payload).toBe('blue');
    expect(john.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Bürgerort')?.payload).toBe('Bern');
    expect(john.attributes?.filter((entry) => entry.tag === 'FACT' && entry.type === 'Bürgerort')).toHaveLength(2);
    expect(john.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Living')?.payload).toBe('Y');
    expect(john.restriction).toEqual(['PRIVACY']);
    expect(john.createdAt).toBe('2 APR 1911');
    expect(john.adoptedByFather).toBe(true);
    expect(john.adoptedByMother).toBe(true);
    expect(john.godparents).toEqual(['Aunt Rosa']);
    expect(john.witnesses).toEqual(['Peter']);
    expect(john.webTags).toEqual([{ name: 'Homepage', url: 'http://example.com/john' }]);

    const occupation = john.attributes?.find((entry) => entry.tag === 'OCCU');
    expect(occupation && 'primary' in occupation && occupation.primary).toBe(true);

    const birth = john.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.place?.alternativeNames).toEqual(['Mustervillage']);
    expect(john.childFamilies?.[0]?.pedigree).toEqual({ payload: 'FOSTER' });

    const fam = dataset.records.find((record): record is FamilyRecord => record.tag === 'FAM');
    expect(fam?.witnesses).toEqual(['A friend']);
    expect(fam?.createdAt).toBe('3 APR 1911');
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const dataset = parseOk551(SAMPLE);
    const text = ser551(dataset);
    expect(lines(text)).toContain('1 _ADPF Y');
    expect(lines(text)).toContain('1 _ADPM Y');
    expect(lines(text)).toContain('1 _GODP Aunt Rosa');
    expect(lines(text)).toContain('1 _WITN Peter');
    expect(lines(text)).toContain('1 _WEBTAG');
    expect(lines(text)).toContain('2 URL http://example.com/john');
    expect(lines(text)).toContain('2 _DATE 2 APR 1911');
    expect(lines(text)).toContain('2 _ALIA J.D.');
    expect(lines(text)).toContain('2 _PRIM Y');
    expect(lines(text)).toContain('3 _AON Mustervillage');
    expect(lines(text)).toContain('1 _CREAT 2 APR 1911');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('7.0 writes the typed constructs back and round-trips', () => {
    const dataset = parseOk551(SAMPLE);
    const text = ser70(dataset);
    expect(lines(text)).toContain('2 TYPE Hobby');
    expect(lines(text)).toContain('2 TYPE Holocaust');
    expect(lines(text)).toContain('2 TYPE Bürgerort');
    expect(lines(text)).toContain('1 RESN PRIVACY');
    expect(lines(text)).toContain('2 PEDI FOSTER');
    const reparsed = parseOk70(text);
    const reparsedIndi = reparsed.records.find((record) => record.xref === '@I1@');
    expect(reparsedIndi).toEqual(indi(dataset));
    const reparsedFam = reparsed.records.find((record) => record.xref === '@F1@');
    const fam = dataset.records.find((record): record is FamilyRecord => record.tag === 'FAM');
    expect(reparsedFam).toEqual(fam);
  });

  test('types the same tags on 7.0 input', () => {
    const dataset = parseOk70(indi70(['1 NAME John /Doe/', '1 _ATTR Singing', '2 TYPE Hobby', '1 _ADPF', '1 _HOL x']));
    const john = indi(dataset);
    expect(john.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Hobby')?.payload).toBe('Singing');
    expect(john.adoptedByFather).toBe(true);
    expect(john.attributes?.find((entry) => entry.tag === 'FACT' && entry.type === 'Holocaust')?.payload).toBe('x');
  });

  test('the AGES! _WTN witness projects onto _SHAR/_ROLE on 5.5.1 output', () => {
    const dataset = parseOk551(indi551(['1 BIRT', '2 _WTN @I2@', '0 @I2@ INDI']));
    const text = ser551(dataset);
    expect(lines(text)).toContain('2 _SHAR @I2@');
    expect(lines(text)).toContain('3 _ROLE Witness');
  });
});

// ---------------------------------------------------------------------------
// The GEDCOM 5.5EL name splitting: repeated GIVN with the TYPE RUF marker
// ---------------------------------------------------------------------------

describe('the GEDCOM 5.5EL name splitting', () => {
  test('repeated GIVN keep their order and the TYPE RUF marks the call name', () => {
    const dataset = parseOk551(
      indi551([
        '1 NAME Hieronimus Ernst-Rüdiger Hermann-Josef /Pockenfurth/',
        '2 GIVN Hieronimus',
        '2 GIVN Ernst',
        '3 TYPE RUF',
        '2 GIVN -Rüdiger',
        '2 GIVN Hermann-Josef',
        '2 SURN Pockenfurth',
      ]),
    );
    const name = indi(dataset).names?.[0];
    expect(name?.pieces?.givenNames).toEqual(['Hieronimus', 'Ernst', '-Rüdiger', 'Hermann-Josef']);
    expect(name?.callName).toBe('Ernst');
  });

  test('round-trips through the 5.5.1 serializer as joined GIVN + _RUFNAME', () => {
    const dataset = parseOk551(
      indi551([
        '1 NAME Hieronimus Ernst /Pockenfurth/',
        '2 GIVN Hieronimus',
        '2 GIVN Ernst',
        '3 TYPE RUF',
        '2 SURN Pockenfurth',
      ]),
    );
    const text = ser551(dataset);
    expect(lines(text)).toContain('2 GIVN Hieronimus, Ernst');
    expect(lines(text)).toContain('2 _RUFNAME Ernst');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('a TYPE under GIVN with another value is a strict error', () => {
    const result = parseGedcom551(enc(indi551(['1 NAME A /B/', '2 GIVN A', '3 TYPE X'])));
    if (result.ok) {
      throw new Error('expected an error');
    }
    expect((result.error as { code: string }).code).toBe('enum.invalid-value');
  });
});

// ---------------------------------------------------------------------------
// The GEDCOM 5.5EL MAP coordinate form under the _LOC record
// ---------------------------------------------------------------------------

describe('the GEDCOM 5.5EL MAP coordinate form', () => {
  const SAMPLE = [
    ...H551,
    '0 @P1@ _LOC',
    '1 NAME Musterort',
    '1 MAP 50.1234N 128.9876E',
    '2 TYPE DEGREE',
    '1 MAP JO99HZ',
    '2 TYPE MAIDENHEAD',
    '0 @I1@ INDI',
    '1 NAME A /B/',
    '1 BIRT',
    '2 PLAC Musterort',
    '3 _LOC @P1@',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('parses the payload MAP + TYPE entries alongside the standard MAP', () => {
    const dataset = parseOk551(SAMPLE);
    const card = dataset.records.find((record) => record.tag === '_PLAC');
    expect(card && 'elMaps' in card && card.elMaps).toEqual([
      { payload: '50.1234N 128.9876E', type: 'DEGREE' },
      { payload: 'JO99HZ', type: 'MAIDENHEAD' },
    ]);
  });

  test('a MAP TYPE with another value is a strict error', () => {
    const result = parseGedcom551(
      enc([...H551, '0 @P1@ _LOC', '1 NAME X', '1 MAP 1.0 2.0', '2 TYPE UTM', ...SUBM, '0 TRLR'].join('\n')),
    );
    if (result.ok) {
      throw new Error('expected an error');
    }
    expect((result.error as { code: string }).code).toBe('enum.invalid-value');
  });

  test('round-trips through both serializers as the _LOC record', () => {
    const dataset = parseOk551(SAMPLE);
    const text551 = ser551(dataset);
    expect(lines(text551)).toContain('0 @P1@ _LOC');
    expect(lines(text551)).toContain('1 MAP 50.1234N 128.9876E');
    expect(lines(text551)).toContain('2 TYPE DEGREE');
    expect(parseOk551(text551)).toEqual(dataset);
    const text70 = ser70(dataset);
    expect(lines(text70)).toContain('1 MAP JO99HZ');
    expect(lines(text70)).toContain('2 TYPE MAIDENHEAD');
    const reparsed70 = parseOk70(text70);
    const card551 = dataset.records.find((record) => record.tag === '_PLAC');
    const card70 = reparsed70.records.find((record) => record.tag === '_PLAC');
    expect(card70).toEqual(card551);
  });
});

// ---------------------------------------------------------------------------
// The webtrees custom-tag registry additions to the closed non-underscore set
// ---------------------------------------------------------------------------

describe('the Aldfaer MARR_* tags and the phpGedView COMM under FAM', () => {
  const SAMPLE = [
    ...H551,
    '0 @F1@ FAM',
    '1 MARR_CIVIL',
    '2 DATE 1900',
    '1 MARR_RELIGIOUS',
    '1 MARR_PARTNERS',
    '1 MARR_UNKNOWN',
    '1 COMM a family comment',
    ...SUBM,
    '0 TRLR',
  ].join('\n');

  test('types the Aldfaer marriage kinds into MARR + TYPE', () => {
    const dataset = parseOk551(SAMPLE);
    const fam = dataset.records.find((record): record is FamilyRecord => record.tag === 'FAM');
    expect(fam?.events).toEqual([
      { tag: 'MARR', type: 'civil', detail: { detail: { date: expect.anything() } } },
      { tag: 'MARR', type: 'religious' },
      { tag: 'MARR', type: 'registered partnership' },
      { tag: 'MARR', type: 'unknown' },
    ]);
    expect(fam?.notes?.[0]).toEqual({ tag: 'NOTE', payload: 'a family comment' });
  });

  test('writes the typed constructs standard-first and round-trips', () => {
    const dataset = parseOk551(SAMPLE);
    const text = ser551(dataset);
    expect(lines(text)).toContain('2 TYPE civil');
    expect(lines(text)).toContain('2 TYPE registered partnership');
    expect(lines(text)).toContain('1 NOTE a family comment');
    expect(text).not.toContain('MARR_CIVIL');
    expect(parseOk551(text)).toEqual(dataset);
  });
});
