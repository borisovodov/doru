// The tolerant parse (parseTolerant): every problem is recorded and
// skipped instead of aborting — the result carries the best-effort
// dataset plus the full error list.

import { describe, expect, test } from 'vitest';
import { parseTolerant } from '../src/detect';
import { parseGedcom70 } from '../src/parsing/assemble';
import { serializeGedcom551 } from '../src/serialize/serialize';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('parseTolerant', () => {
  test('records every error of a document and keeps parsing', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/', // fine
      '1 SEX Z', // enum error
      '1 BIRT',
      '2 DATE 32 JAN 1900', // impossible day — kept verbatim (not an error)
      '1 OCCU', // bare line — repaired silently (kept with an empty payload)
      '1 FAMS @NOPE@', // dangling pointer — dropped silently (the link has no content)
      '0 @I2@ INDI',
      '1 NAME Mary /Doe/',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(value?.kind).toBe('dataset');
    const codes = errors.map((error) => error.code).sort();
    expect(codes).toEqual(['enum.invalid-value']);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.records).toHaveLength(2);
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.sex).toBeUndefined();
    // The bare OCCU line is repaired, not dropped: the attribute is
    // kept with an empty payload and no error is recorded.
    expect(indi.attributes).toEqual([{ tag: 'OCCU', payload: '' }]);
    expect(indi.occupations ?? []).toEqual([]);
    expect(indi.spouseFamilies ?? []).toEqual([]);
    expect(indi.events?.[0]?.detail?.date?.value).toBeDefined();
  });

  test('a clean document has no errors', () => {
    const text = ['0 HEAD', '1 GEDC', '2 VERS 7.0', '0 @I1@ INDI', '1 NAME John /Doe/', '0 TRLR', ''].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    expect(value?.kind).toBe('dataset');
  });

  test('a document that is nothing but junk fails once with not-gedcom', () => {
    const { value, errors } = parseTolerant(enc('NOT GEDCOM AT ALL\njust prose\n'));
    expect(value).toBeUndefined();
    expect(errors.map((error) => error.code)).toEqual(['document.not-gedcom']);
  });
});

describe('the repair-vs-error recording policy', () => {
  test('a repair with a defined resolution is silent', () => {
    // Bare lines in text slots (kept with an empty payload) and bare
    // SOUR citations (kept as the void citation) are resolutions —
    // no error entries.
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME', // bare name — kept empty
      '1 BIRT',
      '2 DATE 1900',
      '2 SOUR', // bare citation — kept as the void citation
      '1 OCCU', // bare attribute — kept empty
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.names?.[0]).toEqual({ tag: 'NAME', payload: {} });
    expect(indi.events?.[0]?.detail?.citations).toEqual([{ tag: 'SOUR', source: '@VOID@', description: '' }]);
    expect(indi.attributes).toEqual([{ tag: 'OCCU', payload: '' }]);
  });

  test('an unresolved drop keeps recording the error', () => {
    // A text payload in a pointer slot (SUBN with a name instead of a
    // pointer) has no recovery: the line is dropped and the error
    // stays recorded. A bare line would be silent (nothing to lose).
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBN Bill Kelly',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors.map((error) => error.code)).toEqual(['structure.missing-payload']);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.submission).toBeUndefined();
  });
});

describe('the pointer and coordinate repairs', () => {
  test('a pointer with a trailing blank or a US20 artifact resolves', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 FAMC @F2@ ',
      '1 FAMS @<US20>F1@',
      '0 @F1@ FAM',
      '0 @F2@ FAM',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.childFamilies?.map((link) => link.family)).toEqual(['@F2@']);
    expect(indi.spouseFamilies?.map((link) => link.family)).toEqual(['@F1@']);
  });

  test('a bare MAP coordinate line drops the map silently', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 BIRT',
      '2 PLAC X',
      '3 MAP',
      '4 LATI',
      '4 LONG 1E',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.events?.[0]?.detail?.place?.map).toBeUndefined();
  });
});

describe('the not-GEDCOM detection', () => {
  test('a document without a single level-0 line fails once in tolerant mode', () => {
    const text = [
      'if (LEFT(ADDRESS(), 6) ~= "GOLDED") then',
      "  address 'GOLDED.1'",
      'exit',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(value).toBeUndefined();
    expect(errors.map((error) => error.code)).toEqual(['document.not-gedcom']);
  });

  test('a blank document keeps parsing as before', () => {
    const { value, errors } = parseTolerant(enc('\n\n\n'));
    expect(errors).toEqual([]);
    expect(value?.kind).toBe('dataset');
  });

  test('the strict parse fails with the same code', () => {
    const result = parseGedcom70(enc('ASCII art * * *\n'));
    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.code).toBe('document.not-gedcom');
  });
});

