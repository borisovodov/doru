import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse(text: string, version: '551' | '70'): GedcomDataset {
  const result = version === '551' ? parseGedcom551(enc(text)) : parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function serialize(dataset: GedcomDataset, version: '551' | '70'): string {
  const result = version === '551' ? serializeGedcom551(dataset) : serializeGedcom70(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

const HEAD551 = ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const HEAD70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', '1 SCHMA'];

describe('extension children of typed structures', () => {
  test('keeps _TCDT and REPO children under their parents', () => {
    for (const version of ['551', '70'] as const) {
      const head = version === '551' ? HEAD551 : HEAD70;
      const text = [
        ...head,
        '0 @R1@ REPO',
        '1 NAME Archive',
        '0 @T1@ _TODO Task',
        '1 REPO @R1@',
        '2 _CALLNO Box 7',
        '1 _TCDT 2026-11-19',
        '2 NOTE imported',
        '0 TRLR',
        '',
      ].join('\n');
      const dataset = parse(text, version);
      const out = serialize(dataset, version);
      const normalized = out.replaceAll('\r\n', '\n');
      expect(normalized).toContain('1 REPO @R1@\n2 _CALLNO Box 7');
      expect(normalized).toContain('1 _TCDT 2026-11-19\n2 NOTE imported');
      expect(serialize(parse(out, version), version).replaceAll('\r\n', '\n')).toContain(
        '1 _TCDT 2026-11-19\n2 NOTE imported',
      );
    }
  });

  test('keeps _QUAY children under the source record', () => {
    for (const version of ['551', '70'] as const) {
      const head = version === '551' ? HEAD551 : HEAD70;
      const text = [...head, '0 @S1@ SOUR', '1 TITL Book', '1 _QUAY 2', '2 TEXT eyewitness', '0 TRLR', ''].join('\n');
      const dataset = parse(text, version);
      const out = serialize(dataset, version);
      const normalized = out.replaceAll('\r\n', '\n');
      expect(normalized).toContain('1 _QUAY 2\n2 TEXT eyewitness');
      expect(serialize(parse(out, version), version).replaceAll('\r\n', '\n')).toContain(
        '1 _QUAY 2\n2 TEXT eyewitness',
      );
    }
  });
});

describe('typed extension fallbacks', () => {
  test('keeps an unknown certainty value as an extension', () => {
    const text = [...HEAD551, '0 @S1@ SOUR', '1 TITL Book', '1 _QUAY high', '0 TRLR', ''].join('\n');
    const dataset = parse(text, '551');
    const out = serialize(dataset, '551');
    expect(out).toContain('1 _QUAY high');
    expect(serialize(parse(out, '551'), '551')).toContain('1 _QUAY high');
  });

  test('keeps void repository children in 7.0 but not in 5.5.1', () => {
    const text = [...HEAD70, '0 @T1@ _TODO Task', '1 REPO @VOID@', '2 _WHY retained', '0 TRLR', ''].join('\n');
    const dataset = parse(text, '70');
    const out70 = serialize(dataset, '70').replaceAll('\r\n', '\n');
    expect(out70).toContain('1 REPO @VOID@\n2 _WHY retained');
    const out551 = serialize(dataset, '551').replaceAll('\r\n', '\n');
    expect(out551).not.toContain('2 _WHY retained');
  });

  test('lets a valid REPO pointer follow repository text', () => {
    const text = [
      ...HEAD551,
      '0 @R1@ REPO',
      '1 NAME Archive',
      '0 @T1@ _TODO Task',
      '1 REPO City Archive',
      '1 REPO @R1@',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parse(text, '551');
    const task = dataset.records.find((record) => record.tag === '_TODO');
    expect(task).toMatchObject({ repository: '@R1@' });
    const out = serialize(dataset, '551');
    expect(out).toContain('1 REPO @R1@');
  });
});
