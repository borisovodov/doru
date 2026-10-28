import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset, IndividualRecord, PlaceRecord } from '../src/structures';

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

const HEADER551 = [
  '0 HEAD',
  '1 SOUR PAF',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
  '0 @S1@ SUBM',
  '1 NAME T',
];

function places(dataset: GedcomDataset): PlaceRecord[] {
  return dataset.records.filter((record): record is PlaceRecord => record.tag === '_PLAC');
}

function indi(dataset: GedcomDataset, xref: string): IndividualRecord {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || record.tag !== 'INDI') {
    throw new Error(`expected INDI ${xref}`);
  }
  return record;
}

describe('place records on 5.5.1 input', () => {
  test('RootsMagic name cards: linked by name, xref minted on first link', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 BIRT',
        '2 PLAC Ames, Iowa',
        '0 _PLAC Ames, Iowa',
        '1 MAP',
        '2 LATI N42.034722',
        '2 LONG W93.62',
        '0 _PLAC Unreferenced, Iowa',
        '0 TRLR',
      ].join('\n'),
    );
    const cards = places(dataset);
    expect(cards).toHaveLength(2);
    const ames = cards.find((c) => c.payload === 'Ames, Iowa');
    const other = cards.find((c) => c.payload === 'Unreferenced, Iowa');
    // The referenced card got a synthesized xref; the other stayed xref-less.
    expect(ames?.xref).toMatch(/^@_SYNP\d+@$/);
    expect(other?.xref).toBeUndefined();
    expect(ames?.map).toEqual({
      latitude: { direction: 'N', degrees: 42.034722 },
      longitude: { direction: 'W', degrees: 93.62 },
    });
    const birth = indi(dataset, '@I1@').events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.place?.location).toBe(ames?.xref);
  });

  test('Legacy _PLAC_DEFN: name from the PLAC child, abbreviation typed', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 BIRT',
        '2 PLAC Ames, Iowa, United States',
        '0 _PLAC_DEFN',
        '1 PLAC Ames, Iowa, United States',
        '1 ABBR Ames, IA',
        '0 TRLR',
      ].join('\n'),
    );
    const card = places(dataset)[0];
    expect(card?.payload).toBe('Ames, Iowa, United States');
    expect(card?.abbreviation).toBe('Ames, IA');
    const birth = indi(dataset, '@I1@').events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.place?.location).toBe(card?.xref);
  });

  test('5.5EL _LOC: name from NAME child, hierarchy parent, explicit pointer', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 DEAT',
        '2 PLAC Ames, Iowa, United States',
        '3 _LOC @L1@',
        '0 @L1@ _LOC',
        '1 NAME Ames',
        '1 _LOC @L2@',
        '0 @L2@ _LOC',
        '1 NAME Iowa',
        '0 TRLR',
      ].join('\n'),
    );
    const ames = places(dataset).find((c) => c.xref === '@L1@');
    expect(ames?.payload).toBe('Ames');
    expect(ames?.parents?.[0]?.parent).toBe('@L2@');
    expect(places(dataset).find((c) => c.xref === '@L2@')?.payload).toBe('Iowa');
    const death = indi(dataset, '@I1@').events?.find((e) => e.tag === 'DEAT');
    expect(death?.detail?.place?.location).toBe('@L1@');
  });

  test('Family Historian: second _PLAC under an event and an xref card', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 EMIG',
        '2 PLAC Ames, Iowa',
        '2 _PLAC Parma, Ohio',
        '0 @P1@ _PLAC Ames, Iowa',
        '0 TRLR',
      ].join('\n'),
    );
    const emig = indi(dataset, '@I1@').events?.find((e) => e.tag === 'EMIG');
    expect(emig?.detail?.additionalPlaces?.[0]?.payload).toEqual(['Parma', 'Ohio']);
    expect(emig?.detail?.place?.location).toBe('@P1@');
  });
});

