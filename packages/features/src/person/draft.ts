import type {
  DateComponent,
  DateQuality,
  DateValue,
  FactRecord,
  NamePart,
  NamePartKind,
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

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** How a name variant relates to its base name (GEDCOM TRAN/PHON/ROMN). */
export type NameVariantKind = 'translation' | 'phonetic' | 'romanized';

export const NAME_TYPES = ['birth', 'maiden', 'married', 'aka', 'immigrant', 'professional', 'other'] as const;

export const NAME_VARIANT_KINDS = ['translation', 'phonetic', 'romanized'] as const;

/**
 * The part kinds the name form edits as labeled fields. 'full' — the
 * verbatim display form kept for imported names — is edited through a
 * separate input, shown only while a 'full' part exists.
 */
export const NAME_PART_FIELDS = ['prefix', 'given', 'nickname', 'surnamePrefix', 'surname', 'suffix'] as const;

/**
 * An editable variant of a name: the part list plus the variant kind and
 * language. Variants of variants are carried through unedited — the UI
 * edits one level, deeper levels survive saves verbatim.
 */
export interface NameVariantDraft {
  id: string;
  kind: NameVariantKind;
  language: string;
  parts: NamePart[];
  date?: DateValue | undefined;
  variants: NameVariantDraft[];
}

/**
 * An editable name of a person. The parts mirror the `name_part` rows
 * (any number per kind); the form edits one value per kind — editing a
 * field collapses that kind's parts into the typed value, untouched kinds
 * keep every stored part. `primary` marks the preferred display name; the
 * UI keeps the primary name first in the list, matching the model's
 * display rule. `date` (the name's validity period) is preserved but not
 * edited yet.
 */
export interface NameDraft {
  id: string;
  type: string; // '' = ordinary; one of NAME_TYPES otherwise
  language: string; // BCP 47
  primary: boolean;
  parts: NamePart[];
  date?: DateValue | undefined;
  variants: NameVariantDraft[];
}

export interface PersonDraft {
  id: string;
  names: NameDraft[];
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

export function emptyVariantDraft(): NameVariantDraft {
  return {
    id: crypto.randomUUID(),
    kind: 'translation',
    language: '',
    parts: [],
    variants: [],
  };
}

export function emptyNameDraft(): NameDraft {
  return {
    id: crypto.randomUUID(),
    type: '',
    language: '',
    primary: false,
    parts: [],
    variants: [],
  };
}

/** The first part of the kind — the value the form field edits. */
export function partOf(name: { parts: NamePart[] }, kind: NamePartKind): string {
  return name.parts.find((part) => part.kind === kind)?.value ?? '';
}

/**
 * Replaces every part of the kind with a single part carrying the typed
 * value (keeping the first part's id), or drops them when the value is
 * empty. Other kinds keep all their parts.
 */
export function setPartValue<T extends { parts: NamePart[] }>(name: T, kind: NamePartKind, value: string): T {
  const original = name.parts.filter((part) => part.kind === kind);
  const rest = name.parts.filter((part) => part.kind !== kind);
  const trimmed = value.trim();
  const parts =
    trimmed === ''
      ? rest
      : [...rest, { id: original[0]?.id ?? crypto.randomUUID(), kind, value: trimmed, position: rest.length }];
  return { ...name, parts };
}

/** The display form of a name draft: the verbatim form, else given + surname. */
export function nameDraftDisplay(name: NameDraft | NameVariantDraft | undefined): string {
  if (!name) {
    return '';
  }
  const full = partOf(name, 'full').replace(/\//g, '').trim();
  if (full !== '') {
    return full;
  }
  return [partOf(name, 'given'), partOf(name, 'surname')]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(' ');
}

/** The display name of the draft: the primary name, else the first one. */
export function primaryNameDraft(draft: PersonDraft): NameDraft | undefined {
  return draft.names.find((name) => name.primary) ?? draft.names[0];
}

/** The initials shown on the person view card, live from the draft. */
export function draftInitials(draft: PersonDraft): string {
  const name = primaryNameDraft(draft);
  if (!name) {
    return '?';
  }
  const full = partOf(name, 'full').replace(/\//g, '').trim();
  if (full !== '') {
    const words = full.split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  }
  const parts = [partOf(name, 'given'), partOf(name, 'surname')].map((part) => part.trim()).filter((part) => part !== '');
  if (parts.length === 0) {
    return '?';
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
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
    names: [emptyNameDraft()],
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

export function variantToDraft(variant: PersonName): NameVariantDraft {
  return {
    id: variant.id,
    kind: variant.kind ?? 'translation',
    language: variant.language ?? '',
    parts: [...partsOfName(variant)],
    date: variant.date,
    variants: (variant.variants ?? []).map(variantToDraft),
  };
}

export function nameToDraft(name: PersonName): NameDraft {
  return {
    id: name.id,
    type: name.type ?? '',
    language: name.language ?? '',
    primary: name.primary === true,
    parts: [...partsOfName(name)],
    date: name.date,
    variants: (name.variants ?? []).map(variantToDraft),
  };
}

export function personToDraft(person: PersonRecord): PersonDraft {
  const birth = factOf(person, 'BIRT');
  const death = factOf(person, 'DEAT');
  return {
    id: person.id,
    names: person.names.map(nameToDraft),
    sex: person.sex,
    birth: toDateDraft(birth?.date, birth?.place),
    death: toDateDraft(death?.date, death?.place),
    isNew: false,
  };
}

export function personDraftMatches(draft: PersonDraft, person: PersonRecord): boolean {
  const other = personToDraft(person);
  return (
    draft.sex === other.sex &&
    draft.names.length === other.names.length &&
    draft.names.every((name, index) => nameDraftMatches(name, other.names[index]!)) &&
    dateDraftMatches(draft.birth, factOf(person, 'BIRT')) &&
    dateDraftMatches(draft.death, factOf(person, 'DEAT'))
  );
}

function nameDraftMatches(a: NameDraft, b: NameDraft): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.language === b.language &&
    a.primary === b.primary &&
    partsEqual(a.parts, b.parts) &&
    dateValueEqual(a.date, b.date) &&
    a.variants.length === b.variants.length &&
    a.variants.every((variant, index) => variantDraftMatches(variant, b.variants[index]!))
  );
}

function variantDraftMatches(a: NameVariantDraft, b: NameVariantDraft): boolean {
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.language === b.language &&
    partsEqual(a.parts, b.parts) &&
    dateValueEqual(a.date, b.date) &&
    a.variants.length === b.variants.length &&
    a.variants.every((variant, index) => variantDraftMatches(variant, b.variants[index]!))
  );
}

/** Parts compare by id, kind and value in list order; positions are derived. */
function partsEqual(a: NamePart[], b: NamePart[]): boolean {
  return (
    a.length === b.length &&
    a.every((part, index) => {
      const other = b[index]!;
      return part.id === other.id && part.kind === other.kind && part.value === other.value;
    })
  );
}

function dateValueEqual(a: DateValue | undefined, b: DateValue | undefined): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  return (
    a.quality === b.quality &&
    a.modifier === b.modifier &&
    componentEqual(a.component, b.component) &&
    componentEqual(a.end, b.end) &&
    a.text === b.text &&
    a.time?.hour === b.time?.hour &&
    a.time?.minute === b.time?.minute &&
    a.time?.second === b.time?.second &&
    a.time?.fraction === b.time?.fraction &&
    a.time?.utc === b.time?.utc
  );
}

function componentEqual(a: DateComponent | undefined, b: DateComponent | undefined): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  return a.calendar === b.calendar && a.year === b.year && a.month === b.month && a.day === b.day && a.epoch === b.epoch;
}

/** True when the variant carries nothing to store (no text, no dated metadata). */
export function variantDraftEmpty(variant: NameVariantDraft): boolean {
  return (
    variant.date === undefined &&
    variant.parts.every((part) => part.value.trim() === '') &&
    variant.variants.every(variantDraftEmpty)
  );
}

/** True when the name carries nothing to store. */
export function nameDraftEmpty(name: NameDraft): boolean {
  return (
    name.date === undefined &&
    name.parts.every((part) => part.value.trim() === '') &&
    name.variants.every(variantDraftEmpty)
  );
}

export function variantDraftToName(variant: NameVariantDraft): PersonName | undefined {
  if (variantDraftEmpty(variant)) {
    return undefined;
  }
  return {
    id: variant.id,
    kind: variant.kind,
    language: variant.language.trim() || undefined,
    parts: normalizedParts(variant.parts),
    ...flatFromParts(variant.parts),
    date: variant.date,
    variants: variant.variants.map(variantDraftToName).filter((entry): entry is PersonName => entry !== undefined),
  };
}

export function nameDraftToName(draft: NameDraft): PersonName | undefined {
  if (nameDraftEmpty(draft)) {
    return undefined;
  }
  return {
    id: draft.id,
    type: draft.type.trim() || undefined,
    language: draft.language.trim() || undefined,
    primary: draft.primary || undefined,
    parts: normalizedParts(draft.parts),
    ...flatFromParts(draft.parts),
    date: draft.date,
    variants: draft.variants.map(variantDraftToName).filter((entry): entry is PersonName => entry !== undefined),
  };
}

/**
 * Builds the person record for a save. Every name of the draft is written
 * (empty ones are dropped); the person's other facts (residences,
 * occupations, …) are preserved from `existing`; the BIRT/DEAT facts are
 * rebuilt from the draft — inserted, updated in place, or dropped when the
 * draft is empty. Pass `existing` when updating a person so the save does
 * not clobber facts edited elsewhere.
 */
export function draftToRecord(draft: PersonDraft, existing?: PersonRecord): PersonRecord {
  const names = draft.names.map(nameDraftToName).filter((name): name is PersonName => name !== undefined);
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

// ---------------------------------------------------------------------------
// Name part plumbing
// ---------------------------------------------------------------------------

/**
 * The parts of a model name. Hydrated records carry explicit parts; names
 * built by agents may only have the flat pieces — synthesize parts in
 * display order so every path lands on one representation.
 */
function partsOfName(name: PersonName): NamePart[] {
  if (name.parts) {
    return name.parts;
  }
  const pieces: Array<[NamePartKind, string | undefined]> = [
    ['prefix', name.prefix],
    ['given', name.given],
    ['nickname', name.nickname],
    ['surnamePrefix', name.surnamePrefix],
    ['surname', name.surname],
    ['suffix', name.suffix],
  ];
  const parts: NamePart[] = [];
  pieces.forEach(([kind, value]) => {
    if (value !== undefined && value !== '') {
      parts.push({ id: syntheticPartId(name.id, kind, parts.length), kind, value, position: parts.length });
    }
  });
  if (name.full !== undefined && name.full.trim() !== '') {
    parts.push({ id: syntheticPartId(name.id, 'full', parts.length), kind: 'full', value: name.full.trim(), position: parts.length });
  }
  return parts;
}

/**
 * A deterministic id for a part synthesized from the flat pieces: the same
 * name always synthesizes the same part ids, so draft comparisons against
 * flat-only records (agents, tests) stay stable across renders.
 */
function syntheticPartId(nameId: string, kind: NamePartKind, index: number): string {
  return `${nameId}#${kind}#${index}`;
}

/** Parts with contiguous positions (0-based, in list order). */
function normalizedParts(parts: NamePart[]): NamePart[] {
  return parts.map((part, index) => ({ ...part, position: index }));
}

/** The flat display pieces of a name, derived from its parts. */
function flatFromParts(parts: NamePart[]): Pick<
  PersonName,
  'full' | 'given' | 'surname' | 'surnamePrefix' | 'nickname' | 'prefix' | 'suffix'
> {
  const first = (kind: NamePartKind): string | undefined => parts.find((part) => part.kind === kind)?.value;
  return {
    full: first('full'),
    given: first('given'),
    surname: first('surname'),
    surnamePrefix: first('surnamePrefix'),
    nickname: first('nickname'),
    prefix: first('prefix'),
    suffix: first('suffix'),
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