describe('the unleveled-continuation merge', () => {
  const HEAD70 = ['0 HEAD', '1 GEDC', '2 VERS 7.0'];

  test('an unleveled line after a NOTE merges as a newline continuation', () => {
    // The Gedcom4Sharp Sopranos fixture: the CONT prefixes were
    // hand-edited away.
    const text = [
      ...HEAD70,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE This note was hand-edited',
      'This is the next line of the text',
      'This is another line of continuation text',
      '1 FAMS @F1@',
      '0 @F1@ FAM',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe(
      'This note was hand-edited\nThis is the next line of the text\nThis is another line of continuation text',
    );
    expect(indi.spouseFamilies?.map((link) => link.family)).toEqual(['@F1@']);
  });

  test('a run anchored by a CONC chain merges into the note too', () => {
    // The ancestry-quirks fixture shape.
    const text = [
      ...HEAD70,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE Wren kept a diary from 18',
      '2 CONC 71 until her death. She wrote about the',
      '2 CONC  harvest every autumn.',
      'Ancestry wrote this paragraph without a CONT tag.',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe(
      'Wren kept a diary from 1871 until her death. She wrote about the harvest every autumn.\nAncestry wrote this paragraph without a CONT tag.',
    );
  });

  test('a blank line ends the run; the tail stays an error', () => {
    const text = [
      ...HEAD70,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE A paragraph',
      'Its unleveled continuation',
      '',
      'And this one after a blank line.',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors.map((error) => error.code)).toEqual(['line.bad-level']);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe('A paragraph\nIts unleveled continuation');
  });

  test('a NAME anchor keeps the error (nothing is guessed)', () => {
    // The GED-Example1 shape: the raw lines are source titles that
    // lost their 0-line, not the repository name's continuation.
    const text = [
      ...HEAD70,
      '0 @R1@ REPO',
      '1 NAME Brabants Historisch Informatie Centrum',
      'Boek',
      'Huwelijksregister 1851',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors.map((error) => error.code)).toEqual(['line.bad-level', 'line.bad-level']);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const repo = dataset?.records[0];
    if (repo?.tag !== 'REPO') {
      throw new Error('expected REPO');
    }
    expect(repo.name).toBe('Brabants Historisch Informatie Centrum');
  });

  test('a citation TEXT anchor merges (the Hebrew bios shape)', () => {
    const text = [
      ...HEAD70,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 BIRT',
      '2 SOUR @S1@',
      '3 DATA',
      '4 TEXT Messoda Dite Marcelle Ben Abou',
      'לידה: 10 בדצמ 1914',
      'פטירה: 30 בינו 2008',
      '0 @S1@ SOUR',
      '1 TITL X',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const citation = indi.events?.[0]?.detail?.citations?.[0];
    expect(citation?.data?.texts?.[0]?.payload).toBe(
      'Messoda Dite Marcelle Ben Abou\nלידה: 10 בדצמ 1914\nפטירה: 30 בינו 2008',
    );
  });

  test('the merge applies in the strict parse too', () => {
    const text = [
      ...HEAD70,
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE A note',
      'its continuation',
      '0 TRLR',
      '',
    ].join('\n');
    const result = parseGedcom70(enc(text));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const indi = result.value.records.find((record) => record.tag === 'INDI');
      const note = indi?.tag === 'INDI' ? indi.notes?.[0] : undefined;
      expect(note && 'payload' in note ? note.payload : undefined).toBe('A note\nits continuation');
    }
  });
});

describe('the xref-not-found repairs', () => {
  test('a US escape artifact inside a record xref matches its stripped pointer', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 SUBM @<US01>I1@',
      '0 @<US01>I1@ INDI',
      '1 NAME Jennifer /Cafiero/',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.submitter).toBe('@I1@');
    const indi = dataset?.records.find((record) => record.tag === 'INDI');
    expect(indi?.xref).toBe('@I1@');
  });
});

