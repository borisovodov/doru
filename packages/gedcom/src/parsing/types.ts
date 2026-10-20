/**
 * Strict parsers for the GEDCOM payload data types (chapter 2 of both
 * specifications). Each parser accepts the version's lexical form and
 * produces the model value; every deviation is a typed error.
 */

import type {
  SourcePosition,
} from '../errors';
import {
  fail,
} from '../errors';
import type {
  AgeBound,
  AgeValue,
  Calendar,
  DateApprox,
  DateBound,
  DateExact,
  DateFields,
  DatePeriodValue,
  DateRange,
  DateValue,
  EmptyDateValue,
  Epoch,
  ExtensionTag,
  GedcomMonth,
  GedcomVersion,
  GregorianMonth,
  Latitude,
  ListText,
  Longitude,
  PersonalName,
  PlainDate,
  TagDefinitionValue,
  TimeValue,
} from '../primitives';
import {
  FRENCH_REPUBLICAN_MONTHS,
  GREGORIAN_MONTHS,
  HEBREW_MONTHS,
  LANGUAGE_IDS_551,
  MULTIMEDIA_FORMATS_551,
  MULTIMEDIA_FORMATS_555,
} from '../primitives';

const CALENDAR_NAMES: ReadonlyMap<string, Calendar> = new Map([
  ['GREGORIAN', 'GREGORIAN'],
  ['JULIAN', 'JULIAN'],
  ['FRENCH_R', 'FRENCH_R'],
  ['HEBREW', 'HEBREW'],
]);

/** 5.5.1 calendar escapes (@#D…@) and the calendars they select. */
const CALENDAR_ESCAPES_551: ReadonlyMap<string, Calendar> = new Map([
  ['@#DGREGORIAN@', 'GREGORIAN'],
  ['@#DJULIAN@', 'JULIAN'],
  ['@#DFRENCH R@', 'FRENCH_R'],
  ['@#DHEBREW@', 'HEBREW'],
]);

/** Month tags valid in each standard calendar. */
function monthTable(calendar: Calendar): Readonly<Record<string, string>> | null {
  if (calendar === 'GREGORIAN' || calendar === 'JULIAN') {
    return GREGORIAN_MONTHS;
  }
  if (calendar === 'FRENCH_R') {
    return FRENCH_REPUBLICAN_MONTHS;
  }
  if (calendar === 'HEBREW') {
    return HEBREW_MONTHS;
  }
  return null;
}

/**
 * Validates a month token for the calendar (case-sensitive for 7.0,
 * case-insensitive for 5.5.1) and returns the canonical tag.
 */
function monthOf(calendar: Calendar, token: string, version: GedcomVersion, position: SourcePosition): GedcomMonth {
  if (calendar === 'GREGORIAN' || calendar === 'JULIAN' || calendar === 'FRENCH_R' || calendar === 'HEBREW') {
    const table = monthTable(calendar) as Readonly<Record<string, string>>;
    if (version === '7.0') {
      if (token in table) {
        return token as GedcomMonth;
      }
    } else {
      const key = Object.keys(table).find((month) => month.toLowerCase() === token.toLowerCase());
      if (key !== undefined) {
        return key as GedcomMonth;
      }
    }
  } else if (token.startsWith('_')) {
    // Extension months require an extension calendar.
    return token as GedcomMonth;
  }
  fail(
    'date.bad-month',
    `"${token}" is not a month of the ${calendar} calendar`,
    position,
  );
}

/** Validates an epoch token for the calendar. */
function epochOf(calendar: Calendar, token: string, version: GedcomVersion, position: SourcePosition): Epoch {
  if (token === 'BCE') {
    if (calendar === 'GREGORIAN' || calendar === 'JULIAN') {
      return 'BCE';
    }
    fail('date.bad-epoch', `The BCE epoch is not permitted in the ${calendar} calendar`, position);
  }
  if (token.startsWith('_')) {
    if (!calendar.startsWith('_')) {
      fail('date.bad-epoch', 'Extension epochs require an extension calendar', position);
    }
    return token as Epoch;
  }
  if (version !== '7.0' && token.toUpperCase() === 'B.C.') {
    // Handled by the 5.5.1/5.5.5 date parser; defensive only.
    return 'BCE';
  }
  fail('date.bad-epoch', `Unknown epoch marker "${token}"`, position);
}

