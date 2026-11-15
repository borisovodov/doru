import { describe, expect, test } from 'vitest';
import { parseTolerant } from '../src/detect';
import { serializeGedcom551 } from '../src/serialize/serialize';

// The tolerant parse (parseTolerant): every problem is recorded and
// skipped instead of aborting — the result carries the best-effort
// dataset plus the full error list.

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('the European date spellings', () => {
  test('the dotted, dashed and month-named European dates parse', () => {
    const text = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 DATE 23.8.2024', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.date?.value).toEqual({ day: 23, month: 'AUG', year: 2024 });
  });

  test('the two-digit-year dash spelling maps to the 20th century', () => {
    const text = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 DATE 23-Apr-98', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.date?.value).toEqual({ day: 23, month: 'APR', year: 1998 });
  });

  test('the slashed numeric spellings parse (day-first and ISO)', () => {
    // The Ahnen2GED header date (`1 DATE 04/12/2023`) and the ISO
    // shape with slashes.
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 DATE 04/12/2023',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 BIRT',
      '2 DATE 2023/12/04',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.date?.value).toEqual({ day: 4, month: 'DEC', year: 2023 });
    const indi = dataset?.records[0];
    const birth = indi?.tag === 'INDI' ? indi.events?.find((event) => event.tag === 'BIRT') : undefined;
    expect(birth?.detail?.date?.value).toMatchObject({ day: 4, month: 'DEC', year: 2023 });
  });
});

describe('the empty date parts', () => {
  test('a modifier with no date is kept whole as the phrase', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 DEAT',
      '2 DATE Aft',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const individual = dataset?.records[0]?.tag === 'INDI' ? dataset.records[0] : undefined;
    const death = individual?.events?.find((event) => event.tag === 'DEAT');
    expect(death?.detail?.date?.phrase).toBe('Aft');
  });

  test('a BET with an empty start and a FROM with an empty from parse as phrases', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 BIRT',
      '2 DATE BET  AND 1907',
      '1 DEAT',
      '2 DATE From  to 1947',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const individual = dataset?.records[0]?.tag === 'INDI' ? dataset.records[0] : undefined;
    const birth = individual?.events?.find((event) => event.tag === 'BIRT');
    const death = individual?.events?.find((event) => event.tag === 'DEAT');
    expect(birth?.detail?.date?.phrase).toBe('BET  AND 1907');
    expect(death?.detail?.date?.phrase).toBe('From  to 1947');
  });
});

describe('the deep nesting', () => {
  test('a 9000-level extension chain parses and serializes without a stack overflow', () => {
    // The vscode-gedcom "numbered list" fixture shape: one unknown tag
    // nested 9000 levels deep. The iterative walks (collectXrefs,
    // parseExtension, the serialize-side clone/collect walks) must
    // survive it.
    const lines = ['0 HEAD', '1 GEDC', '2 VERS 5.5.1'];
    for (let level = 3; level <= 9000; level += 1) {
      lines.push(`${level} Step ${level - 2} of the recipe`);
    }
    lines.push('0 TRLR', '');
    const { value, errors } = parseTolerant(enc(lines.join('\n')));
    expect(errors).toEqual([]);
    expect(value?.kind).toBe('dataset');
    if (value?.kind === 'dataset') {
      const out = serializeGedcom551(value.dataset);
      expect(out.ok).toBe(true);
    }
  });
});

describe('the American month-first date spelling', () => {
  test('FEB 13 2026 swaps to the day-first order', () => {
    const text = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 DATE FEB 13 2026', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.date?.value).toEqual({ day: 13, month: 'FEB', year: 2026 });
  });
});

