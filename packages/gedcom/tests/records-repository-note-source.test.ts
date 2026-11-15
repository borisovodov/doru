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

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

const H551 = ['0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('repository, note and source records', () => {
  test('7.0 REPO parses every field', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @R1@ REPO',
        '1 NAME The Archive',
        '1 ADDR Main St',
        '1 PHON +49 1',
        '1 EMAIL a@example.com',
        '1 FAX +49 2',
        '1 WWW https://example.com',
        '1 NOTE a note',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 UID 550e',
        '1 _UID legacy',
        '1 EXID https://example.com/r1',
        '1 REFN r1',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'REPO';
      name: string;
      address?: { payload: string };
      phone?: string[];
      email?: string[];
      fax?: string[];
      www?: string[];
      notes?: unknown[];
      changeDate?: unknown;
      creationDate?: unknown;
      identifiers?: Array<{ tag: string }>;
    };
    expect(rec.name).toBe('The Archive');
    expect(rec.address?.payload).toBe('Main St');
    // The record-level contacts are relocated into the address block
    // (the canonical position).
    expect(rec.phone).toBeUndefined();
    expect((rec.address as { phone?: string[] }).phone).toEqual(['+49 1']);
    expect(rec.notes).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['UID', 'UID', 'EXID', 'REFN']);
  });

  test('5.5.1 REPO parses RIN and _UID; a missing NAME becomes the empty name', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @R1@ REPO',
        '1 NAME A',
        '1 ADDR x',
        '1 NOTE n',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 REFN r1',
        '1 RIN 3',
        '1 _UID u',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'REPO';
      name: string;
      identifiers?: Array<{ tag: string }>;
      automatedRecordId?: string;
      notes?: unknown[];
      changeDate?: unknown;
      address?: unknown;
    };
    expect(rec.name).toBe('A');
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(rec.automatedRecordId).toBe('3');
    expect(rec.notes).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.address).toBeDefined();
    const nameless = parse551([...H551, '0 @R1@ REPO', '1 NOTE n', ...SUBM, '0 TRLR'].join('\n'));
    const namelessRec = nameless.records.find((record) => record.tag === 'REPO') as { name: string };
    expect(namelessRec.name).toBe('');
  });

  test('5.5.1 REPO accepts the floating ADDRESS_STRUCTURE contacts beside ADDR', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @R1@ REPO',
        '1 NAME A',
        '1 PHON +49 1',
        '1 EMAIL a@@example.com',
        '1 FAX +49 2',
        '1 WWW https://example.com',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'REPO';
      phone?: string[];
      email?: string[];
      fax?: string[];
      www?: string[];
    };
    expect(rec.phone).toEqual(['+49 1']);
    expect(rec.email).toEqual(['a@example.com']);
    expect(rec.fax).toEqual(['+49 2']);
    expect(rec.www).toEqual(['https://example.com']);
  });

  test('7.0 SNOTE record parses every field', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @N1@ SNOTE the text',
        '1 MIME text/plain',
        '1 LANG en',
        '1 TRAN de',
        '2 MIME text/plain',
        '2 LANG de',
        '1 SOUR @S2@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 REFN r1',
        '1 UID 550e',
        '1 EXID https://example.com/n1',
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SNOTE';
      payload: string;
      mediaType?: string;
      language?: string;
      translations?: Array<{ payload: string; mediaType?: string; language?: string }>;
      citations?: unknown[];
      changeDate?: unknown;
      creationDate?: unknown;
      identifiers?: Array<{ tag: string }>;
    };
    expect(rec.payload).toBe('the text');
    expect(rec.mediaType).toBe('text/plain');
    expect(rec.language).toBe('en');
    expect(rec.translations?.[0]).toEqual({ payload: 'de', mediaType: 'text/plain', language: 'de' });
    expect(rec.citations).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID', 'EXID']);
  });

  test('5.5.1 NOTE record parses every field', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @N1@ NOTE the text',
        '1 SOUR @S2@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 REFN r1',
        '1 RIN 2',
        '1 _UID u',
        ...SUBM,
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'NOTE';
      payload: string;
      citations?: unknown[];
      changeDate?: unknown;
      identifiers?: Array<{ tag: string }>;
      automatedRecordId?: string;
    };
    expect(rec.payload).toBe('the text');
    expect(rec.citations).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(rec.automatedRecordId).toBe('2');
  });

  test('7.0 SOUR record parses DATA, TEXT, _TMPLT, REPO and identifiers', () => {
    const dataset = parse70(
      [
        '0 HEAD',
        '1 GEDC',
        '2 VERS 7.0',
        '0 @S1@ SOUR',
        '1 DATA',
        '2 EVEN BIRT, DEAT',
        '3 DATE FROM 1900 TO 1910',
        '4 PHRASE approx',
        '3 PLAC Paris',
        '2 AGNC The Agency',
        '2 NOTE data note',
        '1 AUTH John Doe',
        '1 TITL The Title',
        '1 ABBR TT',
        '1 PUBL Pub Co',
        '1 TEXT the transcript',
        '2 MIME text/plain',
        '2 LANG en',
        '1 _TMPLT',
        '2 TID 123',
        '2 FIELD',
        '3 NAME Author',
        '3 VALUE John',
        '1 _FULL the footnote',
        '1 REPO @R1@',
        '2 CALN A-1',
        '3 MEDI BOOK',
        '2 NOTE repo note',
        '1 NOTE a note',
        '1 OBJE @O1@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 CREA',
        '2 DATE 5 JAN 2001',
        '1 REFN r1',
        '1 UID 550e',
        '1 EXID https://example.com/s1',
        '0 @R1@ REPO',
        '1 NAME R',
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM image/jpeg',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SOUR';
      data?: {
        events?: Array<{
          payload: string[];
          date?: { value?: unknown; phrase?: string };
          place?: { payload: string[] };
        }>;
        agency?: string;
        notes?: unknown[];
      };
      author?: string;
      title?: string;
      abbreviation?: string;
      publication?: string;
      texts?: Array<{ payload: string; mediaType?: string; language?: string }>;
      template?: { templateId?: string; fields: Array<{ name: string; value?: string }> };
      fullFootnote?: string;
      repositoryCitations?: Array<{
        repository: string;
        notes?: unknown[];
        callNumbers?: Array<{ payload: string; medium?: { payload: string } }>;
      }>;
      notes?: unknown[];
      media?: unknown[];
      changeDate?: unknown;
      creationDate?: unknown;
      identifiers?: Array<{ tag: string }>;
    };
    expect(rec.data?.events?.[0]?.payload).toEqual(['BIRT', 'DEAT']);
    expect(rec.data?.events?.[0]?.date?.value).toEqual({
      kind: 'period',
      from: { calendar: 'GREGORIAN', year: 1900 },
      to: { calendar: 'GREGORIAN', year: 1910 },
    });
    expect(rec.data?.events?.[0]?.date?.phrase).toBe('approx');
    expect(rec.data?.events?.[0]?.place?.payload).toEqual(['Paris']);
    expect(rec.data?.agency).toBe('The Agency');
    expect(rec.data?.notes).toHaveLength(1);
    expect(rec.author).toBe('John Doe');
    expect(rec.title).toBe('The Title');
    expect(rec.abbreviation).toBe('TT');
    expect(rec.publication).toBe('Pub Co');
    expect(rec.texts).toEqual([{ payload: 'the transcript', mediaType: 'text/plain', language: 'en' }]);
    expect(rec.template).toEqual({
      tag: '_TMPLT',
      templateId: '123',
      fields: [{ tag: 'FIELD', name: 'Author', value: 'John' }],
    });
    expect(rec.fullFootnote).toBe('the footnote');
    expect(rec.repositoryCitations?.[0]?.repository).toBe('@R1@');
    expect(rec.repositoryCitations?.[0]?.callNumbers?.[0]).toEqual({ payload: 'A-1', medium: { payload: 'BOOK' } });
    expect(rec.repositoryCitations?.[0]?.notes).toHaveLength(1);
    expect(rec.notes).toHaveLength(1);
    expect(rec.media).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID', 'EXID']);
  });

  test('5.5.1 SOUR record parses DATA, TEXT, _TMPLT, REPO, RIN and _UID', () => {
    const dataset = parse551(
      [
        ...H551,
        '0 @S2@ SOUR',
        '1 DATA',
        '2 EVEN BIRT',
        '3 DATE FROM 1900 TO 1910',
        '3 PLAC Paris',
        '2 AGNC The Agency',
        '2 NOTE data note',
        '1 AUTH John Doe',
        '1 TITL The Title',
        '1 ABBR TT',
        '1 PUBL Pub Co',
        '1 TEXT the transcript',
        '1 _TMPLT',
        '2 TID 123',
        '2 FIELD',
        '3 NAME Author',
        '3 VALUE John',
        '1 _FULL the footnote',
        '1 REPO @R1@',
        '2 CALN A-1',
        '3 MEDI book',
        '1 NOTE a note',
        '1 OBJE @O1@',
        '1 CHAN',
        '2 DATE 4 JAN 2001',
        '1 REFN r1',
        '1 RIN 2',
        '1 _UID u',
        ...SUBM,
        '0 @R1@ REPO',
        '1 NAME R',
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM jpg',
        '0 TRLR',
      ].join('\n'),
    );
    const rec = dataset.records[0] as {
      tag: 'SOUR';
      data?: {
        events?: Array<{ payload: string[]; date?: { value?: unknown }; place?: { payload: string[] } }>;
        agency?: string;
        notes?: unknown[];
      };
      author?: string;
      title?: string;
      abbreviation?: string;
      publication?: string;
      texts?: Array<{ payload: string }>;
      template?: { templateId?: string; fields: Array<{ name: string; value?: string }> };
      fullFootnote?: string;
      repositoryCitations?: Array<{
        repository: string;
        callNumbers?: Array<{ payload: string; medium?: { payload: string } }>;
      }>;
      notes?: unknown[];
      media?: unknown[];
      changeDate?: unknown;
      identifiers?: Array<{ tag: string }>;
      automatedRecordId?: string;
    };
    expect(rec.data?.events?.[0]?.date?.value).toEqual({
      kind: 'period',
      from: { calendar: 'GREGORIAN', year: 1900 },
      to: { calendar: 'GREGORIAN', year: 1910 },
    });
    expect(rec.data?.events?.[0]?.place?.payload).toEqual(['Paris']);
    expect(rec.data?.agency).toBe('The Agency');
    expect(rec.data?.notes).toHaveLength(1);
    expect(rec.author).toBe('John Doe');
    expect(rec.title).toBe('The Title');
    expect(rec.abbreviation).toBe('TT');
    expect(rec.publication).toBe('Pub Co');
    expect(rec.texts?.[0]?.payload).toBe('the transcript');
    expect(rec.template).toEqual({
      tag: '_TMPLT',
      templateId: '123',
      fields: [{ tag: 'FIELD', name: 'Author', value: 'John' }],
    });
    expect(rec.fullFootnote).toBe('the footnote');
    expect(rec.repositoryCitations?.[0]?.repository).toBe('@R1@');
    expect(rec.repositoryCitations?.[0]?.callNumbers?.[0]?.medium?.payload).toBe('BOOK');
    expect(rec.notes).toHaveLength(1);
    expect(rec.media).toHaveLength(1);
    expect(rec.changeDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['REFN', 'UID']);
    expect(rec.automatedRecordId).toBe('2');
  });

  test('5.5.1 DATA.EVEN.PLAC accepts the GEDCOM-L place children', () => {
    // The GEDCOM-L place tags under the SOUR.DATA.EVEN.PLAC jurisdiction
    // place (webtrees per-vendor custom-tag registry, GedcomL.php) parse
    // into the typed PlaceStructure slots instead of failing.
    const dataset = parse551(
      [...H551, '0 @S2@ SOUR', '1 DATA', '2 EVEN BIRT', '3 PLAC Paris', '4 _GOV WEIHEN_W6051', ...SUBM, '0 TRLR'].join(
        '\n',
      ),
    );
    const data = dataset.records.find((r) => r.tag === 'SOUR' && 'data' in r);
    expect(data !== undefined && 'data' in data ? data.data.events?.[0]?.place?.govId : undefined).toBe('WEIHEN_W6051');
  });

  test('_TMPLT FIELD without a NAME gets the empty name; unknown tags under TEXT become extensions', () => {
    const templ = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR\n1 _TMPLT\n2 FIELD\n3 VALUE v\n0 TRLR\n');
    const sour = templ.records.find((record) => record.tag === 'SOUR') as {
      template?: { fields?: Array<{ name: string }> };
    };
    expect(sour.template?.fields?.[0]?.name).toBe('');
    const dataset = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR\n1 TEXT t\n2 BOGUS x\n0 TRLR\n');
    const sour2 = dataset.records.find((record) => record.tag === 'SOUR') as {
      texts?: Array<{ extensions?: Array<{ tag: string }> }>;
    };
    expect(sour2.texts?.[0]?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('a SOUR record payload becomes the title; a TITL child overrides it', () => {
    const payload = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR payload\n0 TRLR\n');
    const sour = payload.records.find((record) => record.tag === 'SOUR') as { title?: string };
    expect(sour.title).toBe('payload');
    const overridden = parse70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @S1@ SOUR payload\n1 TITL Real\n0 TRLR\n');
    const sour2 = overridden.records.find((record) => record.tag === 'SOUR') as { title?: string };
    expect(sour2.title).toBe('Real');
  });
});
