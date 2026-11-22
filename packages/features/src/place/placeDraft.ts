import type { PlaceRecord } from '@doru/core';
import { dateDraftsEqual, emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '@doru/ui/domain';

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
  date: DateDraft;
  addition: string;
  abbreviation: string;
  abbreviationType: string;
}

/** A postal code with its validity period. */
export interface PostalCodeDraft {
  id: string;
  code: string;
  date: DateDraft;
}

/** A parent link of the place. The id keeps the stored row addressable. */
export interface HierarchyDraft {
  id: string;
  parentId: string; // '' = none
  type: string; // '' = unspecified
  date: DateDraft;
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
  form: string;
  abbreviation: string;
  preposition: string;
  govId: string;
  maidenhead: string;
  placeType: string;
  names: PlaceNameDraft[];
  postalCodes: PostalCodeDraft[];
  hierarchy: HierarchyDraft[];
}

/** Rewrites jurisdiction positions to the list order after add/move/remove. */
export function withPlaceNamePositions(names: PlaceNameDraft[]): PlaceNameDraft[] {
  return names.map((name, position) => ({ ...name, position }));
}

export function emptyPlaceNameDraft(position = 0): PlaceNameDraft {
  return {
    id: crypto.randomUUID(),
    kind: 'official',
    language: '',
    type: '',
    position,
    value: '',
    date: emptyDate(),
    addition: '',
    abbreviation: '',
    abbreviationType: '',
  };
}

export function emptyPlaceDraft(): PlaceDraft {
  return {
    id: crypto.randomUUID(),
    latitude: '',
    longitude: '',
    verified: false,
    form: '',
    abbreviation: '',
    preposition: '',
    govId: '',
    maidenhead: '',
    placeType: '',
    names: [emptyPlaceNameDraft()],
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
    form: (place.form ?? []).join(', '),
    abbreviation: place.abbreviation ?? '',
    preposition: place.preposition ?? '',
    govId: place.govId ?? '',
    maidenhead: place.maidenhead ?? '',
    placeType: place.placeType ?? '',
    names: place.names.map((name) => ({
      id: name.id,
      kind: name.kind ?? 'official',
      language: name.language ?? '',
      type: name.type ?? '',
      position: name.position,
      value: name.value,
      date: toDateDraft(name.date),
      addition: name.addition ?? '',
      abbreviation: name.abbreviation ?? '',
      abbreviationType: name.abbreviationType ?? '',
    })),
    postalCodes: (place.postalCodes ?? []).map((postal) => ({
      id: postal.id,
      code: postal.code,
      date: toDateDraft(postal.date),
    })),
    hierarchy: (place.hierarchy ?? []).map((link) => ({
      id: link.id,
      parentId: link.parentId,
      type: link.type ?? '',
      date: toDateDraft(link.date),
    })),
  };
}

