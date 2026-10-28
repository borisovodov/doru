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
        '0 @I2@ INDI', '1 NAME Jane /Roe/',
        '0 @S2@ SOUR', '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as { associations?: Array<{ individual: string; role?: { payload: string; phrase?: string }; phrase?: string; notes?: unknown[]; citations?: unknown[] }> };
    expect(rec.associations?.[0]).toEqual({
      tag: 'ASSO', individual: '@I2@',
      role: { payload: 'FRIEND', phrase: 'close friend' },
      phrase: 'witness', notes: [{ tag: 'NOTE', payload: 'a note' }], citations: [{ tag: 'SOUR', source: '@S2@' }],
    });
  });

  test('7.0 ASSO requires ROLE; 5.5.1 ASSO requires RELA', () => {
    expect(err70(indi70(['0 @I2@ INDI', '1 NAME X', '1 ASSO @I2@']))).toBe('structure.missing-required');
    expect(err551(indi551(['0 @I2@ INDI', '1 NAME X', '1 ASSO @I2@']))).toBe('structure.missing-required');
  });

  test('5.5.1 ROLE spells the six keywords and parenthesized descriptors', () => {
    const dataset = parse551(
      indi551([
        '0 @I2@ INDI', '1 NAME X',
        '1 ASSO @I2@',
        '2 RELA Godfather',
        '2 ROLE (Witness)',
      ]),
    );
    const rec = dataset.records[1] as { associations?: Array<{ individual: string; relationship?: string; role?: { payload: string; phrase?: string } }> };
    expect(rec.associations?.[0]?.relationship).toBe('Godfather');
    expect(rec.associations?.[0]?.role).toEqual({ payload: 'OTHER', phrase: 'Witness' });
  });

  test('5.5.1 ROLE rejects substructures and unknown values', () => {
    expect(err551(indi551(['0 @I2@ INDI', '1 NAME X', '1 ASSO @I2@', '2 RELA x', '2 ROLE (W)', '3 PHRASE x']))).toBe('structure.unknown-tag');
    expect(err551(indi551(['0 @I2@ INDI', '1 NAME X', '1 ASSO @I2@', '2 RELA x', '2 ROLE nope']))).toBe('enum.invalid-value');
  });

  test('7.0 SOUR.EVEN.ROLE parses a role with a phrase', () => {
    const dataset = parse70(
      indi70([
        '1 BIRT',
        '2 SOUR @S2@',
        '3 EVEN BIRT',
        '4 ROLE WITN',
        '5 PHRASE the witness',
        '0 @S2@ SOUR', '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as { events?: Array<{ detail?: { citations?: Array<{ event?: { payload: string; role?: { payload: string; phrase?: string } } }> } }> };
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
    const rec = dataset.records[0] as { events?: Array<{ detail?: { sortDate?: { value?: { kind: string; year: number }; time?: { hour: number }; phrase?: string } } }> };
    expect(rec.events?.[0]?.detail?.sortDate).toEqual({ value: { kind: 'date', calendar: 'GREGORIAN', year: 1900 }, time: { hour: 10, minute: 30 }, phrase: 'computed' });

    const dataset551 = parse551(indi551(['1 BIRT', '2 _SDATE 1900']));
    const rec551 = dataset551.records[0] as { events?: Array<{ detail?: { sortDate?: { value?: { kind: string; year: number } } } }> };
    expect(rec551.events?.[0]?.detail?.sortDate?.value).toEqual({ kind: 'date', calendar: 'GREGORIAN', year: 1900 });
  });

  test('5.5.1 _SDATE keeps a phrase and rejects substructures', () => {
    const dataset = parse551(indi551(['1 BIRT', '2 _SDATE (sometime)']));
    const rec = dataset.records[0] as { events?: Array<{ detail?: { sortDate?: { phrase?: string } } }> };
    expect(rec.events?.[0]?.detail?.sortDate?.phrase).toBe('sometime');
    expect(err551(indi551(['1 BIRT', '2 _SDATE 1900', '3 BOGUS x']))).toBe('structure.unknown-tag');
  });

  test('5.5.1 DATE rejects missing payload and substructures', () => {
    expect(err551(indi551(['1 BIRT', '2 DATE']))).toBe('structure.missing-payload');
    expect(err551(indi551(['1 BIRT', '2 DATE 1900', '3 BOGUS x']))).toBe('structure.unknown-tag');
  });

  test('5.5.1 DATE_EXACT variants inside CHAN', () => {
    // Year-only is not a DATE_EXACT.
    expect(err551(indi551(['1 CHAN', '2 DATE 1900']))).toBe('date.invalid');
    // A dual year is not a DATE_EXACT.
    expect(err551(indi551(['1 CHAN', '2 DATE 1 JAN 1900/01']))).toBe('date.invalid');
    // A phrase-only date is not a DATE_EXACT.
    expect(err551(indi551(['1 CHAN', '2 DATE (sometime)']))).toBe('date.invalid');
    // TIME is allowed on the exact date.
    const dataset = parse551(indi551(['1 CHAN', '2 DATE 1 JAN 1900', '3 TIME 10:30:15.5']));
    const rec = dataset.records[0] as { changeDate?: { date: { value: unknown; time?: { second: number; fraction?: string } } } };
    expect(rec.changeDate?.date.time?.second).toBe(15);
    expect(rec.changeDate?.date.time?.fraction).toBe('5');
  });

  test('AGE accepts a PHRASE', () => {
    const dataset = parse70(indi70(['1 BIRT', '2 AGE > 50y', '3 PHRASE about fifty']));
    const rec = dataset.records[0] as { events?: Array<{ detail?: { age?: { payload: { bound: string; years: number }; phrase: string } } }> };
    expect(rec.events?.[0]?.detail?.age).toEqual({ payload: { bound: '>', years: 50 }, phrase: 'about fifty' });
  });

  test('7.0 NO carries DATE, NOTE and SOUR', () => {
    const dataset = parse70(
      indi70([
        '1 NO DEAT',
        '2 DATE FROM 1900 TO 1910',
        '2 NOTE never happened',
        '2 SOUR @S2@',
        '0 @S2@ SOUR', '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as { nonEvents?: Array<{ payload: string; date?: { value: unknown }; notes?: unknown[]; citations?: unknown[] }> };
    expect(rec.nonEvents?.[0]?.payload).toBe('DEAT');
    expect(rec.nonEvents?.[0]?.date?.value).toBeDefined();
    expect(rec.nonEvents?.[0]?.notes).toHaveLength(1);
    expect(rec.nonEvents?.[0]?.citations).toHaveLength(1);
  });
});

describe('note structures', () => {
  test('SNOTE reference rejects substructures', () => {
    expect(err70(indi70(['0 @N1@ SNOTE text', '1 SNOTE @N1@', '2 BOGUS x']))).toBe('structure.unknown-tag');
  });

  test('5.5.1 NOTE pointer reference resolves and rejects substructures', () => {
    const dataset = parse551(indi551(['1 NOTE @N1@', '0 @N1@ NOTE text']));
    const rec = dataset.records[0] as { notes?: Array<{ tag: string; note: string }> };
    expect(rec.notes?.[0]).toEqual({ tag: 'NOTE', note: '@N1@' });
    expect(err551(indi551(['1 NOTE @N1@', '2 BOGUS x', '0 @N1@ NOTE text']))).toBe('structure.unknown-tag');
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
        '0 @S2@ SOUR', '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as { notes?: Array<{ payload: string; mediaType?: string; language?: string; translations?: Array<{ payload: string; mediaType?: string; language?: string }>; citations?: unknown[] }> };
    expect(rec.notes?.[0]).toEqual({
      tag: 'NOTE', payload: 'the text', mediaType: 'text/plain', language: 'en',
      translations: [{ payload: 'de', mediaType: 'text/plain', language: 'de' }],
      citations: [{ tag: 'SOUR', source: '@S2@' }],
    });
  });

  test('NOTE.TRAN requires MIME or LANG', () => {
    expect(err70(indi70(['1 NOTE x', '2 TRAN de']))).toBe('structure.missing-required');
  });

  test('UID rejects substructures', () => {
    expect(err70(indi70(['1 UID u', '2 BOGUS x']))).toBe('structure.unknown-tag');
  });

  test('EXID TYPE must be a valid URI', () => {
    expect(err70(indi70(['1 EXID https://x.example/id', '2 TYPE bad uri']))).toBe('uri.invalid');
    expect(err70(indi70(['1 EXID https://x.example/id', '2 TYPE']))).toBe('structure.missing-payload');
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
        '0 @S2@ SOUR', '1 TITL S',
        '0 @O1@ OBJE', '1 FILE a.jpg', '2 FORM image/jpeg',
      ]),
    );
    const rec = dataset.records[0] as {
      events?: Array<{ detail?: { citations?: Array<{
        source: string; page?: string;
        data?: { date?: { value?: unknown }; texts?: Array<{ payload: string; mediaType?: string }> };
        event?: { payload: string; role?: { payload: string } }; quality?: string;
        media?: Array<{ object: string; crop?: { top: number; left: number; height: number; width: number }; title?: string }>;
        notes?: unknown[]; ancestryPointers?: string[]; reference?: string; verified?: boolean;
      }> } }>;
    };
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
        '0 @S2@ SOUR', '1 TITL S',
      ]),
    );
    const rec = dataset.records[0] as { events?: Array<{ detail?: { citations?: Array<{ source: string; description?: string; page?: string; quality?: string; verified?: boolean; data?: { texts?: Array<{ payload: string }> } }> } }> };
    expect(rec.events?.[0]?.detail?.citations?.[0]?.source).toBe('@S2@');
    expect(rec.events?.[0]?.detail?.citations?.[0]?.page?.payload).toBe('p.1');
    expect(rec.events?.[0]?.detail?.citations?.[0]?.quality).toBe('2');
    expect(rec.events?.[0]?.detail?.citations?.[0]?.verified).toBe(false);
    expect(rec.events?.[0]?.detail?.citations?.[1]?.source).toBe('@VOID@');
    expect(rec.events?.[0]?.detail?.citations?.[1]?.description).toBe('some free text');
    expect(rec.events?.[0]?.detail?.citations?.[1]?.data?.texts?.[0]?.payload).toBe('the transcript');
  });

  test('5.5.1 SOUR citation requires a payload', () => {
    expect(err551(indi551(['1 BIRT', '2 SOUR']))).toBe('structure.missing-payload');
  });

  test('5.5.1 inline OBJE synthesizes a record; a text payload is rejected', () => {
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
    const rec = dataset.records[0] as { media?: Array<{ object: string; primary?: boolean; scrapbook?: boolean; slideshow?: boolean }> };
    expect(rec.media?.[0]?.object).toBe('@_SYNO0@');
    expect(rec.media?.[0]?.primary).toBe(true);
    expect(rec.media?.[0]?.scrapbook).toBe(false);
    expect(rec.media?.[0]?.slideshow).toBe(true);
    const synthetic = dataset.records[dataset.records.length - 1] as {
      tag: 'OBJE'; files: Array<{ payload: string; form: { payload: string }; title?: string }>; objectType?: string; soundFile?: string; date?: unknown;
    };
    expect(synthetic.tag).toBe('OBJE');
    expect(synthetic.files[0]?.title).toBe('the title');
    expect(synthetic.objectType).toBe('portrait');
    expect(synthetic.soundFile).toBe('s.wav');
    expect(synthetic.date).toBeDefined();
    expect(err551(indi551(['1 OBJE', '2 BOGUS']))).toBe('structure.unknown-tag');
  });

  test('5.5.1 inline OBJE requires a FILE', () => {
    expect(err551(indi551(['1 OBJE']))).toBe('structure.missing-required');
  });

  test('_PRIV flag semantics', () => {
    const dataset = parse70(indi70(['1 BIRT', '2 ADDR x', '3 _PRIV', '2 ADDR y', '3 _PRIV N', '2 ADDR z', '3 _PRIV Y']));
    const rec = dataset.records[0] as { events?: Array<{ detail?: { address?: { private?: boolean } } }> };
    void rec;
    expect(err70(indi70(['1 BIRT', '2 ADDR x', '3 _PRIV X']))).toBe('enum.invalid-value');
  });

  test('YN flags accept Y and N', () => {
    expect(err70(indi70(['1 FAMC @F1@', '2 _PRIMARY X', '0 @F1@ FAM']))).toBe('enum.invalid-value');
  });
});

