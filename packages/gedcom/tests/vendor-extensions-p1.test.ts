import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { FamilyRecord, GedcomDataset, IndividualRecord, MultimediaRecord, SourceRecord } from '../src/structures';

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
  '1 _MARNM Jane /Doe/',
  '1 _AKA Johnny',
  '1 _UPD 13 SEP 2019 14:21:05',
  '1 BIRT',
  '2 ADDR 123 Main St',
  '3 _EMAIL john@@example.com',
  '1 OBJE @M1@',
  '1 _WT_OBJE_SORT @M2@',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 _UPD 1 JAN 2020',
  '0 @M1@ OBJE',
  '1 FILE a.jpg',
  '2 FORM jpg',
  '0 @M2@ OBJE',
  '1 FILE b.jpg',
  '2 FORM jpg',
  '1 _DATE 4 FEB 2020',
  '0 @S2@ SOUR',
  '1 TITL Book',
  '1 _TMPLT',
  '2 TID 113',
  '2 FIELD',
  '3 NAME Page',
  '3 VALUE 42',
  '2 FIELD',
  '3 NAME URL',
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

function obje(dataset: GedcomDataset, xref: string): MultimediaRecord {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || record.tag !== 'OBJE') {
    throw new Error(`expected OBJE ${xref}`);
  }
  return record;
}

function sour(dataset: GedcomDataset, xref: string): SourceRecord {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || record.tag !== 'SOUR') {
    throw new Error(`expected SOUR ${xref}`);
  }
  return record;
}

describe('P1 vendor tags on 5.5.1 input', () => {
  test('types the tags into the model', () => {
    const dataset = parseOk551(SAMPLE551);

    // Vendor name tags normalize into names with the matching type.
    const john = indi(dataset, '@I1@');
    expect(john.names).toHaveLength(3);
    expect(john.names?.[1]).toMatchObject({
      payload: { given: 'Jane', surname: 'Doe' },
      type: { payload: 'MARRIED' },
    });
    expect(john.names?.[2]).toMatchObject({
      payload: { given: 'Johnny' },
      type: { payload: 'AKA' },
    });

    // _UPD on the records.
    expect(john.updatedAt).toBe('13 SEP 2019 14:21:05');
    expect(fam(dataset, '@F1@').updatedAt).toBe('1 JAN 2020');

    // _EMAIL under the address block.
    expect(john.events?.find((e) => e.tag === 'BIRT')?.detail?.address?.email).toEqual(['john@example.com']);

    // _WT_OBJE_SORT is a media link like OBJE, order preserved.
    expect(john.media?.map((m) => m.object)).toEqual(['@M1@', '@M2@']);

    // _DATE on the media record.
    expect(obje(dataset, '@M2@').date?.value).toEqual({
      kind: 'date',
      calendar: 'GREGORIAN',
      day: 4,
      month: 'FEB',
      year: 2020,
    });

    // _TMPLT source template.
    expect(sour(dataset, '@S2@').template).toEqual({
      tag: '_TMPLT',
      templateId: '113',
      fields: [
        { tag: 'FIELD', name: 'Page', value: '42' },
        { tag: 'FIELD', name: 'URL' },
      ],
    });
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const first = parseOk551(SAMPLE551);
    const second = parseOk551(ser551(first));
    expect(second).toEqual(first);
  });
});

describe('P1 vendor tags on output', () => {
  test('5.5.1: projects onto the standard where it exists, vendor tags otherwise', () => {
    const text = ser551(parseOk551(SAMPLE551));
    // Standard equivalents.
    expect(text).toContain('2 TYPE married');
    expect(text).toContain('2 TYPE aka');
    // The 5.5.1 contacts are written at the ADDRESS_STRUCTURE level
    // (siblings of ADDR, GEDCOM 5.5.1 §2 p.31); the vendor `_EMAIL`
    // under ADDR normalizes into the standard sibling spelling.
    expect(text).toContain('2 EMAIL john@@example.com');
    // _WT_OBJE_SORT becomes the standard OBJE.
    expect(text).toContain('1 OBJE @M1@');
    expect(text).toContain('1 OBJE @M2@');
    // No standard equivalent: the vendor tags are written back.
    expect(text).toContain('1 _UPD 13 SEP 2019 14:21:05');
    expect(text).toContain('1 _UPD 1 JAN 2020');
    expect(text).toContain('1 _DATE 4 FEB 2020');
    expect(text).toContain('1 _TMPLT');
    expect(text).toContain('2 TID 113');
    expect(text).toContain('3 VALUE 42');
  });

  test('7.0: the same rules apply', () => {
    const text = ser70(parseOk551(SAMPLE551));
    expect(text).toContain('2 TYPE MARRIED');
    expect(text).toContain('2 TYPE AKA');
    // The 5.5.1-position address email relocates to the event detail.
    expect(text).toContain('2 EMAIL john@example.com');
    expect(text).toContain('1 OBJE @M1@');
    expect(text).toContain('1 OBJE @M2@');
    expect(text).toContain('1 _UPD 13 SEP 2019 14:21:05');
    expect(text).toContain('1 _UPD 1 JAN 2020');
    expect(text).toContain('1 _DATE 4 FEB 2020');
    expect(text).toContain('1 _TMPLT');
    expect(text).toContain('2 TID 113');
    expect(text).toContain('3 VALUE 42');
  });

  test('7.0 round-trips the tags it writes', () => {
    const sample = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 _MARNM Jane /Doe/',
      '1 _AKA Johnny',
      '1 _UPD 13 SEP 2019 14:21:05',
      '1 OBJE @M1@',
      '1 _WT_OBJE_SORT @M2@',
      '0 @M1@ OBJE',
      '1 FILE a.jpg',
      '2 FORM image/jpeg',
      '0 @M2@ OBJE',
      '1 FILE b.jpg',
      '2 FORM image/jpeg',
      '1 _DATE 4 FEB 2020',
      '0 @S2@ SOUR',
      '1 TITL Book',
      '1 _TMPLT',
      '2 TID 113',
      '2 FIELD',
      '3 NAME Page',
      '3 VALUE 42',
      '0 TRLR',
    ].join('\n');
    const first = parseOk70(sample);
    const second = parseOk70(ser70(first));
    expect(second).toEqual(first);
  });
});
