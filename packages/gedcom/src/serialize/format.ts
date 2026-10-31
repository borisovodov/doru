/**
 * Value formatting: dates, times, ages and names to their 7.0 or 5.5.1
 * spellings.
 */

import type {
  AgeValue,
  Calendar,
  DateExact,
  DateValue,
  Epoch,
  GedcomMonth,
  PersonalName,
  TimeValue,
} from '../primitives';
import type {
  Version,
} from './writer';

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

export function calendarEscape551(calendar: Calendar): string {
  switch (calendar) {
    case 'GREGORIAN':
      return '';
    case 'JULIAN':
      return '@#DJULIAN@ ';
    case 'FRENCH_R':
      return '@#DFRENCH R@ ';
    case 'HEBREW':
      return '@#DHEBREW@ ';
    default:
      return '';
  }
}

export function epochSuffix(epoch: Epoch | undefined, version: Version): string {
  if (epoch === undefined) {
    return '';
  }
  if (epoch.startsWith('_')) {
    // An extension epoch is spellable in 7.0 only; 5.5.1 has no
    // extension-calendar grammar (the caller drops the whole date).
    return version === '7.0' ? ` ${epoch}` : '';
  }
  return version === '7.0' ? ' BCE' : ' B.C.';
}

export function formatDateFields(
  fields: { calendar?: Calendar; day?: number; month?: GedcomMonth; year?: number; epoch?: Epoch },
  version: Version,
): string | undefined {
  if (fields.year === undefined) {
    // The year-less GEDCOM 5.5.5 day+month form: neither 7.0 nor 5.5.1
    // can spell it; the caller drops the date (see DateFields).
    return undefined;
  }
  const calendar = fields.calendar ?? 'GREGORIAN';
  if (
    version === '5.5.1'
    && (calendar.startsWith('_') || fields.month?.startsWith('_') === true || fields.epoch?.startsWith('_') === true)
  ) {
    // 5.5.1 has no extension calendars, months or epochs; a date using
    // one cannot be spelled and is dropped, like the other 5.5.1-only
    // constructs.
    return undefined;
  }
  const escape = version === '5.5.1' ? calendarEscape551(calendar) : calendar === 'GREGORIAN' ? '' : `${calendar} `;
  const dayMonth = fields.day !== undefined && fields.month !== undefined ? `${fields.day} ${fields.month} ` : fields.month !== undefined ? `${fields.month} ` : '';
  return `${escape}${dayMonth}${fields.year}${epochSuffix(fields.epoch, version)}`;
}

export function formatDateValue70(value: DateValue): string | undefined {
  switch (value.kind) {
    case 'date':
      return formatDateFields(value, '7.0');
    case 'range': {
      const start = formatDateFields(value.start, '7.0');
      const end = formatDateFields(value.end, '7.0');
      return start === undefined || end === undefined ? undefined : `BET ${start} AND ${end}`;
    }
    case 'bound': {
      const date = formatDateFields(value.date, '7.0');
      return date === undefined ? undefined : `${value.modifier} ${date}`;
    }
    case 'approx': {
      const date = formatDateFields(value.date, '7.0');
      return date === undefined ? undefined : `${value.modifier} ${date}`;
    }
    case 'period': {
      if (value.from !== undefined && value.to !== undefined) {
        const from = formatDateFields(value.from, '7.0');
        const to = formatDateFields(value.to, '7.0');
        if (from === undefined || to === undefined) {
          return undefined;
        }
        return `FROM ${from} TO ${to}`;
      }
      if (value.from !== undefined) {
        const from = formatDateFields(value.from, '7.0');
        return from === undefined ? undefined : `FROM ${from}`;
      }
      if (value.to !== undefined) {
        const to = formatDateFields(value.to, '7.0');
        return to === undefined ? undefined : `TO ${to}`;
      }
      return '';
    }
    case 'unknown':
      return '';
  }
}

