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
  '1 _MILT',
  '2 DATE 1942',
  '2 PLAC Germany',
  '1 _DCAUSE Heart attack',
  '2 DATE 1 JAN 1990',
  '1 _MDCL Diabetes',
  '1 _URL http://example.com/john',
  '1 FAMC @F1@',
  '2 PEDI birth',
  '2 _PRIMARY Y',
  '1 OBJE @M1@',
  '2 _SCBK Y',
  '2 _SSHOW Y',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 _NONE',
  '1 _STAT Married',
  '1 MARR',
  '2 ASSO @I2@',
  '3 TYPE INDI',
  '3 RELA Witness',
  '0 @I2@ INDI',
  '1 NAME Jane /Roe/',
  '0 @M1@ OBJE',
  '1 FILE pic.jpg',
  '2 FORM jpg',
  '1 _TYPE Photo',
  '0 @S1@ SOUR',
  '1 TITL Book',
  '1 _FULL Formatted footnote',
  '0 @I3@ INDI',
  '1 NAME Kid /Doe/',
  '1 BIRT',
  '2 _PRIV',
  '2 SOUR @S1@',
  '3 _CREF ref-1',
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

describe('P2 vendor tags on 5.5.1 input', () => {
  test('types the tags into the model', () => {
    const dataset = parseOk551(SAMPLE551);
    const john = indi(dataset, '@I1@');

    // FTM facts become EVEN + TYPE.
    const milt = john.events?.find((e) => e.tag === 'EVEN' && e.type === 'Military');
    expect(milt?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1942 });
    expect(milt?.detail?.place?.payload).toEqual(['Germany']);
    expect(john.events?.find((e) => e.tag === 'EVEN' && e.type === 'Medical')?.detail?.cause ?? 'none').toBe('none');

    // _DCAUSE becomes the DEAT event's CAUS.
    const death = john.events?.find((e) => e.tag === 'DEAT');
    expect(death?.detail?.cause).toBe('Heart attack');
    expect(death?.detail?.date?.value).toEqual({
      kind: 'date', calendar: 'GREGORIAN', day: 1, month: 'JAN', year: 1990,
    });

    expect(john.url).toBe('http://example.com/john');
    expect(john.childFamilies?.[0]?.primary).toBe(true);
    expect(john.media?.[0]).toMatchObject({ scrapbook: true, slideshow: true });

    // _NONE → NCHI 0; _STAT → marriageStatus; the Gramps ASSO → associations.
    const family = fam(dataset, '@F1@');
    expect(family.attributes).toEqual([{ tag: 'NCHI', payload: 0 }]);
    expect(family.marriageStatus).toBe('Married');
    const marr = family.events?.find((e) => e.tag === 'MARR');
    expect(marr?.detail?.detail?.associations?.[0]).toEqual({
      tag: 'ASSO',
      individual: '@I2@',
      role: { payload: 'OTHER', phrase: 'Witness' },
    });

    const media = dataset.records.find((r) => r.tag === 'OBJE') as MultimediaRecord | undefined;
    expect(media?.objectType).toBe('Photo');
    const source = dataset.records.find((r) => r.tag === 'SOUR') as SourceRecord | undefined;
    expect(source?.fullFootnote).toBe('Formatted footnote');

    const kid = indi(dataset, '@I3@');
    const birth = kid.events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.restriction).toEqual(['PRIVACY']);
    expect(birth?.detail?.citations?.[0]?.reference).toBe('ref-1');
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const first = parseOk551(SAMPLE551);
    const second = parseOk551(ser551(first));
    expect(second).toEqual(first);
  });
});

describe('P2 vendor tags on output', () => {
  test('5.5.1: standard projection where it exists, vendor tags otherwise', () => {
    const text = ser551(parseOk551(SAMPLE551));
    // FTM facts → EVEN + TYPE; _DCAUSE → DEAT.CAUS; _NONE → NCHI; _PRIV → RESN.
    expect(text).toContain('2 TYPE Military');
    expect(text).toContain('2 DATE 1942');
    expect(text).toContain('2 CAUS Heart attack');
    expect(text).toContain('2 TYPE Medical');
    expect(text).toContain('1 NCHI 0');
    expect(text).toContain('2 RESN privacy');
    // The Gramps ASSO normalizes into the canonical _SHAR/_ROLE pair.
    expect(text).toContain('2 _SHAR @I2@');
    expect(text).toContain('3 _ROLE Witness');
    // Vendor tags with no standard equivalent.
    expect(text).toContain('1 _STAT Married');
    expect(text).toContain('1 _URL http://example.com/john');
    expect(text).toContain('2 _PRIMARY Y');
    expect(text).toContain('2 _SCBK Y');
    expect(text).toContain('2 _SSHOW Y');
    expect(text).toContain('1 _TYPE Photo');
    expect(text).toContain('1 _FULL Formatted footnote');
    expect(text).toContain('3 _CREF ref-1');
  });

  test('7.0: the same rules apply', () => {
    const text = ser70(parseOk551(SAMPLE551));
    expect(text).toContain('2 TYPE Military');
    expect(text).toContain('2 CAUS Heart attack');
    expect(text).toContain('2 TYPE Medical');
    expect(text).toContain('1 NCHI 0');
    expect(text).toContain('2 RESN PRIVACY');
    expect(text).toContain('2 ASSO @I2@');
    expect(text).toContain('3 ROLE OTHER');
    expect(text).toContain('4 PHRASE Witness');
    expect(text).toContain('1 _STAT Married');
    expect(text).toContain('1 _URL http://example.com/john');
    expect(text).toContain('2 _PRIMARY Y');
    expect(text).toContain('2 _SCBK Y');
    expect(text).toContain('2 _SSHOW Y');
    expect(text).toContain('1 _TYPE Photo');
    expect(text).toContain('1 _FULL Formatted footnote');
    expect(text).toContain('3 _CREF ref-1');
  });
});
