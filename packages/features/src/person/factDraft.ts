import type { FactAge, FactParticipant, FactRecord } from '@doru/core';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from './draft';

/** The event/attribute tags the form suggests; the field stays free text. */
export const EVENT_TYPES = ['BIRT', 'DEAT', 'BURI', 'MARR', 'RESI', 'OCCU', 'EMIG', 'IMMI', 'CENS', 'CHR', 'BAPM'];

/** The fact flags the form edits (GEDCOM restriction markers). */
export const FACT_FLAGS = ['private', 'preferred', 'tentative', 'rejected'] as const;

/** The age roles the form offers: '' is the fact's subject, HUSB/WIFE the partners. */
export const FACT_AGE_ROLES = ['', 'HUSB', 'WIFE'] as const;

/**
 * The editable form of a fact. The text fields mirror the fact columns;
 * `date` carries the place text as well (the raw place string lives on the
 * date draft, like everywhere else in the person form). `ages`,
 * `participants` and `flags` are edited as plain lists; `placeId` and
 * `addressId` are preserved but not edited yet (no place entity picker).
 */
export interface FactDraft {
  id: string;
  personId?: string | undefined;
  familyId?: string | undefined;
  tag: string;
  type: string;
  value: string;
  negation: boolean;
  date: DateDraft;
  sortDate: DateDraft;
  placeId?: string | undefined;
  addressId?: string | undefined;
  agency: string;
  religiousAffiliation: string;
  cause: string;
  sentence: string;
  quality: string;
  ages: FactAge[];
  participants: FactParticipant[];
  flags: string[];
}

export function emptyFactDraft(owner: { personId?: string; familyId?: string }): FactDraft {
  return {
    id: crypto.randomUUID(),
    personId: owner.personId,
    familyId: owner.familyId,
    tag: '',
    type: '',
    value: '',
    negation: false,
    date: emptyDate(),
    sortDate: emptyDate(),
    agency: '',
    religiousAffiliation: '',
    cause: '',
    sentence: '',
    quality: '',
    ages: [],
    participants: [],
    flags: [],
  };
}

export function factToDraft(fact: FactRecord): FactDraft {
  return {
    id: fact.id,
    personId: fact.personId,
    familyId: fact.familyId,
    tag: fact.tag,
    type: fact.type ?? '',
    value: fact.value ?? '',
    negation: fact.negation === true,
    date: toDateDraft(fact.date, fact.place ?? ''),
    sortDate: toDateDraft(fact.sortDate),
    placeId: fact.placeId,
    addressId: fact.addressId,
    agency: fact.agency ?? '',
    religiousAffiliation: fact.religiousAffiliation ?? '',
    cause: fact.cause ?? '',
    sentence: fact.sentence ?? '',
    quality: fact.quality ?? '',
    ages: (fact.ages ?? []).map((age) => ({ ...age })),
    participants: (fact.participants ?? []).map((participant) => ({ ...participant })),
    flags: [...(fact.flags ?? [])],
  };
}

export function factDraftToRecord(draft: FactDraft): FactRecord {
  return {
    id: draft.id,
    personId: draft.personId,
    familyId: draft.familyId,
    tag: draft.tag.trim() || 'EVEN',
    type: draft.type.trim() || undefined,
    value: draft.value.trim() || undefined,
    negation: draft.negation || undefined,
    date: fromDateDraft(draft.date),
    sortDate: fromDateDraft(draft.sortDate),
    place: draft.date.place.trim() || undefined,
    placeId: draft.placeId,
    addressId: draft.addressId,
    agency: draft.agency.trim() || undefined,
    religiousAffiliation: draft.religiousAffiliation.trim() || undefined,
    cause: draft.cause.trim() || undefined,
    sentence: draft.sentence.trim() || undefined,
    quality: draft.quality.trim() || undefined,
    ages: draft.ages.length > 0 ? draft.ages : undefined,
    participants: draft.participants.length > 0 ? draft.participants : undefined,
    flags: draft.flags.length > 0 ? draft.flags : undefined,
  };
}

/** The display label of a fact's kind: the tag, refined by the subtype. */
export function factKindLabel(draft: FactDraft): string {
  const tag = draft.tag.trim().toUpperCase();
  const subtype = draft.type.trim();
  if (tag === '' && subtype === '') {
    return '—';
  }
  return [tag, subtype].filter((part) => part !== '').join(' · ');
}
