import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import {
  serializeGedcom551,
  serializeGedcom551Bytes,
  serializeGedcom70,
  serializeGedcom70Bytes,
} from '../src/serialize/serialize';
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

function expectErr(result: { ok: boolean; error?: unknown }): string {
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
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

describe('serializeGedcom70', () => {
  test('emits a minimal document', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n');
    expect(ser70(dataset)).toBe('0 HEAD\r\n1 GEDC\r\n2 VERS 7.0\r\n0 TRLR\r\n');
  });

  test('escapes a leading at-sign in values', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 NOTE @@me and @I\n0 TRLR\n');
    const text = ser70(dataset);
    expect(text).toContain('1 NOTE @@me and @I');
    // And the round trip restores the single at-sign.
    expect(parseOk70(text).header.note?.payload).toBe('@me and @I');
  });

  test('splits multiline payloads with CONT', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 NOTE first\n2 CONT   second\n2 CONT\n2 CONT third\n0 TRLR\n');
    const text = ser70(dataset);
    expect(text).toContain('1 NOTE first');
    expect(text).toContain('2 CONT   second');
    expect(text).toContain('2 CONT');
    expect(text).toContain('2 CONT third');
  });

  test('round-trips an empty payload line', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 NOTE a\n2 CONT\n0 TRLR\n');
    const text = ser70(dataset);
    expect(parseOk70(text).header.note?.payload).toBe('a\n');
  });

  test('serializes dates with calendars and epochs', () => {
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 DATE HEBREW 1 TSH 5750',
        '1 DEAT',
        '2 DATE 44 BCE',
        '1 BURI',
        '2 DATE FROM 1900 TO JULIAN 1910',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).toContain('2 DATE HEBREW 1 TSH 5750');
    expect(text).toContain('2 DATE 44 BCE');
    expect(text).toContain('2 DATE FROM 1900 TO JULIAN 1910');
  });

  test('emits a phrase as PHRASE', () => {
    const dataset = parseOk70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE\n3 PHRASE 5 January (year unknown)\n0 TRLR\n',
    );
    const text = ser70(dataset);
    expect(text).toContain('2 DATE');
    expect(text).toContain('3 PHRASE 5 January (year unknown)');
  });

  test('projects 5.5.1-only constructs onto 7.0', () => {
    const dataset551 = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 SUBN',
        '1 SUBM @S1@',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @N1@ NOTE Hello',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 NICK Johnny',
        '2 NOTE piece note',
        '2 FONE Jo-han /Do-e/',
        '3 TYPE kana',
        '1 ASSO @I2@',
        '2 RELA Godfather',
        '1 RIN 42',
        '1 BIRT',
        '2 PLAC Rome',
        '2 ADDR Via Appia',
        '3 PHON +39 06 123',
        '0 @I2@ INDI',
        '1 NAME Jane /Roe/',
        '1 SOUR free text citation',
        '0 TRLR',
      ].join('\n'),
    );
    const result = serializeGedcom70(dataset551);
    expect(result.ok).toBe(true);
    const text = (result as { value: string }).value;
    // The NOTE record becomes a SNOTE record.
    expect(text).toContain('0 @N1@ SNOTE Hello');
    // The SUBN is dropped.
    expect(text).not.toContain('SUBN');
    // The RIN is dropped.
    expect(text).not.toContain('RIN');
    // The RELA descriptor becomes an OTHER role with a PHRASE.
    expect(text).toContain('2 ROLE OTHER');
    expect(text).toContain('3 PHRASE Godfather');
    // The FONE variation becomes a TRAN with a language.
    expect(text).toContain('2 TRAN Jo-han/Do-e/');
    expect(text).toContain('3 LANG ja-Kana');
    // The piece-level NOTE is dropped.
    expect(text).not.toContain('piece note');
    // The contacts inside ADDR are relocated to the event detail level.
    expect(text).toContain('2 PHON +39 06 123');
    // The free-text SOUR becomes a void pointer with the text as PAGE.
    expect(text).toContain('1 SOUR @VOID@');
    expect(text).toContain('2 PAGE free text citation');
  });
});