describe('the enum leniencies', () => {
  test('the LDS ordinance statuses CLEARED and QUALIFIED parse verbatim', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 BAPL',
      '2 STAT Cleared',
      '1 ENDL',
      '2 STAT QUALIFIED',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.ordinances?.map((ordinance) => ordinance.detail?.status?.payload)).toEqual(['CLEARED', 'QUALIFIED']);
  });

  test('RESN none and NONE list parts are filtered before the enum', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 RESN none',
      '0 @I2@ INDI',
      '1 NAME B /C/',
      '1 RESN NONE, LOCKED',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.restriction).toEqual([]);
    const indi2 = dataset?.records[1];
    expect(indi2?.tag === 'INDI' ? indi2.restriction : undefined).toEqual(['LOCKED']);
  });

  test('the GEDKeeper numeric direction marker defaults like an absent direction', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 BIRT',
      '2 PLAC X',
      '3 _COR',
      '4 _LAD 41',
      '4 _LAM 38',
      '4 _LAS 26',
      '4 _LOD 4',
      '4 _LOM 51',
      '4 _LOS 24',
      '4 _LON 1',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const map = indi.events?.[0]?.detail?.place?.map;
    expect(map?.latitude).toEqual({ direction: 'N', degrees: 41 + 38 / 60 + 26 / 3600 });
    expect(map?.longitude).toEqual({ direction: 'E', degrees: 4 + 51 / 60 + 24 / 3600 });
  });

  test('_CONF_FLAG 1 marks the confidential flag', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @E1@ _EVENT_DEFN',
      '1 _CONF_FLAG 1',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const def = dataset?.records[0];
    expect(def?.tag === '_EVENT_DEFN' ? def.confidentialFlag : undefined).toBe(true);
  });
});

describe('the ISO-8601 exact date', () => {
  test('the ISO-8601 timestamp in CHAN.DATE parses the date and the time', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 CHAN ',
      '2 DATE  2022-08-24T12:26:24.532Z',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    expect(indi.changeDate?.date.value).toEqual({ day: 24, month: 'AUG', year: 2022 });
    expect(indi.changeDate?.date.time).toEqual({ hour: 12, minute: 26, second: 24, fraction: '532', utc: true });
  });

  test('a bare NOTE.TRAN keeps the translation text', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NOTE American English',
      '2 TRAN British English',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'translations' in note ? note.translations?.[0] : undefined).toEqual({ payload: 'British English' });
  });
});

describe('the numbered-list markers', () => {
  test('a numbered-list marker under a NOTE merges into the note', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE Regne independent',
      '1. Jaume I',
      'La mort del Jaume I (1276)',
      '2. Jaume II',
      'El Regne de Mallorca esdevingue independent',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe(
      'Regne independent\n1. Jaume I\nLa mort del Jaume I (1276)\n2. Jaume II\nEl Regne de Mallorca esdevingue independent',
    );
  });

  test('a numbered-list marker without a NOTE anchor keeps the bad-tag error', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1. Jaume I',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors.map((error) => error.code)).toEqual(['line.bad-tag']);
  });
});

describe('the line-comment values', () => {
  test('a // comment after a record or event line is dropped silently', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @F1@ FAM  // Family for the parents',
      '1 HUSB @I1@',
      '0 @I1@ INDI',
      '1 NAME Jako /BACH/',
      '1 DEAT // Burial information suggests',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const fam = dataset?.records.find((record) => record.tag === 'FAM');
    expect(fam?.tag === 'FAM' ? fam.husband?.partner : undefined).toBe('@I1@');
    const indi = dataset?.records.find((record) => record.tag === 'INDI');
    expect(indi?.tag === 'INDI' ? indi.events?.length : -1).toBe(1);
  });
});

describe('the over-indented continuations', () => {
  test('a continuation indented one level too deep merges into the note', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE Main decisive actions:',
      '2 CONT - Delivers impassioned speech',
      '3 CONT - Orders the execution',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const indi = dataset?.records[0];
    if (indi?.tag !== 'INDI') {
      throw new Error('expected INDI');
    }
    const note = indi.notes?.[0];
    expect(note && 'payload' in note ? note.payload : undefined).toBe(
      'Main decisive actions:\n- Delivers impassioned speech\n- Orders the execution',
    );
  });

  test('a level-skip without a text-bearing anchor keeps the error', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME A /B/',
      '1 NOTE x',
      '2 SOUR @S1@',
      '4 CONT deep',
      '0 @S1@ SOUR',
      '0 TRLR',
      '',
    ].join('\n');
    const { errors } = parseTolerant(enc(text));
    expect(errors.map((error) => error.code)).toContain('line.level-skip');
  });
});

