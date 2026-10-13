import type { DateQuality, DateValue, PersonRecord } from '@doru/core';

export function displayName(person: PersonRecord | undefined): string {
  if (!person) {
    return '?';
  }
  const name = person.names[0];
  if (!name) {
    return person.id;
  }
  if (name.full) {
    const cleaned = name.full.replace(/\//g, '').trim();
    if (cleaned) {
      return cleaned;
    }
  }
  const given = name.given;
  const surname = name.surname;
  const filtered = [given, surname].filter((part) => part !== undefined);
  return filtered.length > 0 ? filtered.join(' ') : person.id;
}

export function years(person: PersonRecord): string {
  const parts: string[] = [];
  if (person.birth?.year !== undefined) {
    parts.push(`${qualityMark(person.birth.quality)}${person.birth.year}`);
  }
  if (person.death?.year !== undefined) {
    parts.push(`— ${person.death.year}`);
  }
  return parts.join(' ');
}

export function formatDate(date: DateValue): string {
  const parts: string[] = [];
  if (date.year !== undefined) {
    parts.push(`${qualityMark(date.quality)}${date.year}`);
  }
  if (date.text) {
    parts.push(date.text);
  }
  return parts.join(' ');
}

export function qualityMark(quality: DateQuality): string {
  switch (quality) {
    case 'about':
      return '~';
    case 'before':
      return '<';
    case 'after':
      return '>';
    default:
      return '';
  }
}
