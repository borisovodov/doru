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

describe('the MyHeritage _MTTAG/_MTCAT tree-tag records', () => {
  const TREE_TAGS = [
    HEAD551,
    '0 @I1@ INDI',
    '1 NAME X /Y/',
    '1 _MTTAG @T10@',
    '0 @T10@ _MTTAG',
    '1 NAME DNA Match',
    '1 RIN 10',
    '1 _VISI 1',
    '1 _MTCAT @C2@',
    '0 @C2@ _MTCAT',
    '1 NAME DNA',
    '1 RIN 2',
    '0 TRLR',
    '',
  ].join('\n');

  test('types the records and the INDI links; round-trips 5.5.1', () => {
    const dataset = parseOk551(TREE_TAGS);
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.treeTags).toEqual(['@T10@']);
    const tag = dataset.records.find((r) => r.tag === '_MTTAG');
    expect(tag).toMatchObject({
      tag: '_MTTAG',
      xref: '@T10@',
      name: 'DNA Match',
      automatedRecordId: '10',
      visible: true,
      category: '@C2@',
    });
    const cat = dataset.records.find((r) => r.tag === '_MTCAT');
    expect(cat).toMatchObject({ tag: '_MTCAT', name: 'DNA', automatedRecordId: '2' });
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _MTTAG @T10@');
    expect(serialized).toContain('0 @T10@ _MTTAG');
    expect(serialized).toContain('1 _VISI 1');
    expect(serialized).toContain('1 _MTCAT @C2@');
    expect(serialized).toContain('0 @C2@ _MTCAT');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_VISI 0 and unknown children are kept', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '0 @T10@ _MTTAG',
        '1 NAME DNA Match',
        '1 _VISI 0',
        '1 _BOGUS x',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const tag = dataset.records.find((r) => r.tag === '_MTTAG');
    if (tag === undefined || !('visible' in tag)) {
      throw new Error('expected _MTTAG');
    }
    expect(tag.visible).toBe(false);
    expect(tag.extensions?.some((ext) => ext.tag === '_BOGUS')).toBe(true);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _VISI 0');
  });
});

