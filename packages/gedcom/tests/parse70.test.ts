import { describe, expect, test } from 'vitest';
import { parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err70(text: string): { code: string; message: string } {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return result.error as { code: string; message: string };
}

describe('parseGedcom70 — document level', () => {
  test('rejects a document without a header', () => {
    expect(err70('0 @I1@ INDI\n0 TRLR\n').code).toBe('document.missing-header');
  });

  test('rejects a document without a trailer', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n').code).toBe('document.missing-trailer');
  });

  test('rejects content after the trailer', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n0 @I1@ INDI\n').code).toBe('document.trailer-not-last');
  });

  test('rejects a wrong version', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 TRLR\n').code).toBe('document.wrong-version');
    expect(err70('0 HEAD\n1 GEDC\n0 TRLR\n').code).toBe('structure.missing-required');
  });

  test('rejects a missing GEDC', () => {
    expect(err70('0 HEAD\n0 TRLR\n').code).toBe('structure.missing-required');
  });

  test('rejects a TRLR with substructures', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n1 X\n').code).toBe('structure.unexpected-payload');
  });

  test('parses an empty header-only document', () => {
    const dataset = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n');
    expect(dataset.header.tag).toBe('HEAD');
    expect(dataset.header.gedcom.version).toBe('7.0');
    expect(dataset.records).toHaveLength(0);
    expect(dataset.trailer).toEqual({ tag: 'TRLR' });
  });
});

describe('parseGedcom70 — header', () => {
  test('parses SCHMA tag definitions', () => {
    const dataset = parse70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n1 SCHMA\n2 TAG _SKYPEID http://xmlns.com/foaf/0.1/skypeID\n0 TRLR\n',
    );
    expect(dataset.header.schema?.tagDefinitions[0]?.payload).toEqual({
      tag: '_SKYPEID',
      uri: 'http://xmlns.com/foaf/0.1/skypeID',
    });
  });

  test('rejects a bad tag definition', () => {
    expect(
      err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 SCHMA\n2 TAG SKYPEID http://x\n0 TRLR\n').code,
    ).toBe('tagdef.invalid');
  });

  test('parses SOUR with CORP, address and data', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SOUR MyApp',
        '2 NAME My App',
        '2 CORP Acme Corp',
        '3 ADDR 1 Main St',
        '3 PHON +1 555 0100',
        '2 DATA Extracted DB',
        '3 DATE 12 MAR 2024',
        '3 COPR (c) 2024 Acme',
        '1 DEST Target',
        '1 DATE 1 JAN 2024',
        '2 TIME 10:30:15.5Z',
        '1 SUBM @S1@',
        '1 COPR Copyright',
        '1 LANG en',
        '1 PLAC',
        '2 FORM City, Country',
        '0 @S1@ SUBM',
        '1 NAME Tester',
        '0 TRLR',
      ].join('\n'),
    );
    const header = dataset.header;
    expect(header.source?.payload).toBe('MyApp');
    expect(header.source?.corporation?.address?.payload).toBe('1 Main St');
    expect(header.source?.corporation?.phone).toEqual(['+1 555 0100']);
    expect(header.source?.data?.date?.value).toEqual({ day: 12, month: 'MAR', year: 2024 });
    expect(header.destination).toBe('Target');
    expect(header.date?.value).toEqual({ day: 1, month: 'JAN', year: 2024 });
    expect(header.date?.time).toEqual({ hour: 10, minute: 30, second: 15, fraction: '5', utc: true });
    expect(header.submitter).toBe('@S1@');
    expect(header.language).toBe('en');
    expect(header.place?.form).toEqual(['City', 'Country']);
  });
});

