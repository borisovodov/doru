import { describe, expect, test } from 'vitest';
import type { SourcePosition } from '../src/errors';
import {
  parseAge551,
  parseAge70,
  parseDateExact70,
  parseDatePeriod70,
  parseDateValue551,
  parseDateValue70,
  parseEnum,
  parseLanguage551,
  parseLatitude,
  parseListEnum,
  parseLongitude,
  parseMediaFormat551,
  parsePersonalName,
  parseTagDefinition,
  parseTime551,
  parseTime70,
} from '../src/parsing/types';
import { parseGedcom551, parseGedcom70 } from '../src/parsing/assemble';
import { dateFieldsBounds, convertCalendar, toJsDateTime } from '../src/dates';
import type { DateFields } from '../src/primitives';

const pos: SourcePosition = { line: 1, column: 1, offset: 0 };

/** Runs a throwing parser and returns the typed error code. */
function codeOf(fn: () => unknown): string {
  try {
    fn();
    throw new Error('expected an error');
  } catch (error) {
    return (error as { code: string }).code;
  }
}

function err70(text: string): string {
  const result = parseGedcom70(new TextEncoder().encode(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

function err551(text: string): string {
  const result = parseGedcom551(new TextEncoder().encode(text));
  if (result.ok) {
    throw new Error('expected an error');
  }
  return (result.error as { code: string }).code;
}

describe('date value parsers (7.0)', () => {
  test('empty payload is the unknown date', () => {
    expect(parseDateValue70('', pos)).toEqual({ kind: 'unknown' });
    expect(parseDateValue70('   ', pos)).toEqual({ kind: 'unknown' });
  });

  test('all modifiers', () => {
    expect(parseDateValue70('BET 1900 AND 1910', pos).kind).toBe('range');
    expect(parseDateValue70('FROM 1900 TO 1910', pos).kind).toBe('period');
    expect(parseDateValue70('TO 1910', pos)).toEqual({
      kind: 'period', to: { kind: 'date', calendar: 'GREGORIAN', year: 1910 },
    });
    expect(parseDateValue70('FROM 1900', pos)).toEqual({
      kind: 'period', from: { kind: 'date', calendar: 'GREGORIAN', year: 1900 },
    });
    expect(parseDateValue70('AFT 1900', pos).kind).toBe('bound');
    expect(parseDateValue70('BEF 1900', pos).kind).toBe('bound');
    expect(parseDateValue70('ABT 1900', pos).kind).toBe('approx');
    expect(parseDateValue70('CAL 1900', pos).kind).toBe('approx');
    expect(parseDateValue70('EST 1900', pos).kind).toBe('approx');
  });

  test('extension calendars and months', () => {
    expect(parseDateValue70('_CAL _MON 1900', pos)).toEqual({
      kind: 'date', calendar: '_CAL', month: '_MON', year: 1900,
    });
    expect(parseDateValue70('_CAL 1900 _EXT', pos)).toEqual({
      kind: 'date', calendar: '_CAL', year: 1900, epoch: '_EXT',
    });
  });

  test('date errors', () => {
    expect(codeOf(() => parseDateValue70('BET 1900', pos))).toBe('date.invalid');
    expect(codeOf(() => parseDateValue70('_CAL JAN 1900', pos))).toBe('date.bad-month');
    expect(codeOf(() => parseDateValue70('1900 _EXT', pos))).toBe('date.bad-epoch');
    expect(codeOf(() => parseDateValue70('HEBREW 1900 BCE', pos))).toBe('date.bad-epoch');
    expect(codeOf(() => parseDateValue70('1 JAN 1900 EXTRA', pos))).toBe('date.invalid');
    expect(codeOf(() => parseDateValue70('x 1900', pos))).toBe('date.bad-month');
  });

  test('day validation per calendar', () => {
    expect(codeOf(() => parseDateValue70('32 JAN 1900', pos))).toBe('date.bad-day');
    expect(codeOf(() => parseDateValue70('29 FEB 1900', pos))).toBe('date.bad-day');
    expect(parseDateValue70('29 FEB 2000', pos)).toMatchObject({ kind: 'date', day: 29, month: 'FEB', year: 2000 });
    expect(codeOf(() => parseDateValue70('31 APR 1900', pos))).toBe('date.bad-day');
    expect(codeOf(() => parseDateValue70('FRENCH_R 7 COMP 8', pos))).toBe('date.bad-day');
    expect(codeOf(() => parseDateValue70('HEBREW 31 TSH 5750', pos))).toBe('date.bad-day');
    expect(codeOf(() => parseDateValue70('_CAL 37 _MON 1900', pos))).toBe('date.bad-day');
    expect(parseDateValue70('HEBREW 1 TSH 5750', pos)).toMatchObject({ kind: 'date', day: 1, month: 'TSH', year: 5750 });
  });

  test('year errors', () => {
    expect(codeOf(() => parseDateValue70('19OO', pos))).toBe('date.bad-year');
    expect(codeOf(() => parseDateValue70('99999999999999999999', pos))).toBe('date.bad-year');
  });
});

describe('exact and period dates (7.0)', () => {
  test('DateExact', () => {
    expect(parseDateExact70('1 JAN 1900', pos)).toEqual({ day: 1, month: 'JAN', year: 1900 });
    expect(codeOf(() => parseDateExact70('1 JAN', pos))).toBe('date.invalid');
    expect(codeOf(() => parseDateExact70('x JAN 1900', pos))).toBe('date.bad-day');
    expect(codeOf(() => parseDateExact70('1 XYZ 1900', pos))).toBe('date.bad-month');
    expect(codeOf(() => parseDateExact70('30 FEB 1900', pos))).toBe('date.bad-day');
  });

  test('DatePeriod', () => {
    expect(parseDatePeriod70('', pos)).toEqual({ kind: 'period' });
    expect(parseDatePeriod70('FROM 1900 TO 1910', pos).kind).toBe('period');
    expect(codeOf(() => parseDatePeriod70('1900', pos))).toBe('date.invalid');
  });
});

describe('5.5.1 date values', () => {
  test('phrase-only and INT forms', () => {
    expect(parseDateValue551('(sometime)', pos)).toEqual({
      value: { kind: 'unknown' }, dualYear: false, phrase: 'sometime',
    });
    expect(parseDateValue551('INT 1 JAN 1900 (computed)', pos)).toMatchObject({
      value: { kind: 'date', year: 1900 }, dualYear: false, phrase: 'computed',
    });
  });

  test('FROM/TO/BET/AFT/BEF/ABT/CAL/EST', () => {
    expect(parseDateValue551('FROM 1900 TO 1910', pos).value.kind).toBe('period');
    expect(parseDateValue551('TO 1910', pos).value.kind).toBe('period');
    expect(parseDateValue551('FROM 1900', pos).value.kind).toBe('period');
    expect(parseDateValue551('BET 1900 AND 1910', pos).value.kind).toBe('range');
    expect(parseDateValue551('AFT 1900', pos).value.kind).toBe('bound');
    expect(parseDateValue551('BEF 1900', pos).value.kind).toBe('bound');
    expect(parseDateValue551('ABT 1900', pos).value.kind).toBe('approx');
    expect(parseDateValue551('CAL 1900', pos).value.kind).toBe('approx');
    expect(parseDateValue551('EST 1900', pos).value.kind).toBe('approx');
    expect(codeOf(() => parseDateValue551('BET 1900', pos))).toBe('date.invalid');
  });

  test('calendar escapes', () => {
    expect(parseDateValue551('@#DJULIAN@ 5 OCT 1582', pos)).toMatchObject({
      value: { kind: 'date', calendar: 'JULIAN', year: 1582 },
    });
    expect(codeOf(() => parseDateValue551('@#DROMAN@ 1900', pos))).toBe('date.reserved-calendar');
    expect(codeOf(() => parseDateValue551('@#DX@ 1900', pos))).toBe('line.bad-escape');
  });

  test('B.C. suffix rules', () => {
    expect(parseDateValue551('44 B.C.', pos)).toMatchObject({
      value: { kind: 'date', year: 44, epoch: 'BCE' },
    });
    expect(codeOf(() => parseDateValue551('1 JAN 44 B.C.', pos))).toBe('date.bad-epoch');
  });

  test('dual years', () => {
    expect(parseDateValue551('1699/00', pos).dualYear).toBe(true);
    const parsed = parseDateValue551('1900/01', pos);
    expect(parsed.dualYear).toBe(true);
    expect(parsed.value).toMatchObject({ year: 1901 });
  });
});

describe('time parsers', () => {
  test('7.0 time forms', () => {
    expect(parseTime70('10:30', pos)).toEqual({ hour: 10, minute: 30 });
    expect(parseTime70('10:30:05', pos)).toEqual({ hour: 10, minute: 30, second: 5 });
    expect(parseTime70('10:30:05.25', pos)).toEqual({ hour: 10, minute: 30, second: 5, fraction: '25' });
    expect(parseTime70('10:30:05.25Z', pos)).toEqual({ hour: 10, minute:30, second: 5, fraction: '25', utc: true });
    expect(codeOf(() => parseTime70('10:30:05.25+01', pos))).toBe('time.invalid');
    expect(codeOf(() => parseTime70('24:00', pos))).toBe('time.invalid');
    expect(codeOf(() => parseTime70('10:60', pos))).toBe('time.invalid');
    expect(codeOf(() => parseTime70('10:30:60', pos))).toBe('time.invalid');
  });

  test('5.5.1 time forms', () => {
    expect(parseTime551('10:30:05.25', pos)).toEqual({ hour: 10, minute: 30, second: 5, fraction: '25' });
    expect(codeOf(() => parseTime551('10:30Z', pos))).toBe('time.invalid');
    expect(codeOf(() => parseTime551('24:00', pos))).toBe('time.invalid');
    expect(codeOf(() => parseTime551('10:60', pos))).toBe('time.invalid');
    expect(codeOf(() => parseTime551('10:30:60', pos))).toBe('time.invalid');
  });
});

describe('age parsers', () => {
  test('7.0 ages', () => {
    expect(parseAge70('5y', pos)).toEqual({ years: 5 });
    expect(parseAge70('5y 3m 2w 1d', pos)).toEqual({ years: 5, months: 3, weeks: 2, days: 1 });
    expect(parseAge70('>', pos)).toEqual({ bound: '>' });
    expect(parseAge70('< 50y', pos)).toEqual({ bound: '<', years: 50 });
    expect(codeOf(() => parseAge70('5x', pos))).toBe('age.invalid');
    expect(codeOf(() => parseAge70('5m 5y', pos))).toBe('age.invalid');
    expect(codeOf(() => parseAge70('', pos))).toBe('age.invalid');
    expect(codeOf(() => parseAge70('99999999999999999999y', pos))).toBe('integer.out-of-range');
  });

  test('5.5.1 ages', () => {
    expect(parseAge551('CHILD', pos)).toEqual({ description: 'CHILD' });
    expect(parseAge551('infant', pos)).toEqual({ description: 'INFANT' });
    expect(parseAge551('STILLBORN', pos)).toEqual({ description: 'STILLBORN' });
    expect(parseAge551('5y 3m 1d', pos)).toEqual({ years: 5, months: 3, days: 1 });
    expect(parseAge551('< 50y', pos)).toEqual({ bound: '<', years: 50 });
    expect(codeOf(() => parseAge551('5w', pos))).toBe('age.invalid');
    expect(codeOf(() => parseAge551('5d 5y', pos))).toBe('age.invalid');
    expect(codeOf(() => parseAge551('', pos))).toBe('age.invalid');
  });
});

describe('enumeration parsers', () => {
  test('7.0 enums accept exact values and extensions', () => {
    const table = { A: 'a', B: 'b' } as const;
    expect(parseEnum('A', table, '7.0', pos)).toBe('A');
    expect(parseEnum('_EXT', table, '7.0', pos)).toBe('_EXT');
    expect(codeOf(() => parseEnum('C', table, '7.0', pos))).toBe('enum.invalid-value');
  });

  test('5.5.1 enums are case-insensitive', () => {
    const table = { MALE: 'male' } as const;
    expect(parseEnum('male', table, '5.5.1', pos)).toBe('MALE');
    expect(codeOf(() => parseEnum('other', table, '5.5.1', pos))).toBe('enum.invalid-value');
  });

  test('list enums trim items', () => {
    expect(parseListEnum('A, B', { A: 'a', B: 'b' }, '7.0', pos)).toEqual(['A', 'B']);
  });
});

describe('names, coordinates and tag definitions', () => {
  test('personal names', () => {
    expect(parsePersonalName('John /Doe/', '7.0', pos)).toEqual({ given: 'John', surname: 'Doe' });
    expect(parsePersonalName('/Doe/ Jr', '7.0', pos)).toEqual({ surname: 'Doe', suffix: 'Jr' });
    expect(parsePersonalName('John', '7.0', pos)).toEqual({ given: 'John' });
    expect(parsePersonalName('John /Doe/', '5.5.1', pos)).toEqual({ given: 'John', surname: 'Doe' });
    expect(codeOf(() => parsePersonalName('Doe, John', '5.5.1', pos))).toBe('name.invalid');
    expect(codeOf(() => parsePersonalName('John /Doe/ Extra /Part/', '7.0', pos))).toBe('name.invalid');
  });

  test('latitude and longitude', () => {
    expect(parseLatitude('N52.5', pos)).toEqual({ direction: 'N', degrees: 52.5 });
    expect(parseLatitude('S90', pos)).toEqual({ direction: 'S', degrees: 90 });
    expect(codeOf(() => parseLatitude('N91', pos))).toBe('latitude.invalid');
    expect(codeOf(() => parseLatitude('X52', pos))).toBe('latitude.invalid');
    expect(parseLongitude('E13.4', pos)).toEqual({ direction: 'E', degrees: 13.4 });
    expect(parseLongitude('W180', pos)).toEqual({ direction: 'W', degrees: 180 });
    expect(codeOf(() => parseLongitude('E181', pos))).toBe('longitude.invalid');
  });

  test('tag definitions', () => {
    expect(parseTagDefinition('_CUST https://example.com/c', pos)).toEqual({ tag: '_CUST', uri: 'https://example.com/c' });
    expect(codeOf(() => parseTagDefinition('_CUST', pos))).toBe('tagdef.invalid');
    expect(codeOf(() => parseTagDefinition('CUST https://example.com/c', pos))).toBe('tagdef.invalid');
    expect(codeOf(() => parseTagDefinition('_CUST bad uri', pos))).toBe('uri.invalid');
  });

  test('5.5.1 tables', () => {
    expect(parseLanguage551('russian', pos)).toBe('Russian');
    expect(codeOf(() => parseLanguage551('klingon', pos))).toBe('enum.invalid-value');
    expect(parseMediaFormat551('jpg', pos)).toBe('jpg');
    expect(codeOf(() => parseMediaFormat551('exe', pos))).toBe('enum.invalid-value');
  });
});

describe('calendar conversions and bounds', () => {
  test('dateFieldsBounds covers French and Hebrew partials', () => {
    const frenchYear: DateFields = { calendar: 'FRENCH_R', year: 8 };
    expect(dateFieldsBounds(frenchYear)).toBeDefined();
    const frenchMonth: DateFields = { calendar: 'FRENCH_R', year: 8, month: 'VEND' };
    expect(dateFieldsBounds(frenchMonth)).toBeDefined();
    const frenchDay: DateFields = { calendar: 'FRENCH_R', year: 8, month: 'VEND', day: 5 };
    expect(dateFieldsBounds(frenchDay)?.earliest?.getTime()).toBe(dateFieldsBounds(frenchDay)?.latest?.getTime());
    expect(dateFieldsBounds({ calendar: 'FRENCH_R', year: 8, month: 'VEND', day: 31 })).toBeUndefined();
    expect(dateFieldsBounds({ calendar: 'FRENCH_R', year: 20, month: 'VEND', day: 1 })).toBeUndefined();
    expect(dateFieldsBounds({ calendar: 'FRENCH_R', year: 8, month: 'JAN' })).toBeUndefined();

    const hebrewYear: DateFields = { calendar: 'HEBREW', year: 5785 };
    expect(dateFieldsBounds(hebrewYear)).toBeDefined();
    const hebrewMonth: DateFields = { calendar: 'HEBREW', year: 5785, month: 'TSH' };
    expect(dateFieldsBounds(hebrewMonth)).toBeDefined();
    const hebrewDay: DateFields = { calendar: 'HEBREW', year: 5785, month: 'TSH', day: 1 };
    expect(dateFieldsBounds(hebrewDay)).toBeDefined();
    expect(dateFieldsBounds({ calendar: 'HEBREW', year: 5785, month: 'TSH', day: 31 })).toBeUndefined();
    expect(dateFieldsBounds({ calendar: 'HEBREW', year: 5783, month: 'ADR', day: 1 })).toBeUndefined();

    expect(dateFieldsBounds({ calendar: 'GREGORIAN', year: 1900, epoch: '_EXT' })).toBeUndefined();
    expect(dateFieldsBounds({ calendar: '_EXT', year: 1900 })).toBeUndefined();
  });

  test('toJsDateTime places a time with a fraction', () => {
    const date = toJsDateTime({ calendar: 'GREGORIAN', year: 1900, month: 'JAN', day: 1 }, { hour: 10, minute: 30, second: 5, fraction: '25' });
    expect(date?.getUTCHours()).toBe(10);
    expect(date?.getUTCMinutes()).toBe(30);
    expect(date?.getUTCSeconds()).toBe(5);
    expect(date?.getUTCMilliseconds()).toBe(250);
    expect(toJsDateTime({ calendar: 'GREGORIAN', year: 1900 }, { hour: 10, minute: 30 })).toBeUndefined();
    expect(toJsDateTime({ calendar: 'GREGORIAN', year: 1900, month: 'JAN', day: 1 })).toBeDefined();
  });

  test('convertCalendar failures and cross-calendar paths', () => {
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 1900 }, 'HEBREW')).toBeUndefined();
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 4000, epoch: 'BCE', month: 'JAN', day: 1 }, 'HEBREW')).toBeUndefined();
    expect(convertCalendar({ calendar: 'HEBREW', year: 5785, month: 'TSH', day: 1 }, 'FRENCH_R')).toBeUndefined();
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 1792, month: 'SEP', day: 22 }, 'FRENCH_R')).toMatchObject({ calendar: 'FRENCH_R', year: 1, month: 'VEND', day: 1 });
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 2024, month: 'OCT', day: 3 }, 'HEBREW')).toMatchObject({ calendar: 'HEBREW', year: 5785, month: 'TSH', day: 1 });
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 1900, month: 'JAN', day: 1 }, '_EXT')).toBeUndefined();
  });
});

