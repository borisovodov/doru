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
      '1 OCCU', // bare line — repaired silently (kept with an empty payload)
      '1 FAMS @NOPE@', // dangling pointer — dropped
      '0 @I2@ INDI',
      '1 NAME Mary /Doe/',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(value?.kind).toBe('dataset');
    const codes = errors.map((error) => error.code).sort();
    expect(codes).toEqual(['document.xref-not-found', 'enum.invalid-value']);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.records).toHaveLength(2);
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.sex).toBeUndefined();
    // The bare OCCU line is repaired, not dropped: the attribute is
    // kept with an empty payload and no error is recorded.
    expect(indi.attributes).toEqual([{ tag: 'OCCU', payload: '' }]);
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

describe('the repair-vs-error recording policy', () => {
  test('a repair with a defined resolution is silent', () => {
    // Bare lines in text slots (kept with an empty payload) and bare
    // SOUR citations (kept as the void citation) are resolutions —
    // no error entries.
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME', // bare name — kept empty
      '1 BIRT',
      '2 DATE 1900',
      '2 SOUR', // bare citation — kept as the void citation
      '1 OCCU', // bare attribute — kept empty
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]).toEqual({ tag: 'NAME', payload: {} });
    expect(indi.events?.[0]?.detail?.citations).toEqual([{ tag: 'SOUR', source: '@VOID@', description: '' }]);
    expect(indi.attributes).toEqual([{ tag: 'OCCU', payload: '' }]);
  });

  test('an unresolved drop keeps recording the error', () => {
    // A text payload in a pointer slot (SUBN with a name instead of a
    // pointer) has no recovery: the line is dropped and the error
    // stays recorded. A bare line would be silent (nothing to lose).
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBN Bill Kelly',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors.map((error) => error.code)).toEqual(['structure.missing-payload']);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.submission).toBeUndefined();
  });
});

describe('the pointer and coordinate repairs', () => {
  test('a pointer with a trailing blank or a US20 artifact resolves', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 FAMC @F2@ ',
      '1 FAMS @<US20>F1@',
      '0 @F1@ FAM',
      '0 @F2@ FAM',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.childFamilies?.map((link) => link.family)).toEqual(['@F2@']);
    expect(indi.spouseFamilies?.map((link) => link.family)).toEqual(['@F1@']);
  });

  test('a bare MAP coordinate line drops the map silently', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 BIRT',
      '2 PLAC X',
      '3 MAP',
      '4 LATI',
      '4 LONG 1E',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.place?.map).toBeUndefined();
  });
});
