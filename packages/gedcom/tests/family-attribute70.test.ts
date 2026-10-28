import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err70(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

function err551(text: string): string {
  const result = parseGedcom551(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
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

const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];
const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '0 @S1@ SUBM', '1 NAME Tester'];

// The FAMILY_ATTRIBUTE_STRUCTURE of GEDCOM 7.0 §3.2.3: NCHI/RESI/FACT
// each with TYPE {0:1} and a FAMILY_EVENT_DETAIL (the partners' ages
// plus an EVENT_DETAIL).
const FAM_ATTRIBUTES70 = [
  ...H70,
  '0 @F1@ FAM',
  '1 NCHI 3',
  '2 TYPE Children of record',
  '2 HUSB',
  '3 AGE 40y',
  '4 PHRASE About',
  '2 WIFE',
  '3 AGE 38y',
  '2 NOTE A family note',
  '1 RESI Residence',
  '2 TYPE Family home',
  '2 HUSB',
  '3 AGE 42y',
  '2 WIFE',
  '3 AGE 40y',
  '2 DATE 2000',
  '1 FACT Fact',
  '2 TYPE Family fact',
  '2 HUSB',
  '3 AGE 41y',
  '2 WIFE',
  '3 AGE 39y',
  '0 TRLR',
].join('\n');

describe('GEDCOM 7.0 FAMILY_ATTRIBUTE_STRUCTURE details', () => {
  test('parses TYPE and partner ages under NCHI, RESI and FACT', () => {
    const dataset = parse70(FAM_ATTRIBUTES70);
    const fam = dataset.records[0] as {
      attributes?: Array<{
        tag: string;
        payload?: number | string;
        type?: string;
        detail?: {
          husband?: { age: { payload?: unknown; phrase?: string } };
          wife?: { age: { payload?: unknown; phrase?: string } };
          detail?: { notes?: unknown[]; date?: unknown };
        };
      }>;
    };
    const nchi = fam.attributes?.[0];
    expect(nchi?.tag).toBe('NCHI');
    expect(nchi?.payload).toBe(3);
    expect(nchi?.type).toBe('Children of record');
    expect(nchi?.detail?.husband?.age).toEqual({ payload: { years: 40 }, phrase: 'About' });
    expect(nchi?.detail?.wife?.age?.payload).toEqual({ years: 38 });
    expect(nchi?.detail?.detail?.notes).toHaveLength(1);

    const resi = fam.attributes?.[1];
    expect(resi?.tag).toBe('RESI');
    expect(resi?.payload).toBe('Residence');
    expect(resi?.type).toBe('Family home');
    expect(resi?.detail?.husband?.age?.payload).toEqual({ years: 42 });
    expect(resi?.detail?.wife?.age?.payload).toEqual({ years: 40 });
    expect(resi?.detail?.detail?.date).toBeDefined();

    const fact = fam.attributes?.[2];
    expect(fact?.tag).toBe('FACT');
    expect(fact?.type).toBe('Family fact');
    expect(fact?.detail?.husband?.age?.payload).toEqual({ years: 41 });
    expect(fact?.detail?.wife?.age?.payload).toEqual({ years: 39 });
  });

  test('enforces the cardinalities (TYPE/HUSB/WIFE at most once, AGE required)', () => {
    expect(err70([...H70, '0 @F1@ FAM', '1 NCHI 1', '2 TYPE A', '2 TYPE B', '0 TRLR'].join('\n'))).toBe('structure.cardinality');
    expect(err70([...H70, '0 @F1@ FAM', '1 NCHI 1', '2 HUSB', '3 AGE 40y', '2 HUSB', '3 AGE 41y', '0 TRLR'].join('\n'))).toBe('structure.cardinality');
    expect(err70([...H70, '0 @F1@ FAM', '1 NCHI 1', '2 HUSB', '0 TRLR'].join('\n'))).toBe('structure.missing-required');
  });

  test('round trip keeps the attribute details on 7.0 output', () => {
    const out = ser70(parse70(FAM_ATTRIBUTES70));
    expect(out).toContain('1 NCHI 3');
    expect(out).toContain('2 TYPE Children of record');
    expect(out).toContain('2 HUSB');
    expect(out).toContain('3 AGE 40y');
    expect(out).toContain('4 PHRASE About');
    expect(out).toContain('1 RESI Residence');
    expect(out).toContain('1 FACT Fact');
  });

  test('5.5.1 output drops the NCHI TYPE and detail (its NCHI is bare)', () => {
    const out = ser551(parse70(FAM_ATTRIBUTES70));
    expect(out).toContain('1 NCHI 3');
    expect(out).not.toContain('TYPE Children of record');
    // The NCHI partners' ages (40y/38y) are dropped; the RESI partner
    // ages survive as 5.5.1 family-event substructures.
    expect(out).not.toContain('3 AGE 38y');
  });

  test('5.5.1 input stays strict: NCHI has no substructures there', () => {
    expect(err551([...H551, '0 @F1@ FAM', '1 NCHI 1', '2 TYPE A', '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
  });
});