/** The astronomical year of a BCE year (1 BCE is year 0). */
function astronomicalYear(year: number, epoch: Epoch | undefined): number {
  return epoch === 'BCE' ? 1 - year : year;
}

/** Validates the day against the calendar and month. */
function checkDay(calendar: Calendar, month: GedcomMonth | undefined, day: number, year: number, epoch: Epoch | undefined, position: SourcePosition): void {
  if (!Number.isInteger(day) || day < 1) {
    fail('date.bad-day', `Invalid day ${day}`, position);
  }
  let max: number;
  if (calendar === 'GREGORIAN' || calendar === 'JULIAN') {
    const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const index = monthNames.indexOf(month as string);
    if (index === -1) {
      fail('date.bad-month', 'A day requires a month of the calendar', position);
    }
    max = monthLengths[index] as number;
    if (month === 'FEB') {
      const astro = astronomicalYear(year, epoch);
      const leap = calendar === 'JULIAN' ? astro % 4 === 0 : astro % 4 === 0 && (astro % 100 !== 0 || astro % 400 === 0);
      max = leap ? 29 : 28;
    }
  } else if (calendar === 'FRENCH_R') {
    max = month === 'COMP' ? 6 : 30;
  } else if (calendar === 'HEBREW') {
    max = 30;
  } else {
    // Extension calendars define their own month lengths; the largest
    // known maximum is 36 (GEDCOM 7.0 §2.4).
    max = 36;
  }
  if (day > max) {
    fail('date.bad-day', `Day ${day} exceeds the maximum of ${max} for ${month ?? 'this month'} in the ${calendar} calendar`, position);
  }
}

/** The maximum day of each Gregorian month; FEB is 29 because the
 * year-less GEDCOM 5.5.5 date form has no year to decide the leap. */
const GREGORIAN_DAY_MAX: Readonly<Record<GregorianMonth, number>> = {
  JAN: 31, FEB: 29, MAR: 31, APR: 30, MAY: 31, JUN: 30,
  JUL: 31, AUG: 31, SEP: 30, OCT: 31, NOV: 30, DEC: 31,
};

/** Converts a validated digit token to a number, rejecting values Number cannot hold exactly. */
function safeInteger(token: string, position: SourcePosition, code: 'date.bad-year' | 'integer.out-of-range'): number {
  const value = Number(token);
  if (!Number.isSafeInteger(value)) {
    fail(code, `The integer "${token}" is beyond the exactly representable range`, position);
  }
  return value;
}

/** Parses a bare year token (digits). */
function parseYear(token: string, position: SourcePosition): number {
  if (!/^\d+$/.test(token)) {
    fail('date.bad-year', `Invalid year "${token}"`, position);
  }
  return safeInteger(token, position, 'date.bad-year');
}

/** Builds a DateFields object, keeping absent components unset. */
function makeFields(
  calendar: Calendar,
  year: number | undefined,
  day: number | undefined,
  month: GedcomMonth | undefined,
  epoch: Epoch | undefined,
): DateFields {
  const fields: DateFields = { calendar, ...(year === undefined ? {} : { year }) };
  if (day !== undefined) {
    fields.day = day;
  }
  if (month !== undefined) {
    fields.month = month;
  }
  if (epoch !== undefined) {
    fields.epoch = epoch;
  }
  return fields;
}

