import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';
import { isEvidenceRecord, isOccurrenceRecord, isResearchDocumentRecord } from '../src/structures';

// Typing coverage for the third corpus round: the Ancestry.com Family
// Trees media-record block (_OID/_USER/_ENCR/_ORIG/_ATL/_META/_CLON
// under OBJE) and the RIN repeated under events. Each case parses,
// round-trips model-stably and writes the canonical spelling.

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

describe('the glamberson documented extensions (round 10)', () => {
  test('the v1 evidence shapes: _EVID records, links, _RDOC and _RACT', () => {
    // The gedcom-evidence examples/basic-evidence.ged shape
    // (specification.md v1).
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @S1@ SOUR',
        '1 TITL 1850 Census',
        '0 @E1@ _EVID',
        '1 _TYPE Person',
        '1 _ID John Smith',
        '1 _ID aged 40',
        '1 SOUR @S1@',
        '2 PAGE Page 247, Line 12',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '1 _EVID @E1@',
        '2 _CONF 5',
        '2 NOTE Census record matches known facts',
        '0 @R1@ _RDOC',
        '1 _TITL Analysis',
        '1 _TEXT The ages match.',
        '1 _EVID @E1@',
        '1 _CONC',
        '2 _SUBJ @I1@',
        '2 _TEXT Definitely identified',
        '1 AUTH Jane Researcher',
        '0 @A1@ _RACT',
        '1 _TYPE Search',
        '1 _RSLT NotFound',
        '1 DATE 20 JAN 2025',
        '1 _FIND No birth record',
        '2 _EVID @E1@',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const evid = dataset.records.find(isEvidenceRecord);
    if (evid === undefined) {
      throw new Error('expected _EVID');
    }
    expect(evid.type).toBe('Person');
    expect(evid.identifiers).toEqual(['John Smith', 'aged 40']);
    expect(evid.citations?.[0]?.page?.payload).toBe('Page 247, Line 12');
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    // The v1 `_EVID` link normalizes into the `_EVREF` slot.
    expect(indi.evidence?.[0]?.tag).toBe('_EVREF');
    expect(indi.evidence?.[0]?.evidence).toBe('@E1@');
    expect(indi.evidence?.[0]?.confidence).toBe('5');
    const rdoc = dataset.records.find(isResearchDocumentRecord);
    if (rdoc === undefined) {
      throw new Error('expected _RDOC');
    }
    expect(rdoc.title).toBe('Analysis');
    expect(rdoc.conclusions?.[0]).toEqual({ tag: '_CONC', subject: '@I1@', text: 'Definitely identified' });
    const ract = dataset.records.find((r) => r.tag === '_RACT');
    if (ract === undefined || !('result' in ract)) {
      throw new Error('expected _RACT');
    }
    expect(ract.result).toBe('NotFound');
    expect(ract.findings?.[0]?.evidence).toEqual(['@E1@']);
    // Both versions write the constructs back; the link as `_EVREF`.
    for (const ser of [ser551(dataset), ser70(dataset)]) {
      expect(ser).toContain('0 @E1@ _EVID');
      expect(ser).toContain('1 _EVREF @E1@');
      expect(ser).toContain('2 _CONF 5');
      expect(ser).toContain('0 @R1@ _RDOC');
      expect(ser).toContain('0 @A1@ _RACT');
    }
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
    const out551 = ser551(dataset);
    expect(ser551(parseOk551(out551))).toBe(out551);
  });

  test('the v2 evidence shapes: _EVREF, _EVEN_EVID, _FIND, _DTYPE', () => {
    // The registry YAML shapes (record-EVID.yaml, _EVREF.yaml,
    // _EVEN_EVID.yaml, _FIND.yaml) of the pattern1/pattern2 examples.
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @S1@ SOUR',
        '1 TITL t',
        '0 @E1@ _EVID',
        '1 _DTYPE Census',
        '1 DATE 7 JUN 1850',
        '1 SOUR @S1@',
        '1 _FIND John Smith, age 42, farmer',
        '2 TYPE Personal Information',
        '2 AGE 42y',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '1 _EVREF @E1@',
        '2 _CONF High',
        '2 _USED Name and age match',
        '2 QUAY 3',
        '1 _EVEN_EVID',
        '2 TYPE Evidence Discovery',
        '2 SOUR @S1@',
        '2 _FIND born 4 May 1823',
        '3 TYPE Birth Information',
        '2 _CONF Medium',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const evid = dataset.records.find(isEvidenceRecord);
    if (evid === undefined) {
      throw new Error('expected _EVID');
    }
    expect(evid.documentType).toBe('Census');
    expect(evid.findings?.[0]?.payload).toBe('John Smith, age 42, farmer');
    expect(evid.findings?.[0]?.type).toBe('Personal Information');
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.evidence?.[0]).toMatchObject({
      tag: '_EVREF',
      evidence: '@E1@',
      confidence: 'High',
      used: 'Name and age match',
      quality: '3',
    });
    expect(indi.evidenceEvents?.[0]?.type).toBe('Evidence Discovery');
    expect(indi.evidenceEvents?.[0]?.findings?.[0]?.type).toBe('Birth Information');
    expect(indi.evidenceEvents?.[0]?.confidence).toBe('Medium');
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
    const out551 = ser551(dataset);
    expect(ser551(parseOk551(out551))).toBe(out551);
  });

  test('the gedcom-tags records and applications round-trip', () => {
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @T1@ _TAG',
        '1 NAME DNA Match',
        '1 _COLOR #00FF00',
        '1 _ATTR priority',
        '2 _VALUE high',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '1 _TAG @T1@',
        '2 DATE 15 DEC 2024',
        '2 NOTE 3rd cousin match',
        '0 @N1@ NOTE A shared note',
        '1 _TAG @T1@',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const tag = dataset.records.find((r) => r.tag === '_TAG');
    if (tag === undefined || !('color' in tag)) {
      throw new Error('expected _TAG');
    }
    expect(tag.name).toBe('DNA Match');
    expect(tag.color).toBe('#00FF00');
    expect(tag.attributes?.[0]).toEqual({ tag: '_ATTR', payload: 'priority', value: 'high' });
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.tagLinks?.[0]?.target).toBe('@T1@');
    expect(indi.tagLinks?.[0]?.notes?.[0]).toMatchObject({ payload: '3rd cousin match' });
    const note = dataset.records.find((r) => r.tag === 'NOTE');
    expect(note !== undefined && 'tagLinks' in note ? note.tagLinks[0]?.target : undefined).toBe('@T1@');
    for (const ser of [ser551(dataset), ser70(dataset)]) {
      expect(ser).toContain('0 @T1@ _TAG');
      expect(ser).toContain('1 _COLOR #00FF00');
      expect(ser).toContain('1 _ATTR priority');
      expect(ser).toContain('2 _VALUE high');
      expect(ser).toContain('1 _TAG @T1@');
    }
    // The NOTE record projects onto SNOTE in 7.0 and keeps its tag
    // links there; both outputs are idempotent.
    const out70 = ser70(dataset);
    const reparsed70 = parseOk70(out70);
    const snote = reparsed70.records.find((r) => r.tag === 'SNOTE');
    expect(snote !== undefined && 'tagLinks' in snote ? snote.tagLinks[0]?.target : undefined).toBe('@T1@');
    expect(ser70(reparsed70)).toBe(out70);
    const out551 = ser551(dataset);
    expect(ser551(parseOk551(out551))).toBe(out551);
  });

  test('the extended ASSO fields type and round-trip', () => {
    // The gedcom-extended-ASSO specification.md shapes.
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 ASSO @I2@',
        '2 ROLE Godfather',
        '2 _TYPE Godparent',
        '2 _PERIOD',
        '3 _START 15 MAY 1850',
        '3 _END 15 MAY 1868',
        '2 _CONF 4',
        '2 _PRIV Y',
        '2 NOTE Spiritual guardian',
        '0 @I2@ INDI',
        '1 NAME C /D/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const asso = indi.associations?.[0];
    expect(asso?.specificType).toBe('Godparent');
    expect(asso?.period?.start?.value).toMatchObject({ day: 15, month: 'MAY', year: 1850 });
    expect(asso?.period?.end?.value).toMatchObject({ day: 15, month: 'MAY', year: 1868 });
    expect(asso?.confidence).toBe('4');
    expect(asso?.private).toBe(true);
    for (const ser of [ser551(dataset), ser70(dataset)]) {
      expect(ser).toContain('2 _TYPE Godparent');
      expect(ser).toContain('2 _PERIOD');
      expect(ser).toContain('2 _CONF 4');
      expect(ser).toContain('2 _PRIV Y');
    }
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
  });

  test('the occurrence v0.2.0 grammar: _OCREF data, FAM superstructure, event position, _OCUR extras', () => {
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @O1@ _OCUR',
        '1 TYPE Census',
        '1 AGNC NARA',
        '1 _ATTR Schedule_Type',
        '2 _VALUE Population',
        '1 _PART @F1@',
        '2 ROLE Household',
        '2 SOUR @S1@',
        '0 @S1@ SOUR',
        '1 TITL t',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 _OCREF @O1@',
        '2 ROLE Head',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '1 CENS',
        '2 DATE 1850',
        '2 _OCREF @O1@',
        '3 ROLE Head',
        '3 AGE 45y',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const ocur = dataset.records.find(isOccurrenceRecord);
    if (ocur === undefined) {
      throw new Error('expected _OCUR');
    }
    expect(ocur.agency).toBe('NARA');
    expect(ocur.attributes?.[0]).toEqual({ tag: '_ATTR', payload: 'Schedule_Type', value: 'Population' });
    expect(ocur.participants?.[0]?.individual).toBe('@F1@');
    expect(ocur.participants?.[0]?.citations?.length).toBe(1);
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    expect(fam?.tag === 'FAM' ? fam.occurrences?.[0]?.role : undefined).toBe('Head');
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const cens = indi.events?.find((e) => e.tag === 'CENS');
    expect(cens?.detail?.occurrences?.[0]?.occurrence).toBe('@O1@');
    expect(cens?.detail?.occurrences?.[0]?.role).toBe('Head');
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
    const out551 = ser551(dataset);
    expect(ser551(parseOk551(out551))).toBe(out551);
  });

  test('the NAME-level evidence link of the gramps census example types', () => {
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @E1@ _EVID',
        '1 _ID John Smith (census)',
        '1 SOUR @S1@',
        '0 @S1@ SOUR',
        '1 TITL t',
        '0 @I1@ INDI',
        '1 NAME John /Smith/',
        '2 TYPE Birth',
        '2 _EVID @E1@',
        '3 _CONF Medium',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.evidence?.[0]).toMatchObject({ tag: '_EVREF', evidence: '@E1@', confidence: 'Medium' });
    const ser = ser70(dataset);
    expect(ser).toContain('2 _EVREF @E1@');
    expect(parseOk70(ser)).toEqual(dataset);
  });
});