/** Builds the place record for a save; empty rows and links are dropped. */
export function placeDraftToRecord(draft: PlaceDraft, existing?: PlaceRecord): PlaceRecord {
  const existingNames = new Map((existing?.names ?? []).map((name) => [name.id, name]));
  const existingPostals = new Map((existing?.postalCodes ?? []).map((postal) => [postal.id, postal]));
  const existingLinks = new Map((existing?.hierarchy ?? []).map((link) => [link.id, link]));
  return {
    id: draft.id,
    xref: draft.xref,
    ...(parseCoordinate(draft.latitude) !== undefined ? { latitude: parseCoordinate(draft.latitude) } : {}),
    ...(parseCoordinate(draft.longitude) !== undefined ? { longitude: parseCoordinate(draft.longitude) } : {}),
    verified: draft.verified || undefined,
    ...(draft.form.trim() !== ''
      ? {
          form: draft.form
            .split(',')
            .map((value) => value.trim())
            .filter((value) => value !== ''),
        }
      : {}),
    ...(draft.abbreviation.trim() !== '' ? { abbreviation: draft.abbreviation.trim() } : {}),
    ...(draft.preposition.trim() !== '' ? { preposition: draft.preposition.trim() } : {}),
    ...(draft.govId.trim() !== '' ? { govId: draft.govId.trim() } : {}),
    ...(draft.maidenhead.trim() !== '' ? { maidenhead: draft.maidenhead.trim() } : {}),
    ...(draft.placeType.trim() !== '' ? { placeType: draft.placeType.trim() } : {}),
    names: draft.names
      .filter((name) => name.value.trim() !== '')
      .map((name) => {
        const date = fromDateDraft(name.date, existingNames.get(name.id)?.date);
        return {
          id: name.id,
          kind: name.kind as PlaceRecord['names'][number]['kind'],
          ...(name.language.trim() !== '' ? { language: name.language.trim() } : {}),
          ...(name.type.trim() !== '' ? { type: name.type.trim() } : {}),
          position: name.position,
          value: name.value.trim(),
          ...(date !== undefined ? { date } : {}),
          ...(name.addition.trim() !== '' ? { addition: name.addition.trim() } : {}),
          ...(name.abbreviation.trim() !== '' ? { abbreviation: name.abbreviation.trim() } : {}),
          ...(name.abbreviationType.trim() !== '' ? { abbreviationType: name.abbreviationType.trim() } : {}),
        };
      }),
    postalCodes: draft.postalCodes
      .filter((postal) => postal.code.trim() !== '')
      .map((postal) => {
        const date = fromDateDraft(postal.date, existingPostals.get(postal.id)?.date);
        return {
          id: postal.id,
          code: postal.code.trim(),
          ...(date !== undefined ? { date } : {}),
        };
      }),
    hierarchy: draft.hierarchy
      .filter((link) => link.parentId !== '')
      .map((link) => {
        const date = fromDateDraft(link.date, existingLinks.get(link.id)?.date);
        return {
          id: link.id,
          parentId: link.parentId,
          ...(link.type !== '' ? { type: link.type } : {}),
          ...(date !== undefined ? { date } : {}),
        };
      }),
  };
}

function placeRowsEqual<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergePlaceRow<T extends { id: string }>(draft: T, previous: T, refreshed: T): T {
  const merged: T = { ...draft };
  for (const key of Object.keys(draft) as Array<keyof T>) {
    if (key === 'date') {
      const draftDate = (draft as unknown as { date: DateDraft }).date;
      const previousDate = (previous as unknown as { date: DateDraft }).date;
      if (dateDraftsEqual(draftDate, previousDate)) {
        (merged as unknown as { date: DateDraft }).date = (refreshed as unknown as { date: DateDraft }).date;
      }
    } else if (JSON.stringify(draft[key]) === JSON.stringify(previous[key])) {
      merged[key] = refreshed[key];
    }
  }
  return merged;
}

function mergePlaceRows<T extends { id: string }>(
  draftRows: T[],
  comparisonRows: T[],
  previousRows: T[],
  refreshedRows: T[],
): T[] {
  const comparisonById = new Map(comparisonRows.map((row) => [row.id, row]));
  const previousById = new Map(previousRows.map((row) => [row.id, row]));
  const refreshedById = new Map(refreshedRows.map((row) => [row.id, row]));
  const draftIds = new Set(draftRows.map((row) => row.id));
  const merged: T[] = [];
  for (const row of draftRows) {
    const comparison = comparisonById.get(row.id);
    const previous = previousById.get(row.id);
    if (previous === undefined) {
      const refreshed = refreshedById.get(row.id);
      if (comparison !== undefined && placeRowsEqual(row, comparison) && refreshed !== undefined) {
        merged.push(refreshed);
      } else {
        merged.push(row);
      }
      continue;
    }
    const refreshed = refreshedById.get(row.id);
    if (comparison !== undefined && placeRowsEqual(row, comparison)) {
      if (refreshed !== undefined) {
        merged.push(refreshed);
      }
      continue;
    }
    if (refreshed === undefined) {
      merged.push(row);
      continue;
    }
    merged.push(mergePlaceRow(row, comparison ?? previous, refreshed));
  }
  for (const row of refreshedRows) {
    if (!draftIds.has(row.id) && !previousById.has(row.id) && !comparisonById.has(row.id)) {
      merged.push(row);
    }
  }
  return merged;
}