/** Parses the `[calendar] [[day] month] year [epoch]` production. */
function parseDateFields(tokens: string[], calendar: Calendar, version: '7.0' | '5.5.1', position: SourcePosition): DateFields {
  let rest = tokens;
  if (rest.length === 0) {
    fail('date.invalid', 'A date must have a year', position);
  }
  let epoch: Epoch | undefined;
  const last = rest[rest.length - 1] as string;
  const lastUpper = last.toUpperCase();
  if (version === '7.0' && lastUpper === 'BCE') {
    if (calendar !== 'GREGORIAN' && calendar !== 'JULIAN') {
      fail('date.bad-epoch', `The BCE epoch is not permitted in the ${calendar} calendar`, position);
    }
    epoch = 'BCE';
    rest = rest.slice(0, -1);
  } else if (version === '7.0' && last.startsWith('_')) {
    epoch = epochOf(calendar, last, version, position);
    rest = rest.slice(0, -1);
  } else if (version === '5.5.1' && lastUpper === 'B.C.') {
    // GEDCOM 5.5.1 DATE_GREG permits [B.C.] only on the year-only form.
    if (rest.length !== 1) {
      fail('date.bad-epoch', 'The B.C. suffix is only permitted on a year-only date', position);
    }
    epoch = 'BCE';
    rest = rest.slice(0, -1);
  }
  if (rest.length === 0) {
    fail('date.invalid', 'A date must have a year', position);
  }

  // One token: a year. Two tokens: month year. Three: day month year.
  let year: number;
  let month: GedcomMonth | undefined;
  let day: number | undefined;
  if (rest.length === 1) {
    year = parseYear(rest[0] as string, position);
  } else if (rest.length === 2) {
    month = monthOf(calendar, rest[0] as string, version, position);
    year = parseYear(rest[1] as string, position);
  } else if (rest.length === 3) {
    if (!/^\d+$/.test(rest[0] as string)) {
      fail('date.bad-day', `Invalid day "${rest[0]}"`, position);
    }
    day = Number(rest[0]);
    month = monthOf(calendar, rest[1] as string, version, position);
    year = parseYear(rest[2] as string, position);
    checkDay(calendar, month, day, year, epoch, position);
  } else {
    fail('date.invalid', `Too many date components: "${rest.join(' ')}"`, position);
  }
  return makeFields(calendar, year, day, month, epoch);
}

/**
 * Parses a GEDCOM 7.0 DateValue (the whole payload). The empty payload
 * yields the `unknown` variant.
 */
export function parseDateValue70(text: string, position: SourcePosition): DateValue {
  if (text.trim() === '') {
    return { kind: 'unknown' } satisfies EmptyDateValue;
  }
  const tokens = text.trim().split(/ +/);
  const first = tokens[0] as string;
  const firstUpper = first.toUpperCase();
  if (firstUpper === 'FROM' || firstUpper === 'TO') {
    return parsePeriod70(tokens, position);
  }
  if (firstUpper === 'BET') {
    return parseRange70(tokens, position);
  }
  if (firstUpper === 'AFT' || firstUpper === 'BEF') {
    const date = parseDate70(tokens.slice(1), position);
    return { kind: 'bound', modifier: firstUpper as 'AFT' | 'BEF', date } satisfies DateBound;
  }
  if (firstUpper === 'ABT' || firstUpper === 'CAL' || firstUpper === 'EST') {
    const date = parseDate70(tokens.slice(1), position);
    return { kind: 'approx', modifier: firstUpper as 'ABT' | 'CAL' | 'EST', date } satisfies DateApprox;
  }
  return parseDate70(tokens, position);
}

/** Parses the plain `date` production of GEDCOM 7.0. */
export function parseDate70(tokens: string[], position: SourcePosition): PlainDate {
  if (tokens.length === 0) {
    fail('date.invalid', 'A date must have a year', position);
  }
  let calendar: Calendar = 'GREGORIAN';
  let rest = tokens;
  const first = tokens[0] as string;
  if (CALENDAR_NAMES.has(first)) {
    calendar = CALENDAR_NAMES.get(first) as Calendar;
    rest = tokens.slice(1);
  } else if (first.startsWith('_')) {
    calendar = first as Calendar;
    rest = tokens.slice(1);
  }
  const fields = parseDateFields(rest, calendar, '7.0', position);
  return { kind: 'date', ...fields };
}

/** Parses `FROM date [TO date]` / `TO date` of GEDCOM 7.0. */
function parsePeriod70(tokens: string[], position: SourcePosition): DatePeriodValue {
  const first = (tokens[0] as string).toUpperCase();
  if (first === 'TO') {
    return { kind: 'period', to: parseDate70(tokens.slice(1), position) };
  }
  const toIndex = tokens.findIndex((token) => token.toUpperCase() === 'TO');
  if (toIndex === -1) {
    return { kind: 'period', from: parseDate70(tokens.slice(1), position) };
  }
  const from = parseDate70(tokens.slice(1, toIndex), position);
  const to = parseDate70(tokens.slice(toIndex + 1), position);
  return { kind: 'period', from, to };
}