describe('names and places edge cases', () => {
  test('name pieces reject substructures', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME John /Doe/\n2 GIVN John\n3 BOGUS x\n0 TRLR\n')).toBe('structure.unknown-tag');
  });

  test('5.5.1 name pieces with commas and a custom TYPE', () => {
    const result = parseGedcom551(new TextEncoder().encode(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 NPFX Dr., Prof.',
        '2 GIVN John, Jonathan',
        '2 NICK Johnny, Jack',
        '2 SPFX van, von',
        '2 SURN Doe, Smith',
        '2 NSFX Jr., Sr.',
        '2 TYPE custom label',
        '0 @S1@ SUBM', '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    ));
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[0] as {
      names?: Array<{ payload: unknown; pieces?: { namePrefixes?: string[]; givenNames?: string[]; nicknames?: string[]; surnamePrefixes?: string[]; surnames?: string[]; nameSuffixes?: string[] }; type?: { payload: string; phrase?: string } }>;
    };
    expect(rec.names?.[0]?.pieces?.namePrefixes).toEqual(['Dr.', 'Prof.']);
    expect(rec.names?.[0]?.pieces?.givenNames).toEqual(['John', 'Jonathan']);
    expect(rec.names?.[0]?.pieces?.nicknames).toEqual(['Johnny', 'Jack']);
    expect(rec.names?.[0]?.pieces?.surnamePrefixes).toEqual(['van', 'von']);
    expect(rec.names?.[0]?.pieces?.surnames).toEqual(['Doe', 'Smith']);
    expect(rec.names?.[0]?.pieces?.nameSuffixes).toEqual(['Jr.', 'Sr.']);
    expect(rec.names?.[0]?.type).toEqual({ payload: 'OTHER', phrase: 'custom label' });
  });

  test('7.0 name TYPE with a PHRASE and 5.5.1 TYPE rejects substructures', () => {
    expect(
      parseGedcom70(new TextEncoder().encode(
        '0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @I1@ INDI\n1 NAME John /Doe/\n2 TYPE BIRTH\n3 PHRASE at birth\n0 TRLR\n',
      )).ok,
    ).toBe(true);
    expect(err551('0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME John /Doe/\n2 TYPE maiden\n3 BOGUS x\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n')).toBe('structure.unknown-tag');
  });

  test('name translations and 5.5.1 variations keep pieces', () => {
    const result = parseGedcom551(new TextEncoder().encode(
      [
        '0 HEAD', '1 SOUR PAF', '1 SUBM @S1@', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '2 FONE Jo-han /Do-e/',
        '3 TYPE kana',
        '3 GIVN Jo-han',
        '2 ROMN Dzon /Doe/',
        '3 TYPE cyrillic',
        '3 SURN Doe',
        '0 @S1@ SUBM', '1 NAME T',
        '0 TRLR',
      ].join('\n'),
    ));
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[0] as {
      names?: Array<{ phonetic?: Array<{ pieces?: { givenNames?: string[] } }>; romanized?: Array<{ pieces?: { surnames?: string[] } }> }>;
    };
    expect(rec.names?.[0]?.phonetic?.[0]?.pieces?.givenNames).toEqual(['Jo-han']);
    expect(rec.names?.[0]?.romanized?.[0]?.pieces?.surnames).toEqual(['Doe']);
  });

  test('place phonetic variations reject non-TYPE substructures', () => {
    expect(err551('0 HEAD\n1 SOUR PAF\n1 SUBM @S1@\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n0 @I1@ INDI\n1 BIRT\n2 PLAC Berlin\n3 FONE Berurin\n4 TYPE kana\n4 BOGUS x\n0 @S1@ SUBM\n1 NAME T\n0 TRLR\n')).toBe('structure.unknown-tag');
  });

  test('_POST with DATE and SOUR under a place', () => {
    const result = parseGedcom70(new TextEncoder().encode(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @S2@ SOUR', '1 TITL S',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 PLAC Berlin',
        '3 _POST 10115',
        '4 DATE 1900',
        '4 SOUR @S2@',
        '0 TRLR',
      ].join('\n'),
    ));
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const rec = result.value.records[1] as {
      events?: Array<{ detail?: { place?: { postalCodes?: Array<{ code: string; date?: unknown; citations?: unknown[] }> } } }>;
    };
    expect(rec.events?.[0]?.detail?.place?.postalCodes?.[0]?.code).toBe('10115');
    expect(rec.events?.[0]?.detail?.place?.postalCodes?.[0]?.date).toBeDefined();
    expect(rec.events?.[0]?.detail?.place?.postalCodes?.[0]?.citations).toHaveLength(1);
  });
});