describe('event details', () => {
  test('FAM HUSB/WIFE partner ages', () => {
    const dataset = parse70(
      [...H70, '0 @I1@ INDI', '1 NAME A /B/', '0 @I2@ INDI', '1 NAME C /D/', '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 MARR', '2 HUSB', '3 AGE 30y', '2 WIFE', '3 AGE 28y', '0 TRLR'].join('\n'),
    );
    const fam = dataset.records[2] as {
      events?: Array<{
        detail?: {
          husband?: { age: { payload: { years: number } } };
          wife?: { age: { payload: { years: number } } };
        };
      }>;
    };
    expect(fam.events?.[0]?.detail?.husband?.age?.payload).toEqual({ years: 30 });
    expect(fam.events?.[0]?.detail?.wife?.age?.payload).toEqual({ years: 28 });
  });

  test('FAM MARR HUSB without AGE fails', () => {
    expect(
      err70([...H70, '0 @I1@ INDI', '1 NAME A /B/', '0 @F1@ FAM', '1 HUSB @I1@', '1 MARR', '2 HUSB', '0 TRLR'].join('\n')),
    ).toBe('structure.missing-required');
  });

  test('FAM EVEN requires TYPE in 7.0; 5.5.1 defaults to empty', () => {
    expect(err70([...H70, '0 @F1@ FAM', '1 EVEN', '0 TRLR'].join('\n'))).toBe('structure.missing-required');
    const dataset = parse551([...H551, '0 @F1@ FAM', '1 EVEN a party', ...SUBM, '0 TRLR'].join('\n'));
    const fam = dataset.records[0] as { events?: Array<{ payload: string; type: string }> };
    expect(fam.events?.[0]).toMatchObject({ payload: 'a party', type: '' });
  });

  test('7.0 event detail contacts, SDATE, ASSO and UID', () => {
    const dataset = parse70(
      indi70([
        '0 @I2@ INDI', '1 NAME X',
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
      events?: Array<{ detail?: {
        phone?: string[]; email?: string[]; fax?: string[]; www?: string[];
        sortDate?: { value?: unknown }; associations?: unknown[]; uniqueIds?: string[];
        additionalPlaces?: unknown[]; godparents?: string[]; witnesses?: string[];
        agency?: string; religiousAffiliation?: string; cause?: string;
      } }>;
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

  test('INDI FAMC is only allowed under ADOP, BIRT and CHR', () => {
    expect(err70(indi70(['1 DEAT', '2 FAMC @F1@', '0 @F1@ FAM']))).toBe('structure.unknown-tag');
    expect(err70(indi70(['1 BIRT', '2 FAMC @F1@', '3 BOGUS x', '0 @F1@ FAM']))).toBe('structure.unknown-tag');
  });

  test('ADOP FAMC with ADOP detail', () => {
    const dataset = parse70(indi70(['1 ADOP', '2 FAMC @F1@', '3 ADOP BOTH', '4 PHRASE both parents', '0 @F1@ FAM']));
    const rec = dataset.records[0] as { events?: Array<{ adoptionFamily?: { family: string; adoption?: { payload: string; phrase?: string } } }> };
    expect(rec.events?.[0]?.adoptionFamily).toEqual({ family: '@F1@', adoption: { payload: 'BOTH', phrase: 'both parents' } });
  });

  test('NCHI rejects substructures; NMR requires digits', () => {
    expect(err70(indi70(['1 NCHI 3', '2 BOGUS x']))).toBe('structure.unknown-tag');
    expect(err70(indi70(['1 NMR three']))).toBe('structure.unexpected-payload');
  });

  test('IDNO and FACT attributes require TYPE', () => {
    expect(err70(indi70(['1 IDNO 123']))).toBe('structure.missing-required');
    expect(err70(indi70(['1 FACT tall']))).toBe('structure.missing-required');
  });

  test('individual ordinances keep FAMC only under SLGC', () => {
    const dataset = parse70(indi70(['1 SLGC', '2 FAMC @F1@', '2 STAT COMPLETED', '3 DATE 1 JAN 2000', '2 TEMP SLAKE', '2 PLAC Salt Lake', '0 @F1@ FAM']));
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
    expect(err70(indi70(['1 BAPL', '2 FAMC @F1@']))).toBe('structure.unknown-tag');
  });

  test('5.5.1 ordinance status table and errors', () => {
    const dataset = parse551(
      indi551(['1 BAPL', '2 STAT PRE-1970', '3 DATE 1 JAN 2000']),
    );
    const rec = dataset.records[0] as { ordinances?: Array<{ detail?: { status?: { payload: string; date: { value: unknown } } } }> };
    expect(rec.ordinances?.[0]?.detail?.status?.payload).toBe('PRE_1970');
    expect(err551(indi551(['1 BAPL', '2 STAT NOPE', '3 DATE 1 JAN 2000']))).toBe('enum.invalid-value');
    expect(err551(indi551(['1 BAPL', '2 STAT COMPLETED', '3 DATE 1 JAN 2000', '3 BOGUS x']))).toBe('structure.unknown-tag');
    expect(err551(indi551(['1 BAPL', '2 STAT COMPLETED']))).toBe('structure.missing-required');
    expect(err70(indi70(['1 BAPL', '2 STAT COMPLETED']))).toBe('structure.missing-required');
  });

  test('SLGS spouse sealing', () => {
    const dataset = parse70(
      [...H70, '0 @F1@ FAM', '1 SLGS', '2 DATE 1 JAN 2000', '2 TEMP SLAKE', '2 PLAC Salt Lake', '2 STAT COMPLETED', '3 DATE 1 JAN 2000', '2 NOTE n', '2 SOUR @S2@', '0 @S2@ SOUR', '1 TITL S', '0 TRLR'].join('\n'),
    );
    const fam = dataset.records[0] as { spouseSealings?: Array<{ tag: string; detail?: { date?: unknown; temple?: string; place?: { payload: string[] }; status?: { payload: string }; notes?: unknown[]; citations?: unknown[] } }> };
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
        '0 @I1@ INDI', '1 NAME A /B/',
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
      nonEvents?: Array<{ payload: string }>; associations?: unknown[];
      creationDate?: unknown; identifiers?: Array<{ tag: string }>;
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
        '0 @I1@ INDI', '1 NAME A /B/',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    const fam = dataset.records[0] as {
      attributes?: Array<{ tag: string; payload: number }>;
      marriageStatus?: string; sameSexUnion?: boolean;
      nonEvents?: Array<{ payload: string }>;
      events?: Array<{ tag: string; type?: string; detail?: { date?: unknown } }>;
      associations?: unknown[]; automatedRecordId?: string;
    };
    expect(fam.attributes?.[0]).toMatchObject({ tag: 'NCHI', payload: 0 });
    expect(fam.marriageStatus).toBe('married');
    expect(fam.sameSexUnion).toBe(true);
    expect(fam.nonEvents).toEqual([{ tag: 'NO', payload: 'MARR' }, { tag: 'NO', payload: 'MARR' }]);
    expect(fam.events?.[0]).toMatchObject({ tag: 'EVEN', type: 'Cohabitation' });
    expect(fam.events?.[1]).toMatchObject({ tag: 'MARR', type: 'Common law marriage' });
    expect(fam.events?.[2]).toMatchObject({ tag: 'EVEN', type: 'Marriage bond' });
    expect(fam.events?.[3]).toMatchObject({ tag: 'EVEN', type: 'Separated' });
    expect(fam.associations).toHaveLength(1);
    expect(fam.automatedRecordId).toBe('9');
  });

  test('vendor FAM negatives validate their payloads', () => {
    expect(err551([...H551, '0 @F1@ FAM', '1 _MARR Y', ...SUBM, '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
    expect(err551([...H551, '0 @F1@ FAM', '1 _NMR N', ...SUBM, '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
    expect(err551([...H551, '0 @F1@ FAM', '1 _MARR N', '2 BOGUS x', ...SUBM, '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
    expect(err551([...H551, '0 @F1@ FAM', '1 _TYPE other', ...SUBM, '0 TRLR'].join('\n'))).toBe('enum.invalid-value');
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
      updatedAt?: string; url?: string; marks?: string[];
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
    expect(rec.nonEvents).toEqual([{ tag: 'NO', payload: 'DEAT' }, { tag: 'NO', payload: 'MARR' }]);
    // _DCAUSE merged into the death event that _NLIV did not create.
    const death = rec.events?.find((event) => event.tag === 'DEAT');
    expect(death?.detail?.cause).toBe('old age');
  });

  test('7.0 INDI ordinances and identifiers', () => {
    const dataset = parse70(
      indi70(['1 BAPL', '2 DATE 1 JAN 2000', '1 CONL', '1 ENDL', '1 INIL', '1 CREA', '2 DATE 5 JAN 2001', '1 UID u', '1 _UID u2', '1 EXID https://x.example/i1']),
    );
    const rec = dataset.records[0] as { ordinances?: Array<{ tag: string }>; creationDate?: unknown; identifiers?: Array<{ tag: string }> };
    expect(rec.ordinances?.map((o) => o.tag)).toEqual(['BAPL', 'CONL', 'ENDL', 'INIL']);
    expect(rec.creationDate).toBeDefined();
    expect(rec.identifiers?.map((id) => id.tag)).toEqual(['UID', 'UID', 'EXID']);
  });

  test('5.5.1 INDI parses RIN, RFN and AFN', () => {
    const dataset = parse551(indi551(['1 RIN 42', '1 RFN 99', '1 AFN 1234']));
    const rec = dataset.records[0] as { automatedRecordId?: string; recordFileNumber?: string; ancestralFileNumber?: string };
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
  test('reqText rejects pointer values', () => {
    expect(err70(indi70(['0 @I2@ INDI', '1 NAME X', '1 NAME @I2@']))).toBe('structure.missing-payload');
  });

  test('reqPtr rejects text values', () => {
    expect(err70([...H70, '0 @F1@ FAM', '1 HUSB John', '0 TRLR'].join('\n'))).toBe('structure.missing-payload');
  });

  test('optPtr rejects text payloads on REPO citations', () => {
    expect(err70([...H70, '0 @S1@ SOUR', '1 REPO Text', '0 TRLR'].join('\n'))).toBe('structure.unexpected-payload');
  });

  test('the Y assertion rejects other values', () => {
    expect(err70(indi70(['1 BIRT N']))).toBe('structure.unexpected-payload');
  });

  test('duplicate singles are cardinality errors', () => {
    expect(err70(indi70(['1 SEX M', '1 SEX F']))).toBe('structure.cardinality');
    expect(err551(indi551(['1 EVEN', '2 TYPE a', '2 TYPE b']))).toBe('structure.cardinality');
    expect(err70(indi70(['1 EVEN', '2 TYPE a', '2 TYPE b']))).toBe('structure.cardinality');
  });

  test('document level errors', () => {
    expect(err70('0 TRLR\n')).toBe('document.missing-header');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @X@ TRLR\n')).toBe('line.xref-on-substructure');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n0 @I1@ INDI\n')).toBe('document.trailer-not-last');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @N1@ NOTE text\n0 TRLR\n')).toBe('structure.unknown-tag');
    expect(err551([...H551, '0 @N1@ SNOTE text', ...SUBM, '0 TRLR'].join('\n'))).toBe('structure.unknown-tag');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 BOGUS\n0 TRLR\n')).toBe('structure.unknown-tag');
  });

  test('duplicate cross-reference identifiers are rejected anywhere, not just adjacent', () => {
    expect(
      err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME A /B/\n0 @I2@ INDI\n1 NAME C /D/\n0 @I1@ INDI\n1 NAME E /F/\n0 TRLR\n'),
    ).toBe('document.duplicate-xref');
    expect(
      err551('0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME A /B/\n0 @I2@ INDI\n1 NAME C /D/\n0 @I1@ INDI\n1 NAME E /F/\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n'),
    ).toBe('document.duplicate-xref');
  });

  test('extension records keep pointer payloads', () => {
    const dataset = parse70([...H70, '0 @X1@ _CUSTOM @I1@', '1 _CHILD value', '0 @I1@ INDI', '1 NAME A /B/', '0 TRLR'].join('\n'));
    const ext = dataset.records[0] as { tag: string; xref?: string; payload: string; children: Array<{ tag: string; payload: string }> };
    expect(ext.tag).toBe('_CUSTOM');
    expect(ext.xref).toBe('@X1@');
    expect(ext.payload).toBe('@I1@');
    expect(ext.children?.[0]).toEqual({ tag: '_CHILD', payload: 'value', children: [] });
  });

  test('header edge cases', () => {
    expect(err70('0 @H@ HEAD\n1 GEDC\n2 VERS 7.0\n0 TRLR\n')).toBe('line.xref-on-substructure');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 GEDC\n2 VERS 7.0\n0 TRLR\n')).toBe('structure.cardinality');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n2 FORM LINEAGE-LINKED\n0 TRLR\n')).toBe('structure.unknown-tag');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n1 SCHMA\n2 TAG _X x\n3 BOGUS y\n0 TRLR\n')).toBe('structure.unexpected-payload');
    expect(err551('0 HEAD\n1 SOUR My App\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n')).toBe('enum.invalid-value');
    expect(err551('0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR KOI8\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n')).toBe('decoding.unknown-charset');
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
      source?: { payload: string; version?: string; name?: string; corporation?: { payload: string; address?: unknown; phone?: string[]; email?: string[]; fax?: string[]; www?: string[] }; data?: { payload: string; date?: { value: unknown }; copyright?: string } };
    };
    expect(header.source?.version).toBe('1.0');
    expect(header.source?.name).toBe('My Application');
    expect(header.source?.corporation?.payload).toBe('The Corp');
    expect(header.source?.corporation?.address).toBeDefined();
    expect(header.source?.corporation?.phone).toEqual(['+49 1']);
    expect(header.source?.corporation?.email).toEqual(['a@example.com']);
    expect(header.source?.corporation?.fax).toEqual(['+49 2']);
    expect(header.source?.corporation?.www).toEqual(['https://example.com']);
    expect(header.source?.data?.payload).toBe('the data');
    expect(header.source?.data?.date?.value).toEqual({ day: 1, month: 'JAN', year: 2000 });
    expect(header.source?.data?.copyright).toBe('(c) 2000');
  });
});
