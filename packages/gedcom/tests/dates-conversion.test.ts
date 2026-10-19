import { describe, expect, test } from 'vitest';
import { convertCalendar, dateBounds, dateFieldsBounds, toJsDate, toJsDateTime } from '../src/dates';
import type { DateFields, DateValue } from '../src/primitives';

const utc = (year: number, monthIndex: number, day: number): Date =>
  new Date(Date.UTC(year, monthIndex, day));

describe('dateFieldsBounds — Gregorian', () => {
  test('an exact day', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'JAN', year: 1900 });
    expect(span?.earliest).toEqual(utc(1900, 0, 1));
    expect(span?.latest).toEqual(utc(1900, 0, 1));
  });

  test('a month widens to the whole month', () => {
    const span = dateFieldsBounds({ kind: 'date', month: 'FEB', year: 1900 });
    expect(span?.earliest).toEqual(utc(1900, 1, 1));
    expect(span?.latest).toEqual(utc(1900, 1, 28));
  });

  test('a leap February', () => {
    const span = dateFieldsBounds({ kind: 'date', month: 'FEB', year: 2000 });
    expect(span?.latest).toEqual(utc(2000, 1, 29));
  });

  test('a year alone widens to the whole year', () => {
    const span = dateFieldsBounds({ kind: 'date', year: 1800 });
    expect(span?.earliest).toEqual(utc(1800, 0, 1));
    expect(span?.latest).toEqual(utc(1800, 11, 31));
  });

  test('the BCE epoch uses astronomical numbering (4 B.C. = year -3)', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'MAR', year: 4, epoch: 'BCE' });
    expect(span?.earliest?.getUTCFullYear()).toBe(-3);
    expect(span?.earliest?.getUTCMonth()).toBe(2);
    expect(span?.earliest?.getUTCDate()).toBe(1);
  });

  test('an invalid day is undefined', () => {
    expect(dateFieldsBounds({ kind: 'date', day: 31, month: 'APR', year: 1900 })).toBeUndefined();
  });

  test('an extension calendar is undefined', () => {
    expect(dateFieldsBounds({ kind: 'date', day: 1, month: 'JAN', year: 1900, calendar: '@#DXXX@' as never })).toBeUndefined();
  });
});

describe('dateFieldsBounds — Julian', () => {
  test('1 Jan 1900 Julian is 13 Jan 1900 Gregorian', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'JAN', year: 1900, calendar: 'JULIAN' });
    expect(span?.earliest).toEqual(utc(1900, 0, 13));
  });

  test('a Julian leap February', () => {
    const span = dateFieldsBounds({ kind: 'date', month: 'FEB', year: 1900, calendar: 'JULIAN' });
    expect(span?.latest).toEqual(utc(1900, 1, 13 + 28));
  });

  test('the Julian epoch anchor (1 Jan 1 BCE Julian = 30 Dec 2 BCE Gregorian)', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'JAN', year: 1, epoch: 'BCE', calendar: 'JULIAN' });
    expect(span?.earliest?.getUTCFullYear()).toBe(-1);
    expect(span?.earliest?.getUTCMonth()).toBe(11);
    expect(span?.earliest?.getUTCDate()).toBe(30);
  });
});

describe('dateFieldsBounds — Hebrew', () => {
  test('1 Tishri 5785 is 3 October 2024', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'TSH', year: 5785, calendar: 'HEBREW' });
    expect(span?.earliest).toEqual(utc(2024, 9, 3));
  });

  test('1 Tishri 5784 is 16 September 2023', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'TSH', year: 5784, calendar: 'HEBREW' });
    expect(span?.earliest).toEqual(utc(2023, 8, 16));
  });

  test('the epoch: 1 Tishri year 1 is 7 September 3761 BCE proleptic Gregorian (a Monday)', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'TSH', year: 1, calendar: 'HEBREW' });
    expect(span?.earliest?.getUTCFullYear()).toBe(-3760);
    expect(span?.earliest?.getUTCMonth()).toBe(8);
    expect(span?.earliest?.getUTCDate()).toBe(7);
    // The Julian-proleptic spelling of the same day is 7 October 3761 BCE.
  });

  test('ADR exists only in leap years', () => {
    expect(dateFieldsBounds({ kind: 'date', day: 1, month: 'ADR', year: 5784, calendar: 'HEBREW' })).toBeDefined();
    expect(dateFieldsBounds({ kind: 'date', day: 1, month: 'ADR', year: 5785, calendar: 'HEBREW' })).toBeUndefined();
  });
});

describe('dateFieldsBounds — French Republican', () => {
  test('1 Vendémiaire I is 22 September 1792', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'VEND', year: 1, calendar: 'FRENCH_R' });
    expect(span?.earliest).toEqual(utc(1792, 8, 22));
  });

  test('1 Vendémiaire VIII is 23 September 1799', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 1, month: 'VEND', year: 8, calendar: 'FRENCH_R' });
    expect(span?.earliest).toEqual(utc(1799, 8, 23));
  });

  test('the 6th complementary day of the leap year XI is 23 September 1803', () => {
    const span = dateFieldsBounds({ kind: 'date', day: 6, month: 'COMP', year: 11, calendar: 'FRENCH_R' });
    expect(span?.earliest).toEqual(utc(1803, 8, 23));
  });

  test('a non-leap year has 5 complementary days', () => {
    expect(dateFieldsBounds({ kind: 'date', day: 6, month: 'COMP', year: 14, calendar: 'FRENCH_R' })).toBeUndefined();
    expect(dateFieldsBounds({ kind: 'date', day: 5, month: 'COMP', year: 14, calendar: 'FRENCH_R' })).toBeDefined();
  });

  test('years outside An I–XIV are undefined', () => {
    expect(dateFieldsBounds({ kind: 'date', day: 1, month: 'VEND', year: 15, calendar: 'FRENCH_R' })).toBeUndefined();
  });
});

