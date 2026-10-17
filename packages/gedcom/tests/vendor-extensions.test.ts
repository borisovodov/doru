import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { FamilyRecord, GedcomDataset, IndividualRecord, SourceCitation } from '../src/structures';

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

/**
 * A 5.5.1 file exercising the typed vendor extensions: _UID (record and
 * event level), _SDATE, _SHAR with _ROLE and with the standard ROLE tag,
 * _PRIM on a pointer OBJE link, _FREL/_MREL under CHIL, _APID under a
 * citation, plus an unknown _FOO that must stay a generic extension.
 */
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
  '1 _UID f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
  '1 _FOO bar',
  '1 BIRT',
  '2 DATE 12 MAR 1923',
  '2 _SDATE 1923',
  '2 _SHAR @I2@',
  '3 _ROLE Witness',
  '1 DEAT',
  '2 _UID aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  '1 OBJE @M1@',
  '2 _PRIM Y',
  '1 FAMS @F1@',
  '1 FAMC @F1@',
  '2 PEDI birth',
  '0 @I2@ INDI',
  '1 NAME Jane /Roe/',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 WIFE @I2@',
  '1 CHIL @I3@',
  '2 _FREL Natural',
  '2 _MREL Adopted',
  '1 MARR',
  '2 SOUR @S1@',
  '3 _APID 1,7602::2771226',
  '2 _SHAR @I2@',
  '3 ROLE Maid of Honor',
  '0 @I3@ INDI',
  '1 NAME Kid /Doe/',
  '1 FAMC @F1@',
  '0 @M1@ OBJE',
  '1 FILE picture.jpg',
  '2 FORM jpg',
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

describe('vendor extensions on 5.5.1 input', () => {
  test('normalizes the typed tags into the model', () => {
    const dataset = parseOk551(SAMPLE551);

    // _UID on the record.
    expect(indi(dataset, '@I1@').identifiers).toEqual([
      { tag: 'UID', payload: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6' },
    ]);

    // _UID on the event detail.
    const death = indi(dataset, '@I1@').events?.find((e) => e.tag === 'DEAT');
    expect(death?.detail?.uniqueIds).toEqual(['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']);

    // _SDATE on the event detail.
    const birth = indi(dataset, '@I1@').events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.sortDate?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1923 });

    // _SHAR + _ROLE becomes an association with ROLE OTHER + PHRASE.
    expect(birth?.detail?.associations).toEqual([
      { tag: 'ASSO', individual: '@I2@', role: { payload: 'OTHER', phrase: 'Witness' } },
    ]);

    // _SHAR + standard ROLE is the same normalization.
    const marr = fam(dataset, '@F1@').events?.find((e) => e.tag === 'MARR');
    expect(marr?.detail?.detail?.associations).toEqual([
      { tag: 'ASSO', individual: '@I2@', role: { payload: 'OTHER', phrase: 'Maid of Honor' } },
    ]);

    // _PRIM on the pointer OBJE link.
    const link = indi(dataset, '@I1@').media?.[0];
    expect(link?.primary).toBe(true);

    // _FREL/_MREL under CHIL.
    expect(fam(dataset, '@F1@').children?.[0]).toMatchObject({
      child: '@I3@',
      fatherRelation: 'Natural',
      motherRelation: 'Adopted',
    });

    // _APID under the citation.
    const citation = marr?.detail?.detail?.citations?.[0] as SourceCitation | undefined;
    expect(citation?.ancestryPointers).toEqual(['1,7602::2771226']);

    // The unknown underscore tag stays a generic extension.
    expect(indi(dataset, '@I1@').extensions).toEqual([expect.objectContaining({ tag: '_FOO' })]);
  });

  test('round-trips through the 5.5.1 serializer unchanged', () => {
    const first = parseOk551(SAMPLE551);
    const second = parseOk551(ser551(first));
    expect(second).toEqual(first);
  });
});

describe('vendor extensions on 5.5.1 output', () => {
  test('writes the vendor tags back', () => {
    const text = ser551(parseOk551(SAMPLE551));
    expect(text).toContain('1 _UID f81d4fae-7dec-11d0-a765-00a0c91e6bf6');
    expect(text).toContain('2 _SDATE 1923');
    expect(text).toContain('2 _SHAR @I2@');
    expect(text).toContain('3 _ROLE Witness');
    expect(text).toContain('3 _ROLE Maid of Honor');
    expect(text).toContain('2 _PRIM Y');
    expect(text).toContain('2 _FREL Natural');
    expect(text).toContain('2 _MREL Adopted');
    expect(text).toContain('3 _APID 1,7602::2771226');
    expect(text).toContain('2 _UID aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(text).toContain('1 _FOO bar');
  });
});

describe('vendor extensions on 7.0 output', () => {
  test('uses the standard 7.0 structures', () => {
    const text = ser70(parseOk551(SAMPLE551));
    // Standard tags, not vendor tags.
    expect(text).toContain('1 UID f81d4fae-7dec-11d0-a765-00a0c91e6bf6');
    expect(text).toContain('2 UID aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(text).toContain('2 SDATE 1923');
    expect(text).toContain('2 ASSO @I2@');
    expect(text).toContain('3 ROLE OTHER');
    expect(text).toContain('4 PHRASE Witness');
    expect(text).toContain('4 PHRASE Maid of Honor');
    // Not representable in 7.0: dropped.
    expect(text).not.toContain('_PRIM');
    expect(text).not.toContain('_APID');
    expect(text).not.toContain('_FREL');
    expect(text).not.toContain('_MREL');
    // The _FOO extension is preserved verbatim.
    expect(text).toContain('1 _FOO bar');
  });

  test('translates matching _FREL/_MREL into INDI.FAMC.PEDI', () => {
    const sample = parseOk551(
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
        '0 @I1@ INDI',
        '1 NAME Dad /Doe/',
        '0 @I2@ INDI',
        '1 NAME Mom /Doe/',
        '0 @I3@ INDI',
        '1 NAME Kid /Doe/',
        '1 FAMC @F1@',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 CHIL @I3@',
        '2 _FREL Natural',
        '2 _MREL Natural',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(sample);
    // The PEDI was filled on the FAMC link by prepareFor70.
    expect(text).toContain('2 PEDI BIRTH');
    expect(text).not.toContain('_FREL');
    expect(text).not.toContain('_MREL');
    const via70 = parseOk70(text);
    const famc = indi(via70, '@I3@').childFamilies?.[0];
    expect(famc?.pedigree?.payload).toBe('BIRTH');
  });

  test('does not invent a PEDI when the relations disagree', () => {
    const sample = parseOk551(
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
        '0 @I1@ INDI',
        '1 NAME Dad /Doe/',
        '0 @I3@ INDI',
        '1 NAME Kid /Doe/',
        '1 FAMC @F1@',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 CHIL @I3@',
        '2 _FREL Natural',
        '2 _MREL Adopted',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser70(sample);
    expect(text).not.toContain('_FREL');
    expect(text).not.toContain('_MREL');
    expect(text).not.toContain('PEDI');
  });
});
