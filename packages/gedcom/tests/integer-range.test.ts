import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function err551(text: string): string {
  const result = parseGedcom551(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return result.error.code;
}

function err70(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return result.error.code;
}

function doc551(body: string): string {
  return [
    '0 HEAD',
    '1 SOUR X',
    '1 SUBM @S1@',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '0 @S1@ SUBM',
    '1 NAME T',
    '0 @I1@ INDI',
    '1 NAME John /Doe/',
    ...body.split('\n'),
    '0 TRLR',
  ].join('\n');
}

describe('integer range strictness', () => {
  test('a year beyond the exactly representable range is rejected (5.5.1)', () => {
    expect(err551(doc551('1 BIRT\n2 DATE 99999999999999999999999'))).toBe('date.bad-year');
  });

  test('a dual year beyond the range is rejected (5.5.1)', () => {
    expect(err551(doc551('1 BIRT\n2 DATE 99999999999999999999999/99'))).toBe('date.bad-year');
  });

  test('a year beyond the range is rejected (7.0)', () => {
    expect(err70(
      ['0 HEAD', '1 GEDC', '2 VERS 7.0', '0 @I1@ INDI', '1 BIRT', '2 DATE 5 JAN 9007199254740992', '0 TRLR'].join('\n'),
    )).toBe('date.bad-year');
  });

  test('the largest safe year is accepted exactly (7.0)', () => {
    const result = parseGedcom70(enc(
      ['0 HEAD', '1 GEDC', '2 VERS 7.0', '0 @I1@ INDI', '1 BIRT', '2 DATE 5 JAN 9007199254740991', '0 TRLR'].join('\n'),
    ));
    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }
    const record = result.value.records.find((r) => r.xref === '@I1@');
    const date = record?.tag === 'INDI' ? record.events?.[0]?.detail?.date?.value : undefined;
    expect(date).toMatchObject({ kind: 'date', year: 9007199254740991 });
    const serialized = serializeGedcom70(result.value);
    if (!serialized.ok) {
      throw new Error(JSON.stringify(serialized.error));
    }
    expect(serialized.value).toContain('9007199254740991');
  });

  test('a large but safe year round-trips exactly (5.5.1)', () => {
    const result = parseGedcom551(enc(doc551('1 BIRT\n2 DATE 123456789012345')));
    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }
    const serialized = serializeGedcom551(result.value);
    if (!serialized.ok) {
      throw new Error(JSON.stringify(serialized.error));
    }
    expect(serialized.value).toContain('2 DATE 123456789012345');
  });

  test('an out-of-range child count is rejected', () => {
    expect(err551(
      ['0 HEAD', '1 SOUR X', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @S1@ SUBM', '1 NAME T', '0 @F1@ FAM', '1 NCHI 99999999999999999999', '0 TRLR'].join('\n'),
    )).toBe('integer.out-of-range');
  });

  test('an out-of-range age component is rejected', () => {
    expect(err551(doc551('1 BIRT\n2 AGE 99999999999999999999y'))).toBe('integer.out-of-range');
    expect(err70(
      ['0 HEAD', '1 GEDC', '2 VERS 7.0', '0 @I1@ INDI', '1 BIRT', '2 AGE 99999999999999999999y', '0 TRLR'].join('\n'),
    )).toBe('integer.out-of-range');
  });
});
