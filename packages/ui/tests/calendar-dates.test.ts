import { afterEach, describe, expect, it } from 'vitest';
import { setSystemLocale } from '@doru/platform';
import {
  addLocalDays,
  addLocalMonths,
  firstDayOfWeek,
  inputToTimestamp,
  localDay,
  localDayKey,
  monthGrid,
  replaceInputDay,
  systemFirstDayOfWeek,
  timestampToInput,
  weekdayNames,
} from '../src/lib/datetime';

afterEach(() => {
  setSystemLocale(undefined);
});

describe('local date-time helpers', () => {
  it('round-trips datetime-local values and rejects invalid dates', () => {
    const instant = new Date(2026, 10, 22, 18, 30).getTime();
    expect(timestampToInput(instant)).toBe('2026-11-22T18:30');
    expect(inputToTimestamp('2026-11-22T18:30')).toBe(instant);
    expect(inputToTimestamp('2026-02-30T18:30')).toBeUndefined();
    expect(inputToTimestamp('')).toBeUndefined();
  });

  it('replaces the day and keeps the existing time', () => {
    expect(replaceInputDay('2026-11-22T18:30', new Date(2026, 11, 3))).toBe('2026-12-03T18:30');
    expect(replaceInputDay('2026-11-22T18:30:45', new Date(2026, 11, 3))).toBe('2026-12-03T18:30:45');
    expect(replaceInputDay('', new Date(2026, 11, 3))).toBe('2026-12-03T09:00');
  });

  it('keeps a nonexistent daylight-saving time for validation', () => {
    const previous = process.env['TZ'];
    process.env['TZ'] = 'America/New_York';
    try {
      expect(replaceInputDay('2017-03-11T02:30', new Date(2017, 2, 12))).toBe('2017-03-12T02:30');
      expect(inputToTimestamp('2017-03-12T02:30')).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env['TZ'];
      } else {
        process.env['TZ'] = previous;
      }
    }
  });

  it('moves days and months across month and year boundaries', () => {
    expect(localDayKey(addLocalDays(localDay(2026, 11, 31), 1))).toBe('2027-01-01');
    expect(localDayKey(addLocalMonths(localDay(2026, 0, 31), 1))).toBe('2026-02-28');
    expect(localDayKey(addLocalMonths(localDay(2026, 0, 15), -2))).toBe('2025-11-15');
  });

  it('builds a six-week grid that starts on the locale week day', () => {
    const mondayGrid = monthGrid(2026, 10, 1);
    expect(mondayGrid).toHaveLength(42);
    expect(localDayKey(mondayGrid[0]!)).toBe('2026-10-26');

    const sundayGrid = monthGrid(2026, 10, 7);
    expect(localDayKey(sundayGrid[0]!)).toBe('2026-11-01');
  });

  it('uses the locale first weekday and localized weekday names', () => {
    expect(firstDayOfWeek('ru')).toBe(1);
    expect(firstDayOfWeek('en')).toBe(7);
    expect(weekdayNames('en', 1)[0]).toBe('Mon');
    expect(weekdayNames('en', 7)[0]).toBe('Sun');
  });

  it('takes the week start from the operating-system locale', () => {
    setSystemLocale('en-US@rg=ruzzzz');
    expect(systemFirstDayOfWeek('en')).toBe(1);

    setSystemLocale('en-US');
    expect(systemFirstDayOfWeek('ru')).toBe(7);

    setSystemLocale(undefined);
    expect(systemFirstDayOfWeek('ru')).toBe(1);
  });
});
