import {
  FACT_FLAGS,
  type DateValue,
  type FactAge,
  type FactFlag,
  type FactParticipant,
  type FactRecord,
} from '@doru/core';
import { dateDraftsEqual, emptyDate, fromDateDraft, rebaseDate, toDateDraft, type DateDraft } from '../person/draft';

/** The event/attribute tags the form suggests; the field stays free text. */
export const EVENT_TYPES = ['BIRT', 'DEAT', 'BURI', 'MARR', 'RESI', 'OCCU', 'EMIG', 'IMMI', 'CENS', 'CHR', 'BAPM'];

/** The fact flags the form edits (Family Historian `_FLGS`). */
export { FACT_FLAGS };

/** The age roles the form offers: '' is the fact's subject, HUSB/WIFE the partners. */
export const FACT_AGE_ROLES = ['', 'HUSB', 'WIFE'] as const;

/**
 * The editable form of a fact. The text fields mirror the fact columns;
 * `date` carries the place text as well (the raw place string lives on the
 * date draft, like everywhere else in the person form). `ages`,
 * `participants` and `flags` are edited as plain lists; `primary` is the
 * separate AGES! `_PRI` marker; `placeId` and `addressId` are preserved
 * but not edited yet (no place entity picker).
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
  endDate: DateDraft;
  sortDate: DateDraft;
  placeId?: string | undefined;
  additionalPlaceIds: string[];
  addressId?: string | undefined;
  placePrefix: string;
  eventNumber: string;
  birthLength: string;
  birthWeight: string;
  cemetery: string;
  fna: boolean;
  descriptionAware: boolean;
  mapLatitude: string;
  mapLongitude: string;
  agency: string;
  religiousAffiliation: string;
  cause: string;
  sentence: string;
  quality: string;
  ages: FactAge[];
  participants: FactParticipant[];
  flags: FactFlag[];
  /** The AGES! `_PRI` marker, separate from the FH `_FLGS` flags. */
  primary: boolean;
}

/** The owner a fact belongs to: exactly one person or one family. */
export type FactOwnerRef = { kind: 'person'; id: string } | { kind: 'family'; id: string };

export function factOwnerRef(fact: Pick<FactDraft, 'personId' | 'familyId'>): FactOwnerRef | undefined {
  if (fact.personId !== undefined) {
    return { kind: 'person', id: fact.personId };
  }
  if (fact.familyId !== undefined) {
    return { kind: 'family', id: fact.familyId };
  }
  return undefined;
}

/** Moves the fact to another owner, clearing the other owner column. */
export function setFactOwner(draft: FactDraft, owner: FactOwnerRef): FactDraft {
  return {
    ...draft,
    personId: owner.kind === 'person' ? owner.id : undefined,
    familyId: owner.kind === 'family' ? owner.id : undefined,
  };
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
    endDate: emptyDate(),
    sortDate: emptyDate(),
    additionalPlaceIds: [],
    placePrefix: '',
    eventNumber: '',
    birthLength: '',
    birthWeight: '',
    cemetery: '',
    fna: false,
    descriptionAware: false,
    mapLatitude: '',
    mapLongitude: '',
    agency: '',
    religiousAffiliation: '',
    cause: '',
    sentence: '',
    quality: '',
    ages: [],
    participants: [],
    flags: [],
    primary: false,
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
    endDate: toDateDraft(fact.endDate),
    sortDate: toDateDraft(fact.sortDate),
    placeId: fact.placeId,
    additionalPlaceIds: [...(fact.additionalPlaceIds ?? [])],
    addressId: fact.addressId,
    placePrefix: fact.placePrefix ?? '',
    eventNumber: fact.eventNumber ?? '',
    birthLength: fact.birthLength ?? '',
    birthWeight: fact.birthWeight ?? '',
    cemetery: fact.cemetery ?? '',
    fna: fact.fna === true,
    descriptionAware: fact.descriptionAware === true,
    mapLatitude: fact.map !== undefined ? String(fact.map.latitude) : '',
    mapLongitude: fact.map !== undefined ? String(fact.map.longitude) : '',
    agency: fact.agency ?? '',
    religiousAffiliation: fact.religiousAffiliation ?? '',
    cause: fact.cause ?? '',
    sentence: fact.sentence ?? '',
    quality: fact.quality ?? '',
    ages: (fact.ages ?? []).map((age) => ({ ...age })),
    participants: (fact.participants ?? []).map((participant) => ({ ...participant })),
    flags: [...(fact.flags ?? [])],
    primary: fact.primary === true,
  };
}

