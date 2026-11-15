import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';

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

const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

describe('QUOT under CHIL/ASSO and _GCID on other records', () => {
  test('QUOT under a child link and an association types into notes', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @F1@ FAM',
        '1 CHIL @I2@',
        '2 QUOT "Three sons."',
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 ASSO @I3@',
        '2 RELA godfather',
        '2 QUOT "Once more to Nogaret."',
        '0 @I2@ INDI',
        '1 NAME A /B/',
        '0 @I3@ INDI',
        '1 NAME C /D/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.children?.[0]?.notes?.[0]).toMatchObject({ tag: 'NOTE', payload: '"Three sons."' });
    const indi = dataset.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.associations?.[0]?.notes?.[0]).toMatchObject({ tag: 'NOTE', payload: '"Once more to Nogaret."' });
    const serialized = ser551(dataset);
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_GCID types on NOTE and SUBM records too', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @N1@ NOTE text', '1 _GCID AAA', '0 @S2@ SUBM', '1 NAME U', '1 _GCID BBB', '0 TRLR', ''].join('\n'),
    );
    const note = dataset.records.find((r) => r.tag === 'NOTE');
    const subm = dataset.records.find((r) => r.tag === 'SUBM' && r.xref === '@S2@');
    if (note?.tag !== 'NOTE' || subm?.tag !== 'SUBM') {
      throw new Error('expected records');
    }
    expect(note.geditcomId).toBe('AAA');
    expect(subm.geditcomId).toBe('BBB');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _GCID AAA');
    expect(serialized).toContain('1 _GCID BBB');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('CHAN and CREA under an event', () => {
  test('the event-level change date types with its TIME', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 DEAT',
        '2 CHAN',
        '3 DATE 21 DEC 2007',
        '4 TIME 01:35',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.changeDate?.date.time).toEqual({ hour: 1, minute: 35 });
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 CHAN');
    expect(serialized).toContain('4 TIME 1:35');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the event-level CREA types into the creation date', () => {
    const dataset = parseOk70(
      [
        ...H70,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 BIRT',
        '2 CREA',
        '3 DATE 1 JAN 2020',
        '4 TIME 10:00:00',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.creationDate).toBeDefined();
    const serialized = ser70(dataset);
    expect(serialized).toContain('2 CREA');
    expect(parseOk70(serialized)).toEqual(dataset);
  });
});

