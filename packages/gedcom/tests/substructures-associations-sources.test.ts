import { describe, expect, test } from 'vitest';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551, serializeGedcom70 } from '../src/serialize/serialize';
import type { GedcomDataset } from '../src/structures';
import { isIndividualRecord } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

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

describe('associations and roles', () => {
  test('7.0 ASSO with ROLE, PHRASE, NOTE and SOUR', () => {
    const dataset = parse70(
      indi70([
        '1 ASSO @I2@',
        '2 ROLE FRIEND',
        '3 PHRASE close friend',
        '2 PHRASE witness',
        '2 NOTE a note',
        '2 SOUR @S2@',
        '0 @I2@ INDI',
        '1 NAME Jane /Roe/',
        '0 @S2@ SOUR',
        '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as {
      associations?: Array<{
        individual: string;
        role?: { payload: string; phrase?: string };
        phrase?: string;
        notes?: unknown[];
        citations?: unknown[];
      }>;
    };
    expect(rec.associations?.[0]).toEqual({
      tag: 'ASSO',
      individual: '@I2@',
      role: { payload: 'FRIEND', phrase: 'close friend' },
      phrase: 'witness',
      notes: [{ tag: 'NOTE', payload: 'a note' }],
      citations: [{ tag: 'SOUR', source: '@S2@' }],
    });
  });

  test('an ASSO without ROLE/RELA parses', () => {
    // The 7.0 grammar requires ROLE and the 5.5.1 grammar requires
    // RELA; neither is required.
    expect(parseGedcom70(enc(indi70(['0 @I2@ INDI', '1 NAME X', '1 ASSO @I2@']))).ok).toBe(true);
    expect(parseGedcom551(enc(indi551(['0 @I2@ INDI', '1 NAME X', '1 ASSO @I2@']))).ok).toBe(true);
  });

  test('5.5.1 ROLE spells the six keywords and parenthesized descriptors', () => {
    const dataset = parse551(
      indi551([
        '0 @I2@ INDI',
        '1 NAME X',
        '1 ASSO @I2@',
        '2 RELA Godfather',
        '1 ASSO @I3@',
        '2 ROLE (Witness)',
        '0 @I3@ INDI',
        '1 NAME Y',
      ]),
    );
    const rec = dataset.records[1] as {
      associations?: Array<{ individual: string; role?: { payload: string; phrase?: string } }>;
    };
    expect(rec.associations?.[0]?.role).toEqual({ payload: 'OTHER', phrase: 'Godfather' });
    expect(rec.associations?.[1]?.role).toEqual({ payload: 'OTHER', phrase: 'Witness' });
  });

  test('5.5.1 ROLE tolerates a PHRASE child and bare descriptors', () => {
    // The PHRASE child under ROLE is accepted in any file; a bare
    // descriptor becomes OTHER + phrase.
    const dataset = parse551(
      indi551([
        '0 @I2@ INDI',
        '1 NAME X',
        '1 ASSO @I2@',
        '2 ROLE (W)',
        '3 PHRASE x',
        '1 ASSO @I3@',
        '2 ROLE nope',
        '0 @I3@ INDI',
        '1 NAME Y',
      ]),
    );
    const rec = dataset.records[1] as { associations?: Array<{ role?: { payload: string; phrase?: string } }> };
    expect(rec.associations?.[0]?.role).toEqual({ payload: 'OTHER', phrase: 'x' });
    expect(rec.associations?.[1]?.role).toEqual({ payload: 'OTHER', phrase: 'nope' });
  });

  test('7.0 SOUR.EVEN.ROLE parses a role with a phrase', () => {
    const dataset = parse70(
      indi70([
        '1 BIRT',
        '2 SOUR @S2@',
        '3 EVEN BIRT',
        '4 ROLE WITN',
        '5 PHRASE the witness',
        '0 @S2@ SOUR',
        '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as {
      events?: Array<{
        detail?: { citations?: Array<{ event?: { payload: string; role?: { payload: string; phrase?: string } } }> };
      }>;
    };
    expect(rec.events?.[0]?.detail?.citations?.[0]?.event?.role).toEqual({ payload: 'WITN', phrase: 'the witness' });
  });
});

describe('change dates, creation dates and sort dates', () => {
  test('CHAN keeps a NOTE next to the DATE', () => {
    const dataset = parse70(indi70(['1 CHAN', '2 DATE 4 JAN 2001', '2 NOTE changed']));
    const rec = dataset.records[0] as { changeDate?: { date: { value: unknown }; notes?: Array<{ payload: string }> } };
    expect(rec.changeDate?.date.value).toEqual({ day: 4, month: 'JAN', year: 2001 });
    expect(rec.changeDate?.notes?.[0]?.payload).toBe('changed');
  });

  test('CHAN and CREA require a DATE', () => {
    expect(err70(indi70(['1 CHAN']))).toBe('structure.missing-required');
    expect(err70(indi70(['1 CREA']))).toBe('structure.missing-required');
  });

  test('7.0 SDATE with value, TIME and PHRASE; _SDATE is the 5.5.1 spelling', () => {
    const dataset = parse70(indi70(['1 BIRT', '2 SDATE 1900', '3 TIME 10:30', '3 PHRASE computed']));
    const rec = dataset.records[0] as {
      events?: Array<{
        detail?: { sortDate?: { value?: { kind: string; year: number }; time?: { hour: number }; phrase?: string } };
      }>;
    };
    expect(rec.events?.[0]?.detail?.sortDate).toEqual({
      value: { kind: 'date', calendar: 'GREGORIAN', year: 1900 },
      time: { hour: 10, minute: 30 },
      phrase: 'computed',
    });

    const dataset551 = parse551(indi551(['1 BIRT', '2 _SDATE 1900']));
    const rec551 = dataset551.records[0] as {
      events?: Array<{ detail?: { sortDate?: { value?: { kind: string; year: number } } } }>;
    };
    expect(rec551.events?.[0]?.detail?.sortDate?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1900 });
  });

  test('5.5.1 _SDATE keeps a phrase and its substructures as extensions', () => {
    const dataset = parse551(indi551(['1 BIRT', '2 _SDATE (sometime)']));
    const rec = dataset.records[0] as { events?: Array<{ detail?: { sortDate?: { phrase?: string } } }> };
    expect(rec.events?.[0]?.detail?.sortDate?.phrase).toBe('sometime');
    const withChild = parse551(indi551(['1 BIRT', '2 _SDATE 1900', '3 BOGUS x']));
    const rec2 = withChild.records[0] as {
      events?: Array<{ detail?: { sortDate?: { extensions?: Array<{ tag: string }> } } }>;
    };
    expect(rec2.events?.[0]?.detail?.sortDate?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('a bare DATE is the empty date form; unknown substructures become extensions', () => {
    const bare = parseGedcom551(enc(indi551(['1 BIRT', '2 DATE'])));
    expect(bare.ok).toBe(true);
    const withChild = parse551(indi551(['1 BIRT', '2 DATE 1900', '3 BOGUS x']));
    const rec = withChild.records[0] as {
      events?: Array<{ detail?: { date?: { extensions?: Array<{ tag: string }> } } }>;
    };
    expect(rec.events?.[0]?.detail?.date?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('5.5.1 DATE_EXACT variants inside CHAN', () => {
    // A year-only exact date is tolerated with the absent components unset.
    const yearOnly = parse551(indi551(['1 CHAN', '2 DATE 1900']));
    const rec0 = yearOnly.records[0] as { changeDate?: { date: { value: unknown } } };
    expect(rec0.changeDate?.date.value).toEqual({ year: 1900 });
    // A dual year composes to its single year.
    const dual = parse551(indi551(['1 CHAN', '2 DATE 1 JAN 1900/01']));
    const rec1 = dual.records[0] as { changeDate?: { date: { value: unknown } } };
    expect(rec1.changeDate?.date.value).toEqual({ day: 1, month: 'JAN', year: 1901 });
    // A phrase-only date is not a DATE_EXACT.
    expect(err551(indi551(['1 CHAN', '2 DATE (sometime)']))).toBe('date.invalid');
    // TIME is allowed on the exact date.
    const dataset = parse551(indi551(['1 CHAN', '2 DATE 1 JAN 1900', '3 TIME 10:30:15.5']));
    const rec = dataset.records[0] as {
      changeDate?: { date: { value: unknown; time?: { second: number; fraction?: string } } };
    };
    expect(rec.changeDate?.date.time?.second).toBe(15);
    expect(rec.changeDate?.date.time?.fraction).toBe('5');
  });

  test('AGE accepts a PHRASE', () => {
    const dataset = parse70(indi70(['1 BIRT', '2 AGE > 50y', '3 PHRASE about fifty']));
    const rec = dataset.records[0] as {
      events?: Array<{ detail?: { age?: { payload: { bound: string; years: number }; phrase: string } } }>;
    };
    expect(rec.events?.[0]?.detail?.age).toEqual({ payload: { bound: '>', years: 50 }, phrase: 'about fifty' });
  });

  test('7.0 NO carries DATE, NOTE and SOUR', () => {
    const dataset = parse70(
      indi70([
        '1 NO DEAT',
        '2 DATE FROM 1900 TO 1910',
        '2 NOTE never happened',
        '2 SOUR @S2@',
        '0 @S2@ SOUR',
        '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as {
      nonEvents?: Array<{ payload: string; date?: { value: unknown }; notes?: unknown[]; citations?: unknown[] }>;
    };
    expect(rec.nonEvents?.[0]?.payload).toBe('DEAT');
    expect(rec.nonEvents?.[0]?.date?.value).toBeDefined();
    expect(rec.nonEvents?.[0]?.notes).toHaveLength(1);
    expect(rec.nonEvents?.[0]?.citations).toHaveLength(1);
  });
});

describe('note structures', () => {
  test('SNOTE reference keeps substructures as extensions', () => {
    const dataset = parse70(indi70(['0 @N1@ SNOTE text', '1 SNOTE @N1@', '2 BOGUS x']));
    const snote = dataset.records.find((record) => record.tag === 'SNOTE') as {
      extensions?: Array<{ tag: string; payload?: string; payloadKind?: string; children?: Array<{ tag: string }> }>;
    };
    const reference = snote.extensions?.find((extension) => extension.tag === 'SNOTE');
    expect(reference?.payload).toBe('@N1@');
    expect(reference?.payloadKind).toBe('pointer');
    expect(reference?.children?.some((child) => child.tag === 'BOGUS')).toBe(true);
  });

  test('5.5.1 NOTE pointer reference resolves and keeps substructures as extensions', () => {
    const dataset = parse551(indi551(['1 NOTE @N1@', '0 @N1@ NOTE text']));
    const rec = dataset.records[0] as { notes?: Array<{ tag: string; note: string }> };
    expect(rec.notes?.[0]).toEqual({ tag: 'NOTE', note: '@N1@' });
    const withChild = parse551(indi551(['1 NOTE @N1@', '2 BOGUS x', '0 @N1@ NOTE text']));
    const rec2 = withChild.records[0] as { notes?: Array<{ note: string; extensions?: Array<{ tag: string }> }> };
    expect(rec2.notes?.[0]?.note).toBe('@N1@');
    expect(rec2.notes?.[0]?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('5.5.1 NOTE pointer accepts bare SOUR pointers beneath it', () => {
    const dataset = parse551(
      indi551([
        '1 NOTE @N1@',
        '2 SOUR @S2@',
        '2 SOUR @S3@',
        '0 @N1@ NOTE text',
        '0 @S2@ SOUR',
        '1 TITL Two',
        '0 @S3@ SOUR',
        '1 TITL Three',
      ]),
    );
    const rec = dataset.records[0] as {
      notes?: Array<{ tag: string; note: string; citations?: Array<{ tag: string; source: string }> }>;
    };
    expect(rec.notes?.[0]).toEqual({
      tag: 'NOTE',
      note: '@N1@',
      citations: [
        { tag: 'SOUR', source: '@S2@' },
        { tag: 'SOUR', source: '@S3@' },
      ],
    });
    // The SOUR under a NOTE pointer is a bare pointer: a dangling one
    // stays verbatim; an unknown child of the pointer becomes an
    // extension of the note.
    const withChild = parse551(
      indi551(['1 NOTE @N1@', '2 SOUR @S2@', '3 BOGUS x', '0 @N1@ NOTE text', '0 @S2@ SOUR', '1 TITL S']),
    );
    const rec2 = withChild.records[0] as {
      notes?: Array<{ note: string; extensions?: Array<{ tag: string }>; citations?: Array<{ source: string }> }>;
    };
    expect(rec2.notes?.[0]?.citations?.[0]?.source).toBe('@S2@');
    expect(rec2.notes?.[0]?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
    const dangling = parse551(indi551(['1 NOTE @N1@', '2 SOUR @NOPE@', '0 @N1@ NOTE text']));
    const rec3 = dangling.records[0] as { notes?: Array<{ citations?: Array<{ source: string }> }> };
    expect(rec3.notes?.[0]?.citations ?? []).toEqual([]);
  });

  test('NOTE pointer citations: 5.5.1 writes them back, 7.0 drops them', () => {
    const dataset = parse551(indi551(['1 NOTE @N1@', '2 SOUR @S2@', '0 @N1@ NOTE text', '0 @S2@ SOUR', '1 TITL Two']));
    const out551 = ser551(dataset);
    expect(out551).toContain('1 NOTE @N1@');
    expect(out551).toContain('2 SOUR @S2@');
    // 7.0 spells the pointer SNOTE and has no slot for the citation.
    const out70 = ser70(dataset);
    expect(out70).toContain('1 SNOTE @N1@');
    expect(out70).not.toContain('2 SOUR @S2@');
  });

  test('7.0 inline NOTE carries MIME, LANG, TRAN and SOUR', () => {
    const dataset = parse70(
      indi70([
        '1 NOTE the text',
        '2 MIME text/plain',
        '2 LANG en',
        '2 TRAN de',
        '3 MIME text/plain',
        '3 LANG de',
        '2 SOUR @S2@',
        '0 @S2@ SOUR',
        '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as {
      notes?: Array<{
        payload: string;
        mediaType?: string;
        language?: string;
        translations?: Array<{ payload: string; mediaType?: string; language?: string }>;
        citations?: unknown[];
      }>;
    };
    expect(rec.notes?.[0]).toEqual({
      tag: 'NOTE',
      payload: 'the text',
      mediaType: 'text/plain',
      language: 'en',
      translations: [{ payload: 'de', mediaType: 'text/plain', language: 'de' }],
      citations: [{ tag: 'SOUR', source: '@S2@' }],
    });
  });

  test('NOTE.TRAN without MIME or LANG keeps the translation text', () => {
    const dataset = parse70(indi70(['1 NOTE x', '2 TRAN de']));
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'translations' in note ? note.translations[0] : undefined).toEqual({ payload: 'de' });
  });

  test('UID keeps substructures as extensions', () => {
    const dataset = parse70(indi70(['1 UID u', '2 BOGUS x']));
    const rec = dataset.records[0] as { identifiers?: Array<{ tag: string; extensions?: Array<{ tag: string }> }> };
    expect(rec.identifiers?.[0]?.tag).toBe('UID');
    expect(rec.identifiers?.[0]?.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('EXID TYPE must be a valid URI; a bare TYPE line is skipped', () => {
    expect(err70(indi70(['1 EXID https://x.example/id', '2 TYPE bad uri']))).toBe('uri.invalid');
    const dataset = parse70(indi70(['1 EXID https://x.example/id', '2 TYPE']));
    const rec = dataset.records[0] as { identifiers?: Array<{ tag: string; payload: string }> };
    expect(rec.identifiers).toEqual([{ tag: 'EXID', payload: 'https://x.example/id' }]);
  });
});

describe('address and reference identifiers', () => {
  test('REFN accepts a TYPE', () => {
    const dataset = parse70(indi70(['1 REFN r1', '2 TYPE user']));
    const rec = dataset.records[0] as { identifiers?: Array<{ tag: string; payload: string; type?: string }> };
    expect(rec.identifiers?.[0]).toEqual({ tag: 'REFN', payload: 'r1', type: 'user' });
  });
});

describe('source citations and media links', () => {
  test('7.0 SOUR citation with PAGE, DATA, EVEN, QUAY, CROP, TITL and vendor flags', () => {
    const dataset = parse70(
      indi70([
        '1 BIRT',
        '2 SOUR @S2@',
        '3 PAGE p.12',
        '3 DATA',
        '4 DATE 1900',
        '4 TEXT excerpt',
        '5 MIME text/plain',
        '3 EVEN BIRT',
        '4 ROLE WITN',
        '3 QUAY 2',
        '3 OBJE @O1@',
        '4 CROP',
        '5 TOP 1',
        '5 LEFT 2',
        '5 HEIGHT 100',
        '5 WIDTH 200',
        '4 TITL the crop',
        '3 NOTE n',
        '3 _APID 123',
        '3 _CREF c',
        '3 _VERI Y',
        '0 @S2@ SOUR',
        '1 TITL S',
        '0 @O1@ OBJE',
        '1 FILE a.jpg',
        '2 FORM image/jpeg',
      ]),
    );
    const rec = dataset.records[0];
    if (rec === undefined || !isIndividualRecord(rec)) {
      throw new Error('expected INDI');
    }
    const citation = rec.events?.[0]?.detail?.citations?.[0];
    expect(citation?.page?.payload).toBe('p.12');
    expect(citation?.data?.date?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1900 });
    expect(citation?.data?.texts?.[0]).toEqual({ payload: 'excerpt', mediaType: 'text/plain' });
    expect(citation?.event).toEqual({ payload: 'BIRT', role: { payload: 'WITN' } });
    expect(citation?.quality).toBe('2');
    expect(citation?.media?.[0]?.crop).toEqual({ top: 1, left: 2, height: 100, width: 200 });
    expect(citation?.media?.[0]?.title).toBe('the crop');
    expect(citation?.notes).toHaveLength(1);
    expect(citation?.ancestryPointers).toEqual(['123']);
    expect(citation?.reference).toBe('c');
    expect(citation?.verified).toBe(true);
  });

  test('5.5.1 SOUR citation pointer and free-text forms', () => {
    const dataset = parse551(
      indi551([
        '1 BIRT',
        '2 SOUR @S2@',
        '3 PAGE p.1',
        '3 QUAY 2',
        '3 _VERI N',
        '2 SOUR some free text',
        '3 TEXT the transcript',
        '3 QUAY 3',
        '0 @S2@ SOUR',
        '1 TITL S',
      ]),
    );
    const rec = dataset.records[0];
    if (rec === undefined || !isIndividualRecord(rec)) {
      throw new Error('expected INDI');
    }
    const citations = rec.events?.[0]?.detail?.citations;
    expect(citations?.[0]?.source).toBe('@S2@');
    expect(citations?.[0]?.page?.payload).toBe('p.1');
    expect(citations?.[0]?.quality).toBe('2');
    expect(citations?.[0]?.verified).toBe(false);
    expect(citations?.[1]?.source).toBe('@VOID@');
    expect(citations?.[1]?.description).toBe('some free text');
    expect(citations?.[1]?.data?.texts?.[0]?.payload).toBe('the transcript');
  });

  test('5.5.1 bare SOUR citation line is kept as an empty description', () => {
    const dataset = parse551(indi551(['1 BIRT', '2 SOUR']));
    const rec = dataset.records[0] as { events?: Array<{ detail?: { citations?: unknown[] } }> };
    expect(rec.events?.[0]?.detail?.citations).toEqual([{ tag: 'SOUR', source: '@VOID@', description: '' }]);
  });

  test('5.5.1 inline OBJE synthesizes a record; unknown children become extensions', () => {
    const dataset = parse551(
      indi551([
        '1 OBJE',
        '2 FILE a.jpg',
        '3 FORM jpg',
        '2 TITL the title',
        '2 _PRIM Y',
        '2 _SCBK N',
        '2 _SSHOW Y',
        '2 _TYPE portrait',
        '2 _SOUND s.wav',
        '2 _DATE 1900',
      ]),
    );
    const rec = dataset.records[0] as {
      media?: Array<{ object: string; primary?: boolean; scrapbook?: boolean; slideshow?: boolean }>;
    };
    expect(rec.media?.[0]?.object).toBe('@_SYNO0@');
    expect(rec.media?.[0]?.primary).toBe(true);
    expect(rec.media?.[0]?.scrapbook).toBe(false);
    expect(rec.media?.[0]?.slideshow).toBe(true);
    const synthetic = dataset.records[dataset.records.length - 1] as {
      tag: 'OBJE';
      files: Array<{ payload: string; form: { payload: string }; title?: string }>;
      objectType?: string;
      soundFile?: string;
      date?: unknown;
    };
    expect(synthetic.tag).toBe('OBJE');
    expect(synthetic.files[0]?.title).toBe('the title');
    expect(synthetic.objectType).toBe('portrait');
    expect(synthetic.soundFile).toBe('s.wav');
    expect(synthetic.date).toBeDefined();
    const withBogus = parse551(indi551(['1 OBJE', '2 FILE b.jpg', '3 FORM jpg', '2 BOGUS']));
    const synthetic2 = withBogus.records.find((record) => record.tag === 'OBJE') as {
      extensions?: Array<{ tag: string }>;
    };
    expect(synthetic2.extensions?.some((extension) => extension.tag === 'BOGUS')).toBe(true);
  });

  test('5.5.1 inline OBJE without a FILE still synthesizes an empty record', () => {
    const dataset = parse551(indi551(['1 OBJE']));
    const rec = dataset.records[0] as { media?: Array<{ object: string }> };
    expect(rec.media?.[0]?.object).toBe('@_SYNO0@');
    const synthetic = dataset.records.find((record) => record.tag === 'OBJE') as { files: unknown[] };
    expect(synthetic.files).toEqual([]);
  });

  test('_PRIV flag semantics', () => {
    const dataset = parse70(
      indi70(['1 BIRT', '2 ADDR x', '3 _PRIV', '2 ADDR y', '3 _PRIV N', '2 ADDR z', '3 _PRIV Y']),
    );
    expect(dataset.records[0]?.tag).toBe('INDI');
    expect(err70(indi70(['1 BIRT', '2 ADDR x', '3 _PRIV X']))).toBe('enum.invalid-value');
  });

  test('YN flags accept Y and N', () => {
    expect(err70(indi70(['1 FAMC @F1@', '2 _PRIMARY X', '0 @F1@ FAM']))).toBe('enum.invalid-value');
  });
});
