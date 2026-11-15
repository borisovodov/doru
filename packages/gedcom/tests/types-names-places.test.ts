import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';

function err70(text: string): string {
  const result = parseGedcom70(new TextEncoder().encode(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

describe('names and places edge cases', () => {
  test('name pieces keep substructures as extensions', () => {
    const result = parseGedcom70(
      new TextEncoder().encode(
        '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME John /Doe/\n2 GIVN John\n3 BOGUS x\n0 TRLR\n',
      ),
    );
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[0] as { names?: Array<{ pieces?: { extensions?: Array<{ tag: string }> } }> };
    expect(rec.names?.[0]?.pieces?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('5.5.1 name pieces with commas and a custom TYPE', () => {
    const result = parseGedcom551(
      new TextEncoder().encode(
        [
          '0 HEAD',
          '1 SOUR PAF',
          '1 SUBM @S1@',
          '1 GEDC',
          '2 VERS 5.5.1',
          '2 FORM LINEAGE-LINKED',
          '1 CHAR UTF-8',
          '0 @I1@ INDI',
          '1 NAME John /Doe/',
          '2 NPFX Dr., Prof.',
          '2 GIVN John, Jonathan',
          '2 NICK Johnny, Jack',
          '2 SPFX van, von',
          '2 SURN Doe, Smith',
          '2 NSFX Jr., Sr.',
          '2 TYPE custom label',
          '0 @S1@ SUBM',
          '1 NAME T',
          '0 TRLR',
        ].join('\n'),
      ),
    );
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[0] as {
      names?: Array<{
        payload: unknown;
        pieces?: {
          namePrefixes?: string[];
          givenNames?: string[];
          nicknames?: string[];
          surnamePrefixes?: string[];
          surnames?: string[];
          nameSuffixes?: string[];
        };
        type?: { payload: string; phrase?: string };
      }>;
    };
    expect(rec.names?.[0]?.pieces?.namePrefixes).toEqual(['Dr.', 'Prof.']);
    expect(rec.names?.[0]?.pieces?.givenNames).toEqual(['John', 'Jonathan']);
    expect(rec.names?.[0]?.pieces?.nicknames).toEqual(['Johnny', 'Jack']);
    expect(rec.names?.[0]?.pieces?.surnamePrefixes).toEqual(['van', 'von']);
    expect(rec.names?.[0]?.pieces?.surnames).toEqual(['Doe', 'Smith']);
    expect(rec.names?.[0]?.pieces?.nameSuffixes).toEqual(['Jr.', 'Sr.']);
    expect(rec.names?.[0]?.type).toEqual({ payload: 'OTHER', phrase: 'custom label' });
  });

  test('7.0 name TYPE with a PHRASE and 5.5.1 TYPE keeps substructures as extensions', () => {
    expect(
      parseGedcom70(
        new TextEncoder().encode(
          '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME John /Doe/\n2 TYPE BIRTH\n3 PHRASE at birth\n0 TRLR\n',
        ),
      ).ok,
    ).toBe(true);
    const result = parseGedcom551(
      new TextEncoder().encode(
        '0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME John /Doe/\n2 TYPE maiden\n3 BOGUS x\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n',
      ),
    );
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[0] as {
      names?: Array<{ type?: { payload: string; extensions?: Array<{ tag: string }> } }>;
    };
    expect(rec.names?.[0]?.type?.payload).toBe('MAIDEN');
    expect(rec.names?.[0]?.type?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('name translations and 5.5.1 variations keep pieces', () => {
    const result = parseGedcom551(
      new TextEncoder().encode(
        [
          '0 HEAD',
          '1 SOUR PAF',
          '1 SUBM @S1@',
          '1 GEDC',
          '2 VERS 5.5.1',
          '2 FORM LINEAGE-LINKED',
          '1 CHAR UTF-8',
          '0 @I1@ INDI',
          '1 NAME John /Doe/',
          '2 FONE Jo-han /Do-e/',
          '3 TYPE kana',
          '3 GIVN Jo-han',
          '2 ROMN Dzon /Doe/',
          '3 TYPE cyrillic',
          '3 SURN Doe',
          '0 @S1@ SUBM',
          '1 NAME T',
          '0 TRLR',
        ].join('\n'),
      ),
    );
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[0] as {
      names?: Array<{
        phonetic?: Array<{ pieces?: { givenNames?: string[] } }>;
        romanized?: Array<{ pieces?: { surnames?: string[] } }>;
      }>;
    };
    expect(rec.names?.[0]?.phonetic?.[0]?.pieces?.givenNames).toEqual(['Jo-han']);
    expect(rec.names?.[0]?.romanized?.[0]?.pieces?.surnames).toEqual(['Doe']);
  });

  test('place phonetic variations keep non-TYPE substructures as extensions', () => {
    const result = parseGedcom551(
      new TextEncoder().encode(
        '0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n0 @I1@ INDI\n1 BIRT\n2 PLAC Berlin\n3 FONE Berurin\n4 TYPE kana\n4 BOGUS x\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n',
      ),
    );
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[0] as {
      events?: Array<{
        detail?: { place?: { phonetic?: Array<{ type: string; extensions?: Array<{ tag: string }> }> } };
      }>;
    };
    expect(rec.events?.[0]?.detail?.place?.phonetic?.[0]?.type).toBe('kana');
    expect(
      rec.events?.[0]?.detail?.place?.phonetic?.[0]?.extensions?.some((extension) => extension.tag === 'BOGUS'),
    ).toBe(true);
  });

  test('_POST with DATE and SOUR under a place', () => {
    const result = parseGedcom70(
      new TextEncoder().encode(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 7.0',
          '0 @S2@ SOUR',
          '1 TITL S',
          '0 @I1@ INDI',
          '1 BIRT',
          '2 PLAC Berlin',
          '3 _POST 10115',
          '4 DATE 1900',
          '4 SOUR @S2@',
          '0 TRLR',
        ].join('\n'),
      ),
    );
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[1] as {
      events?: Array<{
        detail?: { place?: { postalCodes?: Array<{ code: string; date?: unknown; citations?: unknown[] }> } };
      }>;
    };
    expect(rec.events?.[0]?.detail?.place?.postalCodes?.[0]?.code).toBe('10115');
    expect(rec.events?.[0]?.detail?.place?.postalCodes?.[0]?.date).toBeDefined();
    expect(rec.events?.[0]?.detail?.place?.postalCodes?.[0]?.citations).toHaveLength(1);
  });
});

describe('place records', () => {
  test('_LOC without a NAME child is an extension record, preserved verbatim', () => {
    // The GEDCOM-L place record requires NAME; a _LOC without one is
    // an extension record with extension-defined contents (the
    // FamilySearch 7.0 test files exercise this form), not an error.
    const withPayload = parseGedcom70(
      new TextEncoder().encode('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @L1@ _LOC payload\n0 TRLR\n'),
    );
    if (!withPayload.ok) {
      throw new Error(JSON.stringify(withPayload.error));
    }
    expect(withPayload.value.records[0]).toEqual({ tag: '_LOC', xref: '@L1@', payload: 'payload', children: [] });
    const bare = parseGedcom70(new TextEncoder().encode('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @L1@ _LOC\n0 TRLR\n'));
    if (!bare.ok) {
      throw new Error(JSON.stringify(bare.error));
    }
    expect(bare.value.records[0]).toEqual({ tag: '_LOC', xref: '@L1@', children: [] });
  });

  test('_LOC names, abbreviation types and hierarchy links', () => {
    const result = parseGedcom70(
      new TextEncoder().encode(
        [
          '0 HEAD',
          '1 GEDC',
          '2 VERS 7.0',
          '0 @S2@ SOUR',
          '1 TITL S',
          '0 @O1@ OBJE',
          '1 FILE a.jpg',
          '2 FORM image/jpeg',
          '0 @L1@ _LOC',
          '1 NAME Berlin',
          '2 ABBR B',
          '3 TYPE short',
          '2 ABBR BLN',
          '2 LANG de',
          '2 DATE 1900',
          '2 SOUR @S2@',
          '1 NAME Berlin, Deutschland',
          '1 TYPE City',
          '2 _GOVTYPE 44',
          '2 DATE 1901',
          '2 SOUR @S2@',
          '1 _GOV 11000000',
          '1 _MAIDENHEAD JO62',
          '1 _POST 10115',
          '2 DATE 1900',
          '2 SOUR @S2@',
          '1 _AIDN 123',
          '2 TYPE amtlich',
          '2 DATE 1900',
          '2 SOUR @S2@',
          '1 _DMGD 3.5m',
          '2 TYPE population',
          '2 DATE 1900',
          '2 SOUR @S2@',
          '1 RELI Catholic',
          '1 EVEN founded',
          '2 DATE 1237',
          '1 EVEN',
          '1 _LOC @L2@',
          '2 TYPE POLI',
          '2 DATE 1900',
          '2 SOUR @S2@',
          '1 ABBR B',
          '1 MAP',
          '2 LATI N52.52',
          '2 LONG E13.40',
          '1 NOTE a note',
          '1 SOUR @S2@',
          '1 OBJE @O1@',
          '1 REFN r1',
          '1 _UID u1',
          '1 CHAN',
          '2 DATE 4 JAN 2001',
          '0 @L2@ _LOC',
          '1 NAME Parent',
          '0 TRLR',
        ].join('\n'),
      ),
    );
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const card = result.value.records[2] as {
      payload: string;
      names?: Array<{
        name: string;
        abbreviations?: Array<{ abbreviation: string; type?: string }>;
        language?: string;
        date?: unknown;
        citations?: unknown[];
      }>;
      types?: Array<{ type: string; govTypeId?: string; date?: unknown; citations?: unknown[] }>;
      govId?: string;
      maidenhead?: string;
      postalCodes?: Array<{ code: string; date?: unknown; citations?: unknown[] }>;
      administrativeIds?: Array<{ identifier: string; type: string; date?: unknown; citations?: unknown[] }>;
      demographicData?: Array<{ data: string; type: string; date?: unknown; citations?: unknown[] }>;
      denomination?: string;
      events?: Array<{ tag: string; payload?: string; detail?: { date?: unknown } }>;
      parents?: Array<{ parent: string; type?: string; date?: unknown; citations?: unknown[] }>;
      abbreviation?: string;
      map?: unknown;
      notes?: unknown[];
      citations?: unknown[];
      media?: unknown[];
      identifiers?: Array<{ tag: string }>;
      changeDate?: unknown;
    };
    expect(card.payload).toBe('Berlin');
    expect(card.names?.[0]?.abbreviations).toEqual([{ abbreviation: 'B', type: 'short' }, { abbreviation: 'BLN' }]);
    expect(card.names?.[0]?.language).toBe('de');
    expect(card.names?.[0]?.date).toBeDefined();
    expect(card.names?.[0]?.citations).toHaveLength(1);
    expect(card.names).toHaveLength(2);
    expect(card.types?.[0]?.govTypeId).toBe('44');
    expect(card.types?.[0]?.date).toBeDefined();
    expect(card.types?.[0]?.citations).toHaveLength(1);
    expect(card.govId).toBe('11000000');
    expect(card.maidenhead).toBe('JO62');
    expect(card.postalCodes?.[0]).toMatchObject({ code: '10115' });
    expect(card.postalCodes?.[0]?.date).toBeDefined();
    expect(card.postalCodes?.[0]?.citations).toHaveLength(1);
    expect(card.administrativeIds?.[0]).toMatchObject({ identifier: '123', type: 'amtlich' });
    expect(card.administrativeIds?.[0]?.date).toBeDefined();
    expect(card.administrativeIds?.[0]?.citations).toHaveLength(1);
    expect(card.demographicData?.[0]).toMatchObject({ data: '3.5m', type: 'population' });
    expect(card.demographicData?.[0]?.date).toBeDefined();
    expect(card.demographicData?.[0]?.citations).toHaveLength(1);
    expect(card.denomination).toBe('Catholic');
    expect(card.events?.[0]).toMatchObject({ tag: 'EVEN', payload: 'founded' });
    expect(card.events?.[0]?.detail?.date).toBeDefined();
    expect(card.events?.[1]).toEqual({ tag: 'EVEN' });
    expect(card.parents?.[0]).toMatchObject({ parent: '@L2@', type: 'POLI' });
    expect(card.parents?.[0]?.date).toBeDefined();
    expect(card.parents?.[0]?.citations).toHaveLength(1);
    expect(card.abbreviation).toBe('B');
    expect(card.map).toBeDefined();
    expect(card.notes).toHaveLength(1);
    expect(card.citations).toHaveLength(1);
    expect(card.media).toHaveLength(1);
    expect(card.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(card.changeDate).toBeDefined();
  });

  test('hierarchy TYPE validates its value set', () => {
    expect(
      err70(
        '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @L1@ _LOC\n1 NAME A\n1 _LOC @L2@\n2 TYPE WRONG\n0 @L2@ _LOC\n1 NAME B\n0 TRLR\n',
      ),
    ).toBe('enum.invalid-value');
  });
});
