import type { DateQuality, DateValue, PersonRecord, Sex } from '@doru/core';

export interface DateDraft {
  year: string;
  month: string;
  day: string;
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
  return { year: '', month: '', day: '', text: '', quality: 'exact', place: '' };
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

export function toDateDraft(date: DateValue | undefined): DateDraft {
  return {
    year: date?.year !== undefined ? String(date.year) : '',
    month: date?.month !== undefined ? String(date.month) : '',
    day: date?.day !== undefined ? String(date.day) : '',
    text: date?.text ?? '',
    quality: date?.quality ?? 'exact',
    place: date?.place ?? '',
  };
}

export function fromDateDraft(draft: DateDraft): DateValue | undefined {
  const year = draft.year !== '' ? Number(draft.year) : undefined;
  const month = draft.month !== '' ? Number(draft.month) : undefined;
  const day = draft.day !== '' ? Number(draft.day) : undefined;
  const text = draft.text.trim() || undefined;
  const place = draft.place.trim() || undefined;
  if (year === undefined && month === undefined && day === undefined && text === undefined && place === undefined) {
    return undefined;
  }
  return { year, month, day, text, quality: draft.quality, place };
}

export function personToDraft(person: PersonRecord): PersonDraft {
  const name = person.names[0];
  return {
    id: person.id,
    given: name?.given ?? '',
    surname: name?.surname ?? '',
    sex: person.sex,
    birth: toDateDraft(person.birth),
    death: toDateDraft(person.death),
    isNew: false,
  };
}

export function personDraftMatches(draft: PersonDraft, person: PersonRecord): boolean {
  const name = person.names[0];
  return (
    draft.given === (name?.given ?? '') &&
    draft.surname === (name?.surname ?? '') &&
    draft.sex === person.sex &&
    dateDraftMatches(draft.birth, person.birth) &&
    dateDraftMatches(draft.death, person.death)
  );
}

export function draftToRecord(draft: PersonDraft): PersonRecord {
  const full = `${draft.given} ${draft.surname}`.trim();
  const names = full
    ? [{ given: draft.given || undefined, surname: draft.surname || undefined, full }]
    : [];
  return {
    id: draft.id,
    names,
    sex: draft.sex,
    birth: fromDateDraft(draft.birth),
    death: fromDateDraft(draft.death),
  };
}

function dateDraftMatches(draft: DateDraft, date: DateValue | undefined): boolean {
  const other = toDateDraft(date);
  return (
    draft.year === other.year &&
    draft.month === other.month &&
    draft.day === other.day &&
    draft.text === other.text &&
    draft.quality === other.quality &&
    draft.place === other.place
  );
}
