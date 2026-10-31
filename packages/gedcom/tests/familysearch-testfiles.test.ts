import { describe, expect, test } from 'vitest';
import { parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';
// The official FamilySearch GEDCOM 7.0 test files (fetched from
// https://gedcom.io/testfiles/gedcom70/), exercising every extension
// form of the specification: SCHMA-declared tags, extension records,
// relocated standard structures, documented extension enumerations,
// calendars, months and epochs, and extension-defined substructures.
// The complete corpus runs in familysearch-corpus.test.ts; the two
// files here carry the deep per-construct assertions.
import extensionsGed from './fixtures/gedcom70/extensions.ged?raw';
import extensionRecordGed from './fixtures/gedcom70/extension-record.ged?raw';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** The serializers emit CRLF line endings. */
const lines = (text: string): string[] => text.split('\r\n');

function parseOk70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value;
}

function ser70(dataset: GedcomDataset): string {
  const result = serializeGedcom70(dataset);
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value;
}

describe('the FamilySearch GEDCOM 7.0 test files (gedcom.io/testfiles/gedcom70/)', () => {
  test('extensions.ged parses with every extension form typed or preserved', () => {
    const dataset = parseOk70(extensionsGed);

    // The SCHMA block: every declared tag is typed.
    expect(dataset.header.schema?.tagDefinitions).toHaveLength(14);
    expect(dataset.header.schema?.tagDefinitions?.[3]).toEqual({
      payload: { tag: '_CALENDAR', uri: 'http://example.com/calendar' },
    });

    // A documented record alias (SCHMA `_USER → g7:record-SUBM`) parses
    // as the standard record it abbreviates.
    const user = dataset.records.find((record) => record.xref === '@U1@');
    expect(user).toEqual({ tag: 'SUBM', xref: '@U1@', name: 'Aliased record' });
    const record = dataset.records.find((entry) => entry.tag === '_RECORD');
    expect(record).toMatchObject({ xref: '@R1@', payload: 'not empty' });

    // The undocumented `_LOC` (no NAME child) is an extension record,
    // its extension-defined DATE/SUBM substructures kept verbatim.
    const loc = dataset.records.find((entry) => entry.xref === '@L1@');
    expect(loc).toEqual({
      tag: '_LOC',
      xref: '@L1@',
      children: [
        // Pointer-shaped payloads inside extensions are marked (see
        // ExtensionStructure.payloadKind) but not resolved.
        { tag: 'SUBM', payload: '@U2@', payloadKind: 'pointer', children: [] },
        { tag: 'DATE', payload: 'TO 1880', children: [{ tag: 'PHRASE', payload: 'Dissolved in the 1870s', children: [] }] },
      ],
    });

    const indi = dataset.records.find((entry) => entry.xref === '@I1@');
    if (indi === undefined || indi.tag !== 'INDI') {
      throw new Error('expected INDI @I1@');
    }
    // A documented substructure alias (`_CREATOR → g7:SUBM`) types into
    // the standard pointer slot; the undocumented `_EXT1` stays generic.
    expect(indi.submitters).toEqual(['@U1@', '@U2@']);
    expect(indi.extensions?.map((entry) => entry.tag)).toEqual(['_EXT1']);
    // The FAMC link: a documented extension enumeration, plus a
    // `_PHRASE` documented as g7:PHRASE — but FAMC has no PHRASE
    // substructure in the 7.0 grammar (only the PEDI/STAT children
    // carry one), so the tag keeps its extension meaning and stays a
    // generic extension of the link, preserved verbatim.
    const famc = indi.childFamilies?.[0];
    expect(famc?.pedigree?.payload).toBe('_ENUMVAL');
    expect(famc?.extensions).toEqual([{ tag: '_PHRASE', payload: 'A Family', children: [] }]);
    expect(indi.childFamilies?.[1]?.pedigree?.payload).toBe('_ENUM2');

    const noxref = dataset.records.find((entry) => entry.tag === 'INDI' && entry.xref === undefined);
    if (noxref === undefined || noxref.tag !== 'INDI') {
      throw new Error('expected the xref-less INDI');
    }
    // Documented extension calendar and month (SCHMA → g7:cal-FRENCH_R
    // and g7:month-COMP) keep their extension spelling.
    const birth = noxref.events?.find((entry) => entry.tag === 'BIRT');
    expect(birth?.detail?.date?.value).toEqual({
      kind: 'range',
      start: { calendar: 'FRENCH_R', day: 2, month: '_JOUR', year: 8 },
      end: { calendar: '_CALENDRIER', day: 4, month: 'COMP', year: 8 },
    });
    // Documented calendar, month and epoch.
    const death = noxref.events?.find((entry) => entry.tag === 'DEAT');
    expect(death?.detail?.date?.value).toEqual({
      kind: 'date',
      calendar: '_CALENDAR',
      day: 8,
      month: '_MONTH',
      year: 190,
      epoch: '_EPOCH',
    });
    // Undocumented calendar, month and epoch.
    const graduation = noxref.events?.find((entry) => entry.tag === 'GRAD');
    expect(graduation?.detail?.date?.value).toEqual({
      kind: 'date',
      calendar: '_CAL2',
      day: 23,
      month: '_MON2',
      year: 88,
      epoch: '_EP2',
    });
    // The undocumented pointer with a shared tag stays an extension on
    // the event itself (pointer-shaped payloads are marked, see
    // ExtensionStructure.payloadKind).
    expect(graduation?.extensions).toEqual([{ tag: '_LOC', payload: '@L1@', payloadKind: 'pointer', children: [] }]);
    // A documented extension enumeration under a standard ROLE.
    expect(noxref.associations?.[0]?.role?.payload).toBe('_CHILD');
    // A documented extension record with a shared tag.
    const party = dataset.records.find((entry) => entry.xref === '@P1@');
    expect(party).toEqual({ tag: '_PARTY', xref: '@P1@', children: [{ tag: 'NAME', payload: 'Spring Fling', children: [] }] });
    // Standard and relocated enumerations under SOUR.DATA.EVEN.
    const source = dataset.records.find((entry) => entry.tag === 'SOUR');
    expect(source?.tag === 'SOUR' ? source.data?.events?.[0]?.payload : undefined).toEqual(['DEAT', '_CHILD']);
    expect(source?.tag === 'SOUR' ? source.data?.events?.[0]?.extensions : undefined).toEqual([
      { tag: '_CREATOR', payload: '@U2@', payloadKind: 'pointer', children: [] },
    ]);
  });

  test('extensions.ged round-trips through the 7.0 serializer (model-stable and idempotent)', () => {
    const first = parseOk70(extensionsGed);
    const text = ser70(first);
    expect(parseOk70(text)).toEqual(first);
    // The output is idempotent: serializing the re-parsed model yields
    // the same wire text.
    expect(ser70(parseOk70(text))).toBe(text);
  });

  test('extension-record.ged parses with the extension place records linked', () => {
    const dataset = parseOk70(extensionRecordGed);
    const card = dataset.records.find((entry) => entry.xref === '@LOC1@');
    expect(card).toMatchObject({
      tag: '_PLAC',
      xref: '@LOC1@',
      payload: 'Town',
      names: [
        {
          name: 'Town',
          date: { value: { kind: 'period', from: { calendar: 'GREGORIAN', year: 1800 }, to: { calendar: 'GREGORIAN', year: 1900 } } },
        },
      ],
      parents: [{ parent: '@LOC2@' }],
    });
    const indi = dataset.records.find((entry) => entry.tag === 'INDI');
    const birth = indi?.tag === 'INDI' ? indi.events?.find((entry) => entry.tag === 'BIRT') : undefined;
    expect(birth?.detail?.place?.location).toBe('@LOC1@');
  });

  test('extension-record.ged round-trips through the 7.0 serializer (model-stable and idempotent)', () => {
    const first = parseOk70(extensionRecordGed);
    const text = ser70(first);
    expect(parseOk70(text)).toEqual(first);
    expect(ser70(parseOk70(text))).toBe(text);
  });
});

