import type {
  DateComponent,
  DateQuality,
  DateValue,
  FactRecord,
  PersonName,
  PersonRecord,
  Sex,
} from '@doru/core';
import { factOf } from '@doru/core/model';
import { formatDate } from './format';

export interface DateDraft {
  year: string;
  month: string;
  day: string;
  endYear: string;
  endMonth: string;
  endDay: string;
  text: string;
  quality: DateQuality;
  place: string;
}

export interface PersonDraft {
  id: string;
  given: string;
  surname: string;
  sex: Sex;
  birth: DateDraft;
  death: DateDraft;
  isNew: boolean;
}

export function emptyDate(): DateDraft {
  return {
    year: '',
    month: '',
    day: '',
    endYear: '',
    endMonth: '',
    endDay: '',
    text: '',
    quality: 'exact',
    place: '',
  };
}

/** The initials shown on the person view card, live from the draft. */
export function draftInitials(draft: PersonDraft): string {
  const parts = [draft.given.trim(), draft.surname.trim()].filter((part) => part !== '');
  if (parts.length === 0) {
    return '?';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** The life span shown on the person view card, live from the draft. */
export function draftSpan(draft: PersonDraft): string {
  const birth = fromDateDraft(draft.birth);
  const death = fromDateDraft(draft.death);
  const parts = [birth ? formatDate(birth) : '', death ? formatDate(death) : ''].filter((part) => part !== '');
  if (parts.length === 0) {
    return '';
  }
  const span = parts.join(' – ');
  const birthYear = birth?.component?.year;
  const deathYear = death?.component?.year;
  if (
    birthYear !== undefined &&
    deathYear !== undefined &&
    birth?.component?.epoch === undefined &&
    death?.component?.epoch === undefined &&
    birth?.text === undefined &&
    death?.text === undefined
  ) {
    const age = deathYear - birthYear;
    if (age >= 0 && age < 130) {
      return `${span} (${age})`;
    }
  }
  return span;
}

export function newPersonDraft(): PersonDraft {
  return {
    id: crypto.randomUUID(),
    given: '',
    surname: '',
    sex: 'U',
    birth: emptyDate(),
    death: emptyDate(),
    isNew: true,
  };
}

export function toDateDraft(date: DateValue | undefined, place = ''): DateDraft {
  return {
    year: date?.component?.year !== undefined ? String(date.component.year) : '',
    month: date?.component?.month !== undefined ? String(date.component.month) : '',
    day: date?.component?.day !== undefined ? String(date.component.day) : '',
    endYear: date?.end?.year !== undefined ? String(date.end.year) : '',
    endMonth: date?.end?.month !== undefined ? String(date.end.month) : '',
    endDay: date?.end?.day !== undefined ? String(date.end.day) : '',
    text: date?.text ?? '',
    quality: date?.quality ?? 'exact',
    place,
  };
}

export function fromDateDraft(draft: DateDraft): DateValue | undefined {
  const component = componentOf(draft.year, draft.month, draft.day);
  const end = componentOf(draft.endYear, draft.endMonth, draft.endDay);
  const text = draft.text.trim() || undefined;
  if (!component && !end && !text) {
    return undefined;
  }
  if (draft.quality === 'range') {
    return { quality: 'range', component, end, text };
  }
  return { quality: draft.quality, component, text };
}

export function personToDraft(person: PersonRecord): PersonDraft {
  const name = person.names[0];
  const birth = factOf(person, 'BIRT');
  const death = factOf(person, 'DEAT');
  return {
    id: person.id,
    given: name?.given ?? '',
    surname: name?.surname ?? '',
    sex: person.sex,
    birth: toDateDraft(birth?.date, birth?.place),
    death: toDateDraft(death?.date, death?.place),
    isNew: false,
  };
}

export function personDraftMatches(draft: PersonDraft, person: PersonRecord): boolean {
  const name = person.names[0];
  return (
    draft.given === (name?.given ?? '') &&
    draft.surname === (name?.surname ?? '') &&
    draft.sex === person.sex &&
    dateDraftMatches(draft.birth, factOf(person, 'BIRT')) &&
    dateDraftMatches(draft.death, factOf(person, 'DEAT'))
  );
}

/**
 * Builds the person record for a save. The person's other facts (residences,
 * occupations, …) are preserved from `existing`; the BIRT/DEAT facts are
 * rebuilt from the draft — inserted, updated in place, or dropped when the
 * draft is empty. Pass `existing` when updating a person so the save does
 * not clobber facts edited elsewhere.
 */
export function draftToRecord(draft: PersonDraft, existing?: PersonRecord): PersonRecord {
  const full = `${draft.given} ${draft.surname}`.trim();
  const names: PersonName[] = [];
  if (full) {
    names.push({
      id: existing?.names[0]?.id ?? crypto.randomUUID(),
      given: draft.given.trim() || undefined,
      surname: draft.surname.trim() || undefined,
      full,
    });
  }
  // Names beyond the primary one (maiden name, aliases, …) are not edited
  // by the person form yet; carry them through unchanged.
  if (existing) {
    names.push(...existing.names.slice(1));
  }
  const facts = existing ? existing.facts.filter((fact) => fact.tag !== 'BIRT' && fact.tag !== 'DEAT') : [];
  const birth = factFromDraft(draft, existing, 'BIRT', draft.birth);
  const death = factFromDraft(draft, existing, 'DEAT', draft.death);
  if (birth) {
    facts.push(birth);
  }
  if (death) {
    facts.push(death);
  }
  return {
    id: draft.id,
    sex: draft.sex,
    names,
    facts,
  };
}

function factFromDraft(
  draft: PersonDraft,
  existing: PersonRecord | undefined,
  tag: string,
  value: DateDraft,
): FactRecord | undefined {
  const date = fromDateDraft(value);
  const place = value.place.trim() || undefined;
  if (!date && !place) {
    return undefined;
  }
  return {
    id: existing ? (factOf(existing, tag)?.id ?? crypto.randomUUID()) : crypto.randomUUID(),
    personId: draft.id,
    tag,
    date,
    place,
  };
}

function dateDraftMatches(draft: DateDraft, fact: FactRecord | undefined): boolean {
  const other = toDateDraft(fact?.date, fact?.place ?? '');
  return (
    draft.year === other.year &&
    draft.month === other.month &&
    draft.day === other.day &&
    draft.endYear === other.endYear &&
    draft.endMonth === other.endMonth &&
    draft.endDay === other.endDay &&
    draft.text === other.text &&
    draft.quality === other.quality &&
    draft.place === other.place
  );
}

function componentOf(year: string, month: string, day: string): DateComponent | undefined {
  const y = year !== '' ? Number(year) : undefined;
  const numeric = month !== '' ? Number(month) : undefined;
  // Non-Gregorian month codes (e.g. 'VEND') round-trip as strings: the
  // number inputs cannot produce them, so a non-numeric value is kept as
  // the calendar's own month code.
  const m = numeric !== undefined && !Number.isNaN(numeric) ? numeric : month || undefined;
  const d = day !== '' ? Number(day) : undefined;
  if (y === undefined && m === undefined && d === undefined) {
    return undefined;
  }
  return { year: y, month: m, day: d };
}
