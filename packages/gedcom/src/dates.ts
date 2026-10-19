/**
 * Calendar arithmetic for GEDCOM dates.
 *
 * Maps the parsed date forms (DateFields / DateValue) onto the
 * proleptic Gregorian timeline and converts dates between the four
 * GEDCOM 7.0 §6.1 calendars (GREGORIAN, JULIAN, FRENCH_R, HEBREW).
 * The pivot of every conversion is the Julian day number (JDN):
 *
 * - JDN ↔ Gregorian uses the standard Fliegel–Van Flandern formulas
 *   (valid for the whole proleptic Gregorian calendar);
 * - JDN ↔ Julian uses the classic civil formulas;
 * - the Hebrew calendar follows the fixed arithmetic calendar of
 *   Dershowitz & Reingold, "Calendrical Calculations" (the Hillel II
 *   postponement rules; epoch: 1 Tishri, year 1 = JDN 347998);
 * - the French Republican calendar is the historical one: it was in
 *   use for the years An I–An XIV (1792–1806), each year beginning at
 *   the Paris-meridian autumn equinox, with the leap years III, VII,
 *   and XI; dates outside that span are not converted (the spec does
 *   not define the calendar beyond it).
 *
 * GEDCOM years are 1-based with the BCE epoch for years before the
 * common era (GEDCOM 7.0 §2.4); the arithmetic uses astronomical year
 * numbering (year 0 = 1 BCE). Days are returned as JavaScript Dates at
 * UTC midnight so that calendar comparisons are not shifted by the
 * host time zone. All functions assume structurally valid input (the
 * parsers guarantee it); a date that cannot be represented in a
 * calendar (extension calendars or epochs, a Hebrew ADR month in a
 * common year, a French Republican year outside I–XIV) yields
 * `undefined` rather than a guess.
 */

import type {
  Calendar,
  DateFields,
  DateValue,
  Epoch,
  FrenchRepublicanMonth,
  GregorianMonth,
  HebrewMonth,
  Integer,
  TimeValue,
} from './primitives';

/** GEDCOM 7.0 §2.4 `month` order, January first. */
const GREGORIAN_ORDER: readonly GregorianMonth[] = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

/** GEDCOM 7.0 §6.1 FRENCH_R month order, Vendémiaire first, the complementary days last. */
const FRENCH_ORDER: readonly FrenchRepublicanMonth[] = [
  'VEND', 'BRUM', 'FRIM', 'NIVO', 'PLUV', 'VENT', 'GERM', 'FLOR', 'PRAI', 'MESS', 'THER', 'FRUC', 'COMP',
];

/** GEDCOM 7.0 §6.1 HEBREW month order, Tishri first: common years (no ADR). */
const HEBREW_COMMON_ORDER: readonly HebrewMonth[] = [
  'TSH', 'CSH', 'KSL', 'TVT', 'SHV', 'ADS', 'NSN', 'IYR', 'SVN', 'TMZ', 'AAV', 'ELL',
];

/** GEDCOM 7.0 §6.1 HEBREW month order, Tishri first: leap years (ADR then ADS). */
const HEBREW_LEAP_ORDER: readonly HebrewMonth[] = [
  'TSH', 'CSH', 'KSL', 'TVT', 'SHV', 'ADR', 'ADS', 'NSN', 'IYR', 'SVN', 'TMZ', 'AAV', 'ELL',
];

// ---------------------------------------------------------------------------
// JDN ↔ Gregorian (Fliegel–Van Flandern; proleptic, astronomical years)
// ---------------------------------------------------------------------------

/** The JDN of 1970-01-01, the JavaScript epoch day. */
const JDN_1970 = 2440588;

/** Converts a proleptic Gregorian date (astronomical year) to its JDN. */
function gregorianToJdn(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return day
    + Math.floor((153 * m + 2) / 5)
    + 365 * y
    + Math.floor(y / 4)
    - Math.floor(y / 100)
    + Math.floor(y / 400)
    - 32045;
}