describe('parseGedcom70 — records', () => {
  test('parses INDI with names, sex, events, attributes and links', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 RESN CONFIDENTIAL, LOCKED',
        '1 NAME John /Doe/',
        '2 TYPE BIRTH',
        '2 GIVN John',
        '2 SURN Doe',
        '1 SEX M',
        '1 BIRT Y',
        '2 DATE 1 JAN 1900',
        '2 PLAC Cove, Cache, Utah, USA',
        '2 AGE 32y 2m',
        '1 OCCU Farmer',
        '2 TYPE Primary',
        '1 FAMS @F1@',
        '1 FAMC @F2@',
        '2 PEDI BIRTH',
        '0 @F1@ FAM',
        '0 @F2@ FAM',
        '0 @S1@ SUBM',
        '1 NAME Tester',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.restriction).toEqual(['CONFIDENTIAL', 'LOCKED']);
    expect(indi.names?.[0]?.payload).toEqual({ given: 'John', surname: 'Doe' });
    expect(indi.names?.[0]?.type?.payload).toBe('BIRTH');
    expect(indi.names?.[0]?.pieces?.givenNames).toEqual(['John']);
    expect(indi.sex).toBe('M');
    const birth = indi.events?.[0];
    if (birth?.tag !== 'BIRT') {
      throw new Error('expected BIRT');
    }
    expect(birth.payload).toBe(true);
    expect(birth.detail?.date?.value).toEqual({ kind: 'date', day: 1, month: 'JAN', year: 1900, calendar: 'GREGORIAN' });
    expect(birth.detail?.place?.payload).toEqual(['Cove', 'Cache', 'Utah', 'USA']);
    expect(birth.detail?.age?.payload).toEqual({ years: 32, months: 2 });
    const occupation = indi.attributes?.[0];
    if (occupation?.tag !== 'OCCU') {
      throw new Error('expected OCCU');
    }
    expect(occupation.payload).toBe('Farmer');
    expect(occupation.type).toBe('Primary');
    expect(indi.spouseFamilies?.[0]?.family).toBe('@F1@');
    expect(indi.childFamilies?.[0]?.pedigree?.payload).toBe('BIRTH');
  });

  test('parses FAM with links and events', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 CHIL @I3@',
        '1 MARR',
        '2 HUSB',
        '3 AGE 30y',
        '2 DATE 1920',
        '1 NCHI 3',
        '0 @I1@ INDI',
        '0 @I2@ INDI',
        '0 @I3@ INDI',
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records[0];
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.husband?.partner).toBe('@I1@');
    expect(fam.wife?.partner).toBe('@I2@');
    expect(fam.children?.[0]?.child).toBe('@I3@');
    const marriage = fam.events?.[0];
    if (marriage?.tag !== 'MARR') {
      throw new Error('expected MARR');
    }
    expect(marriage.detail?.husband?.age.payload).toEqual({ years: 30 });
    expect(marriage.detail?.detail?.date?.value).toEqual({ kind: 'date', year: 1920, calendar: 'GREGORIAN' });
    expect(fam.attributes?.[0]?.payload).toBe(3);
  });

  test('parses SOUR, REPO, SNOTE, OBJE and SUBM records', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @S1@ SOUR',
        '1 DATA',
        '2 EVEN BIRT, DEAT',
        '3 DATE FROM 1900 TO 1910',
        '3 PLAC Oneida, Idaho',
        '1 AUTH County Clerk',
        '1 TITL Vital Records',
        '1 REPO @R1@',
        '2 CALN 13B-1234',
        '3 MEDI FILM',
        '0 @R1@ REPO',
        '1 NAME County Archive',
        '1 ADDR 1 Archive Way',
        '0 @N1@ SNOTE Shared text',
        '1 MIME text/plain',
        '1 LANG en',
        '0 @O1@ OBJE',
        '1 FILE media/photo.jpg',
        '2 FORM image/jpeg',
        '3 MEDI PHOTO',
        '2 TITL Portrait',
        '0 @S2@ SUBM',
        '1 NAME Tester',
        '1 LANG en',
        '0 TRLR',
      ].join('\n'),
    );
    const sour = dataset.records[0];
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.data?.events?.[0]?.payload).toEqual(['BIRT', 'DEAT']);
    expect(sour.data?.events?.[0]?.date?.value).toEqual({
      kind: 'period',
      from: { kind: 'date', year: 1900, calendar: 'GREGORIAN' },
      to: { kind: 'date', year: 1910, calendar: 'GREGORIAN' },
    });
    expect(sour.data?.events?.[0]?.place?.payload).toEqual(['Oneida', 'Idaho']);
    expect(sour.author).toBe('County Clerk');
    expect(sour.repositoryCitations?.[0]?.repository).toBe('@R1@');
    expect(sour.repositoryCitations?.[0]?.callNumbers?.[0]?.medium?.payload).toBe('FILM');
    const snote = dataset.records[2];
    if (snote?.tag !== 'SNOTE') {
      throw new Error('expected SNOTE');
    }
    expect(snote.payload).toBe('Shared text');
    expect(snote.mediaType).toBe('text/plain');
    const obje = dataset.records[3];
    if (obje?.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(obje.files[0]?.payload).toBe('media/photo.jpg');
    expect(obje.files[0]?.form.payload).toBe('image/jpeg');
    expect(obje.files[0]?.form.medium?.payload).toBe('PHOTO');
    expect(obje.files[0]?.title).toBe('Portrait');
  });
});