describe('place records', () => {
  test('_LOC rejects a payload and requires NAME', () => {
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @L1@ _LOC payload\n0 TRLR\n')).toBe('structure.unexpected-payload');
    expect(err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @L1@ _LOC\n0 TRLR\n')).toBe('structure.missing-required');
  });

  test('_LOC names, abbreviation types and hierarchy links', () => {
    const result = parseGedcom70(new TextEncoder().encode(
      [
        '0 HEAD', '1 GEDC', '2 VERS 7.0',
        '0 @S2@ SOUR', '1 TITL S',
        '0 @O1@ OBJE', '1 FILE a.jpg', '2 FORM image/jpeg',
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
    ));
    if (!result.ok) {
      throw new Error(JSON.stringify(result));
    }
    const card = result.value.records[2] as {
      payload: string;
      names?: Array<{ name: string; abbreviations?: Array<{ abbreviation: string; type?: string }>; language?: string; date?: unknown; citations?: unknown[] }>;
      types?: Array<{ type: string; govTypeId?: string; date?: unknown; citations?: unknown[] }>;
      govId?: string; maidenhead?: string;
      postalCodes?: Array<{ code: string; date?: unknown; citations?: unknown[] }>;
      administrativeIds?: Array<{ identifier: string; type: string; date?: unknown; citations?: unknown[] }>;
      demographicData?: Array<{ data: string; type: string; date?: unknown; citations?: unknown[] }>;
      denomination?: string;
      events?: Array<{ tag: string; payload?: string; detail?: { date?: unknown } }>;
      parents?: Array<{ parent: string; type?: string; date?: unknown; citations?: unknown[] }>;
      abbreviation?: string; map?: unknown; notes?: unknown[]; citations?: unknown[]; media?: unknown[];
      identifiers?: Array<{ tag: string }>; changeDate?: unknown;
    };
    expect(card.payload).toBe('Berlin');
    expect(card.names?.[0]?.abbreviations).toEqual([
      { abbreviation: 'B', type: 'short' },
      { abbreviation: 'BLN' },
    ]);
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
      err70('0 HEAD\n1 GEDC\n2 VERS 7.0\n0 @L1@ _LOC\n1 NAME A\n1 _LOC @L2@\n2 TYPE WRONG\n0 @L2@ _LOC\n1 NAME B\n0 TRLR\n'),
    ).toBe('enum.invalid-value');
  });
});
