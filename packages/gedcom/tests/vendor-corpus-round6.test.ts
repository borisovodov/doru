import { describe, expect, test } from 'vitest';
import { parseGedcom551 } from '../src/parsing/assemble';
import { serializeGedcom551 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';
import { isPlaceRecord } from '../src/structures';

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

function ser551(dataset: GedcomDataset): string {
  const result = serializeGedcom551(dataset);
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

describe('_TEXT under FILE and _COR under the place card', () => {
  test('_TEXT under the FILE line types into the file text', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @M3@ OBJE',
        '1 FILE C:\\FTM\\US_Presidents_20',
        '2 FORM bmp',
        '2 _TEXT Year: 1880; Census Place: District 14',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    if (obje?.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(obje.files[0]?.text).toBe('Year: 1880; Census Place: District 14');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _TEXT Year: 1880; Census Place: District 14');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_COR under a _PLAC card types into the card map', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @P1@ _PLAC Somewhere',
        '1 _COR',
        '2 _LAD 41',
        '2 _LAM 38',
        '2 _LAS 26',
        '2 _LAN N',
        '2 _LOD 4',
        '2 _LOM 51',
        '2 _LOS 24',
        '2 _LON E',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const plc = dataset.records.find(isPlaceRecord);
    if (plc === undefined) {
      throw new Error('expected _PLAC');
    }
    expect(plc.map?.latitude.direction).toBe('N');
    expect(plc.map?.longitude.direction).toBe('E');
    // The 5.5.1 projection flattens the card into the referencing
    // PLAC payloads; an unreferenced card is dropped entirely.
    const serialized = ser551(dataset);
    expect(serialized).not.toContain('@P1@');
  });
});

describe('the GenoPro entity records', () => {
  test('types the entity records and the INDI containers; round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OCCUPATIONS @occu1@',
        '1 CONTACTS @contact1@',
        '1 EDUCATIONS @edu1@',
        '1 UNIONS @marr1@',
        '1 TWINS @twin1@',
        '0 @occu1@ Occupation',
        '1 COMPANY Otizez',
        '1 INDUSTRY Construction',
        '1 PLAC Belo Horizonte',
        '2 _XREF @p1@',
        '1 DATESTART 2001',
        '1 NOTE Owner',
        '0 @edu1@ Education',
        '1 INSTITUTION Smeltings',
        '1 PLAC Smeltings',
        '0 @contact1@ Contact',
        '1 PLAC Seaford, Sussex, UK',
        '0 @marr1@ Marriage',
        '1 TYPE Civil',
        '1 DATE 2010',
        '0 @twin1@ Twin',
        '1 TWINLINK Fraternal',
        '1 FAMILY @f1@',
        '0 @f1@ FAM',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.occupations).toEqual(['@occu1@']);
    expect(indi.contacts).toEqual(['@contact1@']);
    expect(indi.educations).toEqual(['@edu1@']);
    expect(indi.marriages).toEqual(['@marr1@']);
    expect(indi.twins).toEqual(['@twin1@']);
    const occu = dataset.records.find((r) => r.tag === 'Occupation');
    if (occu?.tag !== 'Occupation') {
      throw new Error('expected Occupation');
    }
    expect(occu.company).toBe('Otizez');
    expect(occu.industry).toBe('Construction');
    expect(occu.place?.placeCard).toBe('@p1@');
    expect(occu.dateStart?.value).toBeDefined();
    const note = occu.notes?.[0];
    expect(note !== undefined && 'payload' in note ? note.payload : undefined).toBe('Owner');
    const marr = dataset.records.find((r) => r.tag === 'Marriage');
    if (marr?.tag !== 'Marriage') {
      throw new Error('expected Marriage');
    }
    expect(marr.type).toBe('Civil');
    expect(marr.date?.value).toBeDefined();
    const twin = dataset.records.find((r) => r.tag === 'Twin');
    if (twin?.tag !== 'Twin') {
      throw new Error('expected Twin');
    }
    expect(twin.kind).toBe('Fraternal');
    expect(twin.family).toBe('@f1@');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 OCCUPATIONS @occu1@');
    expect(serialized).toContain('0 @occu1@ Occupation');
    expect(serialized).toContain('1 COMPANY Otizez');
    expect(serialized).toContain('1 DATESTART 2001');
    expect(serialized).toContain('1 TWINLINK Fraternal');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the corpus-remainder typings (round 6)', () => {
  test('ADDR.NOTE types into AddressStructure.notes and round-trips', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @R1@ REPO', '1 NAME Muriel and Richard Brine', '1 ADDR', '2 NOTE x', '0 TRLR', ''].join('\n'),
    );
    const repo = dataset.records.find((r) => r.tag === 'REPO');
    if (repo?.tag !== 'REPO') {
      throw new Error('expected REPO');
    }
    const note = repo.address?.notes?.[0];
    expect(note !== undefined && 'payload' in note ? note.payload : undefined).toBe('x');
    const text = ser551(dataset);
    expect(text).toContain('1 ADDR');
    expect(text).toContain('2 NOTE x');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('CHAN.SOUR types into ChangeDate.citations and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 CHAN',
        '2 DATE 13 NOV 2003',
        '2 SOUR @S1@',
        '3 DATA',
        '4 TEXT Date of Import: 27 Jun 2005',
        '0 @S1@ SOUR',
        '1 TITL Import',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.changeDate?.citations?.[0]?.source).toBe('@S1@');
    expect(indi.changeDate?.citations?.[0]?.data?.texts?.[0]?.payload).toBe('Date of Import: 27 Jun 2005');
    const text = ser551(dataset);
    expect(text).toContain('2 SOUR @S1@');
    expect(text).toContain('4 TEXT Date of Import: 27 Jun 2005');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('TMG citations under DATE and PLAC type and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 DEAT',
        '2 DATE 1794',
        '3 SOUR @S307@',
        '2 PLAC Waikiki',
        '3 SOUR @S308@',
        '0 @S307@ SOUR',
        '1 TITL S307',
        '0 @S308@ SOUR',
        '1 TITL S308',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const detail = indi.events?.[0]?.detail;
    expect(detail?.date?.citations?.[0]?.source).toBe('@S307@');
    expect(detail?.place?.citations?.[0]?.source).toBe('@S308@');
    const text = ser551(dataset);
    expect(text).toContain('2 DATE 1794');
    expect(text).toContain('3 SOUR @S307@');
    expect(text).toContain('2 PLAC Waikiki');
    expect(text).toContain('3 SOUR @S308@');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('NAME ALIA (with SOUR) and TITL type and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME /Kalanimoku/',
        '2 ALIA William/Pitt/',
        '3 SOUR @S111@',
        '2 TITL King',
        '0 @S111@ SOUR',
        '1 TITL S111',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.aliasLinks?.[0]).toEqual({
      tag: 'ALIA',
      value: 'William/Pitt/',
      citations: [{ tag: 'SOUR', source: '@S111@' }],
    });
    expect(indi.names?.[0]?.title).toBe('King');
    const text = ser551(dataset);
    expect(text).toContain('2 ALIA William/Pitt/');
    expect(text).toContain('3 SOUR @S111@');
    expect(text).toContain('2 TITL King');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('NOTE DATE/PLAC type and round-trip', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME A /B/', '1 NOTE A note', '2 DATE 1736', '2 PLAC Kealakekua', '0 TRLR', ''].join(
        '\n',
      ),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe('A note');
    expect(note && 'date' in note).toBe(true);
    expect(ser551(dataset)).toContain('2 DATE 1736');
    expect(ser551(dataset)).toContain('2 PLAC Kealakekua');
    expect(parseOk551(ser551(dataset))).toEqual(dataset);
  });

  test('the SOUR-record DATE/PLAC and the Ancestris TITL-pointer shape type and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @S1@ SOUR',
        '1 TITL 1910 Census',
        '1 DATE 1910',
        '1 PLAC Illinois',
        '0 @S2@ SOUR',
        '1 TITL @R5@',
        '0 @R5@ TITL "The Kennedys of Massachusetts," NEHGR',
        '1 CHAN',
        '2 DATE 10 MAR 1988',
        '1 AUTH @I2@',
        '1 PUBL (Boston, MA: NEHGS)',
        '1 SERS CXXXIX, July 1985',
        '1 ABBR "Kennedys," NEHGR',
        '1 REPO @R1@',
        '0 @I2@ INDI',
        '1 NAME Edward L. /Galvin/',
        '0 @R1@ REPO',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const s1 = dataset.records.find((r) => r.tag === 'SOUR' && r.xref === '@S1@');
    if (s1?.tag !== 'SOUR') {
      throw new Error('expected SOUR @S1@');
    }
    expect(s1.title).toBe('1910 Census');
    expect(s1.date?.value).toBeDefined();
    expect(s1.place?.payload).toEqual(['Illinois']);
    const s2 = dataset.records.find((r) => r.tag === 'SOUR' && r.xref === '@S2@');
    if (s2?.tag !== 'SOUR') {
      throw new Error('expected SOUR @S2@');
    }
    expect(s2.titlRef).toBe('@R5@');
    const title = dataset.records.find((r) => r.tag === 'TITL');
    if (title?.tag !== 'TITL') {
      throw new Error('expected TITL record');
    }
    expect(title.payload).toBe('"The Kennedys of Massachusetts," NEHGR');
    expect(title.changeDate?.date).toBeDefined();
    expect(title.author).toBe('@I2@');
    expect(title.publisher).toBe('(Boston, MA: NEHGS)');
    expect(title.series).toBe('CXXXIX, July 1985');
    expect(title.abbreviation).toBe('"Kennedys," NEHGR');
    expect(title.repository).toBe('@R1@');
    const text = ser551(dataset);
    expect(text).toContain('1 DATE 1910');
    expect(text).toContain('1 PLAC Illinois');
    expect(text).toContain('1 TITL @R5@');
    expect(text).toContain('0 @R5@ TITL "The Kennedys of Massachusetts," NEHGR');
    expect(text).toContain('1 AUTH @I2@');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('PLAC under the inline OBJE link types and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME Thomas /Gresham/',
        '1 OBJE',
        '2 FORM jpg',
        '2 FILE https://www.WikiTree.com/wiki/Image:Gresham-6.jpg',
        '2 TITL Marriage record Lauderdale Co AL.',
        '2 PLAC AL.',
        '2 DATE 1850',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const media = indi.media?.[0];
    expect(media && 'object' in media ? media.object : undefined).toBeDefined();
    const record = dataset.records.find((r) => r.tag === 'OBJE');
    if (record?.tag !== 'OBJE') {
      throw new Error('expected OBJE record');
    }
    expect(record.place).toBe('AL.');
    const text = ser551(dataset);
    expect(text).toContain('_PLAC AL.');
    expect(parseOk551(text)).toEqual(dataset);
  });

  test('the Case006 long event spellings type into EVEN + TYPE', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '1 BAPTISM',
        '2 DATE 1 JAN 1900',
        '2 PLAC Boston',
        '1 BAR_MITZVAH',
        '2 DATE 1905',
        '1 RESIDENCE Boston',
        '2 DATE 1910',
        '1 _MILITARY_SERVICE',
        '2 DATE 1942',
        '1 _DEGREE Ph.D.',
        '1 ENLIST',
        '2 DATE 1941',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const events = indi.events ?? [];
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Baptism']);
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Bar Mitzvah']);
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Residence']);
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Military service']);
    expect(events.map((e) => [e.tag, e.type])).toContainEqual(['EVEN', 'Enlistment']);
    const baptism = events.find((e) => e.type === 'Baptism');
    expect(baptism?.detail?.date?.value).toBeDefined();
    expect(baptism?.detail?.place?.payload).toEqual(['Boston']);
    expect(indi.attributes?.map((a) => [a.tag, a.type])).toContainEqual(['EDUC', 'Degree']);
    const text = ser551(dataset);
    expect(text).toContain('1 EVEN');
    expect(text).toContain('2 TYPE Baptism');
    expect(text).toContain('2 TYPE Bar Mitzvah');
    expect(text).toContain('2 TYPE Military service');
    expect(parseOk551(text)).toEqual(dataset);
  });
});
