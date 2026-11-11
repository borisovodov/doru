import type { DateQuality, DateValue, FactRecord, FamilyRecord, PersonName, PersonRecord } from '@doru/core';
import { factOf, factYear } from '@doru/core/model';

export function displayName(person: PersonRecord | undefined): string {
  if (!person) {
    return '?';
  }
  const name = primaryName(person);
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

/**
 * The name shown for the person: the one carrying the primary flag, or the
 * first name when no name is flagged (the common single-name case).
 */
export function primaryName(person: PersonRecord): PersonName | undefined {
  return person.names.find((name) => name.primary === true) ?? person.names[0];
}

export function initials(person: PersonRecord): string {
  const name = primaryName(person);
  if (!name) {
    return '?';
  }
  if (name.full) {
    const words = name.full.replace(/\//g, '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
  }
  const parts = [name.given, name.surname].filter((part) => part !== undefined) as string[];
  if (parts.length === 0) {
    return '?';
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

/** "1923 – 1990 (67)" — the life span, with date-quality marks and the age when both years are known. */
export function lifeSpan(person: PersonRecord): string {
  const birth = factOf(person, 'BIRT');
  const death = factOf(person, 'DEAT');
  const birthPart = birth?.date !== undefined ? formatDate(birth.date) : '';
  const deathPart = death?.date !== undefined ? formatDate(death.date) : '';
  if (birthPart === '' && deathPart === '') {
    return '';
  }
  const span = [birthPart, deathPart].filter((part) => part !== '').join(' – ');
  const birthYear = birth?.date?.component?.year;
  const deathYear = death?.date?.component?.year;
  if (
    birthYear !== undefined &&
    deathYear !== undefined &&
    birth?.date?.component?.epoch === undefined &&
    death?.date?.component?.epoch === undefined &&
    birth?.date?.text === undefined &&
    death?.date?.text === undefined
  ) {
    const age = deathYear - birthYear;
    if (age >= 0 && age < 130) {
      return `${span} (${age})`;
    }
  }
  return span;
}

/** The life years in the old compact form ("1923 — 1990"). */
export function years(person: PersonRecord): string {
  const parts: string[] = [];
  const birth = factOf(person, 'BIRT');
  if (birth?.date) {
    parts.push(formatDate(birth.date));
  }
  const deathYear = factYear(person, 'DEAT');
  if (deathYear !== undefined) {
    parts.push(`— ${deathYear}`);
  }
  return parts.join(' ');
}

/** The partners of a family as one label: "Ivan Petrov & Maria Sidorova". */
export function familyLabel(family: FamilyRecord, personById: Map<string, PersonRecord>): string {
  const names = family.partners
    .map((id) => displayName(personById.get(id)))
    .filter((name) => name !== '?');
  if (names.length === 0) {
    return family.children.length > 0
      ? `${displayName(personById.get(family.children[0] ?? ''))} …`
      : family.xref ?? family.id;
  }
  return names.join(' & ');
}

/** The name of the person or family a fact belongs to. */
export function factOwnerName(
  fact: FactRecord,
  personById: Map<string, PersonRecord>,
  familyById: Map<string, FamilyRecord>,
): string {
  if (fact.personId !== undefined) {
    return displayName(personById.get(fact.personId));
  }
  if (fact.familyId !== undefined) {
    const family = familyById.get(fact.familyId);
    return family ? familyLabel(family, personById) : '?';
  }
  return '?';
}

export function formatDate(date: DateValue): string {
  const parts: string[] = [];
  const year = date.component?.year;
  if (year !== undefined) {
    parts.push(`${qualityMark(date.quality)}${year}${date.component?.epoch === 'BCE' ? ' BC' : ''}`);
  }
  if (date.quality === 'range' && date.end?.year !== undefined) {
    parts.push(`— ${date.end.year}`);
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
