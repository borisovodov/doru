import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

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

const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];
const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('name and place emission', () => {
  test('7.0 names keep pieces, translations, notes and citations', () => {
    const dataset = parse70(
      H70.concat(
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 TYPE BIRTH',
        '2 NPFX Dr.',
        '2 GIVN John',
        '2 SURN Doe',
        '2 NSFX Jr.',
        '2 TRAN John /Doe/',
        '3 LANG de',
        '2 NOTE a note',
        '2 SOUR @S2@',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 TYPE BIRTH');
    expect(text).toContain('2 NPFX Dr.');
    expect(text).toContain('2 GIVN John');
    expect(text).toContain('2 SURN Doe');
    expect(text).toContain('2 NSFX Jr.');
    expect(text).toContain('2 TRAN John/Doe/');
    expect(text).toContain('3 LANG de');
    expect(text).toContain('2 NOTE a note');
    expect(text).toContain('2 SOUR @S2@');
  });

  test('5.5.1 name pieces join with commas and keep piece notes', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 GIVN John, Jonathan',
        '2 NOTE piece note',
        '2 TYPE maiden',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 GIVN John, Jonathan');
    expect(text).toContain('2 NOTE piece note');
    expect(text).toContain('2 TYPE maiden');
  });

  test('5.5.1 phonetic and romanized names round-trip', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 FONE Jo-han /Do-e/',
        '3 TYPE kana',
        '2 ROMN Dzon /Doe/',
        '3 TYPE cyrillic',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 FONE Jo-han/Do-e/');
    expect(text).toContain('3 TYPE kana');
    expect(text).toContain('2 ROMN Dzon/Doe/');
    expect(text).toContain('3 TYPE cyrillic');
  });

  test('7.0 translates a phonetic variation with a known method', () => {
    const dataset = parse551(
      [...H551, '0 @I1@ INDI', '1 NAME John /Doe/', '2 FONE Jo-han /Do-e/', '3 TYPE kana', ...SUBM, '0 TRLR'].join(
        '\n',
      ),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 TRAN Jo-han/Do-e/');
    expect(text).toContain('3 LANG ja-Kana');
  });

  test('7.0 drops a phonetic variation with an unknown method', () => {
    const dataset = parse551(
      [...H551, '0 @I1@ INDI', '1 NAME John /Doe/', '2 FONE Jo /Do/', '3 TYPE mystery', ...SUBM, '0 TRLR'].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).not.toContain('TRAN');
  });

  test('places keep all 7.0 fields', () => {
    const dataset = parse70(
      H70.concat(
        '0 @I1@ INDI',
        '1 BIRT',
        '2 PLAC Berlin, Germany',
        '3 FORM City, Country',
        '3 _VERI Y',
        '3 _GOV 12345',
        '3 _POST 10115',
        '3 _MAIDENHEAD JO62',
        '3 LANG de',
        '3 TRAN Berlin, Deutschland',
        '4 LANG de',
        '3 EXID https://example.com/p',
        '4 TYPE https://example.com/t',
        '3 MAP',
        '4 LATI N52.52',
        '4 LONG E13.40',
        '3 NOTE a note',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 PLAC Berlin, Germany');
    expect(text).toContain('3 FORM City, Country');
    expect(text).toContain('3 _VERI Y');
    expect(text).toContain('3 _GOV 12345');
    expect(text).toContain('3 _POST 10115');
    expect(text).toContain('3 _MAIDENHEAD JO62');
    expect(text).toContain('3 LANG de');
    expect(text).toContain('3 TRAN Berlin, Deutschland');
    expect(text).toContain('3 EXID https://example.com/p');
    expect(text).toContain('4 TYPE https://example.com/t');
    expect(text).toContain('3 MAP');
    expect(text).toContain('4 LATI N52.52');
    expect(text).toContain('4 LONG E13.4');
    expect(text).toContain('3 NOTE a note');
  });

  test('5.5.1 places keep phonetic and romanized variations', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @I1@ INDI',
        '1 BIRT',
        '2 PLAC Berlin',
        '3 FONE Berurin',
        '4 TYPE kana',
        '3 ROMN Берлин',
        '4 TYPE cyrillic',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('3 FONE Berurin');
    expect(text).toContain('4 TYPE kana');
    expect(text).toContain('3 ROMN Берлин');
    expect(text).toContain('4 TYPE cyrillic');
  });
});

describe('records and record details', () => {
  test('FAM attributes, vendor fields and non-events round-trip', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '0 @F1@ FAM',
        '1 _NONE',
        '1 _STAT married',
        '1 _TYPE same-sex',
        '1 _MARR N',
        '1 NCHI 3',
        '1 RESI',
        '2 TYPE home',
        '1 _COML',
        '1 _MBON',
        '1 _SEPR',
        '1 _UPD 20010101',
        '1 RIN 9',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 _STAT married');
    expect(text).toContain('1 _TYPE same-sex');
    expect(text).toContain('1 _MARR N');
    expect(text).toContain('1 NCHI 3');
    expect(text).toContain('1 RESI');
    expect(text).toContain('2 TYPE home');
    expect(text).toContain('1 _UPD 20010101');
    expect(text).toContain('1 RIN 9');
  });

  test('INDI vendor names, marks, links and interests round-trip', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @I2@ INDI',
        '1 NAME X',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 CHIL @I1@',
        '0 @I1@ INDI',
        '1 _MARNM Mary /Smith/',
        '1 _AKA Alias /Name/',
        '1 _URL https://example.com',
        '1 _TAG tag1',
        '1 _TAG2 tag2',
        '1 SEX M',
        '1 FAMC @F1@',
        '2 _PRIMARY Y',
        '2 _PREF Y',
        '2 PEDI birth',
        '2 STAT proven',
        '1 FAMS @F1@',
        '2 _PREF Y',
        '1 SUBM @S1@',
        '1 ALIA @I2@',
        '2 PHRASE the alias',
        '1 ANCI @S1@',
        '1 DESI @S1@',
        '1 RFN 99',
        '1 AFN 1234',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 NAME Mary/Smith/');
    expect(text).toContain('2 TYPE married');
    expect(text).toContain('1 NAME Alias/Name/');
    expect(text).toContain('1 _URL https://example.com');
    expect(text).toContain('1 _TAG tag1');
    expect(text).toContain('1 _TAG2 tag2');
    expect(text).toContain('1 SEX M');
    expect(text).toContain('1 FAMC @F1@');
    expect(text).toContain('2 _PRIMARY Y');
    expect(text).toContain('2 _PREF Y');
    expect(text).toContain('2 PEDI birth');
    expect(text).toContain('2 STAT proven');
    expect(text).toContain('1 FAMS @F1@');
    expect(text).toContain('1 SUBM @S1@');
    expect(text).toContain('1 ALIA @I2@');
    // 5.5.1 has no PHRASE under ALIA (GEDCOM 5.5.1 §2 p.25); dropped.
    expect(text).not.toContain('2 PHRASE the alias');
    expect(text).toContain('1 ANCI @S1@');
    expect(text).toContain('1 DESI @S1@');
    expect(text).toContain('1 RFN 99');
    expect(text).toContain('1 AFN 1234');
  });

  test('7.0 non-events with details and spouse sealings', () => {
    const dataset = parse70(
      H70.concat(
        '0 @F1@ FAM',
        '1 NO MARR',
        '2 DATE FROM 1900 TO 1910',
        '3 PHRASE approx',
        '2 NOTE n',
        '2 SOUR @S2@',
        '1 SLGS',
        '2 STAT COMPLETED',
        '3 DATE 1 JAN 2000',
        '2 TEMP SLAKE',
        '2 PLAC Salt Lake',
        '2 NOTE n',
        '2 SOUR @S2@',
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 NO MARR');
    expect(text).toContain('2 DATE FROM 1900 TO 1910');
    expect(text).toContain('3 PHRASE approx');
    expect(text).toContain('1 SLGS');
    expect(text).toContain('2 STAT COMPLETED');
    expect(text).toContain('3 DATE 1 JAN 2000');
    expect(text).toContain('2 TEMP SLAKE');
    expect(text).toContain('2 PLAC Salt Lake');
  });

  test('individual events with adoption details and familyChild', () => {
    const dataset = parse70(
      H70.concat(
        '0 @F1@ FAM',
        '0 @I1@ INDI',
        '1 ADOP',
        '2 FAMC @F1@',
        '3 ADOP BOTH',
        '4 PHRASE both parents',
        '1 BIRT',
        '2 FAMC @F1@',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 FAMC @F1@');
    expect(text).toContain('3 ADOP BOTH');
    expect(text).toContain('4 PHRASE both parents');
  });

  test('individual ordinances keep FAMC under SLGC', () => {
    const dataset = parse70(H70.concat('0 @F1@ FAM', '0 @I1@ INDI', '1 SLGC', '2 FAMC @F1@', '0 TRLR').join('\n'));
    const text = ser70(dataset);
    expect(text).toContain('2 FAMC @F1@');
  });

  test('the 7.0 PEDI projection fills FAMC links from _FREL/_MREL', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @F1@ FAM',
        '1 CHIL @I1@',
        '2 _FREL adopted',
        '2 _MREL adopted',
        '0 @I1@ INDI',
        '1 FAMC @F1@',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 PEDI ADOPTED');
  });

  test('extension records and structures round-trip', () => {
    const dataset = parse70(H70.concat('0 @X1@ _CUSTOM value', '1 _CHILD nested', '0 TRLR').join('\n'));
    const text = ser70(dataset);
    expect(text).toContain('0 @X1@ _CUSTOM value');
    expect(text).toContain('1 _CHILD nested');
  });

  test('the _TODO record round-trips', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @T1@ _TODO do it',
        '1 _CAT category',
        '1 _CDATE 20010101',
        '1 _LOCL somewhere',
        '1 _RDATE 20010202',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('0 @T1@ _TODO do it');
    expect(text).toContain('1 _CAT category');
    expect(text).toContain('1 _CDATE 20010101');
    expect(text).toContain('1 _LOCL somewhere');
    expect(text).toContain('1 _RDATE 20010202');
  });

  test('REPO records relocate address contacts in 7.0', () => {
    const dataset = parse551(
      [...H551, '0 @R1@ REPO', '1 NAME R', '1 ADDR x', '2 PHON 1', ...SUBM, '0 TRLR'].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 PHON 1');
  });

  test('a repository citation with a call number and medium', () => {
    const dataset = parse70(
      H70.concat(
        '0 @R1@ REPO',
        '1 NAME R',
        '0 @S1@ SOUR',
        '1 REPO @R1@',
        '2 CALN A-1',
        '3 MEDI BOOK',
        '2 NOTE n',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 REPO @R1@');
    expect(text).toContain('2 CALN A-1');
    expect(text).toContain('3 MEDI BOOK');
    expect(text).toContain('2 NOTE n');
  });

  test('5.5.1 void repository citation becomes a bare REPO', () => {
    const dataset = parse70(H70.concat('0 @S1@ SOUR', '1 REPO', '0 TRLR').join('\n'));
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).toContain('1 REPO');
  });

  test('identifier spellings: EXID dropped in 5.5.1, UID becomes _UID', () => {
    const dataset = parse70(
      H70.concat('0 @I1@ INDI', '1 EXID https://example.com/i', '1 UID 550e', '0 TRLR').join('\n'),
    );
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).not.toContain('EXID');
    expect(text).toContain('1 _UID 550e');
  });

  test('common record fields: change dates with notes and creation dates', () => {
    const dataset = parse70(
      H70.concat(
        '0 @I1@ INDI',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '2 NOTE changed',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 CHAN');
    expect(text).toContain('2 DATE 4 JAN 2001');
    expect(text).toContain('2 NOTE changed');
    expect(text).toContain('1 CREA');
    expect(text).toContain('2 DATE 5 JAN 2001');
  });
});