/** Parses `BET date AND date` of GEDCOM 7.0. */
function parseRange70(tokens: string[], position: SourcePosition): DateRange {
  const andIndex = tokens.findIndex((token) => token.toUpperCase() === 'AND');
  if (andIndex === -1) {
    fail('date.invalid', 'A BET date must contain AND: "BET <date> AND <date>"', position);
  }
  const start = parseDate70(tokens.slice(1, andIndex), position);
  const end = parseDate70(tokens.slice(andIndex + 1), position);
  return { kind: 'range', start, end };
}

/**
 * Parses a GEDCOM 7.0 DatePeriod (used by NO.DATE and DATA.DATE); the
 * empty payload is permitted.
 */
export function parseDatePeriod70(text: string, position: SourcePosition): DatePeriodValue {
  if (text.trim() === '') {
    return { kind: 'period' };
  }
  const tokens = text.trim().split(/ +/);
  const first = (tokens[0] as string).toUpperCase();
  if (first === 'FROM' || first === 'TO') {
    return parsePeriod70(tokens, position);
  }
  fail('date.invalid', `Invalid date period "${text}"; expected FROM/TO`, position);
}

/** Parses a GEDCOM 7.0 DateExact (`day month year`, Gregorian). */
export function parseDateExact70(text: string, position: SourcePosition): DateExact {
  const tokens = text.trim().split(/ +/);
  if (tokens.length !== 3) {
    fail('date.invalid', `Invalid DateExact "${text}"; expected "<day> <month> <year>"`, position);
  }
  if (!/^\d+$/.test(tokens[0] as string)) {
    fail('date.bad-day', `Invalid day "${tokens[0]}"`, position);
  }
  const day = Number(tokens[0]);
  const month = monthOf('GREGORIAN', tokens[1] as string, '7.0', position);
  const year = parseYear(tokens[2] as string, position);
  checkDay('GREGORIAN', month, day, year, undefined, position);
  return { day, month: month as 'JAN' | 'FEB' | 'MAR' | 'APR' | 'MAY' | 'JUN' | 'JUL' | 'AUG' | 'SEP' | 'OCT' | 'NOV' | 'DEC', year };
}

/**
 * Parses a GEDCOM 5.5.1 DateValue, including calendar escapes, the B.C.
 * suffix, dual years, the INT prefix and parenthesized phrases. Returns
 * the value plus the flags the assembler needs: whether the year had the
 * dual form (the raw text goes to a PHRASE) and whether an INT/plain
 * phrase was present.
 */
export function parseDateValue551(
  text: string,
  position: SourcePosition,
): { value: DateValue; dualYear: boolean; phrase?: string } {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { value: { kind: 'unknown' }, dualYear: false };
  }

  // Phrase-only form: "(<DATE_PHRASE>)".
  if (trimmed.startsWith('(') && trimmed.endsWith(')') && !trimmed.slice(1, -1).includes('(')) {
    return { value: { kind: 'unknown' }, dualYear: false, phrase: trimmed.slice(1, -1) };
  }

  // INT form: "INT <date> (<phrase>)".
  const intMatch = /^INT (.*)\(([^()]*)\)$/.exec(trimmed);
  if (intMatch) {
    const inner = parseDate551Body(intMatch[1] as string, position);
    return { value: inner.value, dualYear: inner.dualYear, phrase: (intMatch[2] as string).trim() };
  }

  return parseDate551Body(trimmed, position);
}

