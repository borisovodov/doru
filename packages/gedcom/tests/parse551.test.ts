import { describe, expect, test } from 'vitest';
import { parseGedcom551 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err551(text: string): string {
  const result = parseGedcom551(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

const HEADER = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('parseGedcom551 — header', () => {
  test('parses a minimal 5.5.1 header', () => {
    const dataset = parse551([...HEADER, ...SUBM, '0 TRLR'].join('\n'));
    expect(dataset.header.source?.payload).toBe('PAF');
    expect(dataset.header.submitter).toBe('@S1@');
    expect(dataset.header.gedcom.version).toBe('5.5.1');
    expect(dataset.header.gedcom.form).toBe('LINEAGE-LINKED');
    expect(dataset.header.characterSet?.payload).toBe('UTF-8');
  });

  test('requires SOUR, SUBM and CHAR', () => {
    expect(err551('0 HEAD\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR ANSEL\n0 @S1@ SUBM\n1 NAME X\n0 TRLR\n')).toBe(
      'structure.missing-required',
    );
    expect(err551('0 HEAD\n1 SOUR PAF\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR ANSEL\n0 TRLR\n')).toBe(
      'structure.missing-required',
    );
    expect(err551('0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n0 @S1@ SUBM\n1 NAME X\n0 TRLR\n')).toBe(
      'decoding.missing-charset',
    );
  });

  test('rejects a 7.x version', () => {
    expect(
      err551('0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 7.0\n2 FORM LINEAGE-LINKED\n1 CHAR ANSEL\n0 @S1@ SUBM\n1 NAME X\n0 TRLR\n'),
    ).toBe('document.wrong-version');
  });

  test('rejects a SOUR id with spaces', () => {
    expect(
      err551('0 HEAD\n1 SOUR My App\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR ANSEL\n0 @S1@ SUBM\n1 NAME X\n0 TRLR\n'),
    ).toBe('enum.invalid-value');
  });

  test('validates the GEDCOM form', () => {
    expect(
      err551('0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM OTHER-FORM\n1 CHAR ANSEL\n0 @S1@ SUBM\n1 NAME X\n0 TRLR\n'),
    ).toBe('enum.invalid-value');
  });

  test('parses SUBN, FILE, LANG and PLAC', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '1 SUBN @N1@',
        '1 FILE family.ged',
        '1 LANG Russian',
        '1 PLAC',
        '2 FORM City, County, Country',
        '0 @N1@ SUBN',
        '1 FAMF My Family',
        '1 TEMP SLAKE',
        '1 ANCE 10',
        '1 DESC 3',
        '1 ORDI yes',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    expect(dataset.header.submission).toBe('@N1@');
    expect(dataset.header.fileName).toBe('family.ged');
    expect(dataset.header.language).toBe('Russian');
    expect(dataset.header.place?.form).toEqual(['City', 'County', 'Country']);
    expect(dataset.submission?.familyFile).toBe('My Family');
    expect(dataset.submission?.temple).toBe('SLAKE');
    expect(dataset.submission?.generationsOfAncestors).toBe(10);
    expect(dataset.submission?.generationsOfDescendants).toBe(3);
    expect(dataset.submission?.ordinanceProcessFlag).toBe('yes');
  });

  test('rejects a SUBN record not directly after the header', () => {
    expect(err551([...HEADER, ...SUBM, '0 @N1@ SUBN', '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
  });
});

describe('parseGedcom551 — records and 5.5.1-only fields', () => {
  test('parses INDI with RIN, RFN, AFN and lowercase enums', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @I1@ INDI',
        '1 RESN privacy',
        '1 NAME Ivan /Ivanov/',
        '2 TYPE maiden',
        '1 SEX M',
        '1 BIRT',
        '2 DATE 12 MAR 1923',
        '2 PLAC Moscow',
        '1 FAMC @F1@',
        '2 PEDI birth',
        '2 STAT proven',
        '1 RFN 123:456',
        '1 AFN 9ABC-1234',
        '1 RIN 42',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.restriction).toEqual(['PRIVACY']);
    expect(indi.names?.[0]?.payload).toEqual({ given: 'Ivan', surname: 'Ivanov' });
    expect(indi.names?.[0]?.type?.payload).toBe('MAIDEN');
    expect(indi.recordFileNumber).toBe('123:456');
    expect(indi.ancestralFileNumber).toBe('9ABC-1234');
    expect(indi.automatedRecordId).toBe('42');
    expect(indi.childFamilies?.[0]?.pedigree?.payload).toBe('BIRTH');
    expect(indi.childFamilies?.[0]?.status?.payload).toBe('PROVEN');
  });

  test('parses NOTE records and NOTE pointers', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @N1@ NOTE This is shared',
        '1 REFN n1',
        '0 @I1@ INDI',
        '1 NOTE @N1@',
        '1 NOTE inline text',
        '2 CONT second line',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const noteRecord = dataset.records[0];
    if (noteRecord?.tag !== 'NOTE') {
      throw new Error('expected NOTE record');
    }
    expect(noteRecord.payload).toBe('This is shared');
    const indi = dataset.records[1];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const pointer = indi.notes?.[0];
    if (pointer?.tag !== 'NOTE') {
      throw new Error('expected NOTE');
    }
    expect('note' in pointer && pointer.note).toBe('@N1@');
    const inline = indi.notes?.[1];
    if (inline?.tag !== 'NOTE' || 'note' in inline) {
      throw new Error('expected inline NOTE');
    }
    expect(inline.payload).toBe('inline text\nsecond line');
  });

  test('parses FONE/ROMN name variations with pieces', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @I1@ INDI',
        '1 NAME /孔/德庸',
        '2 ROMN /Kǒng/ Déyōng',
        '3 TYPE pinyin',
        '3 SURN Kǒng',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const variation = indi.names?.[0]?.romanized;
    expect(indi.names?.[0]?.phonetic).toBeUndefined();
    expect(indi.names?.[0]?.romanized?.[0]?.type).toBe('pinyin');
    expect(indi.names?.[0]?.romanized?.[0]?.payload).toEqual({ surname: 'Kǒng', suffix: 'Déyōng' });
    expect(indi.names?.[0]?.romanized?.[0]?.pieces?.surnames).toEqual(['Kǒng']);
  });

  test('parses ASSO with RELA', () => {
    const dataset = parse551(
      [...HEADER, '0 @I1@ INDI', '1 ASSO @I2@', '2 RELA Godfather', '0 @I2@ INDI', ...SUBM, '0 TRLR'].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.associations?.[0]?.individual).toBe('@I2@');
    expect(indi.associations?.[0]?.relationship).toBe('Godfather');
    expect(indi.associations?.[0]?.role).toBeUndefined();
  });

  test('parses the free-text SOUR citation form', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR Waters, Genealogical Gleanings',
        '3 TEXT vol 2, page 388',
        '3 QUAY 2',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'BIRT') {
      throw new Error('expected BIRT');
    }
    const citation = indi.events[0].detail?.citations?.[0];
    expect(citation?.source).toBe('@VOID@');
    expect(citation?.description).toBe('Waters, Genealogical Gleanings');
    expect(citation?.data?.texts?.[0]?.payload).toBe('vol 2, page 388');
    expect(citation?.quality).toBe('2');
  });

  test('synthesizes a record for an inline OBJE', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @I1@ INDI',
        '1 BIRT',
        '2 OBJE',
        '3 FILE media/photo.jpg',
        '4 FORM jpg',
        '5 TYPE photo',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'BIRT') {
      throw new Error('expected BIRT');
    }
    const link = indi.events[0].detail?.media?.[0];
    expect(link?.object).toMatch(/^@_SYNO\d+@$/);
    const synthetic = dataset.records.find((record) => record.tag === 'OBJE');
    expect(synthetic?.tag).toBe('OBJE');
    if (synthetic?.tag === 'OBJE') {
      expect(synthetic.files[0]?.payload).toBe('media/photo.jpg');
      expect(synthetic.files[0]?.form.payload).toBe('jpg');
      expect(synthetic.files[0]?.form.medium?.payload).toBe('PHOTO');
    }
  });

  test('parses age keywords and B.C./calendar escapes', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @I1@ INDI',
        '1 DEAT',
        '2 DATE 13 MAY 1984',
        '2 AGE STILLBORN',
        '1 BIRT',
        '2 DATE @#DHEBREW@ 1 TSH 5750',
        '1 BAPM',
        '2 DATE 44 B.C.',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const death = indi.events?.find((event) => event.tag === 'DEAT');
    expect(death?.detail?.age?.payload).toEqual({ description: 'STILLBORN' });
    const birth = indi.events?.find((event) => event.tag === 'BIRT');
    expect(birth?.detail?.date?.value).toEqual({
      kind: 'date',
      calendar: 'HEBREW',
      day: 1,
      month: 'TSH',
      year: 5750,
    });
    const baptism = indi.events?.find((event) => event.tag === 'BAPM');
    expect(baptism?.detail?.date?.value).toEqual({
      kind: 'date',
      year: 44,
      epoch: 'BCE',
      calendar: 'GREGORIAN',
    });
  });

  test('parses INT dates and phrase-only dates into the phrase', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @I1@ INDI',
        '1 BIRT',
        '2 DATE INT 1 JAN 1900 (calculated)',
        '1 DEAT',
        '2 DATE (unknown)',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const birth = indi.events?.find((event) => event.tag === 'BIRT');
    expect(birth?.detail?.date?.value).toEqual({ kind: 'date', day: 1, month: 'JAN', year: 1900, calendar: 'GREGORIAN' });
    expect(birth?.detail?.date?.phrase).toBe('calculated');
    const death = indi.events?.find((event) => event.tag === 'DEAT');
    expect(death?.detail?.date?.value).toEqual({ kind: 'unknown' });
    expect(death?.detail?.date?.phrase).toBe('unknown');
  });

  test('normalizes the dual-year form into the phrase', () => {
    const dataset = parse551(
      [...HEADER, '0 @I1@ INDI', '1 BIRT', '2 DATE 30 JAN 1648/49', ...SUBM, '0 TRLR'].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'BIRT') {
      throw new Error('expected BIRT');
    }
    expect(indi.events[0].detail?.date?.value).toEqual({
      kind: 'date',
      day: 30,
      month: 'JAN',
      year: 1649,
      calendar: 'GREGORIAN',
    });
    expect(indi.events[0].detail?.date?.phrase).toBe('30 JAN 1648/49');
  });

  test('parses RESI as a family attribute with no payload', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 RESI',
        '2 DATE 1900',
        '1 MARR Y',
        '0 @I1@ INDI',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records[0];
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    const residence = fam.attributes?.[0];
    expect(residence?.tag).toBe('RESI');
    expect(residence?.payload).toBeUndefined();
    expect(residence?.detail?.detail?.date?.value).toEqual({ kind: 'date', year: 1900, calendar: 'GREGORIAN' });
    expect(fam.events?.[0]?.tag).toBe('MARR');
    expect(fam.events?.[0]?.payload).toBe(true);
  });

  test('parses LDS statuses with the 5.5.1 spellings', () => {
    const dataset = parse551(
      [
        ...HEADER,
        '0 @I1@ INDI',
        '1 BAPL',
        '2 STAT PRE-1970',
        '3 DATE 2 JAN 2000',
        '1 SLGC',
        '2 FAMC @F1@',
        '2 STAT BIC',
        '3 DATE 3 JAN 2000',
        '0 @F1@ FAM',
        '1 SLGS',
        '2 STAT DNS/CAN',
        '3 DATE 4 JAN 2000',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.ordinances?.[0]?.detail?.status?.payload).toBe('PRE_1970');
    expect(indi.ordinances?.[1]?.detail?.status?.payload).toBe('BIC');
    const fam = dataset.records[1];
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.spouseSealings?.[0]?.detail?.status?.payload).toBe('DNS_CAN');
  });
});