describe('QUAY directly under an event', () => {
  test('types the event reliability and round-trips in 5.5.1; drops on 7.0', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 QUAY 2', '1 DEAT', '2 QUAY 3', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.quality).toBe('2');
    expect(indi.events?.[1]?.detail?.quality).toBe('3');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 QUAY 2');
    expect(parseOk551(serialized)).toEqual(dataset);
    const dataset70 = parseOk70([...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 BIRT', '2 QUAY 2', '0 TRLR', ''].join('\n'));
    const serialized70 = ser70(dataset70);
    expect(serialized70).not.toContain('QUAY');
  });
});

describe('_PREF under FAM, MARR and the partner/child links', () => {
  test('types the FAM-level preferred family', () => {
    const dataset = parseOk551([HEAD551, '0 @F1@ FAM', '1 _PREF Y', '0 TRLR', ''].join('\n'));
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.preferred).toBe(true);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _PREF Y');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('types the MARR-level preferred marriage', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @F1@ FAM', '1 MARR', '2 _PREF Y', '2 DATE 1 JAN 1900', '0 TRLR', ''].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    const event = fam.events?.[0];
    expect(event !== undefined && 'preferred' in event ? event.preferred : undefined).toBe(true);
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _PREF Y');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('_WPID/_HPID and _FOOT under a citation', () => {
  test('type into the citation and round-trip', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @F1@ FAM',
        '1 MARR',
        '2 SOUR @S0@',
        '3 _HPID 1,61370::465131',
        '3 _WPID 1,61370::900465131',
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SOUR @S0@',
        '2 _FOOT Guy Allen Sims. 25 APR 2001',
        '0 @S0@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.events?.[0]?.detail?.detail?.citations?.[0]?.husbandPersonId).toBe('1,61370::465131');
    expect(fam.events?.[0]?.detail?.detail?.citations?.[0]?.wifePersonId).toBe('1,61370::900465131');
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.citations?.[0]?.footnote).toBe('Guy Allen Sims. 25 APR 2001');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 _HPID 1,61370::465131');
    expect(serialized).toContain('3 _WPID 1,61370::900465131');
    expect(serialized).toContain('2 _FOOT Guy Allen Sims. 25 APR 2001');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the free-text SOUR form types PAGE and the same citation slots', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SOUR England Genealogies',
        '2 PAGE 167',
        '2 REFN ref-1',
        '2 WWW https://example.org/e',
        '2 _FOOT A footnote.',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.citations?.[0]?.page?.payload).toBe('167');
    expect(indi.citations?.[0]?.referenceNumber).toBe('ref-1');
    expect(indi.citations?.[0]?.www).toBe('https://example.org/e');
    expect(indi.citations?.[0]?.footnote).toBe('A footnote.');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 PAGE 167');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('REF under a citation normalizes into the www slot', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 SOUR @S0@',
        '2 REF http://search.findmypast.com/record?id=GBC/190',
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
    expect(indi.citations?.[0]?.www).toBe('http://search.findmypast.com/record?id=GBC/190');
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 WWW http://search.findmypast.com/record?id=GBC/190');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('_APID under SOUR and INDI records', () => {
  test('types the record-level Ancestry references and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 _APID 1,7602::12345',
        '0 @S1@ SOUR',
        '1 TITL S',
        '1 _APID 1,2442::0',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.ancestryPointers).toEqual(['1,7602::12345']);
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.ancestryPointers).toEqual(['1,2442::0']);
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _APID 1,7602::12345');
    expect(serialized).toContain('1 _APID 1,2442::0');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('SOUR under FONE/ROMN and the inline OBJE link', () => {
  test('types the 5.5.1 NAME_PHONETIC_VARIATION citations and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME Joseph Tag /Torture/',
        '2 FONE Joseph Tag /Torture/',
        '3 TYPE user defined',
        '3 SOUR @S1@',
        '4 PAGE 55',
        '4 QUAY 2',
        '2 ROMN Joseph Tag /Torture/',
        '3 TYPE user defined',
        '3 SOUR @S1@',
        '4 PAGE 56',
        '0 @S1@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.phonetic?.[0]?.citations?.[0]?.page?.payload).toBe('55');
    expect(indi.names?.[0]?.phonetic?.[0]?.citations?.[0]?.quality).toBe('2');
    expect(indi.names?.[0]?.romanized?.[0]?.citations?.[0]?.page?.payload).toBe('56');
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 SOUR @S1@');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('types the citation under the 5.5.1 inline OBJE link', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 OBJE',
        '2 FILE',
        '3 FORM jpg',
        '2 SOUR @S55@',
        '3 PAGE Seniors, pp. 172-173',
        '0 @S55@ SOUR',
        '1 TITL S',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    // The inline OBJE synthesizes a multimedia record; its citation
    // carries the PAGE.
    const mediaRecord = dataset.records.find((r) => r.tag === 'OBJE');
    if (mediaRecord?.tag !== 'OBJE') {
      throw new Error('expected OBJE');
    }
    expect(mediaRecord.citations?.[0]?.page?.payload).toBe('Seniors, pp. 172-173');
    const serialized = ser551(dataset);
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the Swarm family-tree pack block (_FTSID, _PLINK under FAMC)', () => {
  test('types the ids and the profile links and round-trips', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 _FTSID 0bfd9174-d010-5b23-b0f2-a98854d921e3',
        '1 NAME Zofia /Sklodowska/',
        '1 FAMC @F1@',
        '2 PEDI birth',
        '2 _PLINK @I2@',
        '3 _FTSID 4f5b3162-d212-5d21-af6c-4defaad66d9e',
        '3 PEDI birth',
        '3 SOUR @S3@',
        '4 PAGE Marie Curie - Biographical',
        '4 QUAY 3',
        '0 @I2@ INDI',
        '1 NAME X /Y/',
        '0 @F1@ FAM',
        '0 @S3@ SOUR',
        '1 TITL S',
        '1 _FTSID abc-def',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.familyTreeSystemId).toBe('0bfd9174-d010-5b23-b0f2-a98854d921e3');
    expect(indi.childFamilies?.[0]?.profileLinks?.[0]).toMatchObject({
      tag: '_PLINK',
      individual: '@I2@',
      familyTreeId: '4f5b3162-d212-5d21-af6c-4defaad66d9e',
    });
    expect(indi.childFamilies?.[0]?.profileLinks?.[0]?.pedigree?.payload).toBe('BIRTH');
    expect(indi.childFamilies?.[0]?.profileLinks?.[0]?.citations?.[0]?.page?.payload).toBe(
      'Marie Curie - Biographical',
    );
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.familyTreeSystemId).toBe('abc-def');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _FTSID 0bfd9174-d010-5b23-b0f2-a98854d921e3');
    expect(serialized).toContain('2 _PLINK @I2@');
    expect(serialized).toContain('3 _FTSID 4f5b3162-d212-5d21-af6c-4defaad66d9e');
    expect(serialized).toContain('3 PEDI birth');
    expect(serialized).toContain('1 _FTSID abc-def');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});

describe('the working-remainder sweep (TIME, _PRIM, QUOT, ADDR, _GCID, _WEBTAG)', () => {
  test('the event-level TIME attaches to the DATE; a 12-hour value converts; junk stays generic', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 BIRT',
        '2 DATE 1 JAN 1900',
        '2 TIME 10:30',
        '1 DEAT',
        '2 DATE 2 JAN 2000',
        '2 TIME 2:00pm',
        '1 BURI',
        '2 TIME banana',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.date?.time).toEqual({ hour: 10, minute: 30 });
    // The 12-hour `2:00pm` converts to the 24-hour clock.
    expect(indi.events?.[1]?.detail?.date?.time).toEqual({ hour: 14, minute: 0 });
    // `banana` is not a time: the line stays a generic extension of
    // the detail (nothing is dropped at parse; the non-underscore TIME
    // extension is dropped on export — the extension rule).
    expect(indi.events?.[2]?.detail?.extensions).toContainEqual(
      expect.objectContaining({ tag: 'TIME', payload: 'banana' }),
    );
    const serialized = ser551(dataset);
    expect(serialized).toContain('3 TIME 10:30');
    expect(serialized).toContain('3 TIME 14:0');
    expect(serialized).not.toContain('banana');
  });

  test('_PRIM types into the event primary slot and the name primary slot', () => {
    const dataset = parseOk551(
      [HEAD551, '0 @I1@ INDI', '1 NAME X /Y/', '2 _PRIM Y', '1 BIRT', '2 _PRIM Y', '0 TRLR', ''].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]?.primary).toBe(true);
    expect(indi.events?.[0]?.detail?.primary).toBe(true);
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 _PRIM Y');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('QUOT types into FACT + TYPE Quotation under INDI and FAM', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 QUOT "To be or not to be."',
        '0 @F1@ FAM',
        '1 QUOT "A family that quotes."',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.attributes?.[0]).toMatchObject({ tag: 'FACT', payload: '"To be or not to be."', type: 'Quotation' });
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (fam?.tag !== 'FAM') {
      throw new Error('expected FAM');
    }
    expect(fam.notes?.[0]).toMatchObject({ tag: 'NOTE', payload: '"A family that quotes."' });
    const serialized = ser551(dataset);
    expect(serialized).toContain('2 TYPE Quotation');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('the INDI-level ADDR types with its _NAME label', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 ADDR Main St',
        '2 _NAME Stephen Michael Mencik',
        '2 CITY Town',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.address?.payload).toBe('Main St');
    expect(indi.address?.name).toBe('Stephen Michael Mencik');
    expect(indi.address?.city).toBe('Town');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 ADDR Main St');
    expect(serialized).toContain('2 _NAME Stephen Michael Mencik');
    expect(parseOk551(serialized)).toEqual(dataset);
    // 7.0 has no INDI address position: dropped.
    const dataset70 = parseOk70([...H70, '0 @I1@ INDI', '1 NAME X /Y/', '1 ADDR Main St', '0 TRLR', ''].join('\n'));
    expect(ser70(dataset70)).not.toContain('ADDR');
  });

  test('_GCID types into the record id on INDI and FAM', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @I1@ INDI',
        '1 NAME X /Y/',
        '1 _GCID 04A344DF-82DE-4D17-97C9-067C3C21276D',
        '0 @F1@ FAM',
        '1 _GCID 3C0DEB23-6184-486F-A01C-EB698D03285B',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const indi = dataset.records.find((r) => r.tag === 'INDI');
    const fam = dataset.records.find((r) => r.tag === 'FAM');
    if (indi?.tag !== 'INDI' || fam?.tag !== 'FAM') {
      throw new Error('expected records');
    }
    expect(indi.geditcomId).toBe('04A344DF-82DE-4D17-97C9-067C3C21276D');
    expect(fam.geditcomId).toBe('3C0DEB23-6184-486F-A01C-EB698D03285B');
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _GCID 04A344DF-82DE-4D17-97C9-067C3C21276D');
    expect(parseOk551(serialized)).toEqual(dataset);
  });

  test('_WEBTAG under a SOUR record types into the webTags slot', () => {
    const dataset = parseOk551(
      [
        HEAD551,
        '0 @S1@ SOUR',
        '1 TITL S',
        '1 _WEBTAG',
        '2 NAME Source home',
        '2 URL https://example.org/s',
        '0 TRLR',
        '',
      ].join('\n'),
    );
    const sour = dataset.records.find((r) => r.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.webTags?.[0]).toMatchObject({ name: 'Source home', url: 'https://example.org/s' });
    const serialized = ser551(dataset);
    expect(serialized).toContain('1 _WEBTAG');
    expect(serialized).toContain('2 NAME Source home');
    expect(parseOk551(serialized)).toEqual(dataset);
  });
});