describe('the date leniencies', () => {
  test('a weekday-prefixed and a phrase-suffixed exact date parse', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 DATE Friday, 20th November 1992',
      '0 @S1@ SOUR',
      '1 PUBL X',
      '2 DATE 1 Jan 2026 (Ancestry source: Publisher date)',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.date?.value).toEqual({ day: 20, month: 'NOV', year: 1992 });
  });

  test('a plain date in the SOUR.DATA.EVEN period slot parses as a single-date period', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @S1@ SOUR',
      '1 DATA',
      '2 EVEN CENS',
      '3 DATE 5 JUL 1776',
      '3 PLAC Philadelphia, PA',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const source = dataset?.records.find((record) => record.tag === 'SOUR');
    const event = source?.tag === 'SOUR' ? source.data?.events?.[0] : undefined;
    expect(event?.date?.value).toEqual({
      kind: 'period',
      from: { calendar: 'GREGORIAN', day: 5, month: 'JUL', year: 1776 },
    });
  });
});

describe('the European date spellings', () => {
  test('the dotted, dashed and month-named European dates parse', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 DATE 23.8.2024',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.date?.value).toEqual({ day: 23, month: 'AUG', year: 2024 });
  });

  test('the two-digit-year dash spelling maps to the 20th century', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 DATE 23-Apr-98',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    expect(dataset?.header.date?.value).toEqual({ day: 23, month: 'APR', year: 1998 });
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
    const death = individual?.events.find((event) => event.tag === 'DEAT');
    expect(death?.detail.date.phrase).toBe('Aft');
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
    const birth = individual?.events.find((event) => event.tag === 'BIRT');
    const death = individual?.events.find((event) => event.tag === 'DEAT');
    expect(birth?.detail.date.phrase).toBe('BET  AND 1907');
    expect(death?.detail.date.phrase).toBe('From  to 1947');
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
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 DATE FEB 13 2026',
      '0 TRLR',
      '',
    ].join('\n');
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
    const birth = individual?.events.find((event) => event.tag === 'BIRT');
    expect(birth?.detail.date.value).toEqual({ kind: 'date', calendar: 'JULIAN', year: 1491, day: 28, month: 'JUN' });
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
    expect(individual?.notes?.[0]?.payload).toBe('This note includes special characters: @#$%&*');
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
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @N1@ NOTE',
      '1 CONC @NI124@',
      '0 TRLR',
      '',
    ].join('\n');
    const { value, errors } = parseTolerant(enc(text));
    expect(errors).toEqual([]);
    const dataset = value?.kind === 'dataset' ? value.dataset : undefined;
    const note = dataset?.records.find((record) => record.tag === 'NOTE');
    expect(note?.tag === 'NOTE' ? note.payload : undefined).toBe('@NI124@');
  });
});

describe('the numeric and dotted month spellings', () => {
  test('an all-numeric European date maps to the day-first order', () => {
    const text = [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '1 DATE 20 10 1996',
      '0 TRLR',
      '',
    ].join('\n');
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
    const birth = individual?.events.find((event) => event.tag === 'BIRT');
    expect(birth?.detail.date.value).toMatchObject({ month: 'JAN', year: 2015 });
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
    const genomap = dataset?.records.find((record) => record.tag === 'GENOMAP');
    expect(genomap).toBeDefined();
    // The GenoPro PEDIGREELINK children keep their own INDIVIDUAL/FAMILY
    // tags — the 5.5.5 alias must not rename them (see gedcom-555.ts).
    const link = genomap?.extensions?.[0] ?? (genomap as { children?: { tag: string }[] }).children?.[0];
    const children = (link as { children?: { tag: string }[] }).children;
    expect(children?.map((child) => child.tag)).toEqual(['INDIVIDUAL', 'FAMILY']);
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
    const birth = individual?.tag === 'INDI' ? individual.events.find((event) => event.tag === 'BIRT') : undefined;
    expect(birth?.detail.place?.familioId).toBe('b18382fe-f188-45a4-96cf-65274665e66b');
    if (value?.kind === 'dataset') {
      const out = serializeGedcom551(value.dataset);
      expect(out.ok && out.value.includes('_FAMILIO_GUID b18382fe-f188-45a4-96cf-65274665e66b')).toBe(true);
    }
  });
});
