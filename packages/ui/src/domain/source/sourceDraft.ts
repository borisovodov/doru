import type { SourceRecord } from '@doru/core';
import { dateDraftsEqual, emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

/** An editable event recorded in a source (source DATA block). */
export interface SourceDataEventDraft {
  id: string;
  tag: string;
  value: string;
  date: DateDraft;
  placeId?: string | undefined; // pass-through, no place entity picker yet
}

/** A call number of a source's repository copy. */
export interface CallNumberDraft {
  id: string;
  value: string;
  medium: string;
}

/** A repository holding the source, with its call numbers. */
export interface SourceRepositoryDraft {
  id: string;
  repositoryId: string;
  callNumbers: CallNumberDraft[];
}

/**
 * The editable form of a source record. `titleId` is a provenance field
 * passed through untouched; the bibliographic work (TITL) has no editor yet.
 */
export interface SourceDraft {
  id: string;
  title: string;
  abbreviation: string;
  author: string;
  publication: string;
  medium: string;
  url: string;
  accessDate: string;
  confidence: string;
  certainty: string;
  subsequentCitationFormat: string;
  bibliography: string;
  dataNote: string;
  agency: string;
  /** The publication date; the date draft's place field holds the publication place. */
  pubDate: DateDraft;
  titleId?: string | undefined;
  text: string;
  dataEvents: SourceDataEventDraft[];
  repositories: SourceRepositoryDraft[];
}

export function emptySourceDraft(): SourceDraft {
  return {
    id: crypto.randomUUID(),
    title: '',
    abbreviation: '',
    author: '',
    publication: '',
    medium: '',
    url: '',
    accessDate: '',
    confidence: '',
    certainty: '',
    subsequentCitationFormat: '',
    bibliography: '',
    dataNote: '',
    agency: '',
    pubDate: emptyDate(),
    text: '',
    dataEvents: [],
    repositories: [],
  };
}

export function sourceToDraft(source: SourceRecord): SourceDraft {
  return {
    id: source.id,
    title: source.title ?? '',
    abbreviation: source.abbreviation ?? '',
    author: source.author ?? '',
    publication: source.publication ?? '',
    medium: source.medium ?? '',
    url: source.url ?? '',
    accessDate: source.accessDate ?? '',
    confidence: source.confidence ?? '',
    certainty: source.certainty ?? '',
    subsequentCitationFormat: source.subsequentCitationFormat ?? '',
    bibliography: source.bibliography ?? '',
    dataNote: source.dataNote ?? '',
    agency: source.agency ?? '',
    pubDate: toDateDraft(source.pubDate, source.pubPlace ?? ''),
    titleId: source.titleId,
    text: source.text ?? '',
    dataEvents: (source.dataEvents ?? []).map((event) => ({
      id: event.id,
      tag: event.tag,
      value: event.value ?? '',
      date: toDateDraft(event.date),
      placeId: event.placeId,
    })),
    repositories: (source.repositories ?? []).map((link) => ({
      id: link.id,
      repositoryId: link.repositoryId,
      callNumbers: (link.callNumbers ?? []).map((callNumber) => ({
        id: callNumber.id,
        value: callNumber.value,
        medium: callNumber.medium ?? '',
      })),
    })),
  };
}

function mergeSourceRows<T extends { id: string }>(current: T[], base: T[], refreshed: T[]): T[] {
  if (JSON.stringify(current) === JSON.stringify(base)) {
    return refreshed;
  }
  const baseById = new Map(base.map((row) => [row.id, row]));
  const refreshedById = new Map(refreshed.map((row) => [row.id, row]));
  const currentIds = new Set(current.map((row) => row.id));
  const merged: T[] = [];
  for (const row of current) {
    const previous = baseById.get(row.id);
    if (previous === undefined) {
      merged.push(row);
      continue;
    }
    if (JSON.stringify(row) === JSON.stringify(previous)) {
      const fresh = refreshedById.get(row.id);
      if (fresh !== undefined) {
        merged.push(fresh);
      }
      continue;
    }
    // A local edit wins over a concurrent change to the same row.
    merged.push(row);
  }
  for (const row of refreshed) {
    if (!currentIds.has(row.id) && !baseById.has(row.id)) {
      merged.push(row);
    }
  }
  return merged;
}

/** Merges refreshed stored fields into a dirty draft, keeping user edits. */
export function mergeSourceDraft(current: SourceDraft, base: SourceDraft, refreshed: SourceDraft): SourceDraft {
  const merged = { ...current };
  for (const key of Object.keys(refreshed) as Array<keyof SourceDraft>) {
    if (key === 'id' || Array.isArray(refreshed[key])) {
      continue;
    }
    if (JSON.stringify(current[key]) === JSON.stringify(base[key])) {
      (merged as unknown as Record<string, unknown>)[key] = refreshed[key];
    }
  }
  merged.dataEvents = mergeSourceRows(current.dataEvents, base.dataEvents, refreshed.dataEvents);
  merged.repositories = mergeSourceRows(current.repositories, base.repositories, refreshed.repositories);
  return merged;
}

/**
 * Builds the source record for a save. Empty sub-rows (a text without
 * content, a repository link without a picked repository, …) are dropped;
 * ids are preserved so nothing is re-created on every save.
 */
export function sourceDraftToRecord(draft: SourceDraft, existing?: SourceRecord): SourceRecord {
  const existingEvents = new Map((existing?.dataEvents ?? []).map((event) => [event.id, event]));
  return {
    id: draft.id,
    title: draft.title.trim() || undefined,
    abbreviation: draft.abbreviation.trim() || undefined,
    author: draft.author.trim() || undefined,
    publication: draft.publication.trim() || undefined,
    medium: draft.medium.trim() || undefined,
    url: draft.url.trim() || undefined,
    accessDate: draft.accessDate.trim() || undefined,
    confidence: draft.confidence.trim() || undefined,
    certainty: draft.certainty.trim() || undefined,
    subsequentCitationFormat: draft.subsequentCitationFormat.trim() || undefined,
    bibliography: draft.bibliography.trim() || undefined,
    dataNote: draft.dataNote.trim() || undefined,
    agency: draft.agency.trim() || undefined,
    pubDate: fromDateDraft(draft.pubDate, existing?.pubDate),
    pubPlace: draft.pubDate.place.trim() || undefined,
    titleId: draft.titleId,
    text: draft.text.trim() || undefined,
    dataEvents: draft.dataEvents
      .map((event) => {
        const date = fromDateDraft(event.date, existingEvents.get(event.id)?.date);
        const value = event.value.trim();
        return { event, date, value };
      })
      .filter(({ event, date, value }) => event.tag.trim() !== '' || value !== '' || date !== undefined)
      .map(({ event, date, value }) => ({
        id: event.id,
        tag: event.tag.trim() || 'EVEN',
        ...(value !== '' ? { value } : {}),
        ...(date !== undefined ? { date } : {}),
        ...(event.placeId !== undefined ? { placeId: event.placeId } : {}),
      })),
    repositories: draft.repositories
      .filter((link) => link.repositoryId !== '')
      .map((link) => ({
        id: link.id,
        repositoryId: link.repositoryId,
        callNumbers: link.callNumbers
          .filter((callNumber) => callNumber.value.trim() !== '')
          .map((callNumber) => ({
            id: callNumber.id,
            value: callNumber.value.trim(),
            ...(callNumber.medium.trim() !== '' ? { medium: callNumber.medium.trim() } : {}),
          })),
      })),
  };
}

/** True when the source carries nothing beyond its id (an abandoned new source). */
export function sourceDraftEmpty(draft: SourceDraft): boolean {
  const base =
    draft.title.trim() === '' &&
    draft.abbreviation.trim() === '' &&
    draft.author.trim() === '' &&
    draft.publication.trim() === '' &&
    draft.medium.trim() === '' &&
    draft.url.trim() === '' &&
    draft.accessDate.trim() === '' &&
    draft.confidence.trim() === '' &&
    draft.agency.trim() === '';
  return base && draft.text.trim() === '' && draft.dataEvents.length === 0 && draft.repositories.length === 0;
}

/** True when the draft still equals the stored source (no external rewrite). */
export function sourceDraftMatches(draft: SourceDraft, source: SourceRecord): boolean {
  const other = sourceToDraft(source);
  return (
    draft.id === other.id &&
    draft.title === other.title &&
    draft.abbreviation === other.abbreviation &&
    draft.author === other.author &&
    draft.publication === other.publication &&
    draft.medium === other.medium &&
    draft.url === other.url &&
    draft.accessDate === other.accessDate &&
    draft.confidence === other.confidence &&
    draft.certainty === other.certainty &&
    draft.subsequentCitationFormat === other.subsequentCitationFormat &&
    draft.bibliography === other.bibliography &&
    draft.dataNote === other.dataNote &&
    draft.agency === other.agency &&
    draft.titleId === other.titleId &&
    dateDraftsEqual(draft.pubDate, other.pubDate) &&
    draft.text === other.text &&
    draft.dataEvents.length === other.dataEvents.length &&
    draft.dataEvents.every((event, index) => {
      const entry = other.dataEvents[index];
      return (
        entry !== undefined &&
        event.id === entry.id &&
        event.tag === entry.tag &&
        event.value === entry.value &&
        event.placeId === entry.placeId &&
        dateDraftsEqual(event.date, entry.date)
      );
    }) &&
    draft.repositories.length === other.repositories.length &&
    draft.repositories.every((link, index) => {
      const entry = other.repositories[index];
      return (
        entry !== undefined &&
        link.id === entry.id &&
        link.repositoryId === entry.repositoryId &&
        link.callNumbers.length === entry.callNumbers.length &&
        link.callNumbers.every((callNumber, callIndex) => {
          const callEntry = entry.callNumbers[callIndex];
          return (
            callEntry !== undefined &&
            callNumber.id === callEntry.id &&
            callNumber.value === callEntry.value &&
            callNumber.medium === callEntry.medium
          );
        })
      );
    })
  );
}
