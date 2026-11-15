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

describe('address and submitter emission', () => {
  test('7.0 address fields round-trip', () => {
    const dataset = parse70(
      [
        ...H70,
        '0 @S1@ SUBM',
        '1 NAME T',
        '1 ADDR Main St',
        '2 ADR1 1 Main St',
        '2 ADR2 F2',
        '2 ADR3 S3',
        '2 CITY Berlin',
        '2 STAE BE',
        '2 POST 10115',
        '2 CTRY DE',
        '2 _PRIV Y',
        '2 _NAME Office',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 ADDR Main St');
    expect(text).toContain('2 ADR1 1 Main St');
    expect(text).toContain('2 ADR2 F2');
    expect(text).toContain('2 ADR3 S3');
    expect(text).toContain('2 CITY Berlin');
    expect(text).toContain('2 STAE BE');
    expect(text).toContain('2 POST 10115');
    expect(text).toContain('2 CTRY DE');
    expect(text).toContain('2 _PRIV Y');
    expect(text).toContain('2 _NAME Office');
  });

  test('5.5.1 address writes the contacts as siblings of ADDR', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S1@ SUBM',
        '1 NAME T',
        '1 ADDR x',
        '2 PHON 1',
        '2 EMAIL a@@b.example',
        '2 FAX 2',
        '2 WWW https://w.example',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    // The 5.5.1 ADDRESS_STRUCTURE puts the contacts at the structure
    // level — siblings of ADDR, not children (GEDCOM 5.5.1 §2 p.31).
    expect(text).toContain('1 PHON 1');
    expect(text).toContain('1 EMAIL a@@b.example');
    expect(text).toContain('1 FAX 2');
    expect(text).toContain('1 WWW https://w.example');
    expect(text).not.toContain('2 PHON');
  });

  test('7.0 submitter relocates address contacts to the record level', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S1@ SUBM',
        '1 NAME T',
        '1 ADDR x',
        '2 PHON 1',
        '2 EMAIL a@@b.example',
        '2 FAX 2',
        '2 WWW https://w.example',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('1 PHON 1');
    expect(text).toContain('1 EMAIL a@b.example');
    expect(text).toContain('1 FAX 2');
    expect(text).toContain('1 WWW https://w.example');
    // The contacts no longer live under ADDR.
    expect(text).not.toContain('2 PHON');
  });
});

describe('association emission', () => {
  test('5.5.1 association with a relationship and details', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @I2@ INDI',
        '1 NAME X',
        '0 @I1@ INDI',
        '1 ASSO @I2@',
        '2 RELA Godfather',
        '2 PHRASE at the baptism',
        '2 NOTE a note',
        '2 SOUR @S2@',
        '0 @S2@ SOUR',
        '1 TITL S',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 ASSO @I2@');
    expect(text).toContain('2 RELA Godfather');
    // 5.5.1 has no PHRASE under ASSO (ASSOCIATION_STRUCTURE, GEDCOM
    // 5.5.1 §2 p.31); the phrase is dropped on 5.5.1 output.
    expect(text).not.toContain('PHRASE');
    expect(text).toContain('2 NOTE a note');
    expect(text).toContain('2 SOUR @S2@');
  });

  test('an association without role or relationship is dropped', () => {
    const dataset = parse70(H70.concat('0 @I2@ INDI', '1 NAME X', '0 TRLR').join('\n'));
    dataset.records.push({
      tag: 'INDI',
      xref: '@I1@',
      associations: [{ tag: 'ASSO', individual: '@I2@' }],
    } as never);
    const text = ser70(dataset);
    expect(text).not.toContain('ASSO');
  });

  test('7.0 association derives an OTHER role from a 5.5.1 RELA', () => {
    const dataset = parse551(
      [...H551, '0 @I2@ INDI', '1 NAME X', '0 @I1@ INDI', '1 ASSO @I2@', '2 RELA Godfather', ...SUBM, '0 TRLR'].join(
        '\n',
      ),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 ROLE OTHER');
    expect(text).toContain('3 PHRASE Godfather');
  });
});

