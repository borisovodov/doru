import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function parseOk551(text: string): GedcomDataset {
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

const SAMPLE70 = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 SCHMA',
  '2 TAG _X https://example.com/x',
  '1 SOUR DORU',
  '2 NAME Doru',
  '1 DATE 17 OCT 2026',
  '2 TIME 10:30:05.25Z',
  '1 LANG en',
  '1 PLAC',
  '2 FORM City, Country',
  '1 NOTE Document description',
  '0 @I1@ INDI',
  '1 RESN CONFIDENTIAL',
  '1 NAME Ivan /Ivanov/',
  '2 TYPE BIRTH',
  '2 GIVN Ivan',
  '2 SURN Ivanov',
  '2 TRAN John /Ivanov/',
  '3 LANG en',
  '1 SEX M',
  '1 BIRT Y',
  '2 DATE 12 MAR 1923',
  '2 PLAC Moscow, Russia',
  '3 MAP',
  '4 LATI N55.7558',
  '4 LONG E37.6173',
  '2 AGE 0y',
  '1 DEAT',
  '2 DATE 2 OCT 1999',
  '2 CAUS Old age',
  '1 OCCU Engineer',
  '1 FAMS @F1@',
  '1 FAMC @F2@',
  '2 PEDI BIRTH',
  '1 ALIA @I2@',
  '1 ASSO @I2@',
  '2 ROLE OTHER',
  '3 PHRASE Colleague',
  '1 NOTE Research note',
  '2 SOUR @S1@',
  '3 PAGE p. 12',
  '3 QUAY 2',
  '1 UID 550e8400-e29b-41d4-a716-446655440000',
  '1 CHAN',
  '2 DATE 1 JAN 2020',
  '3 TIME 12:00Z',
  '0 @I2@ INDI',
  '1 NAME Petr /Ivanov/',
  '1 SEX M',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 WIFE @I3@',
  '1 CHIL @I2@',
  '1 MARR',
  '2 DATE 1940',
  '2 HUSB',
  '3 AGE 17y',
  '1 NCHI 1',
  '0 @I3@ INDI',
  '1 NAME Anna /Ivanova/',
  '1 SEX F',
  '0 @F2@ FAM',
  '1 HUSB @I4@',
  '1 CHIL @I1@',
  '0 @I4@ INDI',
  '1 NAME Fyodor /Ivanov/',
  '1 SEX M',
  '0 @S1@ SOUR',
  '1 DATA',
  '2 EVEN BIRT, DEAT',
  '3 DATE FROM 1900 TO 1999',
  '1 AUTH County Clerk',
  '1 TITL Vital Records',
  '1 REPO @R1@',
  '2 CALN 13B-1234',
  '3 MEDI FILM',
  '0 @R1@ REPO',
  '1 NAME County Archive',
  '1 ADDR 1 Archive Way',
  '1 PHON +1 555 0100',
  '1 EMAIL archive@example.com',
  '0 @N1@ SNOTE Shared note text',
  '1 MIME text/plain',
  '1 LANG en',
  '0 @O1@ OBJE',
  '1 FILE media/photo.jpg',
  '2 FORM image/jpeg',
  '3 MEDI PHOTO',
  '2 TITL Portrait',
  '0 @U1@ SUBM',
  '1 NAME Tester',
  '1 LANG en',
  '0 TRLR',
].join('\n');

