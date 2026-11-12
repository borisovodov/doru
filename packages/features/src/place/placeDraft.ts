import type { PlaceRecord } from '@doru/core';
import { fromDateDraft, toDateDraft, type DateDraft } from '@doru/ui';

/** The name kinds of a place row. Official rows carry 'official' explicitly. */
export const PLACE_NAME_KINDS = ['official', 'translation', 'phonetic', 'romanized'] as const;

/** The hierarchy link kinds (GEDCOM place hierarchy types). */
export const HIERARCHY_TYPES = ['poli', 'reli', 'geog', 'cult'] as const;

/** An editable name row of a place. Position is the jurisdiction level (0 = smallest). */
export interface PlaceNameDraft {
  id: string;
  kind: string; // one of PLACE_NAME_KINDS
  language: string;
  type: string;
  position: number;
  value: string;
}

/** A postal code with its validity period. */
export interface PostalCodeDraft {
  id: string;
  code: string;
  date: DateDraft;
}

/** A parent link of the place. */
export interface HierarchyDraft {
  parentId: string; // '' = none
  type: string; // '' = unspecified
}

/**
 * The editable form of a place. The names list is ordered by jurisdiction
 * (position 0 is the smallest); `xref` is provenance passed through.
 */
export interface PlaceDraft {
  id: string;
  xref?: string | undefined;
  latitude: string;
  longitude: string;
  verified: boolean;
  names: PlaceNameDraft[];
  postalCodes: PostalCodeDraft[];
  hierarchy: HierarchyDraft[];
}

export function emptyPlaceNameDraft(position = 0): PlaceNameDraft {
  return { id: crypto.randomUUID(), kind: 'official', language: '', type: '', position, value: '' };
}

export function emptyPlaceDraft(): PlaceDraft {
  return {
    id: crypto.randomUUID(),
    latitude: '',
    longitude: '',
    verified: false,
    names: [],
    postalCodes: [],
    hierarchy: [],
  };
}

export function placeToDraft(place: PlaceRecord): PlaceDraft {
  return {
    id: place.id,
    xref: place.xref,
    latitude: place.latitude !== undefined ? String(place.latitude) : '',
    longitude: place.longitude !== undefined ? String(place.longitude) : '',
    verified: place.verified === true,
    names: (place.names ?? []).map((name) => ({
      id: name.id,
      kind: name.kind ?? 'official',
      language: name.language ?? '',
      type: name.type ?? '',
      position: name.position,
      value: name.value,
    })),
    postalCodes: (place.postalCodes ?? []).map((postal) => ({
      id: postal.id,
      code: postal.code,
      date: toDateDraft(postal.date),
    })),
    hierarchy: (place.hierarchy ?? []).map((link) => ({
      parentId: link.parentId,
      type: link.type ?? '',
    })),
  };
}

/** Builds the place record for a save; empty rows and links are dropped. */
export function placeDraftToRecord(draft: PlaceDraft): PlaceRecord {
  return {
    id: draft.id,
    xref: draft.xref,
    ...(parseCoordinate(draft.latitude) !== undefined ? { latitude: parseCoordinate(draft.latitude) } : {}),
    ...(parseCoordinate(draft.longitude) !== undefined ? { longitude: parseCoordinate(draft.longitude) } : {}),
    verified: draft.verified || undefined,
    names: draft.names
      .filter((name) => name.value.trim() !== '')
      .map((name) => ({
        id: name.id,
        kind: name.kind as PlaceRecord['names'][number]['kind'],
        ...(name.language.trim() !== '' ? { language: name.language.trim() } : {}),
        ...(name.type.trim() !== '' ? { type: name.type.trim() } : {}),
        position: name.position,
        value: name.value.trim(),
      })),
    postalCodes: draft.postalCodes
      .filter((postal) => postal.code.trim() !== '')
      .map((postal) => {
        const date = fromDateDraft(postal.date);
        return {
          id: postal.id,
          code: postal.code.trim(),
          ...(date !== undefined ? { date } : {}),
        };
      }),
    hierarchy: draft.hierarchy
      .filter((link) => link.parentId !== '')
      .map((link) => ({
        parentId: link.parentId,
        ...(link.type !== '' ? { type: link.type } : {}),
      })),
  };
}

/** The joined display form of the draft: official rows, smallest first. */
export function placeDraftName(draft: PlaceDraft): string {
  return draft.names
    .filter((name) => name.kind === 'official')
    .map((name) => name.value.trim())
    .filter((value) => value !== '')
    .join(', ');
}

/** True when the draft still equals the stored place (no external rewrite). */
export function placeDraftMatches(draft: PlaceDraft, place: PlaceRecord): boolean {
  const other = placeToDraft(place);
  return (
    draft.id === other.id &&
    draft.xref === other.xref &&
    draft.latitude === other.latitude &&
    draft.longitude === other.longitude &&
    draft.verified === other.verified &&
    draft.names.length === other.names.length &&
    draft.names.every((name, index) => {
      const entry = other.names[index]!;
      return (
        name.id === entry.id &&
        name.kind === entry.kind &&
        name.language === entry.language &&
        name.type === entry.type &&
        name.position === entry.position &&
        name.value === entry.value
      );
    }) &&
    draft.postalCodes.length === other.postalCodes.length &&
    draft.postalCodes.every((postal, index) => {
      const entry = other.postalCodes[index]!;
      return (
        postal.id === entry.id &&
        postal.code === entry.code &&
        dateDraftsMatch(postal.date, entry.date)
      );
    }) &&
    draft.hierarchy.length === other.hierarchy.length &&
    draft.hierarchy.every((link, index) => {
      const entry = other.hierarchy[index]!;
      return link.parentId === entry.parentId && link.type === entry.type;
    })
  );
}

function parseCoordinate(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : undefined;
}

function dateDraftsMatch(a: DateDraft, b: DateDraft): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.endYear === b.endYear &&
    a.endMonth === b.endMonth &&
    a.endDay === b.endDay &&
    a.text === b.text &&
    a.quality === b.quality &&
    a.place === b.place
  );
}