describe('the calendar escape leniencies', () => {
  test('the D-less Julian escape resolves to the Julian calendar', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 BIRT',
      '2 DATE @#JULIAN@ 28 JUN 1491',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const individual = dataset?.records[0]?.tag === 'INDI' ? dataset.records[0] : undefined;
    const birth = individual?.events?.find((event) => event.tag === 'BIRT');
    expect(birth?.detail?.date?.value).toEqual({ kind: 'date', calendar: 'JULIAN', year: 1491, day: 28, month: 'JUN' });
  });

  test('a lone @# in free text stays literal', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 NOTE This note includes special characters: @#$%&*',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const individual = dataset?.records[0]?.tag === 'INDI' ? dataset.records[0] : undefined;
    const note = individual?.notes?.[0];
    expect(note !== undefined && 'payload' in note ? note.payload : undefined).toBe(
      'This note includes special characters: @#$%&*',
    );
  });
});

describe('the pointer-slot continuations', () => {
  test('a continuation under a pointer slot stays as its extension', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @F1@ FAM',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 FAMC @F1@',
      '2 CONC note text about the family',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const individual = dataset?.records.find((record) => record.tag === 'INDI');
    const famc = individual?.tag === 'INDI' ? individual.childFamilies?.[0] : undefined;
    expect(famc?.extensions?.[0]).toMatchObject({ tag: 'CONC', payload: 'note text about the family' });
  });

  test('a pointer-valued continuation keeps the pointer string as the text', () => {
    const text = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '0 @N1@ NOTE', '1 CONC @NI124@', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const note = dataset?.records.find((record) => record.tag === 'NOTE');
    expect(note !== undefined && 'payload' in note ? note.payload : undefined).toBe('@NI124@');
  });
});

describe('the numeric and dotted month spellings', () => {
  test('an all-numeric European date maps to the day-first order', () => {
    const text = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 DATE 20 10 1996', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.date?.value).toEqual({ day: 20, month: 'OCT', year: 1996 });
  });

  test('a dotted month abbreviation strips the dot', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 BIRT',
      '2 DATE Jan. 2015',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const individual = dataset?.records[0]?.tag === 'INDI' ? dataset.records[0] : undefined;
    const birth = individual?.events?.find((event) => event.tag === 'BIRT');
    expect(birth?.detail?.date?.value).toMatchObject({ month: 'JAN', year: 2015 });
  });
});

describe('the GEDCOM 5.5.5 draft spellings', () => {
  test('the full-word record and structure tags parse as the standard tags', () => {
    const text = [
      '0 HEADER',
      '1 SOURCE FTW',
      '1 DESTINATION FTW',
      '1 GEDCOM',
      '2 VERSION 5.5.5',
      '2 FORM LINEAGE-LINKED',
      '0 @I1@ INDIVIDUAL',
      '1 NAME Robert /Williams/',
      '2 GIVEN_NAME Robert',
      '2 SURNAME Williams',
      '1 BIRTH',
      '2 DATE 2 APR 1937',
      '2 PLACE Springfield',
      '1 OCCUPATION Engineer',
      '0 @F1@ FAMILY',
      '1 MARRIAGE',
      '2 DATE 1960',
      '1 HUSBAND @I1@',
      '1 WIFE @I2@',
      '0 TRAILER',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.source?.payload).toBe('FTW');
    expect(dataset?.header.destination).toBe('FTW');
    expect(dataset?.header.gedcom.version).toBe('5.5.5');
    const individual = dataset?.records.find((record) => record.tag === 'INDI');
    expect(individual?.tag === 'INDI' ? individual.names?.[0]?.pieces : undefined).toMatchObject({
      givenNames: ['Robert'],
      surnames: ['Williams'],
    });
    expect(individual?.tag === 'INDI' ? individual.events?.[0]?.tag : undefined).toBe('BIRT');
    const occupation = individual?.tag === 'INDI' ? individual.attributes?.[0] : undefined;
    expect(occupation?.tag === 'OCCU' ? occupation.payload : undefined).toBe('Engineer');
    const family = dataset?.records.find((record) => record.tag === 'FAM');
    expect(family?.tag === 'FAM' ? family.events?.[0]?.tag : undefined).toBe('MARR');
    expect(family?.tag === 'FAM' ? family.husband?.partner : undefined).toBe('@I1@');
  });

  test("the GenoPro INDIVIDUAL/FAMILY children keep their dialect's meaning", () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @G1@ GENOMAP',
      '1 PEDIGREELINK',
      '2 INDIVIDUAL @ind00001@',
      '2 FAMILY @fam00001@',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const genomap = dataset?.records.find((record) => record.xref === '@G1@');
    expect(genomap).toBeDefined();
    // The GenoPro PEDIGREELINK children keep their own INDIVIDUAL/FAMILY
    // tags — the 5.5.5 alias must not rename them (see gedcom-555.ts).
    const link =
      genomap !== undefined && 'children' in genomap && genomap.tag !== 'FAM' ? genomap.children[0] : undefined;
    const children = link?.children;
    expect(children?.map((child) => child.tag)).toEqual(['INDIVIDUAL', 'FAMILY']);
  });

  test('the full-word LABEL leaf of the FTM schema block parses as LABL', () => {
    // The official FTM 5.5.5 sample (555SAMPLE-FTM.GED) writes
    // `4 LABEL Fact 1` under its `_SCHEMA` context tags.
    const text = [
      '0 HEADER',
      '1 SOURCE FTW',
      '1 GEDCOM',
      '2 VERSION 5.5',
      '2 FORM LINEAGE-LINKED',
      '1 CHARACTER IBMPC',
      '1 SUBMITTER Unknown',
      '1 _SCHEMA',
      '2 INDIVIDUAL',
      '3 _FACT1',
      '4 LABEL Fact 1',
      '3 _FACT2',
      '4 LABEL Fact 2',
      '0 @I1@ INDIVIDUAL',
      '1 NAME Robert /Williams/',
      '0 TRAILER',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.schema53?.entries[0]).toEqual({
      context: ['INDIVIDUAL', '_FACT1'],
      label: 'Fact 1',
    });
    expect(dataset?.header.schema53?.entries[1]?.label).toBe('Fact 2');
  });
});

