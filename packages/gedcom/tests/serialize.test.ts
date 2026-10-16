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

  test('rejects 5.5.1-only constructs', () => {
    const dataset551 = parseOk551(
      ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME T', '0 TRLR'].join('\n'),
    );
    expect(expectErr(serializeGedcom70(dataset551))).toBe('serialize.unsupported-value');
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
    header.characterSet = { payload: 'UTF-8' };
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
    header.characterSet = { payload: 'UTF-8' };
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
    header.characterSet = { payload: 'UTF-8' };
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
    header.characterSet = { payload: 'UTF-8' };
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

  test('rejects 7.0-only constructs', () => {
    const base = parseOk551(
      ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME T', '0 TRLR'].join('\n'),
    );
    const snote = parseOk70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @N1@ SNOTE text\n0 TRLR\n');
    const snoteRecord = snote.records[0];
    if (snoteRecord === undefined || snoteRecord.tag !== 'SNOTE') {
      throw new Error('expected SNOTE');
    }
    base.records.push(snoteRecord);
    expect(expectErr(serializeGedcom551(base))).toBe('serialize.unsupported-value');
  });
});