describe('serializeGedcom551', () => {
  const minimal551 = (): GedcomDataset =>
    parseOk551(
      ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME T', '0 TRLR'].join('\n'),
    );

  test('emits a minimal 5.5.1 document', () => {
    const text = ser551(minimal551());
    expect(text).toBe(
      '0 HEAD\r\n1 SOUR PAF\r\n1 SUBM @S1@\r\n1 GEDC\r\n2 VERS 5.5.1\r\n2 FORM LINEAGE-LINKED\r\n1 CHAR UTF-8\r\n0 @S1@ SUBM\r\n1 NAME T\r\n0 TRLR\r\n',
    );
  });

  test('spells enums lowercase per 5.5.1', () => {
    const dataset = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @I1@ INDI',
        '1 RESN privacy',
        '1 FAMC @F1@',
        '2 PEDI birth',
        '2 STAT proven',
        '1 NAME John /Doe/',
        '2 TYPE maiden',
        '0 @F1@ FAM',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('1 RESN privacy');
    expect(text).toContain('2 PEDI birth');
    expect(text).toContain('2 STAT proven');
    expect(text).toContain('2 TYPE maiden');
  });

  test('doubles at-signs and splits long lines with CONC', () => {
    const longText = 'a'.repeat(260) + '@b';
    const dataset = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @N1@ NOTE ' + 'x'.repeat(300),
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    );
    void longText;
    const text = ser551(dataset);
    const lines = text.split('\r\n');
    const noteLine = lines.find((line) => line.startsWith('0 @N1@ NOTE'));
    const concLines = lines.filter((line) => line.startsWith('1 CONC'));
    expect(noteLine?.length).toBeLessThanOrEqual(255);
    expect(concLines.length).toBeGreaterThan(0);
    for (const line of [...lines]) {
      expect(line.length).toBeLessThanOrEqual(255);
    }
  });

  test('maps BCP 47 languages to the 5.5.1 table', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 LANG ru\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n');
    // 5.5.1 export requires SOUR/SUBM/CHAR/FORM; build them up.
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    const text = ser551(dataset);
    expect(text).toContain('1 LANG Russian');
  });

  test('maps media types to the 5.5.1 format set', () => {
    const dataset = parseOk70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @O1@ OBJE\n1 FILE x.jpg\n2 FORM image/jpeg\n0 TRLR\n',
    );
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).toContain('2 FORM jpg');
  });

  test('emits calendar escapes and B.C.', () => {
    const dataset = parseOk70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE HEBREW 1 TSH 5750\n1 DEAT\n2 DATE 44 BCE\n0 TRLR\n',
    );
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).toContain('2 DATE @#DHEBREW@ 1 TSH 5750');
    expect(text).toContain('2 DATE 44 B.C.');
  });

  test('emits a phrase as a subordinate NOTE', () => {
    const dataset = parseOk70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 BIRT\n2 DATE 1 JAN 1900\n3 PHRASE calculated\n0 TRLR\n',
    );
    const header = dataset.header;
    header.source = { payload: 'MyApp' };
    header.submitter = '@S1@';
    header.gedcom.form = 'LINEAGE-LINKED';
    header.gedcom.version = '5.5.1';
    dataset.records.push({ tag: 'SUBM', name: 'T' });
    const text = ser551(dataset);
    expect(text).toContain('2 DATE 1 JAN 1900');
    expect(text).toContain('3 NOTE calculated');
  });

  test('emits the PRE-1970 and DNS/CAN spellings', () => {
    const dataset = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @I1@ INDI',
        '1 BAPL',
        '2 STAT PRE-1970',
        '3 DATE 1 JAN 2000',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    expect(text).toContain('2 STAT PRE-1970');
  });

  test('projects 7.0-only constructs onto 5.5.1', () => {
    const base = parseOk551(
      ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME T', '0 TRLR'].join('\n'),
    );
    const seven = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SCHMA',
        '2 TAG _CUST https://example.com/cust',
        '0 @N1@ SNOTE text',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 TRAN Johan /Doe/',
        '3 LANG ja-Latn',
        '1 SEX X',
        '1 ASSO @I2@',
        '2 ROLE FRIEND',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 NO MARR',
        '0 @I2@ INDI',
        '1 NAME Jane /Roe/',
        '1 FAMS @F1@',
        '1 NO DEAT',
        '0 @I3@ INDI',
        '1 NO BIRT',
        '0 TRLR',
      ].join('\n'),
    );
    base.records.push(...seven.records);
    const result = serializeGedcom551(base);
    expect(result.ok).toBe(true);
    const text = (result as { value: string }).value;
    // The SNOTE record becomes a NOTE record.
    expect(text).toContain('0 @N1@ NOTE text');
    // The TRAN becomes a ROMN variation.
    expect(text).toContain('2 ROMN Johan/Doe/');
    expect(text).toContain('3 TYPE romaji');
    // The ROLE FRIEND becomes the RELA descriptor.
    expect(text).toContain('2 RELA Friend');
    // SEX X is dropped.
    expect(text).not.toContain('SEX');
    // The NO rule: the bare FAM NO MARR survives as the Ahnenblatt
    // negative _MARR N (so the record and the FAMS pointer stay); the
    // bare INDI NO DEAT survives as _NLIV; everything else disappears.
    expect(text).toContain('1 _MARR N');
    expect(text).toContain('@F1@');
    expect(text).toContain('FAMS @F1@');
    expect(text).toContain('1 _NLIV');
    expect(text).not.toContain('NO ');
    // @I3@ only carried the negation and is dropped entirely.
    expect(text).not.toContain('@I3@');
    // The SCHMA header is dropped; the required SOUR/SUBM appear with
    // the defaults (the base header already has SOUR PAF and SUBM @S1@).
    expect(text).not.toContain('SCHMA');
    expect(text).toContain('1 SOUR PAF');
    expect(text).toContain('1 SUBM @S1@');
  });

  test('fills the required 5.5.1 SOUR and SUBM with defaults', () => {
    const seven = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n');
    const result = serializeGedcom551(seven);
    expect(result.ok).toBe(true);
    const text = (result as { value: string }).value;
    expect(text).toContain('1 SOUR DORU');
    expect(text).toContain('1 SUBM @_SYNSUB1@');
    expect(text).toContain('0 @_SYNSUB1@ SUBM');
    expect(text).toContain('1 NAME Unknown');
  });
});

