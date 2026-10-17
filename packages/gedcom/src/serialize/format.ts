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
  return version === '7.0' ? ' BCE' : ' B.C.';
}

export function formatDateFields(
  fields: { calendar?: Calendar; day?: number; month?: GedcomMonth; year: number; epoch?: Epoch },
  version: Version,
): string {
  const calendar = fields.calendar ?? 'GREGORIAN';
  const escape = version === '5.5.1' ? calendarEscape551(calendar) : calendar === 'GREGORIAN' ? '' : `${calendar} `;
  const dayMonth = fields.day !== undefined && fields.month !== undefined ? `${fields.day} ${fields.month} ` : fields.month !== undefined ? `${fields.month} ` : '';
  return `${escape}${dayMonth}${fields.year}${epochSuffix(fields.epoch, version)}`;
}

export function formatDateValue70(value: DateValue): string {
  switch (value.kind) {
    case 'date':
      return formatDateFields(value, '7.0');
    case 'range':
      return `BET ${formatDateFields(value.start, '7.0')} AND ${formatDateFields(value.end, '7.0')}`;
    case 'bound':
      return `${value.modifier} ${formatDateFields(value.date, '7.0')}`;
    case 'approx':
      return `${value.modifier} ${formatDateFields(value.date, '7.0')}`;
    case 'period': {
      if (value.from !== undefined && value.to !== undefined) {
        return `FROM ${formatDateFields(value.from, '7.0')} TO ${formatDateFields(value.to, '7.0')}`;
      }
      if (value.from !== undefined) {
        return `FROM ${formatDateFields(value.from, '7.0')}`;
      }
      if (value.to !== undefined) {
        return `TO ${formatDateFields(value.to, '7.0')}`;
      }
      return '';
    }
    case 'unknown':
      return '';
  }
}

export function formatDateValue551(value: DateValue): string {
  switch (value.kind) {
    case 'date':
      return formatDateFields(value, '5.5.1');
    case 'range':
      return `BET ${formatDateFields(value.start, '5.5.1')} AND ${formatDateFields(value.end, '5.5.1')}`;
    case 'bound':
      return `${value.modifier} ${formatDateFields(value.date, '5.5.1')}`;
    case 'approx':
      return `${value.modifier} ${formatDateFields(value.date, '5.5.1')}`;
    case 'period': {
      if (value.from !== undefined && value.to !== undefined) {
        return `FROM ${formatDateFields(value.from, '5.5.1')} TO ${formatDateFields(value.to, '5.5.1')}`;
      }
      if (value.from !== undefined) {
        return `FROM ${formatDateFields(value.from, '5.5.1')}`;
      }
      if (value.to !== undefined) {
        return `TO ${formatDateFields(value.to, '5.5.1')}`;
      }
      return '';
    }
    case 'unknown':
      return '';
  }
}

export function formatDateExact(value: DateExact, version: Version): string {
  if (version === '7.0') {
    return `${value.day} ${value.month} ${value.year}${epochSuffix(value.epoch, '7.0')}`;
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
  return formatDateFields(fields, '5.5.1');
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
  return `${value.bound ?? ''}${parts.join(' ')}`.trim();
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

export function formatName551(value: PersonalName): string {
  return `${value.given ?? ''}/${value.surname ?? ''}/${value.suffix ?? ''}`;
}