const SAMPLE551 = [
  '0 HEAD',
  '1 SOUR MYAPP',
  '1 DEST ANSTFILE',
  '1 DATE 17 OCT 2026',
  '1 SUBM @S1@',
  '1 SUBN @N1@',
  '1 FILE family.ged',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '1 LANG English',
  '1 PLAC',
  '2 FORM City, Country',
  '0 @N1@ SUBN',
  '1 SUBM @S1@',
  '1 FAMF My Family',
  '1 ORDI yes',
  '0 @I1@ INDI',
  '1 RESN confidential',
  '1 NAME Ivan /Ivanov/',
  '2 TYPE aka',
  '2 FONE Ivan /Ivanov/',
  '3 TYPE hangul',
  '1 SEX M',
  '1 BIRT',
  '2 DATE 12 MAR 1923',
  '2 PLAC Moscow, Russia',
  '1 DEAT',
  '2 DATE 2 OCT 1999',
  '2 AGE 76y',
  '1 FAMS @F1@',
  '1 FAMC @F2@',
  '2 PEDI birth',
  '1 ASSO @I2@',
  '2 RELA Colleague',
  '1 RFN 123:456',
  '1 AFN 9ABC-1234',
  '1 RIN 42',
  '1 CHAN',
  '2 DATE 1 JAN 2020',
  '0 @I2@ INDI',
  '1 NAME Petr /Ivanov/',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 CHIL @I2@',
  '1 MARR',
  '2 DATE 1940',
  '2 HUSB',
  '3 AGE 17y',
  '0 @F2@ FAM',
  '1 HUSB @I4@',
  '1 CHIL @I1@',
  '0 @I4@ INDI',
  '1 NAME Fyodor /Ivanov/',
  '0 @N2@ NOTE This note is shared',
  '1 REFN n2',
  '0 @I2@ INDI',
  '1 NOTE @N2@',
  '0 @S1@ SOUR',
  '1 DATA',
  '2 EVEN BIRT, DEAT',
  '3 DATE FROM 1900 TO 1999',
  '1 AUTH County Clerk',
  '1 TITL Vital Records',
  '1 REPO @R1@',
  '2 CALN 13B-1234',
  '3 MEDI film',
  '0 @R1@ REPO',
  '1 NAME County Archive',
  '1 ADDR 1 Archive Way',
  '2 PHON +1 555 0100',
  '0 @O1@ OBJE',
  '1 FILE media/photo.jpg',
  '2 FORM jpg',
  '3 TYPE photo',
  '0 @S1@ SUBM',
  '1 NAME Tester',
  '1 LANG English',
  '0 TRLR',
].join('\n');

describe('round trips', () => {
  test('7.0: parse → serialize → parse produces the same model', () => {
    const first = parseOk70(SAMPLE70);
    const text = ser70(first);
    const second = parseOk70(text);
    // The synthetic fields do not exist in the 7.0 sample; deep equality
    // holds directly.
    expect(second).toEqual(first);
  });

  test('5.5.1: parse → serialize → parse produces the same model', () => {
    const first = parseOk551(SAMPLE551);
    const text = ser551(first);
    const second = parseOk551(text);
    // Synthetic OBJE records are part of the model after the first parse,
    // so the second parse must see the same synthesized state.
    expect(second).toEqual(first);
  });

  test('7.0 serialization is stable (idempotent)', () => {
    const first = parseOk70(SAMPLE70);
    const once = ser70(first);
    const twice = ser70(parseOk70(once));
    expect(twice).toBe(once);
  });

  test('5.5.1 serialization is stable (idempotent)', () => {
    const first = parseOk551(SAMPLE551);
    const once = ser551(first);
    const twice = ser551(parseOk551(once));
    expect(twice).toBe(once);
  });
});

describe('cross-version round trips (up to the unrepresentable)', () => {
  const SAMPLE_REPRESENTABLE = [
    '0 @I1@ INDI',
    '1 NAME Ivan /Ivanov/',
    '2 GIVN Ivan',
    '2 SURN Ivanov',
    '1 SEX M',
    '1 BIRT Y',
    '2 DATE 12 MAR 1923',
    '2 PLAC Moscow, Russia',
    '1 FAMS @F1@',
    '0 @I2@ INDI',
    '1 NAME Anna /Ivanova/',
    '1 SEX F',
    '1 FAMS @F1@',
    '0 @F1@ FAM',
    '1 HUSB @I1@',
    '1 WIFE @I2@',
    '1 MARR Y',
    '2 DATE 1940',
  ];

  test('5.5.1 → 7.0 → 5.5.1 produces the same model', () => {
    const first = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        ...SAMPLE_REPRESENTABLE,
        '0 TRLR',
      ].join('\n'),
    );
    const via70 = parseOk70(ser70(first));
    const back = parseOk551(ser551(via70));
    // The submitter is reused, not synthesized, on the way back.
    expect(back).toEqual(first);
  });

  test('7.0 → 5.5.1 → 7.0 produces the same model', () => {
    const first = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SOUR DORU',
        '0 @_SYNSUB1@ SUBM',
        '1 NAME Unknown',
        ...SAMPLE_REPRESENTABLE,
        '0 TRLR',
      ].join('\n'),
    );
    const via551 = parseOk551(ser551(first));
    const back = parseOk70(ser70(via551));
    expect(back).toEqual(first);
  });
});