/* Parses a 5.5.1 date body: DATE, DATE_PERIOD, DATE_RANGE, DATE_APPROXIMATED. */
function parseDate551Body(text: string, position: SourcePosition): { value: DateValue; dualYear: boolean } {
  const tokens = text.trim().split(/ +/);
  const first = (tokens[0] as string).toUpperCase();
  if (first === 'FROM' || first === 'TO') {
    const from = first === 'FROM';
    const toIndex = from ? tokens.findIndex((token, index) => index > 0 && token.toUpperCase() === 'TO') : -1;
    if (from && toIndex !== -1) {
      const fromPart = parseDate551(tokens.slice(1, toIndex), position);
      const toPart = parseDate551(tokens.slice(toIndex + 1), position);
      return {
        value: { kind: 'period', from: fromPart.fields, to: toPart.fields },
        dualYear: fromPart.dualYear || toPart.dualYear,
      };
    }
    const part = parseDate551(tokens.slice(1), position);
    return {
      value: from ? { kind: 'period', from: part.fields } : { kind: 'period', to: part.fields },
      dualYear: part.dualYear,
    };
  }
  if (first === 'BET') {
    const andIndex = tokens.findIndex((token) => token.toUpperCase() === 'AND');
    if (andIndex === -1) {
      fail('date.invalid', 'A BET date must contain AND: "BET <date> AND <date>"', position);
    }
    const start = parseDate551(tokens.slice(1, andIndex), position);
    const end = parseDate551(tokens.slice(andIndex + 1), position);
    return { value: { kind: 'range', start: start.fields, end: end.fields }, dualYear: start.dualYear || end.dualYear };
  }
  if (first === 'AFT' || first === 'BEF') {
    const part = parseDate551(tokens.slice(1), position);
    return {
      value: { kind: 'bound', modifier: first as 'AFT' | 'BEF', date: part.fields },
      dualYear: part.dualYear,
    };
  }
  if (first === 'ABT' || first === 'CAL' || first === 'EST') {
    const part = parseDate551(tokens.slice(1), position);
    return {
      value: { kind: 'approx', modifier: first as 'ABT' | 'CAL' | 'EST', date: part.fields },
      dualYear: part.dualYear,
    };
  }
  const part = parseDate551(tokens, position);
  return { value: { kind: 'date', ...part.fields }, dualYear: part.dualYear };
}

/** Parses one 5.5.1 `<DATE>` (a single date, per calendar escape). */
function parseDate551(
  tokens: string[],
  position: SourcePosition,
): { fields: DateFields; dualYear: boolean } {
  let calendar: Calendar = 'GREGORIAN';
  let rest = tokens;
  const first = tokens[0] as string;
  if (first.startsWith('@#D')) {
    const mapped = CALENDAR_ESCAPES_551.get(first);
    if (mapped !== undefined) {
      calendar = mapped;
    } else if (first === '@#DROMAN@' || first === '@#DUNKNOWN@') {
      fail('date.reserved-calendar', `The ${first} calendar is reserved in GEDCOM 5.5.1 and has no defined months`, position);
    } else {
      fail('line.bad-escape', `Unknown calendar escape ${first}`, position);
    }
    rest = tokens.slice(1);
  } else if (first.startsWith('@#')) {
    fail('line.bad-escape', `Unknown escape ${first}`, position);
  }
  if (rest.length === 0) {
    fail('date.invalid', 'A date must have a year', position);
  }

  // The BCE suffix (year-only form). 5.5.1 spells it B.C.; GEDCOM 5.5.5
  // (p.77) additionally makes the spellings BCE and BC official, with
  // BCE preferred — all three mean the same thing, are accepted in any
  // 5.x file, and normalize to the BCE epoch.
  let epoch: Epoch | undefined;
  const lastUpper = (rest[rest.length - 1] as string).toUpperCase();
  if (lastUpper === 'B.C.' || lastUpper === 'BCE' || lastUpper === 'BC') {
    if (rest.length !== 2) {
      fail('date.bad-epoch', `The ${lastUpper} suffix is only permitted on a year-only date`, position);
    }
    epoch = 'BCE';
    rest = rest.slice(0, -1);
  }
  if (rest.length === 0) {
    fail('date.invalid', 'A date must have a year', position);
  }

  // Dual years: NUMBER/NUMBER (permitted in every 5.5.1 date form, since
  // YEAR_GREG appears in all three DATE_GREG alternatives).
  let dualYear = false;
  const yearToken = rest[rest.length - 1] as string;
  if (/^\d+\/\d+$/.test(yearToken)) {
    dualYear = true;
    // The second number replaces the last digits of the first (1699/00 is
    // 1699 or 1700); if the result is before the first year, the century
    // rolled over. The raw text goes to a PHRASE by the assembler.
    const slash = yearToken.indexOf('/');
    const first = yearToken.slice(0, slash);
    const second = yearToken.slice(slash + 1);
    const composed = first.slice(0, Math.max(first.length - second.length, 0)) + second;
    let year = safeInteger(composed, position, 'date.bad-year');
    if (year < safeInteger(first, position, 'date.bad-year')) {
      year += 10 ** second.length;
      if (!Number.isSafeInteger(year)) {
        fail('date.bad-year', `The year "${yearToken}" is beyond the exactly representable range`, position);
      }
    }
    rest = [...rest.slice(0, -1), String(year)];
  }

  let year: number | undefined;
  let month: GedcomMonth | undefined;
  let day: number | undefined;
  if (rest.length === 1) {
    year = parseYear(rest[0] as string, position);
  } else if (rest.length === 2 && /^\d+$/.test(rest[0] as string)) {
    // The year-less form "<DAY> <MONTH>" of GEDCOM 5.5.5 DATE_GREG
    // (p.83) — a birthday whose year is unknown. Accepted in any 5.x
    // file. Gregorian only; DATE_JULN has no such alternative.
    if (calendar !== 'GREGORIAN') {
      fail('date.invalid', 'A year-less day+month date is only valid in the GREGORIAN calendar', position);
    }
    day = Number(rest[0]);
    month = monthOf(calendar, rest[1] as string, '5.5.1', position);
    const max = month === 'FEB' ? 29 : GREGORIAN_DAY_MAX[month as GregorianMonth];
    if (max === undefined || day < 1 || day > max) {
      fail('date.bad-day', `Day ${day} is invalid for the month ${month as string}`, position);
    }
  } else if (rest.length === 2) {
    month = monthOf(calendar, rest[0] as string, '5.5.1', position);
    year = parseYear(rest[1] as string, position);
  } else if (rest.length === 3) {
    if (!/^\d+$/.test(rest[0] as string)) {
      fail('date.bad-day', `Invalid day "${rest[0]}"`, position);
    }
    day = Number(rest[0]);
    month = monthOf(calendar, rest[1] as string, '5.5.1', position);
    year = parseYear(rest[2] as string, position);
    checkDay(calendar, month, day, year, epoch, position);
  } else {
    fail('date.invalid', `Too many date components: "${rest.join(' ')}"`, position);
  }
  return { fields: makeFields(calendar, year, day, month, epoch), dualYear };
}

