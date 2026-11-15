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

describe('date value parsers (7.0)', () => {
  test('empty payload is the unknown date', () => {
    expect(parseDateValue70('', pos)).toEqual({ kind: 'unknown' });
    expect(parseDateValue70('   ', pos)).toEqual({ kind: 'unknown' });
  });

  test('all modifiers', () => {
    expect(parseDateValue70('BET 1900 AND 1910', pos).kind).toBe('range');
    expect(parseDateValue70('FROM 1900 TO 1910', pos).kind).toBe('period');
    expect(parseDateValue70('TO 1910', pos)).toEqual({
      kind: 'period',
      to: { calendar: 'GREGORIAN', year: 1910 },
    });
    expect(parseDateValue70('FROM 1900', pos)).toEqual({
      kind: 'period',
      from: { calendar: 'GREGORIAN', year: 1900 },
    });
    expect(parseDateValue70('AFT 1900', pos).kind).toBe('bound');
    expect(parseDateValue70('BEF 1900', pos).kind).toBe('bound');
    expect(parseDateValue70('ABT 1900', pos).kind).toBe('approx');
    expect(parseDateValue70('CAL 1900', pos).kind).toBe('approx');
    expect(parseDateValue70('EST 1900', pos).kind).toBe('approx');
  });

  test('extension calendars and months', () => {
    expect(parseDateValue70('_CAL _MON 1900', pos)).toEqual({
      kind: 'date',
      calendar: '_CAL',
      month: '_MON',
      year: 1900,
    });
    expect(parseDateValue70('_CAL 1900 _EXT', pos)).toEqual({
      kind: 'date',
      calendar: '_CAL',
      year: 1900,
      epoch: '_EXT',
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

  test('impossible days are kept verbatim', () => {
    // The day is no longer validated against the calendar: files in the
    // wild carry impossible days (31 NOV, day 170), and dropping the
    // whole date loses more than the unvalidated day.
    expect(parseDateValue70('32 JAN 1900', pos)).toMatchObject({ kind: 'date', day: 32, month: 'JAN', year: 1900 });
    expect(parseDateValue70('29 FEB 1900', pos)).toMatchObject({ kind: 'date', day: 29, month: 'FEB', year: 1900 });
    expect(parseDateValue70('29 FEB 2000', pos)).toMatchObject({ kind: 'date', day: 29, month: 'FEB', year: 2000 });
    expect(parseDateValue70('31 APR 1900', pos)).toMatchObject({ kind: 'date', day: 31, month: 'APR', year: 1900 });
    // The 7.0 specification lists the French Republican months without
    // stating their lengths, so no French day-of-month limit applies
    // anyway (the official FamilySearch test file date.ged exercises
    // `23 COMP`).
    expect(parseDateValue70('FRENCH_R 7 COMP 8', pos)).toMatchObject({ kind: 'date', day: 7, month: 'COMP', year: 8 });
    expect(parseDateValue70('FRENCH_R 31 COMP 8', pos)).toMatchObject({
      kind: 'date',
      day: 31,
      month: 'COMP',
      year: 8,
    });
    expect(parseDateValue70('HEBREW 31 TSH 5750', pos)).toMatchObject({
      kind: 'date',
      day: 31,
      month: 'TSH',
      year: 5750,
    });
    expect(parseDateValue70('_CAL 37 _MON 1900', pos)).toMatchObject({
      kind: 'date',
      day: 37,
      month: '_MON',
      year: 1900,
    });
    expect(parseDateValue70('HEBREW 1 TSH 5750', pos)).toMatchObject({
      kind: 'date',
      day: 1,
      month: 'TSH',
      year: 5750,
    });
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
    // A plain date in the period slot is the single-date period (the
    // full-leniency container rule).
    expect(parseDatePeriod70('1900', pos)).toEqual({ kind: 'period', from: { calendar: 'GREGORIAN', year: 1900 } });
  });
});

describe('5.5.1 date values', () => {
  test('phrase-only and INT forms', () => {
    expect(parseDateValue551('(sometime)', pos)).toEqual({
      value: { kind: 'unknown' },
      dualYear: false,
      phrase: 'sometime',
    });
    expect(parseDateValue551('INT 1 JAN 1900 (computed)', pos)).toMatchObject({
      value: { kind: 'date', year: 1900 },
      dualYear: false,
      phrase: 'computed',
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
    expect(parseTime70('10:30:05.25Z', pos)).toEqual({ hour: 10, minute: 30, second: 5, fraction: '25', utc: true });
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
    expect(parseEnum('A', table, pos)).toBe('A');
    expect(parseEnum('_EXT', table, pos)).toBe('_EXT');
    expect(codeOf(() => parseEnum('C', table, pos))).toBe('enum.invalid-value');
  });

  test('5.5.1 enums are case-insensitive', () => {
    const table = { MALE: 'male' } as const;
    expect(parseEnum('male', table, pos)).toBe('MALE');
    expect(codeOf(() => parseEnum('other', table, pos))).toBe('enum.invalid-value');
  });

  test('list enums trim items', () => {
    expect(parseListEnum('A, B', { A: 'a', B: 'b' }, pos)).toEqual(['A', 'B']);
  });
});

describe('names, coordinates and tag definitions', () => {
  test('personal names', () => {
    expect(parsePersonalName('John /Doe/', pos)).toEqual({ given: 'John', surname: 'Doe' });
    expect(parsePersonalName('/Doe/ Jr', pos)).toEqual({ surname: 'Doe', suffix: 'Jr' });
    expect(parsePersonalName('John', pos)).toEqual({ given: 'John' });
    // Commas are accepted in any file (the 5.5.1 rule
    // rejected them; the 7.0 rule accepts them).
    expect(parsePersonalName('Doe, John', pos)).toEqual({ given: 'Doe, John' });
    // Slashes that do not form the standard shape keep the whole text
    // as the given name.
    expect(parsePersonalName('John /Doe/ Extra /Part/', pos)).toEqual({ given: 'John /Doe/ Extra /Part/' });
  });

  test('latitude and longitude', () => {
    expect(parseLatitude('N52.5', pos)).toEqual({ direction: 'N', degrees: 52.5 });
    expect(parseLatitude('S90', pos)).toEqual({ direction: 'S', degrees: 90 });
    expect(codeOf(() => parseLatitude('N91', pos))).toBe('latitude.invalid');
    expect(codeOf(() => parseLatitude('X52', pos))).toBe('latitude.invalid');
    expect(parseLongitude('E13.4', pos)).toEqual({ direction: 'E', degrees: 13.4 });
    expect(parseLongitude('W180', pos)).toEqual({ direction: 'W', degrees: 180 });
    expect(codeOf(() => parseLongitude('E181', pos))).toBe('longitude.invalid');
    // The DMS spelling (the gedcom4j samples): the direction defaults
    // from the sign.
    expect(parseLatitude('+50° 3\' 1.49"', pos)).toEqual({ direction: 'N', degrees: 50 + 3 / 60 + 1.49 / 3600 });
    expect(parseLongitude('+19° 56\' 21.48"', pos)).toEqual({ direction: 'E', degrees: 19 + 56 / 60 + 21.48 / 3600 });
    // The colon-separated DMS of the webtrees exports (double or
    // single colons, optional trailing quote).
    expect(parseLatitude('N46::3::19"', pos)).toEqual({ direction: 'N', degrees: 46 + 3 / 60 + 19 / 3600 });
    expect(parseLongitude('E14:30:52', pos)).toEqual({ direction: 'E', degrees: 14 + 30 / 60 + 52 / 3600 });
  });

  test('tag definitions', () => {
    expect(parseTagDefinition('_CUST https://example.com/c', pos)).toEqual({
      tag: '_CUST',
      uri: 'https://example.com/c',
    });
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
    const date = toJsDateTime(
      { calendar: 'GREGORIAN', year: 1900, month: 'JAN', day: 1 },
      { hour: 10, minute: 30, second: 5, fraction: '25' },
    );
    expect(date?.getUTCHours()).toBe(10);
    expect(date?.getUTCMinutes()).toBe(30);
    expect(date?.getUTCSeconds()).toBe(5);
    expect(date?.getUTCMilliseconds()).toBe(250);
    expect(toJsDateTime({ calendar: 'GREGORIAN', year: 1900 }, { hour: 10, minute: 30 })).toBeUndefined();
    expect(toJsDateTime({ calendar: 'GREGORIAN', year: 1900, month: 'JAN', day: 1 })).toBeDefined();
  });

  test('convertCalendar failures and cross-calendar paths', () => {
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 1900 }, 'HEBREW')).toBeUndefined();
    expect(
      convertCalendar({ calendar: 'GREGORIAN', year: 4000, epoch: 'BCE', month: 'JAN', day: 1 }, 'HEBREW'),
    ).toBeUndefined();
    expect(convertCalendar({ calendar: 'HEBREW', year: 5785, month: 'TSH', day: 1 }, 'FRENCH_R')).toBeUndefined();
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 1792, month: 'SEP', day: 22 }, 'FRENCH_R')).toMatchObject({
      calendar: 'FRENCH_R',
      year: 1,
      month: 'VEND',
      day: 1,
    });
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 2024, month: 'OCT', day: 3 }, 'HEBREW')).toMatchObject({
      calendar: 'HEBREW',
      year: 5785,
      month: 'TSH',
      day: 1,
    });
    expect(convertCalendar({ calendar: 'GREGORIAN', year: 1900, month: 'JAN', day: 1 }, '_EXT')).toBeUndefined();
  });
});
