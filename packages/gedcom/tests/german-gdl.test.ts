import { describe, expect, test } from 'vitest';
import { parseGedcom551 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset, PlaceRecord } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parseOk551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }
  return result.value;
}

function ser551(dataset: GedcomDataset): string {
  const result = serializeGedcom551(dataset);
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
  '1 NAME Anna Marie /Schmidt/',
  '2 _RUFNAME Anna',
  '1 BIRT',
  '2 DATE 1 JAN 1900',
  '2 PLAC Weiskirchen',
  '3 _LOC @P1@',
  '3 _GOV WEIHEN_W6051',
  '3 _POST 63110',
  '4 DATE FROM 1 JUL 1993',
  '1 CHR',
  '2 _GODP Max Herbert Mustermann, Musiker',
  '2 _GODP Erna Beispiel',
  '1 FAMC @F1@',
  '0 @F1@ FAM',
  '1 HUSB @I1@',
  '1 MARR',
  '2 _WITN Otto Mustermann, Franz-Xaver Gabler',
  '0 @P1@ _LOC',
  '1 NAME Weiskirchen',
  '2 LANG deu',
  '1 NAME Weiskirchen (alt)',
  '2 DATE TO 1993',
  '1 TYPE Ortsteil',
  '2 _GOVTYPE 123',
  '2 DATE FROM 1938',
  '1 _GOV WEIHEN_W6051',
  '1 _POST 63110',
  '2 DATE FROM 1 JUL 1993',
  '1 _POST W6051',
  '2 DATE TO 30 JUN 1993',
  '1 _AIDN 06438011',
  '2 TYPE Gemeindekennzahl',
  '1 _DMGD 1234 Einwohner',
  '2 TYPE Einwohnerzahl',
  '2 DATE 1990',
  '1 _MAIDENHEAD JO40KB',
  '1 RELI ev',
  '1 EVEN Stadtrecht',
  '2 DATE 1232',
  '1 _LOC @P2@',
  '2 TYPE POLI',
  '2 DATE FROM 1938',
  '1 MAP',
  '2 LATI N50.05',
  '2 LONG E8.883333',
  '0 @P2@ _LOC',
  '1 NAME Hessen',
  '0 TRLR',
].join('\n');

function record(dataset: GedcomDataset, xref: string): PlaceRecord {
  const found = dataset.records.find((r) => r.xref === xref);
  if (found === undefined || found.tag !== '_PLAC') {
    throw new Error(`expected _PLAC ${xref}`);
  }
  return found;
}

describe('the GEDCOM-L German extension on 5.5.1 input', () => {
  test('types the person-side tags', () => {
    const dataset = parseOk551(SAMPLE);
    const indi = dataset.records.find((r) => r.xref === '@I1@');
    if (indi === undefined || indi.tag !== 'INDI') {
      throw new Error('expected @I1@ INDI');
    }
    expect(indi.names?.[0]?.callName).toBe('Anna');
    const birth = indi.events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.place?.govId).toBe('WEIHEN_W6051');
    expect(birth?.detail?.place?.postalCodes).toEqual([
      { code: '63110', date: { value: { kind: 'period', from: { calendar: 'GREGORIAN', day: 1, month: 'JUL', year: 1993 } } } },
    ]);
    expect(birth?.detail?.place?.location).toBe('@P1@');
    const christening = indi.events?.find((e) => e.tag === 'CHR');
    expect(christening?.detail?.godparents).toEqual(['Max Herbert Mustermann, Musiker', 'Erna Beispiel']);
    const family = dataset.records.find((r) => r.xref === '@F1@');
    const marriage = family?.tag === 'FAM' ? family.events?.find((e) => e.tag === 'MARR') : undefined;
    expect(marriage?.detail?.detail?.witnesses).toEqual(['Otto Mustermann, Franz-Xaver Gabler']);
  });

  test('types the _LOC record fields', () => {
    const card = record(parseOk551(SAMPLE), '@P1@');
    expect(card.payload).toBe('Weiskirchen');
    expect(card.names).toEqual([
      { name: 'Weiskirchen', language: 'deu' },
      { name: 'Weiskirchen (alt)', date: { value: { kind: 'period', to: { calendar: 'GREGORIAN', year: 1993 } } } },
    ]);
    expect(card.types).toEqual([
      { type: 'Ortsteil', govTypeId: '123', date: { value: { kind: 'period', from: { calendar: 'GREGORIAN', year: 1938 } } } },
    ]);
    expect(card.govId).toBe('WEIHEN_W6051');
    expect(card.postalCodes).toEqual([
      { code: '63110', date: { value: { kind: 'period', from: { calendar: 'GREGORIAN', day: 1, month: 'JUL', year: 1993 } } } },
      { code: 'W6051', date: { value: { kind: 'period', to: { calendar: 'GREGORIAN', day: 30, month: 'JUN', year: 1993 } } } },
    ]);
    expect(card.administrativeIds).toEqual([
      { identifier: '06438011', type: 'Gemeindekennzahl' },
    ]);
    expect(card.demographicData).toEqual([
      { data: '1234 Einwohner', type: 'Einwohnerzahl', date: { value: { kind: 'date', calendar: 'GREGORIAN', year: 1990 } } },
    ]);
    expect(card.maidenhead).toBe('JO40KB');
    expect(card.denomination).toBe('ev');
    expect(card.events).toEqual([
      { tag: 'EVEN', payload: 'Stadtrecht', detail: { date: { value: { kind: 'date', calendar: 'GREGORIAN', year: 1232 } } } },
    ]);
    expect(card.parents).toEqual([
      { parent: '@P2@', type: 'POLI', date: { value: { kind: 'period', from: { calendar: 'GREGORIAN', year: 1938 } } } },
    ]);
    expect(card.map?.latitude.degrees).toBe(50.05);
  });

  test('round-trips through the 5.5.1 serializer', () => {
    const first = parseOk551(SAMPLE);
    const second = parseOk551(ser551(first));
    expect(second).toEqual(first);
  });
});