/** Converts a JDN to a proleptic Gregorian date (astronomical year). */
function jdnToGregorian(jdn: number): { year: number; month: number; day: number } {
  const j = jdn + 32044;
  const g = Math.floor(j / 146097);
  const dg = j % 146097;
  const c = Math.floor((Math.floor(dg / 36524) + 1) * 3 / 4);
  const dc = dg - c * 36524;
  const b = Math.floor(dc / 1461);
  const db = dc % 1461;
  const a = Math.floor((Math.floor(db / 365) + 1) * 3 / 4);
  const da = db - a * 365;
  const y = g * 400 + c * 100 + b * 4 + a;
  const m = Math.floor((da * 5 + 308) / 153) - 2;
  const d = da - Math.floor((m + 4) * 153 / 5) + 122;
  return {
    year: y - 4800 + Math.floor((m + 2) / 12),
    month: ((m + 2) % 12) + 1,
    day: d + 1,
  };
}

// ---------------------------------------------------------------------------
// JDN ↔ Julian (astronomical years)
// ---------------------------------------------------------------------------

/** The JDN of 1 January, astronomical year 1, in the Julian calendar. */
const JULIAN_YEAR_ONE_JDN = 1721424;

/** Days from the epoch to the start of Julian year `year` (astronomical). */
function julianDaysBeforeYear(year: number): number {
  const y = year - 1;
  return 365 * y + Math.floor(y / 4);
}