describe('the media flags, _PID under PLAC, RIN under citations and _MIDN', () => {
  test('the MyHeritage media flags and AUTH type under the inline OBJE link', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OBJE',
        '2 FILE',
        '3 FORM jpg',
        '2 _CUTOUT Y',
        '2 _PRIM_CUTOUT Y',
        '2 _PARENTPHOTO Y',
        '2 _PERSONALPHOTO Y',
        '2 _PARENTRIN MH:P500006',
        '2 AUTH John Smith',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    if (obje?.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(obje.cutout).toBe(true);
    expect(obje.primaryCutout).toBe(true);
    expect(obje.parentPhoto).toBe(true);
    expect(obje.personalPhoto).toBe(true);
    expect(obje.parentRecordId).toBe('MH:P500006');
    expect(obje.author).toBe('John Smith');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _CUTOUT Y');
    expect(serialized).toContain('1 _PRIM_CUTOUT Y');
    expect(serialized).toContain('1 _PARENTRIN MH:P500006');
    expect(serialized).toContain('1 AUTH John Smith');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_PID under PLAC types into the place id', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 BIRT',
        '2 PLAC Kielce, Poland',
        '3 _PID curie-joliot-place-q102317',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.place?.placeId).toBe('curie-joliot-place-q102317');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 _PID curie-joliot-place-q102317');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('RIN under a citation types and round-trips in 5.5.1', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 BIRT',
        '2 SOUR @S0@',
        '3 RIN MH:SC500011',
        '0 @S0@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.citations?.[0]?.automatedRecordId).toBe('MH:SC500011');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 RIN MH:SC500011');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_MIDN under NAME types into the middle name', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME Henry Newton /Gresham/', '2 _MIDN Newton', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.middleName).toBe('Newton');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _MIDN Newton');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the header mid-stream, _TYPE under _CROP and _FNA under events', () => {
  test('a NOTE before the HEAD no longer orphans the header', () => {
    const dataset = parseOk551(
      [
        '0 NOTE A preamble note',
        '0 HEAD',
        '1 SOUR Family Echo',
        '2 WWW http://www.familyecho.com/',
        '1 SUBM @S1@',
        '1 DATE 12 SEP 2022',
        '2 TIME 16:12:23',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    expect(dataset.header.source?.payload).toBe('Family Echo');
    expect(dataset.header.source?.www).toBe('http://www.familyecho.com/');
    expect(dataset.header.date?.value).toBeDefined();
    expect(dataset.header.gedcom.version).toBe('5.5.1');
    expect(dataset.records[0]?.tag).toBe('NOTE');
    const serialized = ser551(dataset);
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_TYPE under the crop block types into the crop variant', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OBJE @M1@',
        '2 _CROP',
        '3 _LEFT 0',
        '3 _TOP 51',
        '3 _WDTH 186',
        '3 _HGHT 186',
        '3 _TYPE primary',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.media?.[0]?.crop?.type).toBe('primary');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 _TYPE primary');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_FNA under an event types into the Heredis flag', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 _FNA YES', '1 DEAT', '2 _FNA NO', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.fna).toBe(true);
    expect(indi.events?.[1]?.detail?.fna).toBe(false);
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _FNA Y');
    expect(serialized).toContain('2 _FNA N');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the MFT _CRE blocks, FAM SLGC and APPT', () => {
  test('the structured _CRE under NAME/FAM/OBJE types into the creation date', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '2 _CRE',
        '3 DATE 1 JAN 2020',
        '4 TIME 10:00',
        '0 @F1@ FAM',
        '1 _CRE',
        '2 DATE 2 JAN 2021',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '1 _CRE',
        '2 DATE 3 JAN 2022',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    if (indi?.tag !== 'INDI' || fam?.tag !== 'FAM' || obje?.tag !== 'OBJE') {
      throw new Error('expected records');
    }
    expect(indi.names?.[0]?.creationDate?.date.time).toEqual({ hour: 10, minute: 0 });
    expect(fam.creationDate?.date.value).toBeDefined();
    expect(obje.creationDate?.date.value).toBeDefined();
    const serialized = ser551(dataset);
    // 5.5.1 writes the _CRE spelling.
    expect(serialized).toContain('2 _CRE');
    expect(serialized).toContain('1 _CRE');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('SLGC under a FAM record types into the child sealing', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @F1@ FAM', '1 SLGC', '2 DATE 1 JAN 1900', '2 TEMP SLAKE', '0 TRLR', ''].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.childSealings?.[0]?.tag).toBe('SLGC');
    expect(fam.childSealings?.[0]?.detail?.date).toBeDefined();
    expect(fam.childSealings?.[0]?.detail?.temple).toBe('SLAKE');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 SLGC');
    expect(serialized).toContain('2 TEMP SLAKE');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('APPT under INDI normalizes into EVEN + TYPE Application', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 APPT',
        '2 DATE 27 Aug 2019',
        '2 PLAC Supplemental - MullinsP',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]).toMatchObject({ tag: 'EVEN', type: 'Application' });
    expect(indi.events?.[0]?.detail?.date).toBeDefined();
    expect(indi.events?.[0]?.detail?.place?.payload).toEqual(['Supplemental - MullinsP']);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 EVEN');
    expect(serialized).toContain('2 TYPE Application');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the data clusters of the remainder sweep', () => {
  test('RELATION/ISDEAD/_PHOTO/_WLNK/PHON under records type', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 ISDEAD Y',
        '1 PHON 336-874-7241',
        '1 _PHOTO @M1@',
        '1 _WLNK',
        '2 TITL Birth records, search Kolovec',
        '2 NOTE http://www.portafontium.eu/searching',
        '0 @F1@ FAM',
        '1 RELATION Marriage',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (indi?.tag !== 'INDI' || fam?.tag !== 'FAM') {
      throw new Error('expected records');
    }
    expect(indi.deceased).toBe(true);
    expect(indi.phone).toEqual(['336-874-7241']);
    expect(indi.media?.[0]?.object).toBe('@M1@');
    expect(indi.webLinks?.[0]).toMatchObject({
      tag: '_WLNK',
      title: 'Birth records, search Kolovec',
      url: 'http://www.portafontium.eu/searching',
    });
    expect(fam.unionStatus).toBe('Marriage');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 ISDEAD Y');
    expect(serialized).toContain('1 PHON 336-874-7241');
    expect(serialized).toContain('1 _WLNK');
    expect(serialized).toContain('2 NOTE http://www.portafontium.eu/searching');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_XREF under PLAC and _PATN under NAME type', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '2 _PATN Ivanovich',
        '1 BIRT',
        '2 PLAC Vicarage Rd, Camberwell',
        '3 _XREF @P14@',
        '0 @P14@ PLAC',
        '1 NAME Camberwell',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.patronymic).toBe('Ivanovich');
    expect(indi.events?.[0]?.detail?.place?.placeCard).toBe('@P14@');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _PATN Ivanovich');
    expect(serialized).toContain('3 _XREF @P14@');
    // The generic `0 @P14@ PLAC` card is dropped on export (the
    // non-underscore extension-record rule), so no full-equality
    // round-trip here; the typed fields survive.
    const reparsed = parseOk551(serialized);
    const indi2 = reparsed.records.find((r) => r.tag === 'INDI');
    expect(indi2?.events?.[0]?.detail?.place?.placeCard).toBe('@P14@');
  });

  test('_COR under an event types into the event map', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 BIRT',
        '2 _COR',
        '3 _LAD 41',
        '3 _LAM 38',
        '3 _LAS 26',
        '3 _LAN N',
        '3 _LOD 4',
        '3 _LOM 51',
        '3 _LOS 24',
        '3 _LON E',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.map?.latitude.direction).toBe('N');
    expect(indi.events?.[0]?.detail?.map?.longitude.direction).toBe('E');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 MAP');
    expect(serialized).toContain('3 LATI N41.64055555555556');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the error leniencies: TYPE other, QUAY 4, SEX long, bare SOUR, pointer text', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SEX Male',
        '1 BIRT',
        '2 QUAY 4',
        '2 SOUR',
        '3 PAGE NSW Registry of Births',
        '0 @M1@ OBJE',
        '1 FILE',
        '2 FORM jpg',
        '3 TYPE image',
        '2 TITL @R5@',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const obje = dataset.records.find((r) => r.tag === 'OBJE');
    if (indi?.tag !== 'INDI' || obje?.tag !== 'OBJE') {
      throw new Error('expected records');
    }
    expect(indi.sex).toBe('M');
    expect(indi.events?.[0]?.detail?.quality).toBe('4');
    // The bare SOUR is kept as an empty description with its PAGE.
    expect(indi.events?.[0]?.detail?.citations?.[0]?.description).toBe('');
    expect(indi.events?.[0]?.detail?.citations?.[0]?.page?.payload).toBe('NSW Registry of Births');
    // TYPE image becomes OTHER + phrase.
    expect(obje.files[0]?.form?.medium?.payload).toBe('OTHER');
    expect(obje.files[0]?.form?.medium?.phrase).toBe('image');
    // TITL with a pointer keeps the pointer string.
    expect(obje.files[0]?.title).toBe('@R5@');
    const serialized = ser551(dataset);
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});
