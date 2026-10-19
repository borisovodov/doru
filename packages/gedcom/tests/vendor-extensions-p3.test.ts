import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { FamilyRecord, GedcomDataset, IndividualRecord, MultimediaRecord, TodoRecord } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function parseOk70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
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

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

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
  '0 @I1@ INDI',
  '1 NAME John /Doe/',
  '1 _TAG VIP',
  '1 _TAG3 Blue',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 CHIL @I2@',
  '2 _STAT Twin',
  '0 @I2@ INDI',
  '1 NAME Kid /Doe/',
  '0 @M1@ OBJE',
  '1 FILE photo.jpg',
  '2 FORM jpg',
  '1 _SOUND voice.wav',
  '0 _TODO Find birth certificate',
  '1 _CAT Vital records',
  '1 _LOCL Springfield',
  '0 _TODO Order microfilm',
  '1 _CDATE 1 JAN 2020',
  '1 _RDATE 3 FEB 2020',
  '0 TRLR',
].join('\n');

function indi(dataset: GedcomDataset, xref: string): IndividualRecord {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || record.tag !== 'INDI') {
    throw new Error(`expected INDI ${xref}`);
  }
  return record;
}

function fam(dataset: GedcomDataset, xref: string): FamilyRecord {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || record.tag !== 'FAM') {
    throw new Error(`expected FAM ${xref}`);
  }
  return record;
}

function todos(dataset: GedcomDataset): TodoRecord[] {
  return dataset.records.filter((record): record is TodoRecord => record.tag === '_TODO');
}

describe('Legacy data tags on 5.5.1 input', () => {
  test('types _STAT under CHIL, the tag marks, _SOUND and _TODO', () => {
    const dataset = parseOk551(SAMPLE551);

    // Tag marks keep their slots (the gap stays empty).
    expect(indi(dataset, '@I1@').marks).toEqual(['VIP', '', 'Blue']);

    // _STAT under CHIL becomes the multiplicity enum.
    expect(fam(dataset, '@F1@').children?.[0]?.multiplicity).toBe('Twin');

    // _SOUND on the media record.
    const media = dataset.records.find((r) => r.tag === 'OBJE') as MultimediaRecord | undefined;
    expect(media?.soundFile).toBe('voice.wav');

    // _TODO records.
    expect(todos(dataset)).toEqual([
      { tag: '_TODO', payload: 'Find birth certificate', category: 'Vital records', locality: 'Springfield' },
      { tag: '_TODO', payload: 'Order microfilm', closedDate: '1 JAN 2020', reminderDate: '3 FEB 2020' },
    ]);
  });

  test('keeps any multiplicity text verbatim', () => {
    const dataset = parseOk551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @F1@ FAM',
        '1 CHIL @I2@',
        '2 _STAT Quadruplet',
        '0 @I2@ INDI',
        '1 NAME Kid /Doe/',
        '0 TRLR',
      ].join('\n'),
    );
    expect(fam(dataset, '@F1@').children?.[0]?.multiplicity).toBe('Quadruplet');
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const first = parseOk551(SAMPLE551);
    const second = parseOk551(ser551(first));
    expect(second).toEqual(first);
  });
});

describe('Legacy data tags on output', () => {
  test('5.5.1 writes the vendor tags back', () => {
    const text = ser551(parseOk551(SAMPLE551));
    expect(text).toContain('1 _TAG VIP');
    expect(text).toContain('1 _TAG3 Blue');
    expect(text).not.toContain('_TAG2 ');
    expect(text).toContain('2 _STAT Twin');
    expect(text).toContain('1 _SOUND voice.wav');
    expect(text).toContain('0 _TODO Find birth certificate');
    expect(text).toContain('1 _CAT Vital records');
    expect(text).toContain('1 _LOCL Springfield');
    expect(text).toContain('0 _TODO Order microfilm');
    expect(text).toContain('1 _CDATE 1 JAN 2020');
    expect(text).toContain('1 _RDATE 3 FEB 2020');
  });

  test('7.0 writes the same vendor tags', () => {
    const text = ser70(parseOk551(SAMPLE551));
    expect(text).toContain('1 _TAG VIP');
    expect(text).toContain('1 _TAG3 Blue');
    expect(text).toContain('2 _STAT Twin');
    expect(text).toContain('1 _SOUND voice.wav');
    expect(text).toContain('0 _TODO Find birth certificate');
    expect(text).toContain('1 _CDATE 1 JAN 2020');
  });
});