export function formatDateValue551(value: DateValue): string | undefined {
  switch (value.kind) {
    case 'date':
      return formatDateFields(value, '5.5.1');
    case 'range': {
      const start = formatDateFields(value.start, '5.5.1');
      const end = formatDateFields(value.end, '5.5.1');
      return start === undefined || end === undefined ? undefined : `BET ${start} AND ${end}`;
    }
    case 'bound': {
      const date = formatDateFields(value.date, '5.5.1');
      return date === undefined ? undefined : `${value.modifier} ${date}`;
    }
    case 'approx': {
      const date = formatDateFields(value.date, '5.5.1');
      return date === undefined ? undefined : `${value.modifier} ${date}`;
    }
    case 'period': {
      if (value.from !== undefined && value.to !== undefined) {
        const from = formatDateFields(value.from, '5.5.1');
        const to = formatDateFields(value.to, '5.5.1');
        if (from === undefined || to === undefined) {
          return undefined;
        }
        return `FROM ${from} TO ${to}`;
      }
      if (value.from !== undefined) {
        const from = formatDateFields(value.from, '5.5.1');
        return from === undefined ? undefined : `FROM ${from}`;
      }
      if (value.to !== undefined) {
        const to = formatDateFields(value.to, '5.5.1');
        return to === undefined ? undefined : `TO ${to}`;
      }
      return '';
    }
    case 'unknown':
      return '';
  }
}

export function formatDateExact(value: DateExact, version: Version): string {
  if (version === '7.0') {
    // GEDCOM 7.0 §2.4 DateExact = `day D month D year` has no epoch
    // production: an epoch on the model value (only reachable
    // programmatically — the 7.0 parser rejects a fourth token) is not
    // emitted, so the output always matches the grammar.
    return `${value.day} ${value.month} ${value.year}`;
  }
  const fields: { calendar: Calendar; day: number; month: GedcomMonth; year: number; epoch?: Epoch } = {
    calendar: 'GREGORIAN',
    day: value.day,
    month: value.month,
    year: value.year,
  };
  if (value.epoch !== undefined) {
    fields.epoch = value.epoch;
  }
  // DateExact always carries a year, so the formatter cannot fail here.
  return formatDateFields(fields, '5.5.1') as string;
}

export function formatTime(value: TimeValue, version: Version): string {
  let out = `${value.hour}:${value.minute}`;
  if (value.second !== undefined) {
    out += `:${value.second}`;
    if (value.fraction !== undefined) {
      out += `.${value.fraction}`;
    }
  }
  if (version === '7.0' && value.utc === true) {
    out += 'Z';
  }
  return out;
}

export function formatAge70(value: AgeValue): string {
  const parts: string[] = [];
  if (value.years !== undefined) {
    parts.push(`${value.years}y`);
  }
  if (value.months !== undefined) {
    parts.push(`${value.months}m`);
  }
  if (value.weeks !== undefined) {
    parts.push(`${value.weeks}w`);
  }
  if (value.days !== undefined) {
    parts.push(`${value.days}d`);
  }
  const duration = parts.join(' ');
  // GEDCOM 7.0 §2.6 `Age = [[ageBound D] ageDuration]` — the bound is
  // separated from the duration by a space (`> 20y`). The parser accepts
  // both spellings (see parseAge70); 5.5.1's AGE_AT_EVENT has no space,
  // which formatAge551 mirrors.
  return value.bound === undefined ? duration : `${value.bound} ${duration}`.trim();
}

export function formatAge551(value: AgeValue): string {
  if (value.description !== undefined) {
    return value.description;
  }
  const parts: string[] = [];
  if (value.years !== undefined) {
    parts.push(`${value.years}y`);
  }
  if (value.months !== undefined) {
    parts.push(`${value.months}m`);
  }
  if (value.days !== undefined) {
    parts.push(`${value.days}d`);
  }
  return `${value.bound ?? ''}${parts.join(' ')}`.trim();
}

export function formatName70(value: PersonalName): string {
  return `${value.given ?? ''}/${value.surname ?? ''}/${value.suffix ?? ''}`;
}

/** GEDCOM 5.5.1 spells personal names exactly like 7.0. */
export function formatName551(value: PersonalName): string {
  return formatName70(value);
}
