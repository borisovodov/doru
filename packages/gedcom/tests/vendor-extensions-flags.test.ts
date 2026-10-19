import { describe, expect, test } from 'vitest';
import { parseGedcom551 } from '../src/parsing/assemble';
import { serializeGedcom551 } from '../src/serialize/serialize';
import type { FamilyRecord, GedcomDataset, IndividualRecord } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
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
  '1 FAMS @F1@',
  '2 _PREF Y',
  '1 FAMS @F2@',
  '1 FAMC @F3@',
  '2 _PREF Y',
  '1 BIRT',
  '2 ADDR 1 Main St',
  '3 _PRIV',
  '2 PLAC Ames, Iowa',
  '3 _VERI Y',
  '2 SOUR @S1@',
  '3 _VERI Y',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 CHIL @I2@',
  '2 _PREF Y',
  '0 @F2@ FAM',
  '0 @F3@ FAM',
  '0 @I2@ INDI',
  '1 NAME Kid /Doe/',
  '0 @S1@ SOUR',
  '1 TITL Book',
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

describe('Legacy workflow flags', () => {
  test('types _PREF, _VERI and _PRIV into the model', () => {
    const dataset = parseOk551(SAMPLE551);
    const john = indi(dataset, '@I1@');

    // _PREF: spouse link, child link, parent link.
    expect(john.spouseFamilies).toEqual([
      { family: '@F1@', preferred: true },
      { family: '@F2@' },
    ]);
    expect(john.childFamilies?.[0]?.preferred).toBe(true);
    expect(fam(dataset, '@F1@').children?.[0]?.preferred).toBe(true);

    // _PRIV under ADDR (bare form means true).
    // _VERI on the place and on the citation.
    const birth = john.events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.address?.private).toBe(true);
    expect(birth?.detail?.place?.verified).toBe(true);
    expect(birth?.detail?.citations?.[0]?.verified).toBe(true);
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const first = parseOk551(SAMPLE551);
    const second = parseOk551(ser551(first));
    expect(second).toEqual(first);
  });

  test('writes the flags back', () => {
    const text = ser551(parseOk551(SAMPLE551));
    expect(text).toContain('2 _PREF Y');
    expect(text).toContain('3 _PRIV Y');
    expect(text).toContain('3 _VERI Y');
  });
});
