import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
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
  '1 _BIRN John /Smith/',
  '1 _CENN John /Census/',
  '1 _EYEC Blue',
  '1 _HAIR Brown',
  '1 _HEIG 180 cm',
  '1 _WEIG 80 kg',
  '1 _BRTM',
  '2 DATE 1 JAN 1900',
  '1 _FNRL',
  '1 _INTE',
  '1 _YART',
  '1 _PRMN 12345',
  '1 _NLIV',
  '1 _NMAR',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 _COML',
  '2 DATE 1910',
  '1 _MBON',
  '1 _SEPR',
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

describe('Brother\'s Keeper tags on 5.5.1 input', () => {
  test('projects the tags onto the standard structures', () => {
    const dataset = parseOk551(SAMPLE551);
    const john = indi(dataset, '@I1@');

    // Name variants.
    expect(john.names).toHaveLength(3);
    expect(john.names?.[1]).toMatchObject({ type: { payload: 'BIRTH' }, payload: { surname: 'Smith' } });
    expect(john.names?.[2]).toMatchObject({ type: { payload: 'OTHER', phrase: 'Census name' } });

    // Physical descriptors → FACT + TYPE.
    expect(john.attributes).toEqual([
      { tag: 'FACT', payload: 'Blue', type: 'Eye color' },
      { tag: 'FACT', payload: 'Brown', type: 'Hair color' },
      { tag: 'FACT', payload: '180 cm', type: 'Height' },
      { tag: 'FACT', payload: '80 kg', type: 'Weight' },
    ]);

    // Ceremonies → EVEN + TYPE.
    const brit = john.events?.find((e) => e.type === 'Brit Mila');
    expect(brit?.tag).toBe('EVEN');
    expect(brit?.detail?.date?.value).toEqual({
      kind: 'date', calendar: 'GREGORIAN', day: 1, month: 'JAN', year: 1900,
    });
    for (const type of ['Funeral', 'Interred', 'Yahrzeit']) {
      expect(john.events?.find((e) => e.type === type)?.tag).toBe('EVEN');
    }

    // Permanent number → REFN.
    expect(john.identifiers).toEqual([{ tag: 'REFN', payload: '12345' }]);

    // Negatives → NO structures.
    expect(john.nonEvents).toEqual([{ tag: 'NO', payload: 'DEAT' }, { tag: 'NO', payload: 'MARR' }]);

    // Marriage-related → MARR / FAM.EVEN + TYPE.
    const family = fam(dataset, '@F1@');
    const marr = family.events?.find((e) => e.tag === 'MARR');
    expect(marr?.type).toBe('Common law marriage');
    expect(marr?.detail?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1910 });
    expect(family.events?.find((e) => e.tag === 'EVEN' && e.type === 'Marriage bond')).toBeDefined();
    expect(family.events?.find((e) => e.tag === 'EVEN' && e.type === 'Separated')).toBeDefined();
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const first = parseOk551(SAMPLE551);
    const second = parseOk551(ser551(first));
    expect(second).toEqual(first);
  });
});

describe('Brother\'s Keeper tags on output', () => {
  test('5.5.1: standard projection and the vendor negatives', () => {
    const text = ser551(parseOk551(SAMPLE551));
    expect(text).toContain('2 TYPE birth');
    expect(text).toContain('2 TYPE Census name');
    expect(text).toContain('1 FACT Blue');
    expect(text).toContain('2 TYPE Eye color');
    expect(text).toContain('2 TYPE Brit Mila');
    expect(text).toContain('2 DATE 1 JAN 1900');
    expect(text).toContain('1 REFN 12345');
    expect(text).toContain('1 _NMAR');
    expect(text).toContain('1 _NLIV');
    expect(text).toContain('2 TYPE Common law marriage');
    expect(text).toContain('2 DATE 1910');
    expect(text).toContain('2 TYPE Marriage bond');
    expect(text).toContain('2 TYPE Separated');
  });

  test('7.0: the standard structures', () => {
    const text = ser70(parseOk551(SAMPLE551));
    expect(text).toContain('2 TYPE BIRTH');
    expect(text).toContain('2 TYPE OTHER');
    expect(text).toContain('3 PHRASE Census name');
    expect(text).toContain('1 FACT Blue');
    expect(text).toContain('2 TYPE Eye color');
    expect(text).toContain('2 TYPE Brit Mila');
    expect(text).toContain('1 REFN 12345');
    expect(text).toContain('1 NO DEAT');
    expect(text).toContain('1 NO MARR');
    expect(text).toContain('2 TYPE Common law marriage');
    expect(text).toContain('2 TYPE Marriage bond');
    expect(text).toContain('2 TYPE Separated');
  });

  test('a NO with substructures is still dropped on 5.5.1', () => {
    const result = parseGedcom70(enc(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 NO MARR',
        '2 DATE TO 1880',
        '0 TRLR',
      ].join('\n'),
    ));
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const text = ser551(result.value);
    expect(text).not.toContain('NO ');
    expect(text).not.toContain('_NMAR');
  });
});