describe('dateBounds over DateValue variants', () => {
  test('BET combines the two spans', () => {
    const value: DateValue = {
      kind: 'range',
      start: { day: 1, month: 'JAN', year: 1900 },
      end: { day: 31, month: 'DEC', year: 1900 },
    };
    const span = dateBounds(value);
    expect(span.earliest).toEqual(utc(1900, 0, 1));
    expect(span.latest).toEqual(utc(1900, 11, 31));
  });

  test('BEF bounds only the late side', () => {
    const value: DateValue = { kind: 'bound', modifier: 'BEF', date: { day: 1, month: 'JAN', year: 1900 } };
    const span = dateBounds(value);
    expect(span.earliest).toBeUndefined();
    expect(span.latest).toEqual(utc(1900, 0, 1));
  });

  test('AFT bounds only the early side', () => {
    const value: DateValue = { kind: 'bound', modifier: 'AFT', date: { day: 1, month: 'JAN', year: 1900 } };
    expect(dateBounds(value).earliest).toEqual(utc(1900, 0, 1));
    expect(dateBounds(value).latest).toBeUndefined();
  });

  test('FROM/TO periods', () => {
    const value: DateValue = { kind: 'period', from: { day: 1, month: 'MAR', year: 1900 } };
    expect(dateBounds(value).earliest).toEqual(utc(1900, 2, 1));
    expect(dateBounds(value).latest).toBeUndefined();
  });

  test('the empty form is unbounded', () => {
    expect(dateBounds({ kind: 'unknown' })).toEqual({});
  });
});

describe('toJsDate and toJsDateTime', () => {
  test('an exact date converts', () => {
    const value: DateValue = { kind: 'date', day: 15, month: 'JUN', year: 1950 };
    expect(toJsDate(value)).toEqual(utc(1950, 5, 15));
  });

  test('a partial date does not convert', () => {
    expect(toJsDate({ kind: 'date', year: 1950 })).toBeUndefined();
    expect(toJsDate({ kind: 'unknown' })).toBeUndefined();
  });

  test('a date with a time keeps the day and adds the time', () => {
    const fields: DateFields = { day: 15, month: 'JUN', year: 1950 };
    const result = toJsDateTime(fields, { hour: 12, minute: 30, second: 5, fraction: '25' });
    expect(result?.toISOString()).toBe('1950-06-15T12:30:05.250Z');
  });
});

describe('convertCalendar', () => {
  test('Julian 20 December 1800 is Gregorian 1 January 1801', () => {
    expect(convertCalendar({ day: 20, month: 'DEC', year: 1800, calendar: 'JULIAN' }, 'GREGORIAN'))
      .toEqual({ day: 1, month: 'JAN', year: 1801 });
  });

  test('Gregorian 22 September 1792 is 1 Vendémiaire I', () => {
    expect(convertCalendar({ day: 22, month: 'SEP', year: 1792 }, 'FRENCH_R'))
      .toEqual({ calendar: 'FRENCH_R', day: 1, month: 'VEND', year: 1 });
  });

  test('Gregorian 3 October 2024 is 1 Tishri 5785', () => {
    expect(convertCalendar({ day: 3, month: 'OCT', year: 2024 }, 'HEBREW'))
      .toEqual({ calendar: 'HEBREW', day: 1, month: 'TSH', year: 5785 });
  });

  test('Gregorian 22 September 1792 is Julian 11 September 1792', () => {
    expect(convertCalendar({ day: 22, month: 'SEP', year: 1792 }, 'JULIAN'))
      .toEqual({ calendar: 'JULIAN', day: 11, month: 'SEP', year: 1792 });
  });

  test('the round trip through Julian returns the original Gregorian date', () => {
    const fields: DateFields = { day: 22, month: 'SEP', year: 1792 };
    expect(convertCalendar(convertCalendar(fields, 'JULIAN') as DateFields, 'GREGORIAN')).toEqual(fields);
  });

  test('a BCE date stays BCE in the target calendar (Gregorian 1 Mar 4 BCE = Julian 3 Mar 4 BCE)', () => {
    expect(convertCalendar({ day: 1, month: 'MAR', year: 4, epoch: 'BCE' }, 'JULIAN'))
      .toEqual({ calendar: 'JULIAN', day: 3, month: 'MAR', year: 4, epoch: 'BCE' });
    // Round trip back.
    expect(convertCalendar({ day: 3, month: 'MAR', year: 4, epoch: 'BCE', calendar: 'JULIAN' }, 'GREGORIAN'))
      .toEqual({ day: 1, month: 'MAR', year: 4, epoch: 'BCE' });
  });

  test('unrepresentable conversions are undefined', () => {
    expect(convertCalendar({ day: 1, month: 'VEND', year: 1, calendar: 'FRENCH_R' }, 'HEBREW')).toBeDefined();
    expect(convertCalendar({ year: 1800 }, 'JULIAN')).toBeUndefined();
    expect(convertCalendar({ day: 22, month: 'SEP', year: 1792 }, '@#DXXX@' as never)).toBeUndefined();
    // 1 Jan 1900 Gregorian maps to a French year after An XIV (1900 > 1806).
    expect(convertCalendar({ day: 1, month: 'JAN', year: 1900 }, 'FRENCH_R')).toBeUndefined();
  });
});