describe('parseGedcom70 — dates and payloads', () => {
  test('parses all DateValue forms', () => {
    const cases: Array<[string, unknown]> = [
      ['FROM 1900 TO 1910', { kind: 'period', from: { kind: 'date', year: 1900, calendar: 'GREGORIAN' }, to: { kind: 'date', year: 1910, calendar: 'GREGORIAN' } }],
      ['TO 1800', { kind: 'period', to: { kind: 'date', year: 1800, calendar: 'GREGORIAN' } }],
      ['BET 1900 AND 1910', { kind: 'range', start: { kind: 'date', year: 1900, calendar: 'GREGORIAN' }, end: { kind: 'date', year: 1910, calendar: 'GREGORIAN' } }],
      ['AFT 1800', { kind: 'bound', modifier: 'AFT', date: { kind: 'date', year: 1800, calendar: 'GREGORIAN' } }],
      ['BEF 1800', { kind: 'bound', modifier: 'BEF', date: { kind: 'date', year: 1800, calendar: 'GREGORIAN' } }],
      ['ABT 1800', { kind: 'approx', modifier: 'ABT', date: { kind: 'date', year: 1800, calendar: 'GREGORIAN' } }],
      ['CAL 1800', { kind: 'approx', modifier: 'CAL', date: { kind: 'date', year: 1800, calendar: 'GREGORIAN' } }],
      ['EST 1800', { kind: 'approx', modifier: 'EST', date: { kind: 'date', year: 1800, calendar: 'GREGORIAN' } }],
      ['JAN 1920', { kind: 'date', month: 'JAN', year: 1920, calendar: 'GREGORIAN' }],
      ['JULIAN 12 FEB 1600', { kind: 'date', calendar: 'JULIAN', day: 12, month: 'FEB', year: 1600 }],
      ['HEBREW 15 TSH 5750', { kind: 'date', calendar: 'HEBREW', day: 15, month: 'TSH', year: 5750 }],
      ['FRENCH_R 1 VEND 1', { kind: 'date', calendar: 'FRENCH_R', day: 1, month: 'VEND', year: 1 }],
      ['44 BCE', { kind: 'date', year: 44, epoch: 'BCE', calendar: 'GREGORIAN' }],
    ];
    for (const [text, expected] of cases) {
      const dataset = parse70(
        `0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE ${text}\n0 TRLR\n`,
      );
      const indi = dataset.records[0];
      if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'BIRT') {
        throw new Error('expected BIRT');
      }
      expect(indi.events[0].detail?.date?.value, text).toEqual(expected);
    }
  });

  test('parses an empty DATE with a PHRASE', () => {
    const dataset = parse70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE\n3 PHRASE 5 January (year unknown)\n0 TRLR\n',
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'BIRT') {
      throw new Error('expected BIRT');
    }
    expect(indi.events[0].detail?.date?.value).toEqual({ kind: 'unknown' });
    expect(indi.events[0].detail?.date?.phrase).toBe('5 January (year unknown)');
  });

  test('rejects invalid dates', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE 32 JAN 1900\n0 TRLR\n').code).toBe('date.bad-day');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE XYZ 1900\n0 TRLR\n').code).toBe('date.bad-month');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE BET 1900\n0 TRLR\n').code).toBe('date.invalid');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE FRENCH_R 1 JAN 1900\n0 TRLR\n').code).toBe('date.bad-month');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE HEBREW 1 TSH 5750 BCE\n0 TRLR\n').code).toBe('date.bad-epoch');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE 29 FEB 1900\n0 TRLR\n').code).toBe('date.bad-day');
    const leap = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE 29 FEB 2000\n0 TRLR\n');
    expect(leap.records[0]?.tag).toBe('INDI');
  });

  test('validates Gregorian and Julian leap years differently', () => {
    // 1900 is a leap year in the Julian calendar but not the Gregorian.
    const julian = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE JULIAN 29 FEB 1900\n0 TRLR\n');
    const indi = julian.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.date?.value).toEqual({
      kind: 'date',
      calendar: 'JULIAN',
      day: 29,
      month: 'FEB',
      year: 1900,
    });
  });

  test('rejects invalid enums, times and ages', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 SEX Z\n0 TRLR\n').code).toBe('enum.invalid-value');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE 1900\n2 AGE 3y 2y\n0 TRLR\n').code).toBe('age.invalid');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE 1900\n2 AGE 3x\n0 TRLR\n').code).toBe('age.invalid');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 DATE 1 JAN 2024\n2 TIME 24:00\n0 TRLR\n').code).toBe('time.invalid');
  });
});