describe('the SCHMA-documented extension tag resolution (GEDCOM 7.0 §1.5 / §2.14)', () => {
  const doc = (body: string): string => [
    '0 HEAD',
    '1 GEDC',
    '2 VERS 7.0',
    '1 SCHMA',
    '2 TAG _PERSON https://gedcom.io/terms/v7/record-INDI',
    '2 TAG _WHO https://gedcom.io/terms/v7/SUBM',
    '2 TAG _SN https://gedcom.io/terms/v7/record-SNORE',
    '2 TAG _SUB https://gedcom.io/terms/v7/record-SUBM',
    '2 TAG _NOTE https://gedcom.io/terms/v7/NOTE',
    '2 TAG _WHEN https://gedcom.io/terms/v7/DATE',
    '2 TAG _CHILD https://gedcom.io/terms/v7/enum-CHIL',
    '2 TAG _X http://example.com/x',
    ...body.split('\n'),
    '0 TRLR',
  ].join('\n');

  test('a documented record alias parses as the standard record and is written standard-first', () => {
    const dataset = parseOk70(doc('0 @I1@ _PERSON\n1 NAME John /Doe/\n1 SEX M'));
    const record = dataset.records[0];
    expect(record).toEqual({ tag: 'INDI', xref: '@I1@', names: [{ tag: 'NAME', payload: { given: 'John', surname: 'Doe' } }], sex: 'M' });
    const text = ser70(dataset);
    expect(text).toContain('0 @I1@ INDI');
    expect(parseOk70(text)).toEqual(dataset);
  });

  test('a documented substructure alias types into the standard slot', () => {
    const dataset = parseOk70(doc('0 @U1@ SUBM\n1 NAME T\n0 @I1@ INDI\n1 NAME John /Doe/\n1 _WHO @U1@'));
    const indi = dataset.records.find((entry) => entry.tag === 'INDI');
    expect(indi?.tag === 'INDI' ? indi.submitters : undefined).toEqual(['@U1@']);
    expect(indi?.tag === 'INDI' ? indi.extensions : undefined).toBeUndefined();
    const text = ser70(dataset);
    expect(text).toContain('1 SUBM @U1@');
    // The usage is written standard-first; only the SCHMA declaration
    // keeps the extension spelling.
    expect(lines(text)).not.toContain('1 _WHO @U1@');
    expect(parseOk70(text)).toEqual(dataset);
  });

  test('the shared-note alias (g7:record-SNORE) resolves to SNOTE', () => {
    const dataset = parseOk70(doc('0 @N1@ _SN shared text'));
    expect(dataset.records[0]).toEqual({ tag: 'SNOTE', xref: '@N1@', payload: 'shared text' });
    const text = ser70(dataset);
    expect(text).toContain('0 @N1@ SNOTE shared text');
    expect(parseOk70(text)).toEqual(dataset);
  });

  test('a documented tag without a slot here keeps its extension meaning', () => {
    // `_WHEN → g7:DATE` under INDI: the standard INDI grammar has no
    // DATE slot, so the tag stays a generic extension (the extension
    // may place the standard meaning where the standard cannot).
    const dataset = parseOk70(doc('0 @I1@ INDI\n1 NAME John /Doe/\n1 _WHEN 1900'));
    const indi = dataset.records.find((entry) => entry.tag === 'INDI');
    expect(indi?.tag === 'INDI' ? indi.extensions : undefined).toEqual([{ tag: '_WHEN', payload: '1900', children: [] }]);
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
  });

  test('a payload-type URI (g7:enum-…) does not resolve as a structure', () => {
    const dataset = parseOk70(doc('0 @I1@ INDI\n1 NAME John /Doe/\n1 _CHILD x'));
    const indi = dataset.records.find((entry) => entry.tag === 'INDI');
    expect(indi?.tag === 'INDI' ? indi.extensions?.map((entry) => entry.tag) : undefined).toEqual(['_CHILD']);
  });

  test('a non-g7: URI stays generic', () => {
    const dataset = parseOk70(doc('0 @X1@ _X whatever\n1 _CHILD y'));
    expect(dataset.records[0]).toEqual({ tag: '_X', xref: '@X1@', payload: 'whatever', children: [{ tag: '_CHILD', payload: 'y', children: [] }] });
    expect(parseOk70(ser70(dataset))).toEqual(dataset);
  });

  test('the standard grammar stays strict inside a resolved alias', () => {
    // A documented record alias must satisfy the standard grammar of
    // the record it abbreviates: SUBMITTER_RECORD requires a NAME.
    const result = parseGedcom70(enc(doc('0 @S1@ _SUB')));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('structure.missing-required');
    }
  });
});