describe('place records on export', () => {
  const sample = (): GedcomDataset =>
    parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 BIRT',
        '2 PLAC Ames, Iowa',
        '1 EMIG',
        '2 PLAC Ames, Iowa',
        '2 _PLAC Parma, Ohio',
        '0 @P1@ _PLAC Ames, Iowa',
        '1 MAP',
        '2 LATI N42.034722',
        '2 LONG W93.62',
        '1 NOTE Card note',
        '0 TRLR',
      ].join('\n'),
    );

  test('5.5.1: cards flatten into the standard PLAC, links and cards are not written', () => {
    const text = ser551(sample());
    // No card records, no _LOC links; the additional place stays a vendor tag.
    expect(text).not.toContain('0 _PLAC');
    expect(text).not.toContain('_LOC');
    expect(text).toContain('2 _PLAC Parma, Ohio');
    // The card's map and note are merged into the referencing PLAC.
    expect(text).toContain('3 MAP');
    expect(text).toContain('4 LATI N42.034722');
    expect(text).toContain('3 NOTE Card note');
  });

  test('7.0: the card survives as a _LOC extension record, links kept, nothing merged', () => {
    const text = ser70(sample());
    // The card is written back as a _LOC extension record (GEDCOM 7.0
    // §1.5 allows extension records) with its name, map and note on the
    // card; the referencing places keep the _LOC pointer instead of
    // receiving merged copies.
    expect(text).toContain('0 @P1@ _LOC');
    expect(text).toContain('1 NAME Ames, Iowa');
    expect(text).toContain('1 MAP');
    expect(text).toContain('2 LATI N42.034722');
    expect(text).toContain('1 NOTE Card note');
    expect(text).toContain('3 _LOC @P1@');
    expect(text).not.toContain('3 MAP');
    expect(text).not.toContain('3 NOTE Card note');
    expect(text).toContain('2 _PLAC Parma, Ohio');
  });

  test('7.0: the preserved cards round-trip through the 7.0 parser', () => {
    const first = parseOk70(ser70(sample()));
    const second = parseOk70(ser70(first));
    expect(second).toEqual(first);
    const card = second.records.find((record): record is PlaceRecord => record.tag === '_PLAC');
    expect(card?.map).toEqual({
      latitude: { direction: 'N', degrees: 42.034722 },
      longitude: { direction: 'W', degrees: 93.62 },
    });
    expect(card?.notes?.[0]).toEqual({ tag: 'NOTE', payload: 'Card note' });
  });

  test('the event keeps its own map and note when present', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 BIRT',
        '2 PLAC Ames, Iowa',
        '3 MAP',
        '4 LATI N1',
        '4 LONG W2',
        '3 NOTE Event note',
        '0 @P1@ _PLAC Ames, Iowa',
        '1 MAP',
        '2 LATI N42.034722',
        '2 LONG W93.62',
        '1 NOTE Card note',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(dataset);
    // The event's own data survives; the card's copy is not merged over it.
    expect(text).toContain('4 LATI N1');
    expect(text).toContain('3 NOTE Event note');
    expect(text).not.toContain('Card note');
    expect(text).not.toContain('N42.034722');
  });
});