describe('parseGedcom551 — strictness', () => {
  test('rejects 7.0-only constructs', () => {
    expect(err551([...HEADER, ...SUBM, '0 @N1@ SNOTE text', '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
    expect(err551([...HEADER, '0 @I1@ INDI', '1 NO MARR', ...SUBM, '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
    expect(err551([...HEADER, '0 @I1@ INDI', '1 CREA', '2 DATE 1 JAN 2000', ...SUBM, '0 TRLR'].join('\n'))).toBe(
      'structure.unknown-tag',
    );
    expect(err551([...HEADER, '0 @I1@ INDI', '1 UID abc', ...SUBM, '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
    expect(err551([...HEADER, '0 @I1@ INDI', '1 INIL', ...SUBM, '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
    expect(err551([...HEADER, '0 @I1@ INDI', '1 SEX X', ...SUBM, '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
  });

  test('rejects a Y payload on 5.5.1 family events other than MARR', () => {
    expect(err551([...HEADER, '0 @F1@ FAM', '1 ANUL Y', ...SUBM, '0 TRLR'].join('\n'))).toBe(
      'structure.unexpected-payload',
    );
  });

  test('rejects a per-ordinance status mismatch', () => {
    expect(
      err551([...HEADER, '0 @I1@ INDI', '1 BAPL', '2 STAT BIC', '3 DATE 1 JAN 2000', ...SUBM, '0 TRLR'].join('\n')),
    ).toBe('enum.invalid-value');
  });

  test('rejects unknown 5.5.1 media formats and languages', () => {
    expect(
      err551([...HEADER, '0 @O1@ OBJE', '1 FILE x.png', '2 FORM png', ...SUBM, '0 TRLR'].join('\n')),
    ).toBe('enum.invalid-value');
    expect(err551([...HEADER, '1 LANG Klingon', ...SUBM, '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
  });

  test('rejects commas in 5.5.1 names', () => {
    expect(err551([...HEADER, '0 @I1@ INDI', '1 NAME John, /Doe/', ...SUBM, '0 TRLR'].join('\n'))).toBe(
      'name.invalid',
    );
  });

  test('rejects reserved calendar escapes', () => {
    expect(
      err551([...HEADER, '0 @I1@ INDI', '1 BIRT', '2 DATE @#DROMAN@ 1 JAN 1900', ...SUBM, '0 TRLR'].join('\n')),
    ).toBe('date.reserved-calendar');
  });

  test('rejects the void pointer in 5.5.1 pointers', () => {
    expect(
      err551([...HEADER, '0 @I1@ INDI', '1 FAMS @VOID@', ...SUBM, '0 TRLR'].join('\n')),
    ).toBe('document.xref-not-found');
  });

  test('parses an empty REPO as the void pointer', () => {
    const dataset = parse551(
      [...HEADER, '0 @S2@ SOUR', '1 REPO', '2 NOTE Where it is stored', ...SUBM, '0 TRLR'].join('\n'),
    );
    const sour = dataset.records[0];
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.repositoryCitations?.[0]?.repository).toBe('@VOID@');
    expect(sour.repositoryCitations?.[0]?.notes?.[0]?.tag).toBe('NOTE');
  });

  test('parses an extension record and extension substructures', () => {
    const dataset = parse551(
      [...HEADER, '0 @L1@ _LOC', '1 NAME Byzantion', '2 _POP 15149358', ...SUBM, '0 TRLR'].join('\n'),
    );
    const ext = dataset.records[0];
    expect(ext?.tag).toBe('_LOC');
    if (ext?.tag === '_LOC') {
      expect(ext.children[0]?.tag).toBe('NAME');
      expect(ext.children[0]?.children[0]?.tag).toBe('_POP');
    }
  });
});