/** Parses a GEDCOM 7.0 Time value. */
export function parseTime70(text: string, position: SourcePosition): TimeValue {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?(Z)?$/.exec(text);
  if (!match) {
    fail('time.invalid', `Invalid time "${text}"; expected "<hour>:<minute>[:<second>[.<fraction>]][Z]"`, position);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23) {
    fail('time.invalid', `Invalid hour ${hour}; the 24-hour clock ends at 23`, position);
  }
  if (minute > 59) {
    fail('time.invalid', `Invalid minute ${minute}`, position);
  }
  const time: TimeValue = { hour, minute };
  if (match[3] !== undefined) {
    time.second = Number(match[3]);
    if (time.second > 59) {
      fail('time.invalid', `Invalid second ${time.second}`, position);
    }
  }
  if (match[4] !== undefined) {
    time.fraction = match[4];
  }
  if (match[5] !== undefined) {
    time.utc = true;
  }
  return time;
}

/** Parses a GEDCOM 5.5.1 Time value (no UTC marker). */
export function parseTime551(text: string, position: SourcePosition): TimeValue {
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d+))?)?$/.exec(text);
  if (!match) {
    fail('time.invalid', `Invalid time "${text}"; expected "<hour>:<minute>[:<second>[.<fraction>]]"`, position);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23) {
    fail('time.invalid', `Invalid hour ${hour}; the 24-hour clock ends at 23`, position);
  }
  if (minute > 59) {
    fail('time.invalid', `Invalid minute ${minute}`, position);
  }
  const time: TimeValue = { hour, minute };
  if (match[3] !== undefined) {
    time.second = Number(match[3]);
    if (time.second > 59) {
      fail('time.invalid', `Invalid second ${time.second}`, position);
    }
  }
  if (match[4] !== undefined) {
    time.fraction = match[4];
  }
  return time;
}

