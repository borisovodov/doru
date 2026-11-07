// Typing coverage for the second corpus round: the Hutson source
// conventions (_URL/_CONF/_ACC under SOUR, _CONF/NAME/_QUAL under
// citations), the RootsMagic _AMTID, the Ancestris _SOSADABOVILLE,
// the Ancestry _ENV under HEAD.SOUR._TREE, the glamberson _OCUR
// occurrence records, the ELF schema declarations (PRFX/IRI/TAG/ISA/
// LANG), the SOUR-record FILE attachments, the standard DATE under
// NAME, and the FAM-event tags under INDI (normalized to EVEN +
// TYPE). Each case parses, round-trips model-stably and writes the
// canonical spelling.

import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

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

const HEAD551 = [
  '0 HEAD',
  '1 SOUR X',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '0 @S1@ SUBM',
  '1 NAME T',
].join('\n');

describe('the Hutson source conventions', () => {
  const SAMPLE = [
    HEAD551,
    '0 @S2@ SOUR',
    '1 TITL The source',
    '1 _URL https://example.com/',
    '1 _CONF Secondary',
    '1 _ACC 2026-07-11',
    '1 FILE census.jpg',
    '0 @I1@ INDI',
    '1 NAME Jane /Doe/',
    '1 BIRT',
    '2 DATE 1990',
    '2 SOUR @S2@',
    '3 PAGE page 1',
    '3 _CONF Primary',
    '3 NAME The cited thing',
    '3 _QUAL',
    '4 _INFO P',
    '0 TRLR',
    '',
  ].join('\n');

  test('parses the record-level and citation-level fields and round-trips', () => {
    const dataset = parseOk551(SAMPLE);
    const source = dataset.records.find((r) => r.tag === 'SOUR');
    expect(source).toMatchObject({
      tag: 'SOUR',
      url: 'https://example.com/',
      confidence: 'Secondary',
      accessDate: '2026-07-11',
      files: [{ tag: 'FILE', payload: 'census.jpg' }],
    });
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.citations?.[0]).toMatchObject({
      tag: 'SOUR',
      confidence: 'Primary',
      name: 'The cited thing',
      qualityAssessment: { tag: '_QUAL', information: 'P' },
    });
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _URL https://example.com/');
    expect(serialized).toContain('1 _CONF Secondary');
    expect(serialized).toContain('1 _ACC 2026-07-11');
    expect(serialized).toContain('1 FILE census.jpg');
    expect(serialized).toContain('3 _CONF Primary');
    expect(serialized).toContain('3 NAME The cited thing');
    expect(serialized).toContain('3 _QUAL');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the RootsMagic _AMTID and the Ancestris _SOSADABOVILLE', () => {
  test('parse and round-trip', () => {
    const text = [
      HEAD551,
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 _AMTID 412781982829:1030:210595317',
      '1 _SOSADABOVILLE 1 G1',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk551(text);
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.ancestryMemberTreeId).toBe('412781982829:1030:210595317');
    expect(indi.sosaDAboville).toBe('1 G1');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _AMTID 412781982829:1030:210595317');
    expect(serialized).toContain('1 _SOSADABOVILLE 1 G1');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the Ancestry _ENV under HEAD.SOUR._TREE', () => {
  test('parses and round-trips', () => {
    const text = [
      '0 HEAD',
      '1 SOUR Ancestry.com Family Trees',
      '2 NAME Ancestry.com Member Trees',
      '2 VERS 2025.08',
      '2 _TREE LayoutTest',
      '3 RIN 210370967',
      '3 _ENV prd',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk551(text);
    expect(dataset.header.source?.tree).toMatchObject({
      tag: '_TREE',
      id: 'LayoutTest',
      rin: '210370967',
      environment: 'prd',
    });
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 _ENV prd');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the glamberson _OCUR occurrence records', () => {
  test('parse, round-trip and write the participants', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @S1@ SOUR',
      '1 TITL The source',
      '0 @O1@ _OCUR',
      '1 TYPE Marriage',
      '1 DATE 14 FEB 1848',
      '1 PLAC Boston, Massachusetts',
      '1 _PART @I1@',
      '2 ROLE Groom',
      '2 AGE 43y',
      '1 SOUR @S1@',
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 _OCREF @O1@',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk70(text);
    const occurrence = dataset.records.find((r) => r.tag === '_OCUR');
    expect(occurrence).toMatchObject({
      tag: '_OCUR',
      xref: '@O1@',
      type: 'Marriage',
      participants: [{ tag: '_PART', individual: '@I1@', role: 'Groom' }],
    });
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.occurrences).toEqual([{ tag: '_OCREF', occurrence: '@O1@' }]);
    const serialized = ser70(dataset);
    expect(serialized).toContain('0 @O1@ _OCUR');
    expect(serialized).toContain('1 _PART @I1@');
    expect(serialized).toContain('1 _OCREF @O1@');
    expect(ser70(parseOk70(serialized))).toBe(serialized);
    expect(parseOk70(serialized)).toEqual(dataset);
  });
});

describe('the ELF schema declarations', () => {
  test('PRFX and IRI entries parse and round-trip on 5.5.1 input', () => {
    const text = [
      '0 HEAD',
      '1 CHAR UTF-8',
      '1 SOUR X',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 SCHMA',
      '2 PRFX elf https://terms.fhiso.org/elf/',
      '2 IRI elf:ADDRESS',
      '3 TAG ADDR elf:Agent elf:Event',
      '2 IRI elf:ADOPTION',
      '3 ISA elf:IndividualEvent',
      '3 TAG ADOP elf:INDIVIDUAL_RECORD',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk551(text);
    expect(dataset.header.schema?.prefixes).toEqual([
      { tag: 'PRFX', prefix: 'elf', uri: 'https://terms.fhiso.org/elf/' },
    ]);
    expect(dataset.header.schema?.elfDefinitions).toEqual([
      { tag: 'IRI', iri: 'elf:ADDRESS', tagValues: ['ADDR elf:Agent elf:Event'] },
      { tag: 'IRI', iri: 'elf:ADOPTION', parents: ['elf:IndividualEvent'], tagValues: ['ADOP elf:INDIVIDUAL_RECORD'] },
    ]);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 SCHMA');
    expect(serialized).toContain('2 PRFX elf https://terms.fhiso.org/elf/');
    expect(serialized).toContain('2 IRI elf:ADDRESS');
    expect(serialized).toContain('3 TAG ADDR elf:Agent elf:Event');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the standard DATE under NAME and the FAM events under INDI', () => {
  test('DATE under NAME types into the name date slot', () => {
    const text = [
      HEAD551,
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '2 DATE FROM 1900 TO 1920',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk551(text);
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.date).toBeDefined();
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _DATE');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('MARR under INDI normalizes into EVEN + TYPE Marriage', () => {
    const text = [
      HEAD551,
      '0 @I1@ INDI',
      '1 NAME Jane /Doe/',
      '1 MARR',
      '2 DATE 23 OCT 752',
      '2 PLAC Somewhere',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk551(text);
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]).toMatchObject({
      tag: 'EVEN',
      type: 'Marriage',
    });
    expect(indi.events?.[0]?.detail?.date).toBeDefined();
    expect(indi.events?.[0]?.detail?.place?.payload).toEqual(['Somewhere']);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 EVEN');
    expect(serialized).toContain('2 TYPE Marriage');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});
