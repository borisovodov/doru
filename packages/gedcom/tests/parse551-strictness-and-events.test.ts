import { describe, expect, test } from 'vitest';
import { parseGedcom551 } from '../src/parsing/assemble';
import type { GedcomDataset } from '../src/structures';
import { isIndividualRecord } from '../src/structures';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function parse551(text: string): GedcomDataset {
  const result = parseGedcom551(enc(text));
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.value;
}

const HEADER = [
  '0 HEAD',
  '1 SOUR PAF',
  '1 SUBM @S1@',
  '1 GEDC',
  '2 VERS 5.5.1',
  '2 FORM LINEAGE-LINKED',
  '1 CHAR UTF-8',
];
const SUBM = ['0 @S1@ SUBM', '1 NAME Tester'];

describe('parseGedcom551 — strictness', () => {
  test('accepts 7.0-only constructs', () => {
    for (const lines of [
      [...HEADER, ...SUBM, '0 @N1@ SNOTE text', '0 TRLR'],
      [...HEADER, '0 @I1@ INDI', '1 NO MARR', ...SUBM, '0 TRLR'],
      [...HEADER, '0 @I1@ INDI', '1 UID abc', ...SUBM, '0 TRLR'],
      [...HEADER, '0 @I1@ INDI', '1 INIL', ...SUBM, '0 TRLR'],
      [...HEADER, '0 @I1@ INDI', '1 EXID abc', ...SUBM, '0 TRLR'],
    ]) {
      expect(parseGedcom551(enc(lines.join('\n'))).ok).toBe(true);
    }
  });

  test('the MFT7 non-underscore CREA types into the creation date', () => {
    const result = parseGedcom551(
      enc([...HEADER, '0 @I1@ INDI', '1 CREA', '2 DATE 1 JAN 2000', ...SUBM, '0 TRLR'].join('\n')),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const indi = result.value.records.find((record) => record.tag === 'INDI');
      expect((indi as unknown as { creationDate?: unknown }).creationDate).toBeDefined();
    }
  });

  test('accepts a Y payload on every 5.5.1 family event', () => {
    const result = parseGedcom551(enc([...HEADER, '0 @F1@ FAM', '1 ANUL Y', ...SUBM, '0 TRLR'].join('\n')));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const fam = result.value.records.find((record) => record.tag === 'FAM');
      expect((fam as unknown as { events?: Array<{ payload?: unknown }> }).events?.[0]?.payload).toBe(true);
    }
  });

  test('accepts the Y payload on the 5.5.1 individual events ADOP, BIRT, CHR and DEAT', () => {
    for (const tag of ['ADOP', 'BIRT', 'CHR', 'DEAT']) {
      const result = parseGedcom551(enc([...HEADER, '0 @I1@ INDI', `1 ${tag} Y`, ...SUBM, '0 TRLR'].join('\n')));
      expect(result.ok).toBe(true);
      if (result.ok) {
        const indi = result.value.records.find((record) => record.tag === 'INDI');
        const event = indi?.tag === 'INDI' ? indi.events?.find((entry) => entry.tag === tag) : undefined;
        expect(event?.payload).toBe(true);
      }
    }
    // The Y assertion is also accepted on the remaining
    // individual events (the 7.0 rule).
    const bapm = parseGedcom551(enc([...HEADER, '0 @I1@ INDI', '1 BAPM Y', ...SUBM, '0 TRLR'].join('\n')));
    expect(bapm.ok).toBe(true);
  });

  test('accepts a 7.0 enumset status on any ordinance', () => {
    const result = parseGedcom551(
      enc([...HEADER, '0 @I1@ INDI', '1 BAPL', '2 STAT BIC', '3 DATE 1 JAN 2000', ...SUBM, '0 TRLR'].join('\n')),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const indi = result.value.records.find((record) => record.tag === 'INDI');
      expect(
        (indi as unknown as { ordinances?: Array<{ detail?: { status?: { payload?: string } } }> }).ordinances?.[0]
          ?.detail?.status?.payload,
      ).toBe('BIC');
    }
  });

  test('accepts any FORM text and any LANG text', () => {
    const media = parseGedcom551(
      enc([...HEADER, '0 @O1@ OBJE', '1 FILE x.exe', '2 FORM exe', ...SUBM, '0 TRLR'].join('\n')),
    );
    expect(media.ok).toBe(true);
    // The language is free text (the 5.5.1 LANGUAGE_ID table is no
    // longer validated on import; the serializer maps onto it).
    const lang = parseGedcom551(enc([...HEADER, '1 LANG Klingon', ...SUBM, '0 TRLR'].join('\n')));
    expect(lang.ok).toBe(true);
    if (lang.ok) {
      expect(lang.value.header.language).toBe('Klingon');
    }
  });

  test('accepts commas in names', () => {
    const result = parseGedcom551(enc([...HEADER, '0 @I1@ INDI', '1 NAME John, /Doe/', ...SUBM, '0 TRLR'].join('\n')));
    expect(result.ok).toBe(true);
  });

  test('keeps reserved calendar escapes as the date phrase', () => {
    const result = parseGedcom551(
      enc([...HEADER, '0 @I1@ INDI', '1 BIRT', '2 DATE @#DROMAN@ 1 JAN 1900', ...SUBM, '0 TRLR'].join('\n')),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const record = result.value.records.find((entry) => entry.tag === 'INDI');
      expect((record as { events?: Array<{ detail?: { date?: unknown } }> }).events?.[0]?.detail?.date).toEqual({
        value: { kind: 'unknown' },
        phrase: '@#DROMAN@ 1 JAN 1900',
      });
    }
  });

  test('accepts the void pointer in pointers', () => {
    const result = parseGedcom551(enc([...HEADER, '0 @I1@ INDI', '1 FAMS @VOID@', ...SUBM, '0 TRLR'].join('\n')));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const indi = result.value.records.find((record) => record.tag === 'INDI');
      expect((indi as unknown as { spouseFamilies?: Array<{ family?: string }> }).spouseFamilies?.[0]?.family).toBe(
        '@VOID@',
      );
    }
  });

  test('parses an empty REPO as the void pointer', () => {
    const dataset = parse551(
      [...HEADER, '0 @S2@ SOUR', '1 REPO', '2 NOTE Where it is stored', ...SUBM, '0 TRLR'].join('\n'),
    );
    const sour = dataset.records[0];
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.repositoryCitations?.[0]?.repository).toBe('@VOID@');
    expect(sour.repositoryCitations?.[0]?.notes?.[0]?.tag).toBe('NOTE');
  });

  test('parses an extension record and extension substructures', () => {
    const dataset = parse551(
      [...HEADER, '0 @L1@ _SOMEREC', '1 NAME Byzantion', '2 _POP 15149358', ...SUBM, '0 TRLR'].join('\n'),
    );
    const ext = dataset.records[0];
    expect(ext?.tag).toBe('_SOMEREC');
    if (ext?.tag === '_SOMEREC') {
      expect(ext.children[0]?.tag).toBe('NAME');
      expect(ext.children[0]?.children[0]?.tag).toBe('_POP');
    }
  });
});