/** Converts a Julian date (astronomical year) to its JDN. */
function julianToJdn(year: number, month: number, day: number): number {
  const lengths = [31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let days = day - 1;
  for (let m = 1; m < month; m += 1) {
    days += lengths[m - 1] as number;
  }
  return julianDaysBeforeYear(year) + days + JULIAN_YEAR_ONE_JDN;
}

/** Converts a JDN to a Julian date (astronomical year). */
function jdnToJulian(jdn: number): { year: number; month: number; day: number } {
  const relative = jdn - JULIAN_YEAR_ONE_JDN;
  const approx = Math.floor((4 * relative + 3) / 1461);
  const year = approx + (relative >= julianDaysBeforeYear(approx + 1) ? 1 : 0);
  const lengths = [31, year % 4 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let remaining = relative - julianDaysBeforeYear(year);
  let month = 1;
  for (const length of lengths) {
    if (remaining < length) {
      break;
    }
    remaining -= length;
    month += 1;
  }
  return { year, month, day: remaining + 1 };
}

// ---------------------------------------------------------------------------
// JDN ↔ Hebrew (fixed arithmetic calendar, Dershowitz & Reingold)
// ---------------------------------------------------------------------------

/** The JDN of 1 Tishri, Hebrew year 1. */
const HEBREW_EPOCH_JDN = 347998;

/** Days from the Hebrew epoch to the start of `year` (before the postponements). */
function hebrewElapsedDays(year: number): number {
  const months = Math.floor((235 * year - 234) / 19);
  const parts = 12084 + 13753 * months;
  let days = months * 29 + Math.floor(parts / 25920);
  if ((3 * (days + 1)) % 7 < 3) {
    days += 1;
  }
  return days;
}

/** The JDN-relative start of Hebrew `year`, with the Hillel II postponements. */
function hebrewNewYear(year: number): number {
  const elapsed = hebrewElapsedDays(year);
  const next = hebrewElapsedDays(year + 1);
  const after = hebrewElapsedDays(year + 2);
  if (next - elapsed === 356) {
    return elapsed + 2;
  }
  if (after - next === 382) {
    return elapsed + 1;
  }
  return elapsed;
}

/** Whether Hebrew `year` is a leap year (13 months, the ADR month present). */
function hebrewIsLeap(year: number): boolean {
  return (7 * year + 1) % 19 < 7;
}

/** The 1-based position of a GEDCOM Hebrew month within `year` (Tishri first). */
function hebrewMonthPosition(year: number, month: HebrewMonth): number | undefined {
  const order = hebrewIsLeap(year) ? HEBREW_LEAP_ORDER : HEBREW_COMMON_ORDER;
  const index = order.indexOf(month);
  return index === -1 ? undefined : index + 1;
}

/** The length in days of the 1-based (Tishri-first) month `position` of Hebrew `year`. */
function hebrewMonthLength(year: number, position: number): number {
  const yearLength = hebrewNewYear(year + 1) - hebrewNewYear(year);
  const longMarcheshvan = yearLength % 10 === 5;
  const shortKislev = yearLength % 10 === 3;
  const lengths = hebrewIsLeap(year)
    ? [30, longMarcheshvan ? 30 : 29, shortKislev ? 29 : 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29]
    : [30, longMarcheshvan ? 30 : 29, shortKislev ? 29 : 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
  return lengths[position - 1] as number;
}

/** Converts a Hebrew date (1-based Tishri-first month position) to its JDN. */
function hebrewToJdn(year: number, position: number, day: number): number {
  let jdn = HEBREW_EPOCH_JDN + hebrewNewYear(year);
  for (let m = 1; m < position; m += 1) {
    jdn += hebrewMonthLength(year, m);
  }
  return jdn + day - 1;
}

/** Converts a JDN to a Hebrew date (1-based Tishri-first month position). */
function jdnToHebrew(jdn: number): { year: number; position: number; day: number } {
  let year = Math.floor((jdn - HEBREW_EPOCH_JDN) / 365) + 1;
  while (HEBREW_EPOCH_JDN + hebrewNewYear(year + 1) <= jdn) {
    year += 1;
  }
  while (HEBREW_EPOCH_JDN + hebrewNewYear(year) > jdn) {
    year -= 1;
  }
  let remaining = jdn - (HEBREW_EPOCH_JDN + hebrewNewYear(year));
  let position = 1;
  while (remaining >= hebrewMonthLength(year, position)) {
    remaining -= hebrewMonthLength(year, position);
    position += 1;
  }
  return { year, position, day: remaining + 1 };
}

// ---------------------------------------------------------------------------
// JDN ↔ French Republican (the historical An I–An XIV)
// ---------------------------------------------------------------------------

/** The September start day of each French Republican year An I–An XIV (Paris equinox). */
const FRENCH_START_SEPTEMBER: readonly number[] = [
  22, 22, 22, 23, 22, 22, 22, 23, 23, 23, 23, 24, 23, 23,
];

/** The JDN of 1 Vendémiaire of French Republican `year`, or undefined outside I–XIV. */
function frenchYearStartJdn(year: number): number | undefined {
  if (year < 1 || year > FRENCH_START_SEPTEMBER.length) {
    return undefined;
  }
  return gregorianToJdn(1791 + year, 9, FRENCH_START_SEPTEMBER[year - 1] as number);
}

/** The length in days of French Republican `year` (leap years III, VII, XI). */
function frenchYearLength(year: number): number {
  return 360 + (year % 4 === 3 ? 6 : 5);
}

/** Converts a JDN to a French Republican date (0-based month index), I–XIV only. */
function jdnToFrench(jdn: number): { year: number; monthIndex: number; day: number } | undefined {
  for (let year = 1; year <= FRENCH_START_SEPTEMBER.length; year += 1) {
    const start = frenchYearStartJdn(year) as number;
    const length = frenchYearLength(year);
    if (jdn >= start && jdn < start + length) {
      const offset = jdn - start;
      if (offset < 360) {
        return { year, monthIndex: Math.floor(offset / 30), day: (offset % 30) + 1 };
      }
      return { year, monthIndex: 12, day: offset - 360 + 1 };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// GEDCOM forms ↔ bounds
// ---------------------------------------------------------------------------

/** The span of days a date value covers, as UTC-midnight Dates on the proleptic Gregorian timeline. */
export interface DateBounds {
  /** The earliest possible day, or undefined when unbounded in the past. */
  earliest?: Date;
  /** The latest possible day, or undefined when unbounded in the future. */
  latest?: Date;
}

/** The astronomical year of a GEDCOM year (year 0 = 1 BCE), or undefined for extension epochs. */
function astronomicalYear(year: Integer, epoch?: Epoch): number | undefined {
  if (epoch === undefined || epoch === 'BCE') {
    return epoch === 'BCE' ? 1 - year : year;
  }
  return undefined;
}

/** A {earliest, latest} bound pair from two JDN day numbers. */
function boundsOf(earliestJdn: number, latestJdn: number): DateBounds {
  return {
    earliest: new Date((earliestJdn - JDN_1970) * 86400000),
    latest: new Date((latestJdn - JDN_1970) * 86400000),
  };
}

/** The JDN of the last day of a Gregorian/Julian `monthNumber` in astronomical `year`. */
function solarMonthLength(year: number, monthNumber: number, julian: boolean): number {
  if (monthNumber === 2) {
    return (julian ? year % 4 === 0 : (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 29 : 28;
  }
  return monthNumber <= 7 ? 30 + (monthNumber % 2) : 31 - (monthNumber % 2);
}

/**
 * The span of days that `fields` covers on the proleptic Gregorian
 * timeline. Partial precision widens the span: a month without a day
 * covers the whole month, a year alone the whole year. Returns
 * `undefined` when the fields cannot be placed in their calendar
 * (extension calendars or epochs, a Hebrew ADR month in a common year,
 * a French Republican year outside An I–XIV, or fields invalid for the
 * calendar).
 */
export function dateFieldsBounds(fields: DateFields): DateBounds | undefined {
  const calendar = fields.calendar ?? 'GREGORIAN';
  const year = astronomicalYear(fields.year, fields.epoch);
  if (year === undefined) {
    return undefined;
  }
  if (calendar === 'FRENCH_R') {
    if (year < 1 || year > FRENCH_START_SEPTEMBER.length) {
      return undefined;
    }
    const start = frenchYearStartJdn(year) as number;
    if (fields.month === undefined) {
      return boundsOf(start, start + frenchYearLength(year) - 1);
    }
    const monthIndex = FRENCH_ORDER.indexOf(fields.month as FrenchRepublicanMonth);
    if (monthIndex === -1) {
      return undefined;
    }
    const monthLength = monthIndex === 12 ? frenchYearLength(year) - 360 : 30;
    const first = start + monthIndex * 30;
    if (fields.day === undefined) {
      return boundsOf(first, first + monthLength - 1);
    }
    if (fields.day < 1 || fields.day > monthLength) {
      return undefined;
    }
    return boundsOf(first + fields.day - 1, first + fields.day - 1);
  }
  if (calendar === 'HEBREW') {
    if (fields.month === undefined) {
      const start = HEBREW_EPOCH_JDN + hebrewNewYear(year);
      return boundsOf(start, HEBREW_EPOCH_JDN + hebrewNewYear(year + 1) - 1);
    }
    const position = hebrewMonthPosition(year, fields.month as HebrewMonth);
    if (position === undefined) {
      return undefined;
    }
    const first = hebrewToJdn(year, position, 1);
    const monthLength = hebrewMonthLength(year, position);
    if (fields.day === undefined) {
      return boundsOf(first, first + monthLength - 1);
    }
    if (fields.day < 1 || fields.day > monthLength) {
      return undefined;
    }
    return boundsOf(first + fields.day - 1, first + fields.day - 1);
  }
  if (calendar !== 'GREGORIAN' && calendar !== 'JULIAN') {
    return undefined;
  }
  const julian = calendar === 'JULIAN';
  if (fields.month === undefined) {
    const first = julian ? julianToJdn(year, 1, 1) : gregorianToJdn(year, 1, 1);
    const last = julian ? julianToJdn(year, 12, 31) : gregorianToJdn(year, 12, 31);
    return boundsOf(first, last);
  }
  const monthNumber = GREGORIAN_ORDER.indexOf(fields.month as GregorianMonth) + 1;
  if (monthNumber === 0) {
    return undefined;
  }
  const first = julian ? julianToJdn(year, monthNumber, 1) : gregorianToJdn(year, monthNumber, 1);
  const monthLength = solarMonthLength(year, monthNumber, julian);
  if (fields.day === undefined) {
    return boundsOf(first, first + monthLength - 1);
  }
  if (fields.day < 1 || fields.day > monthLength) {
    return undefined;
  }
  return boundsOf(first + fields.day - 1, first + fields.day - 1);
}

/**
 * The span of days a whole DateValue covers: a plain date covers its
 * own (possibly partial) span, BET/AND and FROM/TO combine the
 * boundary spans, BEF/AFT bound one side, ABT/CAL/EST keep the
 * nominal date, and the empty form is unbounded.
 */
export function dateBounds(value: DateValue): DateBounds {
  switch (value.kind) {
    case 'date':
      return dateFieldsBounds(value) ?? {};
    case 'range': {
      const out: DateBounds = {};
      const start = dateFieldsBounds(value.start);
      const end = dateFieldsBounds(value.end);
      if (start?.earliest !== undefined) {
        out.earliest = start.earliest;
      }
      if (end?.latest !== undefined) {
        out.latest = end.latest;
      }
      return out;
    }
    case 'bound': {
      const out: DateBounds = {};
      const bound = dateFieldsBounds(value.date);
      if (value.modifier === 'BEF' && bound?.latest !== undefined) {
        out.latest = bound.latest;
      } else if (value.modifier === 'AFT' && bound?.earliest !== undefined) {
        out.earliest = bound.earliest;
      }
      return out;
    }
    case 'approx':
      return dateFieldsBounds(value.date) ?? {};
    case 'period': {
      const out: DateBounds = {};
      if (value.from !== undefined) {
        const from = dateFieldsBounds(value.from);
        if (from?.earliest !== undefined) {
          out.earliest = from.earliest;
        }
      }
      if (value.to !== undefined) {
        const to = dateFieldsBounds(value.to);
        if (to?.latest !== undefined) {
          out.latest = to.latest;
        }
      }
      return out;
    }
    case 'unknown':
      return {};
  }
}

/**
 * The exact day of `value` as a Date at UTC midnight, or `undefined`
 * when the value does not determine a single day (partial precision,
 * ranges, bounds, phrases, or unrepresentable calendars).
 */
export function toJsDate(value: DateValue): Date | undefined {
  const span = dateBounds(value);
  if (span.earliest === undefined || span.latest === undefined) {
    return undefined;
  }
  if (span.earliest.getTime() !== span.latest.getTime()) {
    return undefined;
  }
  return span.earliest;
}

/**
 * A date-and-time instant as a Date, or `undefined` when `fields` does
 * not determine a single day. The time is placed on that day; the
 * GEDCOM 7.0 §2.5 UTC flag does not change the result (the arithmetic
 * is UTC throughout).
 */
export function toJsDateTime(fields: DateFields, time?: TimeValue): Date | undefined {
  const span = dateFieldsBounds(fields);
  if (span === undefined || span.earliest === undefined || span.latest === undefined) {
    return undefined;
  }
  if (span.earliest.getTime() !== span.latest.getTime()) {
    return undefined;
  }
  const result = span.earliest;
  if (time !== undefined) {
    const milliseconds = time.fraction === undefined ? 0 : Math.round(Number(`0.${time.fraction}`) * 1000);
    result.setUTCHours(time.hour, time.minute, time.second ?? 0, milliseconds);
  }
  return result;
}

/** The GEDCOM year (with the BCE epoch when needed) of an astronomical year. */
function gedcomYear(astronomical: number): { year: Integer; epoch?: Epoch } {
  if (astronomical <= 0) {
    return { year: (1 - astronomical) as Integer, epoch: 'BCE' };
  }
  return { year: astronomical as Integer };
}

/** Decomposes a JDN into the target calendar's fields. */
function jdnToFields(jdn: number, target: Calendar): DateFields | undefined {
  if (target === 'GREGORIAN' || target === 'JULIAN') {
    const date = target === 'GREGORIAN' ? jdnToGregorian(jdn) : jdnToJulian(jdn);
    const year = gedcomYear(date.year);
    const month = GREGORIAN_ORDER[date.month - 1] as GregorianMonth;
    const day = date.day as Integer;
    return target === 'JULIAN' ? { ...year, calendar: 'JULIAN', month, day } : { ...year, month, day };
  }
  if (target === 'FRENCH_R') {
    const french = jdnToFrench(jdn);
    if (french === undefined) {
      return undefined;
    }
    return {
      calendar: 'FRENCH_R',
      year: french.year as Integer,
      month: FRENCH_ORDER[french.monthIndex] as FrenchRepublicanMonth,
      day: french.day as Integer,
    };
  }
  if (target === 'HEBREW') {
    const hebrew = jdnToHebrew(jdn);
    if (hebrew === undefined || hebrew.year < 1) {
      return undefined;
    }
    const order = hebrewIsLeap(hebrew.year) ? HEBREW_LEAP_ORDER : HEBREW_COMMON_ORDER;
    return {
      calendar: 'HEBREW',
      year: hebrew.year as Integer,
      month: order[hebrew.position - 1] as HebrewMonth,
      day: hebrew.day as Integer,
    };
  }
  return undefined;
}

/**
 * The same day expressed in another calendar, or `undefined` when the
 * conversion is impossible (extension calendars or epochs, a date that
 * is not a single exact day, a French Republican result outside An
 * I–XIV, or a Hebrew result before year 1). The source fields are not
 * validated here: an invalid date yields `undefined`.
 */
export function convertCalendar(fields: DateFields, target: Calendar): DateFields | undefined {
  if (fields.day === undefined || fields.month === undefined) {
    return undefined;
  }
  const span = dateFieldsBounds(fields);
  if (span === undefined || span.earliest === undefined || span.latest === undefined) {
    return undefined;
  }
  if (span.earliest.getTime() !== span.latest.getTime()) {
    return undefined;
  }
  return jdnToFields(span.earliest.getTime() / 86400000 + JDN_1970, target);
}