describe('the OFB-Werkstatt tags', () => {
  test('the church-book wording tags type into the dedicated slots', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Rosina Margaretha /Frey/',
      '2 GIVN Rosina Margaretha',
      '2 SURN Frey',
      '2 _KB_NAME Rosina Margaretha /Frey/',
      '1 OCCU',
      '2 _BERUF_KB Weingärtner',
      '1 _TODURSACHE Hitziges Fieber',
      '1 _ALTER_KB 60 Jahre, 3 Monate',
      '0 @I2@ INDI',
      '1 NAME X /Y/',
      '1 _BERUF_KB Tagelöhner',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const first = dataset?.records[0];
    expect(first?.tag === 'INDI' ? first.names?.[0]?.nameAsRecorded : undefined).toBe('Rosina Margaretha /Frey/');
    expect(first?.tag === 'INDI' ? first.deathCauseAsRecorded : undefined).toBe('Hitziges Fieber');
    expect(first?.tag === 'INDI' ? first.ageAsRecorded : undefined).toBe('60 Jahre, 3 Monate');
    const occupation = first?.tag === 'INDI' ? first.attributes?.[0] : undefined;
    expect(occupation?.tag === 'OCCU' ? occupation.asRecorded : undefined).toBe('Weingärtner');
    // The bare INDI-level spelling becomes the OCCU + _BERUF_KB pair.
    const second = dataset?.records[1];
    const bare = second?.tag === 'INDI' ? second.attributes?.[0] : undefined;
    expect(bare?.tag === 'OCCU' ? bare.payload : undefined).toBe('');
    expect(bare?.tag === 'OCCU' ? bare.asRecorded : undefined).toBe('Tagelöhner');
  });
});