/** Parses a GEDCOM 7.0 Age value. */
export function parseAge70(text: string, position: SourcePosition): AgeValue {
  let rest = text.trim();
  const age: AgeValue = {};
  if (rest.startsWith('<') || rest.startsWith('>')) {
    age.bound = rest[0] as AgeBound;
    rest = rest.slice(1).trim();
  }
  const parts = rest === '' ? [] : rest.split(/ +/);
  let lastKind = '';
  const order = ['y', 'm', 'w', 'd'];
  for (const part of parts) {
    const match = /^(\d+)([ymwd])$/.exec(part);
    if (!match) {
      fail('age.invalid', `Invalid age component "${part}"; expected "<number>y|m|w|d"`, position);
    }
    const kind = match[2] as string;
    if (order.indexOf(kind) <= order.indexOf(lastKind)) {
      fail('age.invalid', `Age components must appear in the order years, months, weeks, days; got "${part}" after "${lastKind}"`, position);
    }
    lastKind = kind;
    const count = safeInteger(match[1] as string, position, 'integer.out-of-range');
    if (kind === 'y') {
      age.years = count;
    } else if (kind === 'm') {
      age.months = count;
    } else if (kind === 'w') {
      age.weeks = count;
    } else {
      age.days = count;
    }
  }
  if (lastKind === '' && age.bound === undefined) {
    fail('age.invalid', 'An age must have at least one duration component', position);
  }
  return age;
}

/** Parses a GEDCOM 5.5.1 Age value (no weeks; CHILD/INFANT/STILLBORN keywords). */
export function parseAge551(text: string, position: SourcePosition): AgeValue {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();
  if (upper === 'CHILD') {
    return { description: 'CHILD' };
  }
  if (upper === 'INFANT') {
    return { description: 'INFANT' };
  }
  if (upper === 'STILLBORN') {
    return { description: 'STILLBORN' };
  }
  let rest = trimmed;
  const age: AgeValue = {};
  if (rest.startsWith('<') || rest.startsWith('>')) {
    age.bound = rest[0] as AgeBound;
    rest = rest.slice(1).trim();
  }
  const parts = rest === '' ? [] : rest.split(/ +/);
  let lastKind = '';
  const order = ['y', 'm', 'd'];
  for (const part of parts) {
    const match = /^(\d+)([ymd])$/.exec(part);
    if (!match) {
      fail('age.invalid', `Invalid age component "${part}"; expected "<number>y|m|d"`, position);
    }
    const kind = match[2] as string;
    if (order.indexOf(kind) <= order.indexOf(lastKind)) {
      fail('age.invalid', `Age components must appear in the order years, months, days; got "${part}" after "${lastKind}"`, position);
    }
    lastKind = kind;
    const count = safeInteger(match[1] as string, position, 'integer.out-of-range');
    if (kind === 'y') {
      age.years = count;
    } else if (kind === 'm') {
      age.months = count;
    } else {
      age.days = count;
    }
  }
  if (lastKind === '' && age.bound === undefined) {
    fail('age.invalid', 'An age must have at least one duration component', position);
  }
  return age;
}

/** Parses a List:Text payload (comma-separated, spaces around items trimmed). */
export function parseListText(text: string): ListText {
  return text.split(',').map((item) => item.trim());
}

/**
 * Parses an enumeration value: exact table membership for 7.0,
 * case-insensitive membership for 5.5.1 and 5.5.5 (the canonical value
 * is returned). Extension values (`_…`) are accepted only for 7.0.
 */
export function parseEnum<K extends string>(
  text: string,
  table: Readonly<Record<K, string>>,
  version: GedcomVersion,
  position: SourcePosition,
): K | ExtensionTag {
  if (version === '7.0') {
    if (text in table) {
      return text as K;
    }
    if (text.startsWith('_')) {
      return text as ExtensionTag;
    }
  } else {
    const key = (Object.keys(table) as K[]).find((value) => value.toLowerCase() === text.toLowerCase());
    if (key !== undefined) {
      return key;
    }
  }
  fail(
    'enum.invalid-value',
    `"${text}" is not a permitted value (expected one of: ${Object.keys(table).join(', ')})`,
    position,
  );
}

/** Parses a List:Enum payload. */
export function parseListEnum<K extends string>(
  text: string,
  table: Readonly<Record<K, string>>,
  version: GedcomVersion,
  position: SourcePosition,
): Array<K | ExtensionTag> {
  return text.split(',').map((item) => parseEnum(item.trim(), table, version, position));
}

