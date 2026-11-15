import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse70(text: string): GedcomDataset {
  const result = parseGedcom70(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err70(text: string): string {
  const result = parseGedcom70(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

function err551(text: string): string {
  const result = parseGedcom551(enc(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

const H70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];
const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

const indi70 = (extra: string[]): string => [...H70, '0 @I1@ INDI', ...extra, '0 TRLR'].join('\n');
const indi551 = (extra: string[]): string => [...H551, '0 @I1@ INDI', ...extra, ...SUBM, '0 TRLR'].join('\n');

describe('event details', () => {
  test('FAM HUSB/WIFE partner ages', () => {
    const dataset = parse70(
      [
        ...H70,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '0 @I2@ INDI',
        '1 NAME C /D/',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 MARR',
        '2 HUSB',
        '3 AGE 30y',
        '2 WIFE',
        '3 AGE 28y',
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records[2] as {
      events?: Array<{
        detail?: {
          husband?: { age: { payload: { years: number } } };
          wife?: { age: { payload: { years: number } } };
        };
      }>;
    };
    expect(fam.events?.[0]?.detail?.husband?.age.payload).toEqual({ years: 30 });
    expect(fam.events?.[0]?.detail?.wife?.age.payload).toEqual({ years: 28 });
  });

  test('FAM MARR HUSB without AGE fails', () => {
    expect(
      err70(
        [...H70, '0 @I1@ INDI', '1 NAME A /B/', '0 @F1@ FAM', '1 HUSB @I1@', '1 MARR', '2 HUSB', '0 TRLR'].join('\n'),
      ),
    ).toBe('structure.missing-required');
  });

  test('FAM EVEN without a TYPE defaults to the empty type', () => {
    // The 7.0 grammar requires the TYPE; the 5.5.1 rule
    // rule (optional, empty default).
    const as70 = parseGedcom70(enc([...H70, '0 @F1@ FAM', '1 EVEN', '0 TRLR'].join('\n')));
    expect(as70.ok).toBe(true);
    const dataset = parse551([...H551, '0 @F1@ FAM', '1 EVEN a party', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records[0] as { events?: Array<{ payload: string; type: string }> };
    expect(fam.events?.[0]).toMatchObject({ payload: 'a party', type: '' });
  });

  test('7.0 event detail contacts, SDATE, ASSO and UID', () => {
    const dataset = parse70(
      indi70([
        '0 @I2@ INDI',
        '1 NAME X',
        '1 BIRT',
        '2 PHON +49 1',
        '2 EMAIL a@example.com',
        '2 FAX +49 2',
        '2 WWW https://example.com',
        '2 SDATE 1900',
        '2 ASSO @I2@',
        '3 ROLE WITN',
        '2 UID u1',
        '2 _UID u2',
        '2 _PLAC Second Place',
        '2 _GODP The Godfather',
        '2 _WITN A Witness',
        '2 AGNC The Agency',
        '2 RELI Catholic',
        '2 CAUS Old age',
      ]),
    );
    const rec = dataset.records[1] as {
      events?: Array<{
        detail?: {
          phone?: string[];
          email?: string[];
          fax?: string[];
          www?: string[];
          sortDate?: { value?: unknown };
          associations?: unknown[];
          uniqueIds?: string[];
          additionalPlaces?: unknown[];
          godparents?: string[];
          witnesses?: string[];
          agency?: string;
          religiousAffiliation?: string;
          cause?: string;
        };
      }>;
    };
    const detail = rec.events?.[0]?.detail;
    expect(detail?.phone).toEqual(['+49 1']);
    expect(detail?.email).toEqual(['a@example.com']);
    expect(detail?.fax).toEqual(['+49 2']);
    expect(detail?.www).toEqual(['https://example.com']);
    expect(detail?.sortDate?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1900 });
    expect(detail?.associations).toHaveLength(1);
    expect(detail?.uniqueIds).toEqual(['u1', 'u2']);
    expect(detail?.additionalPlaces).toHaveLength(1);
    expect(detail?.godparents).toEqual(['The Godfather']);
    expect(detail?.witnesses).toEqual(['A Witness']);
    expect(detail?.agency).toBe('The Agency');
    expect(detail?.religiousAffiliation).toBe('Catholic');
    expect(detail?.cause).toBe('Old age');
  });

  test('INDI FAMC outside ADOP, BIRT and CHR falls back to extensions', () => {
    const deat = parse70(indi70(['1 DEAT', '2 FAMC @F1@', '0 @F1@ FAM']));
    const rec = deat.records[0] as {
      events?: Array<{ tag: string; extensions?: Array<{ tag: string; payload?: string; payloadKind?: string }> }>;
    };
    const famc = rec.events?.[0]?.extensions?.find((extension) => extension.tag === 'FAMC');
    expect(famc?.payload).toBe('@F1@');
    expect(famc?.payloadKind).toBe('pointer');
    const birt = parse70(indi70(['1 BIRT', '2 FAMC @F1@', '3 BOGUS x', '0 @F1@ FAM']));
    const birtRec = birt.records[0] as {
      events?: Array<{ familyChild?: string; extensions?: Array<{ tag: string }> }>;
    };
    expect(birtRec.events?.[0]?.familyChild).toBe('@F1@');
    expect(birtRec.events?.[0]?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('ADOP FAMC with ADOP detail', () => {
    const dataset = parse70(indi70(['1 ADOP', '2 FAMC @F1@', '3 ADOP BOTH', '4 PHRASE both parents', '0 @F1@ FAM']));
    const rec = dataset.records[0] as {
      events?: Array<{ adoptionFamily?: { family: string; adoption?: { payload: string; phrase?: string } } }>;
    };
    expect(rec.events?.[0]?.adoptionFamily).toEqual({
      family: '@F1@',
      adoption: { payload: 'BOTH', phrase: 'both parents' },
    });
  });

  test('NCHI keeps substructures as extensions; NMR requires digits', () => {
    const dataset = parse70(indi70(['1 NCHI 3', '2 BOGUS x']));
    const rec = dataset.records[0] as { attributes?: Array<{ tag: string; extensions?: Array<{ tag: string }> }> };
    expect(rec.attributes?.[0]?.tag).toBe('NCHI');
    expect(rec.attributes?.[0]?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
    // The stray text is stripped by the dispatch retry; the payload-less
    // NMR line then fails its required value.
    expect(err70(indi70(['1 NMR three']))).toBe('structure.missing-payload');
  });

  test('IDNO and FACT attributes no longer require TYPE', () => {
    // The 7.0 spec makes the TYPE mandatory; the 5.5.1 grammar letter
    // omits it; the lenient rule wins.
    expect(parseGedcom70(enc(indi70(['1 IDNO 123']))).ok).toBe(true);
    expect(parseGedcom70(enc(indi70(['1 FACT tall']))).ok).toBe(true);
  });

  test('individual ordinances type FAMC only under SLGC and extend it elsewhere', () => {
    const dataset = parse70(
      indi70([
        '1 SLGC',
        '2 FAMC @F1@',
        '2 STAT COMPLETED',
        '3 DATE 1 JAN 2000',
        '2 TEMP SLAKE',
        '2 PLAC Salt Lake',
        '0 @F1@ FAM',
      ]),
    );
    const rec = dataset.records[0] as {
      ordinances?: Array<{
        tag: string;
        familyChild?: string;
        detail?: {
          status?: { payload: string; date: { value: unknown } };
          temple?: string;
          place?: { payload: string[] };
        };
      }>;
    };
    expect(rec.ordinances?.[0]?.familyChild).toBe('@F1@');
    expect(rec.ordinances?.[0]?.detail?.status?.payload).toBe('COMPLETED');
    expect(rec.ordinances?.[0]?.detail?.temple).toBe('SLAKE');
    expect(rec.ordinances?.[0]?.detail?.place?.payload).toEqual(['Salt Lake']);
    const bapl = parse70(indi70(['1 BAPL', '2 FAMC @F1@', '0 @F1@ FAM']));
    const baplRec = bapl.records[0] as {
      ordinances?: Array<{ tag: string; extensions?: Array<{ tag: string; payload?: string; payloadKind?: string }> }>;
    };
    const famc = baplRec.ordinances?.[0]?.extensions?.find((extension) => extension.tag === 'FAMC');
    expect(famc?.payload).toBe('@F1@');
    expect(famc?.payloadKind).toBe('pointer');
  });

  test('5.5.1 ordinance status table; a STAT without DATE parses', () => {
    const dataset = parse551(indi551(['1 BAPL', '2 STAT PRE-1970', '3 DATE 1 JAN 2000']));
    const rec = dataset.records[0] as {
      ordinances?: Array<{ detail?: { status?: { payload: string; date: { value: unknown } } } }>;
    };
    expect(rec.ordinances?.[0]?.detail?.status?.payload).toBe('PRE_1970');
    expect(err551(indi551(['1 BAPL', '2 STAT NOPE', '3 DATE 1 JAN 2000']))).toBe('enum.invalid-value');
    const withChild = parse551(indi551(['1 BAPL', '2 STAT COMPLETED', '3 DATE 1 JAN 2000', '3 BOGUS x']));
    const rec2 = withChild.records[0] as {
      ordinances?: Array<{ detail?: { status?: { payload: string; extensions?: Array<{ tag: string }> } } }>;
    };
    expect(rec2.ordinances?.[0]?.detail?.status?.payload).toBe('COMPLETED');
    expect(rec2.ordinances?.[0]?.detail?.status?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
    const undated551 = parse551(indi551(['1 BAPL', '2 STAT COMPLETED']));
    const undatedRec551 = undated551.records[0] as {
      ordinances?: Array<{ detail?: { status?: { payload: string; date?: unknown } } }>;
    };
    expect(undatedRec551.ordinances?.[0]?.detail?.status?.payload).toBe('COMPLETED');
    expect(undatedRec551.ordinances?.[0]?.detail?.status?.date).toBeUndefined();
    const undated70 = parse70(indi70(['1 BAPL', '2 STAT COMPLETED']));
    const undatedRec70 = undated70.records[0] as {
      ordinances?: Array<{ detail?: { status?: { payload: string; date?: unknown } } }>;
    };
    expect(undatedRec70.ordinances?.[0]?.detail?.status?.payload).toBe('COMPLETED');
    expect(undatedRec70.ordinances?.[0]?.detail?.status?.date).toBeUndefined();
  });

  test('SLGS spouse sealing', () => {
    const dataset = parse70(
      [
        ...H70,
        '0 @F1@ FAM',
        '1 SLGS',
        '2 DATE 1 JAN 2000',
        '2 TEMP SLAKE',
        '2 PLAC Salt Lake',
        '2 STAT COMPLETED',
        '3 DATE 1 JAN 2000',
        '2 NOTE n',
        '2 SOUR @S2@',
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records[0] as {
      spouseSealings?: Array<{
        tag: string;
        detail?: {
          date?: unknown;
          temple?: string;
          place?: { payload: string[] };
          status?: { payload: string };
          notes?: unknown[];
          citations?: unknown[];
        };
      }>;
    };
    expect(fam.spouseSealings?.[0]?.detail?.temple).toBe('SLAKE');
    expect(fam.spouseSealings?.[0]?.detail?.place?.payload).toEqual(['Salt Lake']);
    expect(fam.spouseSealings?.[0]?.detail?.status?.payload).toBe('COMPLETED');
    expect(fam.spouseSealings?.[0]?.detail?.notes).toHaveLength(1);
    expect(fam.spouseSealings?.[0]?.detail?.citations).toHaveLength(1);
  });
});

describe('family and individual records', () => {
  test('7.0 FAM parses NCHI, RESI, FACT, NO, ASSO, CREA and identifiers', () => {
    const dataset = parse70(
      [
        ...H70,
        '0 @I1@ INDI',
        '1 NAME A /B/',
        '0 @F1@ FAM',
        '1 NCHI 3',
        '1 RESI Somewhere',
        '2 TYPE home',
        '1 FACT something',
        '2 TYPE kind',
        '1 NO MARR',
        '1 ASSO @I1@',
        '2 ROLE WITN',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 UID u',
        '1 _UID u2',
        '1 EXID https://x.example/f1',
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records[1] as {
      attributes?: Array<{ tag: string; payload?: string | number; type?: string }>;
      nonEvents?: Array<{ payload: string }>;
      associations?: unknown[];
      creationDate?: unknown;
      identifiers?: Array<{ tag: string }>;
    };
    expect(fam.attributes?.[0]).toMatchObject({ tag: 'NCHI', payload: 3 });
    expect(fam.attributes?.[1]).toMatchObject({ tag: 'RESI', payload: 'Somewhere', type: 'home' });
    expect(fam.attributes?.[2]).toMatchObject({ tag: 'FACT', payload: 'something', type: 'kind' });
    expect(fam.nonEvents?.[0]?.payload).toBe('MARR');
    expect(fam.associations).toHaveLength(1);
    expect(fam.creationDate).toBeDefined();
    expect(fam.identifiers?.map((id) => id.tag)).toEqual(['UID', 'UID', 'EXID']);
  });

  test('vendor FAM negatives and facts', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @F1@ FAM',
        '1 _NONE',
        '1 _STAT married',
        '1 _TYPE same-sex',
        '1 _MARR N',
        '1 _NMR Y',
        '1 _LIV',
        '2 DATE 1900',
        '1 _ASSO @I1@',
        '2 RELA Friend',
        '1 _COML',
        '1 _MBON',
        '1 _SEPR',
        '1 RIN 9',
        '0 @I1@ INDI',
        '1 NAME A /B/',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records[0] as {
      attributes?: Array<{ tag: string; payload: number }>;
      marriageStatuses?: Array<{ payload: string }>;
      sameSexUnion?: boolean;
      nonEvents?: Array<{ payload: string }>;
      events?: Array<{ tag: string; type?: string; detail?: { date?: unknown } }>;
      associations?: unknown[];
      automatedRecordId?: string;
    };
    expect(fam.attributes?.[0]).toMatchObject({ tag: 'NCHI', payload: 0 });
    expect(fam.marriageStatuses).toEqual([{ payload: 'married' }]);
    expect(fam.sameSexUnion).toBe(true);
    expect(fam.nonEvents).toEqual([
      { tag: 'NO', payload: 'MARR' },
      { tag: 'NO', payload: 'MARR' },
    ]);
    expect(fam.events?.[0]).toMatchObject({ tag: 'EVEN', type: 'Cohabitation' });
    expect(fam.events?.[1]).toMatchObject({ tag: 'MARR', type: 'Common law marriage' });
    expect(fam.events?.[2]).toMatchObject({ tag: 'EVEN', type: 'Marriage bond' });
    expect(fam.events?.[3]).toMatchObject({ tag: 'EVEN', type: 'Separated' });
    expect(fam.associations).toHaveLength(1);
    expect(fam.automatedRecordId).toBe('9');
  });

  test('vendor FAM negatives validate their payloads and extend substructures', () => {
    expect(err551([...H551, '0 @F1@ FAM', '1 _MARR Y', ...SUBM, '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
    expect(err551([...H551, '0 @F1@ FAM', '1 _NMR N', ...SUBM, '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
    const withChild = parse551([...H551, '0 @F1@ FAM', '1 _MARR N', '2 BOGUS x', ...SUBM, '0 TRLR'].join('\n'));
    const fam = withChild.records[0] as { extensions?: Array<{ tag: string }>; nonEvents?: Array<{ payload: string }> };
    expect(fam.nonEvents?.[0]?.payload).toBe('MARR');
    expect(fam.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
    // A FAM _TYPE value other than same-sex no longer fails the import:
    // it is preserved as a generic extension (see the FAM _TYPE handler).
    expect(parse551([...H551, '0 @F1@ FAM', '1 _TYPE other', ...SUBM, '0 TRLR'].join('\n'))).toBeTruthy();
  });

  test('vendor INDI names, attributes, facts, negatives and identifiers', () => {
    const dataset = parse551(
      indi551([
        '1 _MARNM Mary /Smith/',
        '1 _AKA Alias /Name/',
        '1 _UPD 20010101',
        '1 _URL https://example.com',
        '1 _TAG tag1',
        '1 _TAG3 tag3',
        '1 _BIRN Birgit /B/',
        '1 _ADPN Ada /A/',
        '1 _EYEC blue',
        '1 _BRTM',
        '2 DATE 1900',
        '1 _PRMN 123',
        '1 _NLIV',
        '1 _NMAR',
        '1 _DCAUSE old age',
        '1 _MILT',
        '1 _EXCM',
        '1 _UNKN 550e',
      ]),
    );
    const rec = dataset.records[0] as {
      names?: Array<{ payload: { given?: string }; type?: { payload: string; phrase?: string } }>;
      updatedAt?: string;
      url?: string;
      marks?: string[];
      attributes?: Array<{ tag: string; type: string; payload: string }>;
      events?: Array<{ tag: string; type?: string; detail?: { cause?: string } }>;
      identifiers?: Array<{ tag: string; payload: string }>;
      nonEvents?: Array<{ payload: string }>;
    };
    expect(rec.names?.[0]?.type?.payload).toBe('MARRIED');
    expect(rec.names?.[1]?.type?.payload).toBe('AKA');
    expect(rec.names?.[2]?.type?.payload).toBe('BIRTH');
    expect(rec.names?.[3]?.type).toEqual({ payload: 'OTHER', phrase: 'Adopted name' });
    expect(rec.updatedAt).toBe('20010101');
    expect(rec.url).toBe('https://example.com');
    expect(rec.marks).toEqual(['tag1', '', 'tag3']);
    expect(rec.attributes?.[0]).toMatchObject({ tag: 'FACT', type: 'Eye color', payload: 'blue' });
    expect(rec.events?.[0]).toMatchObject({ tag: 'EVEN', type: 'Brit Mila' });
    expect(rec.identifiers?.[0]).toMatchObject({ tag: 'REFN', payload: '123' });
    expect(rec.identifiers?.[1]).toMatchObject({ tag: 'UID', payload: '550e' });
    expect(rec.nonEvents).toEqual([
      { tag: 'NO', payload: 'DEAT' },
      { tag: 'NO', payload: 'MARR' },
    ]);
    // _DCAUSE merged into the death event that _NLIV did not create.
    const death = rec.events?.find((event) => event.tag === 'DEAT');
    expect(death?.detail?.cause).toBe('old age');
  });

  test('7.0 INDI ordinances and identifiers', () => {
    const dataset = parse70(
      indi70([
        '1 BAPL',
        '2 DATE 1 JAN 2000',
        '1 CONL',
        '1 ENDL',
        '1 INIL',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 UID u',
        '1 _UID u2',
        '1 EXID https://x.example/i1',
      ]),
    );
    const rec = dataset.records[0] as {
      ordinances?: Array<{ tag: string }>;
      creationDate?: unknown;
      identifiers?: Array<{ tag: string }>;
    };
    expect(rec.ordinances?.map((o) => o.tag)).toEqual(['BAPL', 'CONL', 'ENDL', 'INIL']);
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['UID', 'UID', 'EXID']);
  });

  test('5.5.1 INDI parses RIN, RFN and AFN', () => {
    const dataset = parse551(indi551(['1 RIN 42', '1 RFN 99', '1 AFN 1234']));
    const rec = dataset.records[0] as {
      automatedRecordId?: string;
      recordFileNumber?: string;
      ancestralFileNumber?: string;
    };
    expect(rec.automatedRecordId).toBe('42');
    expect(rec.recordFileNumber).toBe('99');
    expect(rec.ancestralFileNumber).toBe('1234');
  });

  test('FAM and INDI must not carry payloads', () => {
    expect(err70([...H70, '0 @F1@ FAM text', '0 TRLR'].join('\n'))).toBe('structure.unexpected-payload');
    expect(err70([...H70, '0 @I1@ INDI text', '0 TRLR'].join('\n'))).toBe('structure.unexpected-payload');
  });
});

describe('payload readers and document structure', () => {
  test('reqText coerces pointer values to text', () => {
    const dataset = parse70(indi70(['0 @I2@ INDI', '1 NAME X', '1 NAME @I2@']));
    const rec = dataset.records[1] as { names?: Array<{ tag: string; payload: unknown }> };
    expect(rec.names).toEqual([
      { tag: 'NAME', payload: { given: 'X' } },
      { tag: 'NAME', payload: { given: '@I2@' } },
    ]);
  });

  test('a bare-identifier pointer whose target is missing is dropped', () => {
    const dataset = parse70([...H70, '0 @F1@ FAM', '1 HUSB John', '0 TRLR'].join('\n'));
    const fam = dataset.records[0] as { husband?: { partner?: string } };
    expect(fam.husband).toBeUndefined();
  });

  test('a bare-identifier pointer with an existing target resolves', () => {
    const dataset = parse70([...H70, '0 @I1@ INDI', '1 NAME X', '0 @F1@ FAM', '1 HUSB I1', '0 TRLR'].join('\n'));
    const fam = dataset.records[1] as { husband?: { partner?: string } };
    expect(fam.husband?.partner).toBe('@I1@');
  });

  test('a stray text payload on a REPO citation is stripped', () => {
    const dataset = parse70([...H70, '0 @S1@ SOUR', '1 REPO Text', '0 TRLR'].join('\n'));
    const sour = dataset.records[0] as { repositoryCitations?: Array<{ repository?: string }> };
    expect(sour.repositoryCitations?.[0]?.repository).toBe('@VOID@');
  });

  test('the Y assertion keeps a non-Y text payload verbatim', () => {
    const dataset = parse70(indi70(['1 BIRT N']));
    const rec = dataset.records[0] as { events?: Array<{ tag: string; payload?: unknown }> };
    expect(rec.events?.[0]?.payload).toBe('N');
  });

  test('duplicate singles keep the first occurrence', () => {
    const sex = parse70(indi70(['1 SEX M', '1 SEX F']));
    expect((sex.records[0] as { sex?: string }).sex).toBe('M');
    // The individual-event TYPE is read last by the event handler, so
    // a repeated TYPE keeps the later value.
    const even551 = parse551(indi551(['1 EVEN', '2 TYPE a', '2 TYPE b']));
    expect((even551.records[0] as { events?: Array<{ type?: string }> }).events?.[0]?.type).toBe('b');
    const even70 = parse70(indi70(['1 EVEN', '2 TYPE a', '2 TYPE b']));
    expect((even70.records[0] as { events?: Array<{ type?: string }> }).events?.[0]?.type).toBe('b');
  });

  test('document level errors', () => {
    // A document without a header gets a synthesized empty one.
    const noHeader = parse70('0 TRLR\n');
    expect(noHeader.header.gedcom.version).toBe('5.5.1');
    expect(noHeader.records).toEqual([]);
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @X@ TRLR\n')).toBe('line.xref-on-substructure');
    // Records after the trailer still parse.
    const afterTrailer = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n0 @I1@ INDI\n');
    expect(afterTrailer.records.map((record) => record.xref)).toEqual(['@I1@']);
    // Both note records are accepted in any file.
    expect(parseGedcom70(enc('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @N1@ NOTE text\n0 TRLR\n')).ok).toBe(true);
    expect(parseGedcom551(enc([...H551, '0 @N1@ SNOTE text', ...SUBM, '0 TRLR'].join('\n'))).ok).toBe(true);
    // An unknown record-level tag becomes an ExtensionRecord.
    const bogus = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 BOGUS\n0 TRLR\n');
    expect(bogus.records[0]?.tag).toBe('BOGUS');
  });

  test('duplicate cross-reference identifiers keep the later record; the first occurrence registers', () => {
    const dataset70 = parse70(
      '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME A /B/\n0 @I2@ INDI\n1 NAME C /D/\n0 @I1@ INDI\n1 NAME E /F/\n0 TRLR\n',
    );
    expect(dataset70.records.map((record) => record.xref)).toEqual(['@I1@', '@I2@', '@I1@']);
    expect(
      (dataset70.records[2] as { names?: Array<{ payload?: { given?: string } }> }).names?.[0]?.payload?.given,
    ).toBe('E');
    const dataset551 = parse551(
      '0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME A /B/\n0 @I2@ INDI\n1 NAME C /D/\n0 @I1@ INDI\n1 NAME E /F/\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n',
    );
    expect(dataset551.records.filter((record) => record.xref === '@I1@')).toHaveLength(2);
  });

  test('extension records keep pointer payloads', () => {
    const dataset = parse70(
      [...H70, '0 @X1@ _CUSTOM @I1@', '1 _CHILD value', '0 @I1@ INDI', '1 NAME A /B/', '0 TRLR'].join('\n'),
    );
    const ext = dataset.records[0] as {
      tag: string;
      xref?: string;
      payload: string;
      children: Array<{ tag: string; payload: string }>;
    };
    expect(ext.tag).toBe('_CUSTOM');
    expect(ext.xref).toBe('@X1@');
    expect(ext.payload).toBe('@I1@');
    expect(ext.children[0]).toEqual({ tag: '_CHILD', payload: 'value', children: [] });
  });

  test('header edge cases', () => {
    expect(err70('0 @H@ HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n')).toBe('line.xref-on-substructure');
    // A repeated GEDC keeps the first occurrence.
    const repeated = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 GEDC\n2 VERS 7.0\n0 TRLR\n');
    expect(repeated.header.gedcom.version).toBe('7.0');
    // The FORM under GEDC is accepted in any file.
    expect(parseGedcom70(enc('0 HEAD\n1 GEDC\n2 VERS 7.0\n2 FORM LINEAGE-LINKED\n0 TRLR\n')).ok).toBe(true);
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 SCHMA\n2 TAG _X x\n3 BOGUS y\n0 TRLR\n')).toBe(
      'structure.unexpected-payload',
    );
    // A SOUR id with spaces is accepted in any file.
    expect(
      parseGedcom551(
        enc(
          '0 HEAD\n1 SOUR My App\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n',
        ),
      ).ok,
    ).toBe(true);
    expect(
      err551(
        '0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR KOI8\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n',
      ),
    ).toBe('decoding.unknown-charset');
  });

  test('header source corporation and data', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '1 SOUR MyApp',
        '2 VERS 1.0',
        '2 NAME My Application',
        '2 CORP The Corp',
        '3 ADDR Main St',
        '3 PHON +49 1',
        '3 EMAIL a@example.com',
        '3 FAX +49 2',
        '3 WWW https://example.com',
        '2 DATA the data',
        '3 DATE 1 JAN 2000',
        '3 COPR (c) 2000',
        '0 TRLR',
      ].join('\n'),
    );
    const header = dataset.header as {
      source?: {
        payload: string;
        version?: string;
        name?: string;
        corporation?: {
          payload: string;
          address?: unknown;
          phone?: string[];
          email?: string[];
          fax?: string[];
          www?: string[];
        };
        data?: { payload: string; date?: { value: unknown }; copyright?: string };
      };
    };
    expect(header.source?.version).toBe('1.0');
    expect(header.source?.name).toBe('My Application');
    expect(header.source?.corporation?.payload).toBe('The Corp');
    expect(header.source?.corporation?.address).toBeDefined();
    // The contacts are typed into the address block (the canonical
    // position).
    expect((header.source!.corporation!.address as { phone?: string[] }).phone).toEqual(['+49 1']);
    expect((header.source!.corporation!.address as { email?: string[] }).email).toEqual(['a@example.com']);
    expect((header.source!.corporation!.address as { fax?: string[] }).fax).toEqual(['+49 2']);
    expect((header.source!.corporation!.address as { www?: string[] }).www).toEqual(['https://example.com']);
    expect(header.source?.data?.payload).toBe('the data');
    expect(header.source?.data?.date?.value).toEqual({ day: 1, month: 'JAN', year: 2000 });
    expect(header.source?.data?.copyright).toBe('(c) 2000');
  });
});