describe('the unified policy on 7.0 input', () => {
  test('types every known vendor tag', () => {
    const dataset = parseOk70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 _UID f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
        '1 BIRT',
        '2 DATE 12 MAR 1923',
        '2 _SDATE 1923',
        '2 _SHAR @I2@',
        '3 _ROLE Witness',
        '1 OBJE @M1@',
        '2 _PRIM Y',
        '1 BURI',
        '2 PLAC Ames, Iowa',
        '3 _LOC @L1@',
        '0 @I2@ INDI',
        '1 NAME Jane /Roe/',
        '0 @I3@ INDI',
        '1 NAME Kid /Doe/',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 CHIL @I3@',
        '2 _FREL Natural',
        '2 _MREL Adopted',
        '1 MARR',
        '2 SOUR @S1@',
        '3 _APID 1,7602::2771226',
        '0 @M1@ OBJE',
        '1 FILE picture.jpg',
        '2 FORM image/jpeg',
        '0 @L1@ _LOC',
        '1 NAME Ames',
        '0 TRLR',
      ].join('\n'),
    );

    const john = indi(dataset, '@I1@');
    expect(john.identifiers).toEqual([{ tag: 'UID', payload: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6' }]);
    const birth = john.events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.sortDate?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1923 });
    expect(birth?.detail?.associations?.[0]).toEqual({
      tag: 'ASSO',
      individual: '@I2@',
      role: { payload: 'OTHER', phrase: 'Witness' },
    });
    expect(john.media?.[0]?.primary).toBe(true);
    const burial = john.events?.find((e) => e.tag === 'BURI');
    expect(burial?.detail?.place?.location).toBe('@L1@');

    const family = dataset.records.find((r) => r.tag === 'FAM');
    if (family === undefined || family.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(family.children?.[0]).toMatchObject({ fatherRelation: 'Natural', motherRelation: 'Adopted' });
    const marr = family.events?.find((e) => e.tag === 'MARR');
    expect(marr?.detail?.detail?.citations?.[0]?.ancestryPointers).toEqual(['1,7602::2771226']);

    expect(places(dataset)).toEqual([expect.objectContaining({ tag: '_PLAC', xref: '@L1@', payload: 'Ames' })]);
  });

  test('round-trips the vendor tags it writes in 7.0', () => {
    const sample = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 _UID f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
      '1 BIRT',
      '2 DATE 12 MAR 1923',
      '2 _SDATE 1923',
      '2 _SHAR @I2@',
      '3 _ROLE Witness',
      '1 OBJE @M1@',
      '2 _PRIM Y',
      '1 EMIG',
      '2 PLAC Ames, Iowa',
      '2 _PLAC Parma, Ohio',
      '0 @I2@ INDI',
      '1 NAME Jane /Roe/',
      '0 @M1@ OBJE',
      '1 FILE picture.jpg',
      '2 FORM image/jpeg',
      '0 TRLR',
    ].join('\n');
    const first = parseOk70(sample);
    const second = parseOk70(ser70(first));
    // No place records in the sample, so nothing flattens: deep equality.
    expect(second).toEqual(first);
  });
});

describe('GEDCOM-L NAME abbreviations (ABBR {0:M})', () => {
  const err551 = (text: string): string => {
    const result = parseGedcom551(enc(text));
    if (result.ok) {
      throw new Error('expected an error');
    }
    return (result.error as { code: string }).code;
  };

  test('parses several abbreviations per name, each with its own TYPE', () => {
    const dataset = parseOk551(
      [
        ...HEADER551,
        '0 @P1@ _LOC',
        '1 NAME Frankfurt am Main',
        '2 ABBR Ffm.',
        '3 TYPE railway',
        '2 ABBR Frankfurt/M.',
        '2 LANG de',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 PLAC Frankfurt am Main',
        '3 _LOC @P1@',
        '0 TRLR',
      ].join('\n'),
    );
    const card = places(dataset)[0];
    expect(card?.names?.[0]?.abbreviations).toEqual([
      { abbreviation: 'Ffm.', type: 'railway' },
      { abbreviation: 'Frankfurt/M.' },
    ]);
    expect(card?.names?.[0]?.language).toBe('de');
  });

  test('rejects a second TYPE under one ABBR', () => {
    expect(
      err551(
        [
          ...HEADER551,
          '0 @P1@ _LOC',
          '1 NAME Frankfurt am Main',
          '2 ABBR Ffm.',
          '3 TYPE railway',
          '3 TYPE other',
          '0 TRLR',
        ].join('\n'),
      ),
    ).toBe('structure.cardinality');
  });

  test('round-trips all abbreviations through the _LOC write-back', () => {
    const first = parseOk551(
      [
        ...HEADER551,
        '0 @P1@ _LOC',
        '1 NAME Frankfurt am Main',
        '2 ABBR Ffm.',
        '3 TYPE railway',
        '2 ABBR Frankfurt/M.',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 PLAC Frankfurt am Main',
        '3 _LOC @P1@',
        '0 TRLR',
      ].join('\n'),
    );
    const text = ser551(first);
    // The card carries the abbreviation and survives as a _LOC record;
    // every abbreviation is written back.
    expect(text).toContain('0 @P1@ _LOC');
    expect(text).toContain('2 ABBR Ffm.');
    expect(text).toContain('3 TYPE railway');
    expect(text).toContain('2 ABBR Frankfurt/M.');
    const second = parseOk551(text);
    expect(places(second)[0]?.names?.[0]?.abbreviations).toEqual(
      places(first)[0]?.names?.[0]?.abbreviations,
    );
    const via70 = parseOk70(ser70(first));
    expect(places(via70)[0]?.names?.[0]?.abbreviations).toEqual(
      places(first)[0]?.names?.[0]?.abbreviations,
    );
  });
});