/**
 * Merges a refreshed stored place into a dirty draft: untouched fields take
 * the refreshed row (keeping its date ids), while user edits and additions
 * stay. Rows deleted externally disappear unless the user edited them.
 */
export function mergePlaceDraft(
  draft: PlaceDraft,
  previous: PlaceRecord,
  refreshed: PlaceRecord,
  submitted?: PlaceDraft,
  pending?: PlaceDraft,
): PlaceDraft {
  const previousDraft = placeToDraft(previous);
  const base = submitted ?? previousDraft;
  const next = placeToDraft(refreshed);
  const scalar = <K extends keyof PlaceDraft>(key: K): PlaceDraft[K] => {
    // A field touched by an in-flight write keeps the current (possibly
    // reverted) value until the write is confirmed.
    if (pending !== undefined && JSON.stringify(pending[key]) !== JSON.stringify(previousDraft[key])) {
      return draft[key];
    }
    return draft[key] === base[key] ? next[key] : draft[key];
  };
  const pendingNames = pending !== undefined && JSON.stringify(pending.names) !== JSON.stringify(previousDraft.names);
  const pendingPostalCodes =
    pending !== undefined && JSON.stringify(pending.postalCodes) !== JSON.stringify(previousDraft.postalCodes);
  const pendingHierarchy =
    pending !== undefined && JSON.stringify(pending.hierarchy) !== JSON.stringify(previousDraft.hierarchy);
  return {
    id: draft.id,
    xref: scalar('xref'),
    latitude: scalar('latitude'),
    longitude: scalar('longitude'),
    verified: scalar('verified'),
    form: scalar('form'),
    abbreviation: scalar('abbreviation'),
    preposition: scalar('preposition'),
    govId: scalar('govId'),
    maidenhead: scalar('maidenhead'),
    placeType: scalar('placeType'),
    names: pendingNames
      ? draft.names
      : mergePlaceRows(draft.names, base.names, previousDraft.names, next.names).sort(
          (left, right) => left.position - right.position,
        ),
    postalCodes: pendingPostalCodes
      ? draft.postalCodes
      : mergePlaceRows(draft.postalCodes, base.postalCodes, previousDraft.postalCodes, next.postalCodes),
    hierarchy: pendingHierarchy
      ? draft.hierarchy
      : mergePlaceRows(draft.hierarchy, base.hierarchy, previousDraft.hierarchy, next.hierarchy),
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
    draft.form === other.form &&
    draft.abbreviation === other.abbreviation &&
    draft.preposition === other.preposition &&
    draft.govId === other.govId &&
    draft.maidenhead === other.maidenhead &&
    draft.placeType === other.placeType &&
    draft.names.length === other.names.length &&
    draft.names.every((name, index) => {
      const entry = other.names[index];
      if (entry === undefined) {
        return false;
      }
      return (
        name.id === entry.id &&
        name.kind === entry.kind &&
        name.language === entry.language &&
        name.type === entry.type &&
        name.position === entry.position &&
        name.value === entry.value &&
        name.addition === entry.addition &&
        name.abbreviation === entry.abbreviation &&
        name.abbreviationType === entry.abbreviationType &&
        dateDraftsEqual(name.date, entry.date)
      );
    }) &&
    draft.postalCodes.length === other.postalCodes.length &&
    draft.postalCodes.every((postal, index) => {
      const entry = other.postalCodes[index];
      if (entry === undefined) {
        return false;
      }
      return postal.id === entry.id && postal.code === entry.code && dateDraftsEqual(postal.date, entry.date);
    }) &&
    draft.hierarchy.length === other.hierarchy.length &&
    draft.hierarchy.every((link, index) => {
      const entry = other.hierarchy[index];
      return (
        entry !== undefined &&
        link.id === entry.id &&
        link.parentId === entry.parentId &&
        link.type === entry.type &&
        dateDraftsEqual(link.date, entry.date)
      );
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
