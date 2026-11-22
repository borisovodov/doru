/**
 * Local date-time helpers shared by form controls.
 *
 * The values handled here are the strings a `datetime-local` input uses
 * (`2026-11-22T18:30`) and epoch-millisecond instants. Everything stays in
 * the user's local time zone: Dóru stores task instants as epoch milliseconds
 * and shows them as local wall-clock values.
 */

import { getSystemLocale, normalizeSystemLocale } from '@doru/platform';

/** Converts an epoch-ms instant to the local value a `datetime-local` input expects. */
export function timestampToInput(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  if (year < 0 || year > 9999) {
    return '';
  }
  const pad = (part: number, size = 2): string => String(part).padStart(size, '0');
  return `${pad(year, 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Parses a `datetime-local` value as a local instant; invalid values mean "not set". */
export function inputToTimestamp(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (match === null) {
    return undefined;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] !== undefined ? Number(match[6]) : 0;
  // Years 0-99 must not turn into 1900-1999 in the Date constructor.
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(hour, minute, second, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return undefined;
  }
  return date.getTime();
}

/**
 * A calendar day at local noon. Noon keeps a daylight-saving transition at
 * midnight from silently shifting the day during date arithmetic.
 */
export function localDay(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

/** A stable local `YYYY-MM-DD` key for a calendar day. */
export function localDayKey(day: Date): string {
  const pad = (part: number, size = 2): string => String(part).padStart(size, '0');
  return `${pad(day.getFullYear(), 4)}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function sameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** The time of an input value, or 09:00 when the field is empty. */
export function timeOfInput(value: string): { hours: number; minutes: number } {
  const instant = inputToTimestamp(value);
  if (instant === undefined) {
    return { hours: 9, minutes: 0 };
  }
  const date = new Date(instant);
  return { hours: date.getHours(), minutes: date.getMinutes() };
}

/**
 * Replaces the day of a `datetime-local` value, keeping its time.
 * The string is composed directly instead of passing through `Date`, whose
 * daylight-saving normalization would silently turn a nonexistent 02:30 into
 * 03:30. The caller validates the resulting value and can reject it.
 */
export function replaceInputDay(value: string, day: Date): string {
  const time = timeOfInput(value);
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${localDayKey(day)}T${pad(time.hours)}:${pad(time.minutes)}`;
}

/** Adds calendar days without leaving local noon. */
export function addLocalDays(day: Date, amount: number): Date {
  return localDay(day.getFullYear(), day.getMonth(), day.getDate() + amount);
}

/** The number of days in a month; `month` may carry a year overflow. */
export function daysInMonth(year: number, month: number): number {
  return localDay(year, month + 1, 0).getDate();
}

/** Moves a day by months, clamping the day number to the target month. */
export function addLocalMonths(day: Date, amount: number): Date {
  const target = localDay(day.getFullYear(), day.getMonth() + amount, 1);
  const date = Math.min(day.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return localDay(target.getFullYear(), target.getMonth(), date);
}

/** The locale's first day of the week as an `Intl` value (1 = Monday, 7 = Sunday). */
export function firstDayOfWeek(locale: string): number {
  try {
    const resolved = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay?: number };
    };
    const firstDay = resolved.getWeekInfo?.().firstDay;
    if (firstDay !== undefined && firstDay >= 1 && firstDay <= 7) {
      return firstDay;
    }
  } catch {
    // Older engines without Intl.Locale week info fall back to Monday.
  }
  return 1;
}

/**
 * The first day of the week from the operating system's regional settings,
 * falling back to the UI locale when the main process has not supplied one
 * (the component gallery and unit tests run without Electron).
 */
export function systemFirstDayOfWeek(fallbackLocale: string): number {
  const systemLocale = getSystemLocale();
  return firstDayOfWeek(systemLocale === undefined ? fallbackLocale : normalizeSystemLocale(systemLocale));
}

/** The locale's weekday names, starting at the locale's first day of the week. */
export function weekdayNames(locale: string, firstDay: number): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  // 5 January 2020 was a Sunday; adding the JS day index yields the right day.
  return Array.from({ length: 7 }, (_, index) => {
    const jsDay = ((firstDay % 7) + index) % 7;
    return formatter.format(localDay(2020, 0, 5 + jsDay));
  });
}

/** The 42 days (six weeks) of a month grid, including neighbouring days. */
export function monthGrid(year: number, month: number, firstDay: number): Date[] {
  const first = localDay(year, month, 1);
  const offset = (first.getDay() - (firstDay % 7) + 7) % 7;
  const start = localDay(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, index) => addLocalDays(start, index));
}
