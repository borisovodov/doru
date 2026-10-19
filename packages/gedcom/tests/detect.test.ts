import { describe, expect, test } from 'vitest';
import { parse } from '../src/detect';
import { serializeGedzip, type GedzipArchive } from '../src/gedzip';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551Bytes, serializeGedcom70Bytes } from '../src/serialize/serialize';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk(bytes: Uint8Array) {
  const result = parse(bytes);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

const SAMPLE70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '0 @I1@ INDI', '1 NAME John /Doe/', '0 TRLR'].join('\n');
const SAMPLE551 = [
  '0 HEAD',
  '1 SOUR PAF',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '0 @I1@ INDI',
  '1 NAME John /Doe/',
  '0 @S1@ SUBM',
  '1 NAME T',
  '0 TRLR',
].join('\n');

describe('parse (unified entry point)', () => {
  test('detects a GEDCOM 7.0 stream', () => {
    const result = parseOk(enc(SAMPLE70));
    expect(result.kind).toBe('dataset');
    if (result.kind === 'dataset') {
      expect(result.version).toBe('7.0');
      expect(result.dataset.header.gedcom.version).toBe('7.0');
    }
  });

  test('detects a GEDCOM 5.5.1 stream (UTF-8)', () => {
    const result = parseOk(enc(SAMPLE551));
    expect(result.kind).toBe('dataset');
    if (result.kind === 'dataset') {
      expect(result.version).toBe('5.5.1');
      expect(result.dataset.header.gedcom.version).toBe('5.5.1');
    }
  });

  test('detects a GEDCOM 5.5.1 ANSEL stream by falling back on the decoding error', () => {
    // A real ANSEL stream: CHAR ANSEL plus an ANSEL acute accent (0xE2)
    // before its base character — invalid UTF-8, valid ANSEL.
    const ansel = new Uint8Array([
      ...enc(
        [
          '0 HEAD',
          '1 SOUR PAF',
          '1 SUBM @S1@',
          '1 GEDC',
          '2 VERS 5.5.1',
          '2 FORM LINEAGE-LINKED',
          '1 CHAR ANSEL',
          '0 @I1@ INDI',
          '1 NAME caf',
        ].join('\n'),
      ),
      0xe2,
      ...enc('e\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n'),
    ]);
    const result = parseOk(ansel);
    expect(result.kind).toBe('dataset');
    if (result.kind === 'dataset') {
      expect(result.version).toBe('5.5.1');
    }
  });

  test('detects a GEDZIP archive', () => {
    const datasetResult = parseGedcom70(enc(SAMPLE70));
    if (!datasetResult.ok) {
      throw new Error(JSON.stringify(datasetResult));
    }
    const archive: GedzipArchive = {
      dataset: datasetResult.value,
      mediaFiles: [{ name: 'media/a.jpg', contents: enc('X') }],
    };
    const zipResult = serializeGedzip(archive);
    if (!zipResult.ok) {
      throw new Error(JSON.stringify(zipResult));
    }
    const result = parseOk(zipResult.value);
    expect(result.kind).toBe('gedzip');
    if (result.kind === 'gedzip') {
      expect(result.archive.dataset).toEqual(archive.dataset);
    }
  });

  test('reports a 7.0 structural error as-is (no 5.5.1 fallback)', () => {
    const broken70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '0 @I1@ INDI', '1 SEX Z', '0 TRLR'].join('\n');
    const result = parse(enc(broken70));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('enum.invalid-value');
    }
  });

  test('reports the 5.5.1 error when a 5.x stream is malformed', () => {
    // Declares 5.5.1 but lacks the required FORM.
    const broken551 = [
      '0 HEAD',
      '1 SOUR PAF',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '1 CHAR UTF-8',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 TRLR',
    ].join('\n');
    const result = parse(enc(broken551));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('structure.missing-required');
    }
  });

  test('rejects bytes that are neither zip nor GEDCOM', () => {
    const result = parse(enc('this is garbage'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('line.bad-level');
    }
  });

  test('accepts a BOM-prefixed 7.0 stream', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc(SAMPLE70)]);
    const result = parseOk(bytes);
    expect(result.kind).toBe('dataset');
  });

  test('round-trips all three forms through parse', () => {
    // 7.0
    const d70 = parseGedcom70(enc(SAMPLE70));
    if (!d70.ok) throw new Error(JSON.stringify(d70));
    const b70 = serializeGedcom70Bytes(d70.value);
    if (!b70.ok) throw new Error(JSON.stringify(b70));
    const result70 = parseOk(b70.value);
    expect(result70.kind).toBe('dataset');
    if (result70.kind === 'dataset') {
      expect(result70.version).toBe('7.0');
    }
    // 5.5.1
    const d551 = parseGedcom551(enc(SAMPLE551));
    if (!d551.ok) throw new Error(JSON.stringify(d551));
    const b551 = serializeGedcom551Bytes(d551.value);
    if (!b551.ok) throw new Error(JSON.stringify(b551));
    const result551 = parseOk(b551.value);
    expect(result551.kind).toBe('dataset');
    if (result551.kind === 'dataset') {
      expect(result551.version).toBe('5.5.1');
    }
    // GEDZIP
    const archive: GedzipArchive = { dataset: d70.value, mediaFiles: [] };
    const zip = serializeGedzip(archive);
    if (!zip.ok) throw new Error(JSON.stringify(zip));
    const resultZip = parseOk(zip.value);
    expect(resultZip.kind).toBe('gedzip');
  });
});