describe('parseGedcom70 — strictness', () => {
  test('rejects unknown standard tags in context', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 BOGUS x\n0 TRLR\n').code).toBe('structure.unknown-tag');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 HUSB @I2@\n0 @I2@ INDI\n0 TRLR\n').code).toBe('structure.unknown-tag');
  });

  test('accepts extension tags anywhere', () => {
    const dataset = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 _CUSTOM value\n0 @I1@ INDI\n1 _FLAG yes\n2 _DEEP x\n0 TRLR\n');
    expect(dataset.header.extensions?.[0]?.tag).toBe('_CUSTOM');
    expect(dataset.header.extensions?.[0]?.payload).toBe('value');
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.extensions?.[0]?.tag).toBe('_FLAG');
    expect(indi.extensions?.[0]?.children[0]?.tag).toBe('_DEEP');
  });

  test('rejects cardinality violations', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 SEX M\n1 SEX F\n0 TRLR\n').code).toBe('structure.cardinality');
  });

  test('rejects dangling pointers', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 FAMS @F9@\n0 TRLR\n').code).toBe('document.xref-not-found');
  });

  test('accepts the void pointer in 7.0', () => {
    const dataset = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 ASSO @VOID@\n2 PHRASE Mr Stockdale\n2 ROLE OTHER\n3 PHRASE Teacher\n0 TRLR\n');
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.associations?.[0]?.individual).toBe('@VOID@');
    expect(indi.associations?.[0]?.role?.payload).toBe('OTHER');
  });

  test('rejects missing required substructures', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 EVEN\n0 TRLR\n').code).toBe('structure.missing-required');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 ASSO @I2@\n0 @I2@ INDI\n0 TRLR\n').code).toBe('structure.missing-required');
  });

  test('parses NO and all individual events with their FAMC rules', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NO MARR',
        '2 DATE TO 1880',
        '1 ADOP',
        '2 FAMC @F1@',
        '3 ADOP BOTH',
        '1 BIRT',
        '2 FAMC @F1@',
        '1 EVEN Custom event',
        '2 TYPE Custom',
        '0 @F1@ FAM',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.nonEvents?.[0]?.payload).toBe('MARR');
    expect(indi.nonEvents?.[0]?.date?.value).toEqual({ kind: 'period', to: { kind: 'date', year: 1880, calendar: 'GREGORIAN' } });
    const adop = indi.events?.find((event) => event.tag === 'ADOP');
    expect(adop?.adoptionFamily?.adoption?.payload).toBe('BOTH');
    const birt = indi.events?.find((event) => event.tag === 'BIRT');
    expect(birt?.familyChild).toBe('@F1@');
    const even = indi.events?.find((event) => event.tag === 'EVEN');
    expect(even?.payload).toBe('Custom event');
    expect(even?.type).toBe('Custom');
  });

  test('parses LDS ordinances with statuses', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 BAPL',
        '2 DATE 1 JAN 1990',
        '2 TEMP Salt Lake Temple',
        '2 STAT COMPLETED',
        '3 DATE 2 JAN 2020',
        '4 TIME 12:00Z',
        '1 SLGC',
        '2 FAMC @F1@',
        '0 @F1@ FAM',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const ordinance = indi.ordinances?.[0];
    expect(ordinance?.tag).toBe('BAPL');
    expect(ordinance?.detail?.temple).toBe('Salt Lake Temple');
    expect(ordinance?.detail?.status?.payload).toBe('COMPLETED');
    expect(ordinance?.detail?.status?.date.value).toEqual({ day: 2, month: 'JAN', year: 2020 });
    expect(ordinance?.detail?.status?.date.time).toEqual({ hour: 12, minute: 0, utc: true });
    expect(indi.ordinances?.[1]?.familyChild).toBe('@F1@');
  });

  test('parses source citations with data and events', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NAME Mary //',
        '2 SOUR @S1@',
        '3 PAGE Film: 1, Frame: 2',
        '3 DATA',
        '4 DATE 12 MAR 1900',
        '4 TEXT Birth entry',
        '5 MIME text/plain',
        '3 EVEN BIRT',
        '4 ROLE MOTH',
        '3 QUAY 2',
        '0 @S1@ SOUR',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const citation = indi.names?.[0]?.citations?.[0];
    expect(citation?.source).toBe('@S1@');
    expect(citation?.page).toBe('Film: 1, Frame: 2');
    expect(citation?.data?.date?.value).toEqual({ kind: 'date', day: 12, month: 'MAR', year: 1900, calendar: 'GREGORIAN' });
    expect(citation?.data?.texts?.[0]?.payload).toBe('Birth entry');
    expect(citation?.event?.payload).toBe('BIRT');
    expect(citation?.event?.role?.payload).toBe('MOTH');
    expect(citation?.quality).toBe('2');
  });

  test('parses MAP coordinates and CROP', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 PLAC Cove, Utah',
        '3 MAP',
        '4 LATI N41.501',
        '4 LONG W111.992',
        '2 OBJE @O1@',
        '3 CROP',
        '4 TOP 10',
        '4 LEFT 20',
        '4 HEIGHT 100',
        '4 WIDTH 200',
        '3 TITL Zoom',
        '0 @O1@ OBJE',
        '1 FILE x.jpg',
        '2 FORM image/jpeg',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'BIRT') {
      throw new Error('expected BIRT');
    }
    expect(indi.events[0].detail?.place?.map?.latitude).toEqual({ direction: 'N', degrees: 41.501 });
    expect(indi.events[0].detail?.place?.map?.longitude).toEqual({ direction: 'W', degrees: 111.992 });
    expect(indi.events[0].detail?.media?.[0]?.crop).toEqual({ top: 10, left: 20, height: 100, width: 200 });
    expect(indi.events[0].detail?.media?.[0]?.title).toBe('Zoom');
  });
});

