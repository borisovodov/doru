import { describe, expect, test } from 'vitest';
import { zipSync } from 'fflate';
import { parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom70Bytes } from '../src/serialize/serialize';
import { parseGedzip, serializeGedzip, type GedzipArchive } from '../src/gedzip';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk70(text: string) {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function parseOk(bytes: Uint8Array): GedzipArchive {
  const result = parseGedzip(bytes);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function serOk(archive: GedzipArchive): Uint8Array {
  const result = serializeGedzip(archive);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function errCode(bytes: Uint8Array): string {
  const result = parseGedzip(bytes);
  if (result.ok) {
    throw new Error('expected an error');
  }
  return result.error.code;
}

const DATASET = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 SOUR DORU',
  '0 @I1@ INDI',
  '1 NAME Иван /Иванов/',
  '1 SEX M',
  '1 BIRT',
  '2 DATE 12 MAR 1923',
  '0 @O1@ OBJE',
  '1 FILE media/photo.jpg',
  '2 FORM image/jpeg',
  '2 TITL Portrait',
  '0 TRLR',
].join('\n');

describe('GEDZIP', () => {
  test('round-trips an archive with media files', () => {
    const dataset = parseOk70(DATASET);
    const photo = enc('JPEG-BYTES');
    const archive: GedzipArchive = {
      dataset,
      mediaFiles: [{ name: 'media/photo.jpg', contents: photo }],
    };
    const bytes = serOk(archive);
    // The archive is a zip: the PK signature.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const back = parseOk(bytes);
    expect(back.dataset).toEqual(dataset);
    expect(back.mediaFiles).toEqual([{ name: 'media/photo.jpg', contents: photo }]);
  });

  test('rejects an archive without the gedcom.ged entry', () => {
    const bytes = zipSync({ 'other.txt': enc('hello') });
    expect(errCode(bytes)).toBe('gedzip.missing-dataset');
  });

  test('rejects invalid zip bytes', () => {
    expect(errCode(enc('this is not a zip'))).toBe('gedzip.invalid-archive');
  });

  test('rejects an inner stream that is not GEDCOM 7.0', () => {
    const bytes = zipSync({ 'gedcom.ged': enc('0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 TRLR\n') });
    expect(errCode(bytes)).toBe('document.wrong-version');
  });

  test('keeps external file:// URLs out of the archive', () => {
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @O1@ OBJE',
        '1 FILE file:///external/scan.jpg',
        '2 FORM image/jpeg',
        '0 TRLR',
      ].join('\n'),
    );
    const bytes = serOk({ dataset, mediaFiles: [] });
    const back = parseOk(bytes);
    expect(back.dataset).toEqual(dataset);
    expect(back.mediaFiles).toEqual([]);
  });

  test('preserves reserved names like MANIFEST.MF and META-INF/', () => {
    const dataset = parseOk70(DATASET);
    const archive: GedzipArchive = {
      dataset,
      mediaFiles: [
        { name: 'MANIFEST.MF', contents: enc('x') },
        { name: 'META-INF/extra.txt', contents: enc('y') },
      ],
    };
    const back = parseOk(serOk(archive));
    expect(back.mediaFiles.map((media) => media.name)).toEqual(['MANIFEST.MF', 'META-INF/extra.txt']);
  });

  test('rejects duplicate media names on write', () => {
    const dataset = parseOk70(DATASET);
    const archive: GedzipArchive = {
      dataset,
      mediaFiles: [
        { name: 'media/a.jpg', contents: enc('1') },
        { name: 'media/a.jpg', contents: enc('2') },
      ],
    };
    const result = serializeGedzip(archive);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('gedzip.duplicate-entry');
    }
  });

  test('rejects a media name colliding with the dataset entry', () => {
    const dataset = parseOk70(DATASET);
    const archive: GedzipArchive = {
      dataset,
      mediaFiles: [{ name: 'gedcom.ged', contents: enc('x') }],
    };
    const result = serializeGedzip(archive);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('gedzip.duplicate-entry');
    }
  });

  test('skips zip directory markers on read', () => {
    const dataset = parseOk70(DATASET);
    const datasetBytes = serializeGedcom70Bytes(dataset);
    if (!datasetBytes.ok) {
      throw new Error(JSON.stringify(datasetBytes));
    }
    const bytes = zipSync({ 'gedcom.ged': datasetBytes.value, 'media/': new Uint8Array() });
    const back = parseOk(bytes);
    expect(back.mediaFiles).toEqual([]);
    expect(back.dataset).toEqual(dataset);
  });
});