export function factDraftToRecord(draft: FactDraft, existing?: FactRecord): FactRecord {
  const { date, place, placeId } = factDateToRecord(draft, existing);
  const sortDate = factSortDateToRecord(draft, existing);
  return {
    id: draft.id,
    personId: draft.personId,
    familyId: draft.familyId,
    tag: draft.tag.trim() || 'EVEN',
    type: draft.type.trim() || undefined,
    value: draft.value.trim() || undefined,
    negation: draft.negation || undefined,
    date,
    endDate: rebaseDate(fromDateDraft(draft.endDate), existing?.endDate),
    sortDate,
    place,
    placeId,
    ...(draft.additionalPlaceIds.filter((id) => id !== '').length > 0
      ? { additionalPlaceIds: draft.additionalPlaceIds.filter((id) => id !== '') }
      : {}),
    addressId: draft.addressId,
    placePrefix: draft.placePrefix.trim() || undefined,
    eventNumber: draft.eventNumber.trim() || undefined,
    birthLength: draft.birthLength.trim() || undefined,
    birthWeight: draft.birthWeight.trim() || undefined,
    cemetery: draft.cemetery.trim() || undefined,
    fna: draft.fna || undefined,
    descriptionAware: draft.descriptionAware || undefined,
    ...(draft.mapLatitude.trim() !== '' && draft.mapLongitude.trim() !== ''
      ? { map: { latitude: Number(draft.mapLatitude), longitude: Number(draft.mapLongitude) } }
      : {}),
    agency: draft.agency.trim() || undefined,
    religiousAffiliation: draft.religiousAffiliation.trim() || undefined,
    cause: draft.cause.trim() || undefined,
    sentence: draft.sentence.trim() || undefined,
    quality: draft.quality.trim() || undefined,
    ages: draft.ages.length > 0 ? draft.ages : undefined,
    participants: draft.participants.length > 0 ? draft.participants : undefined,
    flags: draft.flags.length > 0 ? draft.flags : undefined,
    primary: draft.primary || undefined,
  };
}

/**
 * The fact's date and place: when the visible fields are unchanged, the
 * stored values are kept verbatim; otherwise the date is rebuilt with the
 * invisible fields carried over (see rebaseDate), and a changed place
 * text invalidates the placeId link.
 */
function factDateToRecord(
  draft: FactDraft,
  existing: FactRecord | undefined,
): { date: DateValue | undefined; place: string | undefined; placeId: string | undefined } {
  const place = draft.date.place.trim() || undefined;
  if (existing !== undefined && dateDraftsEqual(draft.date, toDateDraft(existing.date, existing.place ?? ''))) {
    return { date: existing.date, place: existing.place, placeId: existing.placeId };
  }
  const placeChanged = existing !== undefined && (existing.place ?? '') !== (place ?? '');
  return {
    date: rebaseDate(fromDateDraft(draft.date), existing?.date),
    place,
    placeId: placeChanged ? undefined : draft.placeId,
  };
}

function factSortDateToRecord(draft: FactDraft, existing: FactRecord | undefined): DateValue | undefined {
  if (existing?.sortDate !== undefined && dateDraftsEqual(draft.sortDate, toDateDraft(existing.sortDate))) {
    return existing.sortDate;
  }
  return rebaseDate(fromDateDraft(draft.sortDate), existing?.sortDate);
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