describe('the short name and the Familio place id', () => {
  test('_SHON under NAME types as the short name', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Alexander Jonas /Eriksen/',
      '2 GIVN Alexander Jonas',
      '2 SURN Eriksen',
      '2 _SHON Alex',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const individual = dataset?.records[0];
    expect(individual?.tag === 'INDI' ? individual.names?.[0]?.shortName : undefined).toBe('Alex');
  });

  test('_FAMILIO_GUID under PLAC types as the familio.org place id', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME X /Y/',
      '1 BIRT',
      '2 PLAC Somewhere',
      '3 _FAMILIO_GUID b18382fe-f188-45a4-96cf-65274665e66b',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const individual = dataset?.records[0];
    const birth = individual?.tag === 'INDI' ? individual.events?.find((event) => event.tag === 'BIRT') : undefined;
    expect(birth?.detail?.place?.familioId).toBe('b18382fe-f188-45a4-96cf-65274665e66b');
    if (value?.kind === 'dataset') {
      const out = serializeGedcom551(value.dataset);
      expect(out.ok && out.value.includes('_FAMILIO_GUID b18382fe-f188-45a4-96cf-65274665e66b')).toBe(true);
    }
  });
});

describe('the glued and wrapped line leniencies', () => {
  const HEAD = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '1 CHAR UTF-8', '1 SUBM @S1@', '0 @S1@ SUBM', '1 NAME T'];

  test('a CHAN line glued to its DATE resplits (the Geni exports)', () => {
    // The Geni.com export loses the line break between CHAN and its
    // DATE (`1 CHAN 2 DATE 28 DEC 2019`, the CompareGedcomsForDates
    // BloodTree1 sample — 433 times in one file).
    const text = [
      ...HEAD,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 CHAN 2 DATE 28 DEC 2019',
      '3 TIME 21:14:21',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.changeDate?.date.value).toEqual({ day: 28, month: 'DEC', year: 2019 });
    expect(indi.changeDate?.date.time).toEqual({ hour: 21, minute: 14, second: 21 });
  });

  test('a continuation-wrapped line unwraps (the FTM Mac exports)', () => {
    // Family Tree Maker for Mac OS X wraps whole lines into
    // continuations (`2 CONT 2 SOUR @S453@` under `1 SEX M`, the
    // gedcom4j willis samples): the SEX keeps its enum value and the
    // wrapped citation survives as the SEX line's extension.
    const text = [
      ...HEAD,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 SEX M',
      '2 CONT 2 SOUR @S2@',
      '1 BIRT',
      '2 SOUR @S2@',
      '3 PAGE Database online. Year: 1910; West ',
      '4 CONT 4 CONC Virginia; Roll: T624_1679.',
      '0 @S2@ SOUR',
      '1 TITL t',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    if (dataset === undefined) {
      throw new Error('expected a dataset');
    }
    const indi = dataset.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.sex).toBe('M');
    // The unwrapped citation under SEX types into the dedicated
    // sexCitations slot (the FTM Mac fact-citation shape); on export it
    // is projected onto the standard record-level INDI citation slot.
    expect(indi.sexCitations?.[0]?.source).toBe('@S2@');
    const unwrapped = serializeGedcom551(dataset);
    expect(unwrapped.ok && unwrapped.value.includes('1 SEX M\r\n1 SOUR @S2@')).toBe(true);
    const birth = indi.events?.find((e) => e.tag === 'BIRT');
    expect(birth?.detail?.citations?.[0]?.page?.payload).toBe(
      'Database online. Year: 1910; West Virginia; Roll: T624_1679.',
    );
  });

  test('a NOTE payload that quotes a GEDCOM line stays text', () => {
    // The prose-slot exception: a note documenting the format keeps
    // its text (the TGC551 torture notes shape).
    const text = [
      ...HEAD,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE Syntax help:',
      '2 CONT 2 SOUR @S2@ cites the source',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    const note = indi?.tag === 'INDI' ? indi.notes?.[0] : undefined;
    expect(note && 'payload' in note ? note.payload : undefined).toBe('Syntax help:\n2 SOUR @S2@ cites the source');
  });

  test('whitespace-only payloads parse as the bare tag', () => {
    const text = [
      ...HEAD,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 SEX ',
      '1 BIRT',
      '0 @F1@ FAM                                ',
      '1 HUSB @I1@',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records.find((r) => r.tag === 'INDI' && r.xref === '@I1@');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.sex).toBeUndefined();
    const fam = dataset?.records.find((r) => r.tag === 'FAM');
    expect(fam?.tag === 'FAM' ? fam.husband?.partner : undefined).toBe('@I1@');
  });

  test('pointer values tolerate leading blanks and non-Latin identifiers', () => {
    // The CS555 double-space exports (`1 WIFE  @I5@`, the PAF
    // genealogy_test sample) and the unicode_xref-nonlatin fixture.
    const text = [...HEAD, '0 @F1@ FAM', '1 WIFE  @人物1@', '0 @人物1@ INDI', '1 NAME A /B/', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const fam = dataset?.records.find((r) => r.tag === 'FAM');
    expect(fam?.tag === 'FAM' ? fam.wife?.partner : undefined).toBe('@人物1@');
  });

  test('extra spaces between the level and the xref parse', () => {
    // The PAF genealogy_test sample (`0              @1A@ INDI`).
    const text = [...HEAD, '0              @1A@ INDI', '1 NAME   Robert Eugene/Williams/', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.records.some((r) => r.xref === '@1A@')).toBe(true);
  });
});

describe('the number-sign comment lines', () => {
  test('full-line and trailing-pointer comments drop; note runs keep them', () => {
    // The hand-written glamberson extension examples: markdown-style
    // comment banners between the records, trailing comments after
    // pointer values and after no-payload tags.
    const text = [
      '#SSWFinalProject',
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '##############################################',
      '# A banner comment',
      '0 @O1@ _OCUR                                # GRAMPS Event object',
      '1 TYPE Census',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 _OCREF @O1@                              # Reference to shared census event',
      '2 ROLE Head',
      '1 NOTE # not a comment inside a note run',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const ocur = dataset?.records.find((r) => r.tag === '_OCUR');
    expect(ocur?.xref).toBe('@O1@');
    const indi = dataset?.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.occurrences?.[0]?.occurrence).toBe('@O1@');
    expect(indi.occurrences?.[0]?.role).toBe('Head');
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe('# not a comment inside a note run');
  });
});

describe('the digit-leading note-run merge', () => {
  test('prose lines that start with a number merge; real lines stay', () => {
    // The escyb3 our-family-tree transcripts: the note text carries
    // lines like `1 jaar en 3 mnd`, `26 jaar` and `28-05-1857` that
    // tokenize as fake GEDCOM lines.
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 5.5.1',
      '1 CHAR UTF-8',
      '1 SUBM @S1@',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE Leeftijd:',
      '1 jaar en 3 mnd',
      '2 CONC e Vries',
      '26 jaar',
      '28-05-1857',
      '1 DEAT Y',
      '2 DATE 4 JUN 1820',
      '0 @edu1@ Education',
      '1 INSTITUTION Smeltings',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records.find((r) => r.tag === 'INDI');
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe(
      'Leeftijd:\n1 jaar en 3 mnde Vries\n26 jaar\n28-05-1857',
    );
    // The real line after the run still parses as the death event …
    const death = indi.events?.find((e) => e.tag === 'DEAT');
    expect(death?.detail?.date?.value).toMatchObject({ day: 4, month: 'JUN', year: 1820 });
    // … and the level-0 mixed-case entity record starts its own record.
    expect(dataset?.records.some((r) => r.tag === 'Education' && r.xref === '@edu1@')).toBe(true);
  });

  test('an upper-case vendor tag line inside a note run stays a line', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 CHAR UTF-8',
      '1 SUBM @S1@',
      '0 @S1@ SUBM',
      '1 NAME T',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 BIRT',
      '2 SOUR @S2@',
      '3 TEXT t',
      '4 BOGUS x',
      '0 @S2@ SOUR',
      '1 TITL x',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records.find((r) => r.tag === 'INDI');
    const birth = indi?.tag === 'INDI' ? indi.events?.find((e) => e.tag === 'BIRT') : undefined;
    const citation = birth?.detail?.citations?.[0];
    const dataText = citation?.data?.texts?.[0];
    const ext = (dataText as unknown as { extensions?: Array<{ tag: string }> } | undefined)?.extensions;
    expect(ext?.some((e) => e.tag === 'BOGUS')).toBe(true);
  });
});