describe('parseGedcom70 — empty AGE payload', () => {
  test('parses an AGE with no payload and a PHRASE', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 DEAT Y',
        '2 AGE',
        '3 PHRASE very old',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'DEAT') {
      throw new Error('expected DEAT');
    }
    expect(indi.events[0].detail?.age?.payload).toBeUndefined();
    expect(indi.events[0].detail?.age?.phrase).toBe('very old');
  });
});

describe('parseGedcom70 — payload-less RESI attributes', () => {
  test('parses an INDI.RESI without a payload', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NAME Jane /Doe/',
        '1 RESI',
        '2 PLAC Paris, France',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.attributes?.[0]?.tag).toBe('RESI');
    expect(indi.attributes?.[0]).not.toHaveProperty('payload');
    expect(indi.attributes?.[0]?.detail?.place?.payload).toEqual(['Paris', 'France']);
  });

  test('parses a FAM.RESI without a payload', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @F1@ FAM',
        '1 RESI',
        '2 PLAC Paris, France',
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records[0];
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.attributes?.[0]?.tag).toBe('RESI');
    expect(fam.attributes?.[0]).not.toHaveProperty('payload');
    expect(fam.attributes?.[0]?.detail?.detail?.place?.payload).toEqual(['Paris', 'France']);
  });
});