describe('the GEDCOM-L German extension on output', () => {
  test('5.5.1 writes the _LOC record back with the pointer', () => {
    const text = ser551(parseOk551(SAMPLE));
    expect(text).toContain('0 @P1@ _LOC');
    expect(text).toContain('1 NAME Weiskirchen');
    expect(text).toContain('2 LANG deu');
    expect(text).toContain('1 TYPE Ortsteil');
    expect(text).toContain('2 _GOVTYPE 123');
    expect(text).toContain('1 _GOV WEIHEN_W6051');
    expect(text).toContain('1 _POST 63110');
    expect(text).toContain('2 DATE FROM 1 JUL 1993');
    expect(text).toContain('1 _POST W6051');
    expect(text).toContain('2 DATE TO 30 JUN 1993');
    expect(text).toContain('1 _AIDN 06438011');
    expect(text).toContain('2 TYPE Gemeindekennzahl');
    expect(text).toContain('1 _DMGD 1234 Einwohner');
    expect(text).toContain('1 _MAIDENHEAD JO40KB');
    expect(text).toContain('1 RELI ev');
    expect(text).toContain('1 EVEN Stadtrecht');
    expect(text).toContain('2 DATE 1232');
    expect(text).toContain('1 _LOC @P2@');
    expect(text).toContain('2 TYPE POLI');
    expect(text).toContain('3 _LOC @P1@');
    expect(text).toContain('3 _GOV WEIHEN_W6051');
    expect(text).toContain('3 _POST 63110');
    expect(text).toContain('2 _RUFNAME Anna');
    expect(text).toContain('2 _GODP Max Herbert Mustermann, Musiker');
    expect(text).toContain('2 _WITN Otto Mustermann, Franz-Xaver Gabler');
  });

  test('7.0 flattens the records but keeps the event-level German tags', () => {
    const text = ser70(parseOk551(SAMPLE));
    // The _LOC records and the record-only fields flatten away.
    expect(text).not.toContain('_LOC');
    expect(text).not.toContain('_AIDN');
    expect(text).not.toContain('_DMGD');
    expect(text).not.toContain('_GOVTYPE');
    // The event- and name-level vendor tags have no standard
    // equivalent and are written back in both versions.
    expect(text).toContain('_GOV WEIHEN_W6051');
    expect(text).toContain('_POST 63110');
    // _MAIDENHEAD sits on the record in the sample, so it flattens
    // away; only the event-level German tags survive in 7.0.
    expect(text).not.toContain('_MAIDENHEAD');
    expect(text).toContain('_RUFNAME Anna');
    expect(text).toContain('_GODP Max Herbert Mustermann, Musiker');
    expect(text).toContain('_WITN Otto Mustermann, Franz-Xaver Gabler');
    // The card's map is merged into the referencing place (level 3,
    // under the level-2 PLAC).
    expect(text).toContain('3 MAP');
    expect(text).toContain('4 LATI N50.05');
  });
});
