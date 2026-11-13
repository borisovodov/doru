// Typing coverage for the vendor tags found by the corpus run: the
// name-level married-name and "also known as" tags, the MyHeritage
// _MHID, the FOAF submitter ids, the My Family Tree header title and
// statistics, the Ancestry header tree id, the My Family Tree _TASK
// record, the GEDCOM 5.5.5 draft / RootsMagic _EVDEF record, and the
// GEDKeeper _GRP / _PLC records. Each case parses, round-trips
// model-stably and writes the canonical spelling.

import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';
import { isFamilyRecord, isIndividualRecord } from '../src/structures';
import { isPlaceRecord } from '../src/structures';

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

function indiOf(dataset: GedcomDataset, xref: string) {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || !isIndividualRecord(record)) {
    throw new Error(`expected ${xref} INDI`);
  }
  return record;
}

function famOf(dataset: GedcomDataset, xref: string) {
  const record = dataset.records.find((r) => r.xref === xref);
  if (record === undefined || !isFamilyRecord(record)) {
    throw new Error(`expected ${xref} FAM`);
  }
  return record;
}

function submittersOf(dataset: GedcomDataset) {
  return dataset.records.filter((r) => r.tag === 'SUBM');
}

describe('the name-level married-name and also-known-as tags', () => {
  const SAMPLE = [
    '0 HEAD',
    '1 SOUR X',
    '1 SUBM @S1@',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '0 @S1@ SUBM',
    '1 NAME T',
    '0 @I1@ INDI',
    '1 NAME Jane /Doe/',
    '2 _MARNM Smith',
    '2 _AKA Honda',
    '2 _AKAN Honda-san',
    '0 TRLR',
    '',
  ].join('\n');

  test('_MARNM and _AKA/_AKAN parse into the name structure and round-trip', () => {
    const dataset = parseOk551(SAMPLE);
    const name = indiOf(dataset, '@I1@').names?.[0];
    expect(name?.marriedName).toBe('Smith');
    expect(name?.alsoKnownAs).toEqual(['Honda', 'Honda-san']);
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _MARNM Smith');
    expect(serialized).toContain('2 _AKA Honda');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test("_MARN (the Brother's Keeper spelling) normalizes into the same slot", () => {
    const text = SAMPLE.replace('2 _MARNM Smith', '2 _MARN Smith');
    const dataset = parseOk551(text);
    expect(indiOf(dataset, '@I1@').names?.[0]?.marriedName).toBe('Smith');
    expect(ser551(dataset)).toContain('2 _MARNM Smith');
  });
});

describe('the MyHeritage _MHID under INDI and FAM', () => {
  const SAMPLE = [
    '0 HEAD',
    '1 SOUR MYHERITAGE',
    '1 SUBM @S1@',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '0 @S1@ SUBM',
    '1 NAME T',
    '0 @I1@ INDI',
    '1 NAME Jane /Doe/',
    '1 _MHID individual-12345',
    '0 @F1@ FAM',
    '1 _MHID family-555',
    '0 TRLR',
    '',
  ].join('\n');

  test('parses, writes back and round-trips', () => {
    const dataset = parseOk551(SAMPLE);
    expect(indiOf(dataset, '@I1@').myHeritageId).toBe('individual-12345');
    expect(famOf(dataset, '@F1@').myHeritageId).toBe('family-555');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _MHID individual-12345');
    expect(serialized).toContain('1 _MHID family-555');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the FOAF _SKYPEID / _JABBERID under SUBM', () => {
  test('the official maximal70 form parses and round-trips', () => {
    const text = [
      '0 HEAD',
      '1 SCHMA',
      '2 TAG _SKYPEID http://xmlns.com/foaf/0.1/skypeID',
      '2 TAG _JABBERID http://xmlns.com/foaf/0.1/jabberID',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @U1@ SUBM',
      '1 NAME Submitter 1',
      '1 _SKYPEID example.person',
      '1 _JABBERID person@example.com',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk70(text);
    const submitter = submittersOf(dataset)[0];
    expect(submitter?.tag).toBe('SUBM');
    if (submitter?.tag !== 'SUBM') {
      return;
    }
    expect(submitter.skypeId).toBe('example.person');
    expect(submitter.jabberId).toBe('person@example.com');
    const serialized = ser70(dataset);
    expect(serialized).toContain('1 _SKYPEID example.person');
    expect(serialized).toContain('1 _JABBERID person@example.com');
    expect(parseOk70(serialized)).toEqual(dataset);
  });
});

describe('the My Family Tree header title and statistics', () => {
  test('_TITL and _STS parse and round-trip', () => {
    const text = [
      '0 HEAD',
      '1 SOUR MyFamilyTree',
      '2 VERS 9.4.0.0',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      '1 _TITL The English and British Kings and Queens',
      '1 _STS',
      '2 INDI 179',
      '2 FAM 85',
      '2 SOUR 3',
      '2 _TASK 1',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk551(text);
    expect(dataset.header.title).toBe('The English and British Kings and Queens');
    expect(dataset.header.statistics).toEqual({
      tag: '_STS',
      individuals: '179',
      families: '85',
      sources: '3',
      tasks: '1',
    });
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _TITL The English and British Kings and Queens');
    expect(serialized).toContain('1 _STS');
    expect(serialized).toContain('2 INDI 179');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the Ancestry _TREE under HEAD.SOUR', () => {
  test('parses, writes back and round-trips', () => {
    const text = [
      '0 HEAD',
      '1 SOUR Ancestry.com',
      '2 VERS 1.0',
      '2 NAME Ancestry.com Family Trees',
      '2 _TREE 12345678',
      '3 NOTE the tree',
      '3 RIN 99',
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
    expect(dataset.header.source?.tree).toEqual({
      tag: '_TREE',
      id: '12345678',
      note: 'the tree',
      rin: '99',
    });
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _TREE 12345678');
    expect(serialized).toContain('3 NOTE the tree');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the My Family Tree _TASK record', () => {
  test('normalizes into the to-do record and round-trips', () => {
    const text = [
      '0 HEAD',
      '1 SOUR MyFamilyTree',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 @K0@ _TASK',
      '1 _UID 9D4D4CDC575749B89C4AD8BB3B3DE6EF87C5',
      '1 _TDSC Update Elizabeth II events',
      '1 _TTIL Event',
      '1 _TSDT V02C0000S01150820110000000E01000000000000000T',
      '1 _TCDT V02C0000S01140220120000000E01000000000000000T',
      '1 _TSTS InProgress',
      '1 _TPTY High',
      '1 CHAN',
      '2 DATE 30 DEC 2015',
      '3 TIME 18:04:59.190',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk551(text);
    const task = dataset.records.find((r) => r.tag === '_TODO');
    expect(task).toMatchObject({
      tag: '_TODO',
      xref: '@K0@',
      payload: 'Update Elizabeth II events',
      title: 'Event',
      status: 'InProgress',
      priority: 'High',
      scheduledDate: 'V02C0000S01150820110000000E01000000000000000T',
      createdDate: 'V02C0000S01140220120000000E01000000000000000T',
      uids: ['9D4D4CDC575749B89C4AD8BB3B3DE6EF87C5'],
    });
    const serialized = ser551(dataset);
    expect(serialized).toContain('0 @K0@ _TODO Update Elizabeth II events');
    expect(serialized).toContain('1 _TTIL Event');
    expect(serialized).toContain('1 _TSTS InProgress');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the GEDCOM 5.5.5 draft / RootsMagic _EVDEF record', () => {
  test('normalizes into the event-definition record and round-trips', () => {
    const text = [
      '0 HEAD',
      '1 SOUR RootsMagic',
      '1 SUBM @S1@',
      '1 GEDC',
      '2 VERS 5.5.1',
      '2 FORM LINEAGE-LINKED',
      '1 CHAR UTF-8',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 _EVDEF BIRT',
      '1 TYPE P',
      '1 TITL Birth',
      '1 ABBR Birth',
      '1 SENT [person] was born< [Date]>< [PlaceDetails]>< [Place]>.',
      '1 ROLE Witness',
      '2 SENT [ThisPerson] witnessed the birth of [person]< [Date]>.',
      '1 PLAC Y',
      '1 DATE Y',
      '1 DESC N',
      '0 TRLR',
      '',
    ].join('\n');
    const dataset = parseOk551(text);
    const definition = dataset.records.find((r) => r.tag === '_EVENT_DEFN');
    expect(definition).toMatchObject({
      tag: '_EVENT_DEFN',
      eventType: 'BIRT',
      kind: 'P',
      title: 'Birth',
      abbreviation: 'Birth',
      sentence: '[person] was born< [Date]>< [PlaceDetails]>< [Place]>.',
      placeType: 'Y',
      dateType: 'Y',
      descriptionFlag: 'N',
      witnessRoles: [
        {
          tag: 'ROLE',
          role: 'Witness',
          sentence: '[ThisPerson] witnessed the birth of [person]< [Date]>.',
        },
      ],
    });
    const serialized = ser551(dataset);
    expect(serialized).toContain('0 _EVENT_DEFN BIRT');
    expect(serialized).toContain('1 ABBR Birth');
    expect(serialized).toContain('1 SENT [person] was born< [Date]>< [PlaceDetails]>< [Place]>.');
    expect(serialized).toContain('2 SENT [ThisPerson] witnessed the birth of [person]< [Date]>.');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the GEDKeeper _GRP and _PLC records', () => {
  const SAMPLE = [
    '0 HEAD',
    '1 SOUR GEDKeeper2',
    '1 SUBM @S1@',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '0 @S1@ SUBM',
    '1 NAME T',
    '0 @G10@ _GRP',
    '1 NAME Emigrant',
    '1 NOTE Personer som emigrerat permanent',
    '0 @0@ _PLC',
    '1 _PLP @1@',
    '1 RIN 799',
    '1 FORM Tving, Karlskrona, Blekinge länge, Sverige',
    '1 NAME Tving',
    '1 TYPE 2',
    '0 @1@ _PLC',
    '1 NAME Karlskrona',
    '0 TRLR',
    '',
  ].join('\n');

  test('the group record parses and round-trips', () => {
    const dataset = parseOk551(SAMPLE);
    const group = dataset.records.find((r) => r.tag === '_GRP');
    expect(group).toMatchObject({
      tag: '_GRP',
      xref: '@G10@',
      name: 'Emigrant',
      notes: [{ tag: 'NOTE', payload: 'Personer som emigrerat permanent' }],
    });
    const serialized = ser551(dataset);
    expect(serialized).toContain('0 @G10@ _GRP');
    expect(serialized).toContain('1 NAME Emigrant');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the place record parses into PlaceRecord and round-trips via 7.0', () => {
    const dataset = parseOk551(SAMPLE);
    const place = dataset.records.find((r) => r.xref === '@0@');
    expect(place?.tag).toBe('_PLAC');
    if (place === undefined || !isPlaceRecord(place)) {
      return;
    }
    expect(place.payload).toBe('Tving');
    expect(place.form).toBe('Tving, Karlskrona, Blekinge länge, Sverige');
    expect(place.automatedRecordId).toBe('799');
    expect(place.types?.[0]).toMatchObject({ type: '2' });
    expect(place.parents?.[0]?.parent).toBe('@1@');
    const serialized = ser70(dataset);
    // The 7.0 emitter writes every card back as a _LOC record.
    expect(serialized).toContain('0 @0@ _LOC');
    expect(serialized).toContain('1 NAME Tving');
    expect(serialized).toContain('1 FORM Tving, Karlskrona, Blekinge länge, Sverige');
    expect(serialized).toContain('1 RIN 799');
    // The cross-version projection changes the header, so assert
    // 7.0 idempotence instead of model equality with the 5.5.1 parse.
    expect(ser70(parseOk70(serialized))).toBe(serialized);
  });
});