describe('parseGedcom551 — spec coverage', () => {
  test('parses the @#DFRENCH R@ calendar escape', () => {
    const dataset = parse551(
      [...HEADER, '0 @I1@ INDI', '1 BIRT', '2 DATE @#DFRENCH R@ 8 VEND 8', ...SUBM, '0 TRLR'].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'BIRT') {
      throw new Error('expected BIRT');
    }
    expect(indi.events[0].detail?.date?.value).toEqual({
      kind: 'date',
      calendar: 'FRENCH_R',
      day: 8,
      month: 'VEND',
      year: 8,
    });
  });

  test('parses an INDI.RESI without a payload (5.5.1 grammar has none)', () => {
    const dataset = parse551(
      [...HEADER, '0 @I1@ INDI', '1 NAME Jane /Doe/', '1 RESI', '2 PLAC Paris, France', ...SUBM, '0 TRLR'].join('\n'),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const resi = indi.attributes?.[0];
    expect(resi?.tag).toBe('RESI');
    expect(resi).not.toHaveProperty('payload');
    expect(resi?.detail?.place?.payload).toEqual(['Paris', 'France']);
  });

  test('parses HEAD.DATE with a TIME substructure (5.5.1 p.23)', () => {
    const dataset = parse551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 DATE 12 FEB 2020',
        '2 TIME 10:00:00',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        ...SUBM,
        '0 TRLR',
      ].join('\n'),
    );
    expect(dataset.header.date?.value).toEqual({ day: 12, month: 'FEB', year: 2020 });
    expect(dataset.header.date?.time).toEqual({ hour: 10, minute: 0, second: 0 });
  });

  test('parses an inline OBJE whose FILE.FORM spells the medium MEDI (5.5.1 p.37)', () => {
    const dataset = parse551(
      [...HEADER, '0 @I1@ INDI', '1 OBJE', '2 FILE photo.jpg', '3 FORM jpg', '4 MEDI photo', ...SUBM, '0 TRLR'].join(
        '\n',
      ),
    );
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.media?.[0]?.tag).toBe('OBJE');
    const media = dataset.records.find((record) => record.tag === 'OBJE');
    if (media?.tag !== 'OBJE') {
      throw new Error('expected a synthesized OBJE record');
    }
    expect(media.files[0]?.form?.medium?.payload).toBe('PHOTO');
  });

  test('parses an AGE without a payload', () => {
    const dataset = parse551([...HEADER, '0 @I1@ INDI', '1 DEAT Y', '2 AGE', ...SUBM, '0 TRLR'].join('\n'));
    const indi = dataset.records[0];
    if (indi?.tag !== 'INDI' || indi.events?.[0]?.tag !== 'DEAT') {
      throw new Error('expected DEAT');
    }
    expect(indi.events[0].detail?.age).toEqual({});
  });

  test('accepts a tab in user text (5.5.5 "Tab is Legal")', () => {
    const dataset = parse551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.5',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @I1@ INDI',
        '1 NAME Jane /Doe/',
        '1 NOTE first\tsecond',
        '0 TRLR',
      ].join('\n'),
    );
    const indi = dataset.records.find(isIndividualRecord);
    if (indi === undefined) {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note !== undefined && 'payload' in note ? note.payload : undefined).toBe('first\tsecond');
  });
});