describe('age emission', () => {
  test('5.5.1 age keywords project onto 7.0 bounds', () => {
    const dataset = parse551([...H551, '0 @I1@ INDI', '1 BIRT', '2 AGE CHILD', ...SUBM, '0 TRLR'].join('\n'));
    const text = ser70(dataset);
    expect(text).toContain('2 AGE < 8y');
    expect(text).toContain('3 PHRASE CHILD');
  });

  test('a weeks-only age is dropped in 5.5.1', () => {
    const dataset = parse70(H70.concat('0 @I1@ INDI', '1 BIRT', '2 AGE 3w', '0 TRLR').join('\n'));
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).not.toContain('2 AGE');
  });

  test('an empty 7.0 AGE with a PHRASE round-trips', () => {
    const dataset = parse70(H70.concat('0 @I1@ INDI', '1 DEAT Y', '2 AGE', '3 PHRASE very old', '0 TRLR').join('\n'));
    const text = ser70(dataset);
    expect(text).toContain('2 AGE');
    expect(text).toContain('3 PHRASE very old');
    const reparsed = parse70(text);
    const indi = reparsed.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'DEAT') {
      throw new Error('expected DEAT');
    }
    expect(indi.events[0].detail?.age?.payload).toBeUndefined();
    expect(indi.events[0].detail?.age?.phrase).toBe('very old');
  });
});

describe('dates, sort dates and event details', () => {
  test('a phrase-only sort date becomes a parenthesized _SDATE in 5.5.1', () => {
    const dataset = parse70(H70.concat('0 @I1@ INDI', '1 BIRT', '2 SDATE', '3 PHRASE sometime', '0 TRLR').join('\n'));
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).toContain('2 _SDATE (sometime)');
  });

  test('7.0 SDATE keeps TIME and PHRASE', () => {
    const dataset = parse70(
      H70.concat('0 @I1@ INDI', '1 BIRT', '2 SDATE 1900', '3 TIME 10:30', '3 PHRASE computed', '0 TRLR').join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 SDATE 1900');
    expect(text).toContain('3 TIME 10:30');
    expect(text).toContain('3 PHRASE computed');
  });

  test('unique ids spell UID in 7.0 and _UID in 5.5.1', () => {
    const dataset = parse70(H70.concat('0 @I1@ INDI', '1 BIRT', '2 UID 550e', '0 TRLR').join('\n'));
    expect(ser70(dataset)).toContain('2 UID 550e');
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    expect(ser551(dataset)).toContain('2 _UID 550e');
  });

  test('additional places, godparents, witnesses and associations round-trip', () => {
    const dataset = parse70(
      H70.concat(
        '0 @I2@ INDI',
        '1 NAME X',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 _PLAC Second',
        '2 _GODP The Godfather',
        '2 _WITN A Witness',
        '2 ASSO @I2@',
        '3 ROLE WITN',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 _PLAC Second');
    expect(text).toContain('2 _GODP The Godfather');
    expect(text).toContain('2 _WITN A Witness');
    expect(text).toContain('2 ASSO @I2@');
  });

  test('5.5.1 spellings for associations, godparents and witnesses', () => {
    const dataset = parse70(
      H70.concat(
        '0 @I2@ INDI',
        '1 NAME X',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 _GODP The Godfather',
        '2 _WITN A Witness',
        '2 ASSO @I2@',
        '3 ROLE WITN',
        '0 TRLR',
      ).join('\n'),
    );
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).toContain('2 _GODP The Godfather');
    expect(text).toContain('2 _WITN A Witness');
    expect(text).toContain('2 _SHAR @I2@');
    expect(text).toContain('3 _ROLE Witness');
  });

  test('a 5.5.1 French Republican date round-trips', () => {
    const dataset = parse551(
      [...H551, '0 @I1@ INDI', '1 BIRT', '2 DATE @#DFRENCH R@ 8 VEND 8', ...SUBM, '0 TRLR'].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 DATE @#DFRENCH R@ 8 VEND 8');
    parse551(text); // must re-parse without error
  });

  test('a 5.5.1 payload-less INDI.RESI round-trips', () => {
    const dataset = parse551(
      [...H551, '0 @I1@ INDI', '1 NAME Jane /Doe/', '1 RESI', '2 PLAC Paris, France', ...SUBM, '0 TRLR'].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 RESI');
    expect(text).toContain('2 PLAC Paris, France');
    const reparsed = parse551(text);
    const indi = reparsed.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.attributes?.[0]?.tag).toBe('RESI');
    expect(indi.attributes?.[0]).not.toHaveProperty('payload');
    // The 7.0 export writes an empty-Text RESI, which the 7.0 parser
    // must accept back (a missing payload is the empty string).
    const via70 = parse70(ser70(dataset));
    const indi70 = via70.records[0];
    if (indi70?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi70.attributes?.[0]?.tag).toBe('RESI');
    expect(indi70.attributes?.[0]).not.toHaveProperty('payload');
  });
});

describe('source citations', () => {
  test('5.5.1 free-text citation with data, media, notes and quality', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR some book',
        '3 TEXT an excerpt',
        '3 OBJE @O1@',
        '3 NOTE a note',
        '3 QUAY 2',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 SOUR some book');
    expect(text).toContain('3 TEXT an excerpt');
    expect(text).toContain('3 OBJE @O1@');
    expect(text).toContain('3 NOTE a note');
    expect(text).toContain('3 QUAY 2');
  });

  test('a 5.5.1 void citation without a description is dropped', () => {
    const dataset = parse70(H70.concat('0 @I1@ INDI', '1 BIRT', '2 SOUR @VOID@', '0 TRLR').join('\n'));
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).not.toContain('2 SOUR');
  });

  test('5.5.1 citation event roles', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S2@',
        '3 EVEN BIRT',
        '4 ROLE CHIL',
        '2 SOUR @S2@',
        '3 EVEN BIRT',
        '4 ROLE (the witness)',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('4 ROLE CHIL');
    expect(text).toContain('4 ROLE (the witness)');
  });

  test('7.0 void citation keeps the description as PAGE', () => {
    const dataset = parse551([...H551, '0 @I1@ INDI', '1 BIRT', '2 SOUR free text', ...SUBM, '0 TRLR'].join('\n'));
    const text = ser70(dataset);
    expect(text).toContain('2 SOUR @VOID@');
    expect(text).toContain('3 PAGE free text');
  });
});

