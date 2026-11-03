// The tolerant parse (parseTolerant): every problem is recorded and
// skipped instead of aborting — the result carries the best-effort
// dataset plus the full error list.

import { describe, expect, test } from 'vitest';
import { parseTolerant } from '../src/detect';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('parseTolerant', () => {
  test('records every error of a document and keeps parsing', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/', // fine
      '1 SEX Z', // enum error
      '1 BIRT',
      '2 DATE 32 JAN 1900', // impossible day — kept verbatim (not an error)
      '1 OCCU', // missing payload — recorded skip
      '1 FAMS @NOPE@', // dangling pointer — dropped
      '0 @I2@ INDI',
      '1 NAME Mary /Doe/',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(value?.kind).toBe('dataset');
    const codes = errors.map((error) => error.code).sort();
    expect(codes).toEqual(['document.xref-not-found', 'enum.invalid-value', 'structure.missing-payload']);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.records).toHaveLength(2);
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.sex).toBeUndefined();
    expect(indi.occupations ?? []).toEqual([]);
    expect(indi.spouseFamilies ?? []).toEqual([]);
    expect(indi.events?.[0]?.detail?.date?.value).toBeDefined();
  });

  test('a clean document has no errors', () => {
    const text = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '0 @I1@ INDI', '1 NAME John /Doe/', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    expect(value?.kind).toBe('dataset');
  });

  test('a document that is nothing but junk still yields a dataset', () => {
    const { value, errors } = parseTolerant(enc('NOT GEDCOM AT ALL\njust prose\n'));
    expect(errors.length).toBeGreaterThan(0);
    expect(value?.kind).toBe('dataset');
    if (value?.kind === 'dataset') {
      expect(value.dataset.header.gedcom.version).toBe('5.5.1');
      expect(value.dataset.records).toEqual([]);
    }
  });
});