describe('parseGedcom551 — user-defined EVENT values', () => {
  test('splits 5.5.1 DATA.EVEN and SOUR.EVEN into enums and user values', () => {
    const dataset = parse551(
      [
        '0 HEAD',
        '1 SOUR PAF',
        '1 SUBM @S1@',
        '1 GEDC',
        '2 VERS 5.5.1',
        '2 FORM LINEAGE-LINKED',
        '1 CHAR UTF-8',
        '0 @S1@ SUBM',
        '1 NAME T',
        '0 @S2@ SOUR',
        '1 DATA',
        "2 EVEN BIRT, Ships' manifests",
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S2@',
        "3 EVEN Ships' manifests",
        '0 TRLR',
      ].join('\n'),
    );
    const sour = dataset.records.find((record) => record.tag === 'SOUR');
    if (sour?.tag !== 'SOUR') {
      throw new Error('expected SOUR');
    }
    expect(sour.data?.events?.[0]?.payload).toEqual(['BIRT']);
    expect(sour.data?.events?.[0]?.userDefined).toEqual(["Ships' manifests"]);
    const indi = dataset.records.find((record) => record.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const citation = indi.events?.[0]?.detail?.citations?.[0];
    expect(citation?.event?.payload).toBeUndefined();
    expect(citation?.event?.userDefined).toBe("Ships' manifests");
  });
});