describe('media links', () => {
  test('7.0 OBJE link keeps CROP, TITL and the vendor flags', () => {
    const dataset = parse70(
      H70.concat(
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM image/jpeg',
        '0 @I1@ INDI',
        '1 OBJE @O1@',
        '2 CROP',
        '3 TOP 1',
        '3 LEFT 2',
        '3 HEIGHT 100',
        '3 WIDTH 200',
        '2 TITL the crop',
        '2 _PRIM Y',
        '2 _SCBK Y',
        '2 _SSHOW Y',
        '0 TRLR',
      ).join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 CROP');
    expect(text).toContain('3 TOP 1');
    expect(text).toContain('3 LEFT 2');
    expect(text).toContain('3 HEIGHT 100');
    expect(text).toContain('3 WIDTH 200');
    expect(text).toContain('2 TITL the crop');
    expect(text).toContain('2 _PRIM Y');
    expect(text).toContain('2 _SCBK Y');
    expect(text).toContain('2 _SSHOW Y');
  });

  test('7.0 FORM MEDI with a phrase round-trips', () => {
    const dataset = parse70(
      H70.concat('0 @O1@ OBJE', '1 FILE a.jpg', '2 FORM image/jpeg', '3 MEDI PHOTO', '4 PHRASE A photo', '0 TRLR').join(
        '\n',
      ),
    );
    const text = ser70(dataset);
    expect(text).toContain('3 MEDI PHOTO');
    expect(text).toContain('4 PHRASE A photo');
  });

  test('5.5.1 media format maps back and TYPE is lowercase', () => {
    const dataset = parse551(
      [...H551, '0 @O1@ OBJE', '1 FILE a.jpg', '2 FORM jpg', '3 TYPE PHOTO', ...SUBM, '0 TRLR'].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 FORM jpg');
    expect(text).toContain('3 TYPE photo');
  });

  test('a 5.5.1 inline OBJE spelling the medium MEDI normalizes to TYPE', () => {
    const dataset = parse551(
      [...H551, '0 @I1@ INDI', '1 OBJE', '2 FILE photo.jpg', '3 FORM jpg', '4 MEDI photo', ...SUBM, '0 TRLR'].join(
        '\n',
      ),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 FORM jpg');
    expect(text).toContain('3 TYPE photo');
    parse551(text); // must re-parse without error
  });
});

describe('header and submission emission', () => {
  test('7.0 writes the header SUBM pointer', () => {
    const dataset = parse70([...H70, '1 SUBM @S1@', ...SUBM, '0 TRLR'].join('\n'));
    const text = ser70(dataset);
    expect(text).toContain('1 SUBM @S1@');
    const reparsed = parse70(text);
    expect(reparsed.header.submitter).toBe('@S1@');
  });

  test('a 5.5.1 HEAD.DATE with TIME round-trips', () => {
    const dataset = parse551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 DATE 12 FEB 2020',
        '2 TIME 10:30',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 DATE 12 FEB 2020');
    expect(text).toContain('2 TIME 10:30');
    parse551(text); // must re-parse without error
  });

  test('7.0 header source corporation and data', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SOUR MyApp',
        '2 VERS 1.0',
        '2 NAME My Application',
        '2 CORP The Corp',
        '3 ADDR Main St',
        '3 PHON 1',
        '3 EMAIL a@example.com',
        '2 DATA the data',
        '3 DATE 1 JAN 2000',
        '3 COPR (c) 2000',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 VERS 1.0');
    expect(text).toContain('2 NAME My Application');
    expect(text).toContain('2 CORP The Corp');
    expect(text).toContain('3 ADDR Main St');
    expect(text).toContain('3 PHON 1');
    expect(text).toContain('3 EMAIL a@example.com');
    expect(text).toContain('2 DATA the data');
    expect(text).toContain('3 DATE 1 JAN 2000');
    expect(text).toContain('3 COPR (c) 2000');
  });

  test('5.5.1 header extras and submission record', () => {
    const dataset = parse551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 SUBN @N1@',
        '1 FILE family.ged',
        '1 COPR (c) 2000',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @N1@ SUBN',
        '1 SUBM @S1@',
        '1 FAMF My Family',
        '1 TEMP SLAKE',
        '1 ANCE 10',
        '1 DESC 3',
        '1 ORDI yes',
        '1 RIN 7',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 SUBN @N1@');
    expect(text).toContain('1 FILE family.ged');
    expect(text).toContain('1 COPR (c) 2000');
    expect(text).toContain('0 @N1@ SUBN');
    expect(text).toContain('1 FAMF My Family');
    expect(text).toContain('1 TEMP SLAKE');
    expect(text).toContain('1 ANCE 10');
    expect(text).toContain('1 DESC 3');
    expect(text).toContain('1 ORDI yes');
    expect(text).toContain('1 RIN 7');
  });

  test('a stray SUBN record is dropped in 7.0', () => {
    const dataset = parse70(H70.concat('0 TRLR').join('\n'));
    dataset.records.push({ tag: 'SUBN' });
    expect(ser70(dataset)).not.toContain('SUBN');
  });

  test('the 5.5.1 header reuses an existing submitter record', () => {
    const dataset = parse70(H70.concat('0 @S1@ SUBM', '1 NAME T', '0 TRLR').join('\n'));
    dataset.header.gedcom.form = 'LINEAGE-LINKED';
    dataset.header.gedcom.version = '5.5.1';
    const text = ser551(dataset);
    expect(text).toContain('1 SUBM @S1@');
    expect(text).not.toContain('_SYNSUB');
  });
});