describe('serializeGedcom70Bytes / serializeGedcom551Bytes', () => {
  function ser70Bytes(dataset: GedcomDataset): Uint8Array {
    const result = serializeGedcom70Bytes(dataset);
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    return result.value;
  }

  function ser551Bytes(dataset: GedcomDataset): Uint8Array {
    const result = serializeGedcom551Bytes(dataset);
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    return result.value;
  }

  test('7.0 bytes equal the expected UTF-8 sequence (no BOM, CRLF)', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n');
    const expected = new TextEncoder().encode('0 HEAD\r\n1 GEDC\r\n2 VERS 7.0\r\n0 TRLR\r\n');
    expect(ser70Bytes(dataset)).toEqual(expected);
    // No BOM.
    expect(ser70Bytes(dataset)[0]).toBe(0x30);
  });

  test('5.5.1 bytes declare CHAR UTF-8', () => {
    const dataset = parseOk551(
      ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME T', '0 TRLR'].join('\n'),
    );
    const bytes = ser551Bytes(dataset);
    expect(new TextDecoder().decode(bytes)).toContain('1 CHAR UTF-8');
    expect(bytes[0]).toBe(0x30); // no BOM
  });

  test('7.0 bytes round-trip through the parser with a non-ASCII name', () => {
    const sample = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Иван /Иванов/',
      '1 SEX M',
      '0 TRLR',
    ].join('\n');
    const first = parseOk70(sample);
    const bytes = ser70Bytes(first);
    const result = parseGedcom70(bytes);
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    expect(result.value).toEqual(first);
  });

  test('5.5.1 bytes round-trip through the parser', () => {
    const sample = [
      '0 HEAD',
      '1 SOUR PAF',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Иван /Иванов/',
      '1 BIRT',
      '2 DATE 12 MAR 1923',
      '0 @S1@ SUBM',
      '1 NAME Tester',
      '0 TRLR',
    ].join('\n');
    const first = parseOk551(sample);
    const bytes = ser551Bytes(first);
    const result = parseGedcom551(bytes);
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    expect(result.value).toEqual(first);
  });

  test('rejects an unpaired surrogate instead of throwing', () => {
    const dataset = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n');
    dataset.header.note = { tag: 'NOTE', payload: 'bad \ud800 text' };
    const result = serializeGedcom70Bytes(dataset);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('serialize.invalid-text');
    }
  });
});

describe('the 5.5.1 user-defined EVENT values on 7.0 export', () => {
  const SAMPLE551 = [
    '0 HEAD',
    '1 SOUR PAF',
    '1 SUBM @S1@',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '0 @S1@ SUBM',
    '1 NAME T',
    '0 @S2@ SOUR',
    '1 DATA',
    "2 EVEN BIRT, Ships' manifests",
    '0 @I1@ INDI',
    '1 BIRT',
    '2 SOUR @S2@',
    "3 EVEN Ships' manifests",
    '0 TRLR',
  ].join('\n');

  test('drops the user-defined values and keeps the enums', () => {
    const dataset = parseOk551(SAMPLE551);
    const text = ser70(dataset);
    expect(text).toContain('2 EVEN BIRT');
    expect(text).not.toContain("Ships' manifests");
    // The citation EVEN carried only the user-defined value; the whole
    // structure is dropped on 7.0.
    expect(text).not.toContain('3 EVEN');
  });

  test('an EVEN with only user-defined values is dropped entirely', () => {
    const dataset = parseOk551(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T',
        '0 @S2@ SOUR',
        '1 DATA',
        "2 EVEN Ships' manifests",
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(dataset);
    expect(text).not.toContain('EVEN');
  });

  test('5.5.1 round-trips the user-defined values verbatim', () => {
    const first = parseOk551(SAMPLE551);
    const text = ser551(first);
    expect(text).toContain("2 EVEN BIRT, Ships' manifests");
    expect(text).toContain("3 EVEN Ships' manifests");
    expect(parseOk551(text)).toEqual(first);
  });

  test('7.0 input still rejects non-extension values', () => {
    const result = parseGedcom70(
      enc('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR\n1 DATA\n2 EVEN BIRT, X\n0 TRLR\n'),
    );
    if (result.ok) {
      throw new Error('expected an error');
    }
    expect((result.error as { code: string }).code).toBe('enum.invalid-value');
  });
});