/** Parses a Personal Name payload (slash-delimited). */
export function parsePersonalName(text: string, version: GedcomVersion, position: SourcePosition): PersonalName {
  if (version !== '7.0' && text.includes(',')) {
    fail('name.invalid', `A ${version} personal name must not contain commas`, position);
  }
  const parts = text.split('/');
  if (parts.length === 1) {
    const name: PersonalName = {};
    const part0 = (parts[0] as string).trim();
    if (part0 !== '') {
      name.given = part0;
    }
    return name;
  }
  if (parts.length === 3) {
    const name: PersonalName = {};
    const part0 = (parts[0] as string).trim();
    const part1 = (parts[1] as string).trim();
    const part2 = (parts[2] as string).trim();
    if (part0 !== '') {
      name.given = part0;
    }
    if (part1 !== '') {
      name.surname = part1;
    }
    if (part2 !== '') {
      name.suffix = part2;
    }
    return name;
  }
  fail('name.invalid', `Invalid personal name "${text}": the surname must be enclosed in one pair of slashes`, position);
}

/** Parses a Latitude payload (N/S + decimal degrees). */
export function parseLatitude(text: string, position: SourcePosition): Latitude {
  const match = /^([NS])(90|[0-8]?\d)(?:\.(\d+))?$/.exec(text);
  if (!match) {
    fail('latitude.invalid', `Invalid latitude "${text}"; expected "N" or "S" followed by decimal degrees 0–90`, position);
  }
  const degrees = Number(match[3] !== undefined ? `${match[2]}.${match[3]}` : match[2]);
  return { direction: match[1] as 'N' | 'S', degrees };
}

/** Parses a Longitude payload (E/W + decimal degrees). */
export function parseLongitude(text: string, position: SourcePosition): Longitude {
  const match = /^([EW])(180|1[0-7]\d|0?\d{1,2})(?:\.(\d+))?$/.exec(text);
  if (!match) {
    fail('longitude.invalid', `Invalid longitude "${text}"; expected "E" or "W" followed by decimal degrees 0–180`, position);
  }
  const degrees = Number(match[3] !== undefined ? `${match[2]}.${match[3]}` : match[2]);
  return { direction: match[1] as 'E' | 'W', degrees };
}

/** Parses a 7.0 Tag Definition payload (`_TAG URI`). */
export function parseTagDefinition(text: string, position: SourcePosition): TagDefinitionValue {
  const space = text.indexOf(' ');
  if (space === -1) {
    fail('tagdef.invalid', `Invalid tag definition "${text}"; expected "<_tag> <URI>"`, position);
  }
  const tag = text.slice(0, space);
  const uri = text.slice(space + 1);
  if (!/^_[A-Z0-9_]+$/.test(tag)) {
    fail('tagdef.invalid', `Invalid extension tag "${tag}" in a tag definition`, position);
  }
  if (uri === '' || /[\s\u0000-\u001f\u007f]/.test(uri)) {
    fail('uri.invalid', `Invalid URI "${uri}" in a tag definition`, position);
  }
  return { tag: tag as `_${string}`, uri };
}

/**
 * Parses a 5.x MULTIMEDIA_FORMAT payload: the union of the 5.5.1 set
 * (GEDCOM 5.5.1 §2 p.54) and the GEDCOM 5.5.5 additions `JPEG` and
 * `TIFF` (5.5.5 §2 p.94) — 5.5.5 dropped OLE, but 5.x import accepts
 * the union. The 5.5.1 serializer still writes only the 5.5.1 set.
 */
export function parseMediaFormat551(
  text: string,
  position: SourcePosition,
): (typeof MULTIMEDIA_FORMATS_551)[number] | (typeof MULTIMEDIA_FORMATS_555)[number] {
  const known: readonly string[] = [...MULTIMEDIA_FORMATS_551, ...MULTIMEDIA_FORMATS_555];
  const lower = text.toLowerCase();
  const match = known.find((format) => format.toLowerCase() === lower);
  if (match !== undefined) {
    return match as (typeof MULTIMEDIA_FORMATS_551)[number];
  }
  fail(
    'enum.invalid-value',
    `"${text}" is not a permitted 5.5.1 multimedia format (expected one of: ${known.join(', ')})`,
    position,
  );
}

/** Parses a 5.5.1 LANGUAGE_ID payload (fixed table, case-insensitive). */
export function parseLanguage551(text: string, position: SourcePosition): (typeof LANGUAGE_IDS_551)[number] {
  const found = LANGUAGE_IDS_551.find((id) => id.toLowerCase() === text.toLowerCase());
  if (found !== undefined) {
    return found;
  }
  fail('enum.invalid-value', `"${text}" is not in the 5.5.1 LANGUAGE_ID table`, position);
}
