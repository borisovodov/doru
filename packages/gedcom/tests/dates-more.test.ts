import { describe, expect, test } from 'vitest';
import { convertCalendar, dateBounds, dateFieldsBounds, toJsDateTime } from '../src/dates';
import type { DateFields } from '../src/primitives';

const utc = (year: number, monthIndex: number, day: number): Date =>
  new Date(Date.UTC(year, monthIndex, day));

describe('date edge cases', () => {
  test('a year-less Gregorian date is unbounded', () => {
    expect(dateFieldsBounds({ kind: 'date', day: 1, month: 'JAN' })).toBeUndefined();
  });

  test('an unknown month spelling is unbounded', () => {
    expect(dateFieldsBounds({ kind: 'date', day: 1, month: 'XXX' as never, year: 1900 })).toBeUndefined();
  });

  test('an approx without a date is unbounded', () => {
    expect(dateBounds({ kind: 'approx' })).toEqual({});
  });

  test('a TO period bounds only the late side', () => {
    const span = dateBounds({ kind: 'period', to: { day: 31, month: 'DEC', year: 1900 } });
    expect(span.earliest).toBeUndefined();
    expect(span.latest).toEqual(utc(1900, 11, 31));
  });

  test('toJsDateTime rejects non-exact spans', () => {
    expect(toJsDateTime({ day: 15, month: 'JUN', year: 1950 })).toBeDefined();
    expect(toJsDateTime({ month: 'JUN', year: 1950 })).toBeUndefined();
    expect(toJsDateTime({ day: 1, month: 'VEND', year: 1, calendar: 'FRENCH_R' })).toBeDefined();
  });

  test('convertCalendar rejects non-exact spans and same-calendar conversion', () => {
    expect(convertCalendar({ year: 1800 }, 'JULIAN')).toBeUndefined();
    expect(convertCalendar({ day: 1, month: 'JAN', year: 1800 }, 'GREGORIAN')).toEqual({
      day: 1,
      month: 'JAN',
      year: 1800,
    });
  });

  test('convertCalendar to the French calendar for representable and late years', () => {
    const fields: DateFields = { day: 22, month: 'SEP', year: 1792 };
    expect(convertCalendar(fields, 'FRENCH_R')).toEqual({ calendar: 'FRENCH_R', day: 1, month: 'VEND', year: 1 });
    // An XIII spans 1804–1805.
    expect(convertCalendar({ day: 1, month: 'OCT', year: 1804 }, 'FRENCH_R')).toMatchObject({
      calendar: 'FRENCH_R',
      year: 13,
    });
  });

  test('convertCalendar to the Hebrew calendar across years', () => {
    expect(convertCalendar({ day: 3, month: 'OCT', year: 2024 }, 'HEBREW')).toEqual({
      calendar: 'HEBREW',
      day: 1,
      month: 'TSH',
      year: 5785,
    });
    // A mid-year Hebrew conversion exercises the year-adjustment loops.
    const converted = convertCalendar({ day: 10, month: 'APR', year: 2024 }, 'HEBREW');
    expect(converted?.calendar).toBe('HEBREW');
    expect(converted?.year).toBe(5784);
  });
});
