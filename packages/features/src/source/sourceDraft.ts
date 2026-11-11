import type { SourceRecord } from '@doru/core';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

/** An editable text extract of a source or citation. */
export interface SourceTextDraft {
  id: string;
  text: string;
  mime: string;
  language: string;
}

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

/** A source-template field (7.0 templated citations). */
export interface TemplateFieldDraft {
  id: string;
  name: string;
  value: string;
}

/**
 * The editable form of a source record. `titleId` and `xref` are
 * provenance fields passed through untouched; the bibliographic work
 * (TITL) has no editor yet.
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
  agency: string;
  /** The publication date; the date draft's place field holds the publication place. */
  pubDate: DateDraft;
  titleId?: string | undefined;
  xref?: string | undefined;
  texts: SourceTextDraft[];
  dataEvents: SourceDataEventDraft[];
  repositories: SourceRepositoryDraft[];
  templateFields: TemplateFieldDraft[];
}

export function emptySourceTextDraft(): SourceTextDraft {
  return { id: crypto.randomUUID(), text: '', mime: '', language: '' };
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
    agency: '',
    pubDate: emptyDate(),
    texts: [],
    dataEvents: [],
    repositories: [],
    templateFields: [],
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
    agency: source.agency ?? '',
    pubDate: toDateDraft(source.pubDate, source.pubPlace ?? ''),
    titleId: source.titleId,
    xref: source.xref,
    texts: (source.texts ?? []).map((text) => ({
      id: text.id,
      text: text.text,
      mime: text.mime ?? '',
      language: text.language ?? '',
    })),
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
    templateFields: (source.templateFields ?? []).map((field) => ({
      id: field.id,
      name: field.name,
      value: field.value ?? '',
    })),
  };
}

/**
 * Builds the source record for a save. Empty sub-rows (a text without
 * content, a repository link without a picked repository, …) are dropped;
 * ids are preserved so nothing is re-created on every save.
 */
export function sourceDraftToRecord(draft: SourceDraft): SourceRecord {
  return {
    id: draft.id,
    xref: draft.xref,
    title: draft.title.trim() || undefined,
    abbreviation: draft.abbreviation.trim() || undefined,
    author: draft.author.trim() || undefined,
    publication: draft.publication.trim() || undefined,
    medium: draft.medium.trim() || undefined,
    url: draft.url.trim() || undefined,
    accessDate: draft.accessDate.trim() || undefined,
    confidence: draft.confidence.trim() || undefined,
    agency: draft.agency.trim() || undefined,
    pubDate: fromDateDraft(draft.pubDate),
    pubPlace: draft.pubDate.place.trim() || undefined,
    titleId: draft.titleId,
    texts: draft.texts
      .filter((text) => text.text.trim() !== '')
      .map((text) => ({
        id: text.id,
        text: text.text.trim(),
        mime: text.mime.trim() || undefined,
        language: text.language.trim() || undefined,
      })),
    dataEvents: draft.dataEvents
      .filter((event) => event.tag.trim() !== '' || event.date.year !== '' || event.date.text.trim() !== '')
      .map((event) => {
        const date = fromDateDraft(event.date);
        return {
          id: event.id,
          tag: event.tag.trim() || 'EVEN',
          ...(event.value.trim() !== '' ? { value: event.value.trim() } : {}),
          ...(date !== undefined ? { date } : {}),
          ...(event.placeId !== undefined ? { placeId: event.placeId } : {}),
        };
      }),
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
    templateFields: draft.templateFields
      .filter((field) => field.name.trim() !== '')
      .map((field) => ({
        id: field.id,
        name: field.name.trim(),
        ...(field.value.trim() !== '' ? { value: field.value.trim() } : {}),
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
  return (
    base &&
    draft.texts.every((text) => text.text.trim() === '') &&
    draft.dataEvents.length === 0 &&
    draft.repositories.length === 0 &&
    draft.templateFields.length === 0
  );
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
    draft.agency === other.agency &&
    draft.titleId === other.titleId &&
    draft.xref === other.xref &&
    dateDraftsMatch(draft.pubDate, other.pubDate) &&
    draft.texts.length === other.texts.length &&
    draft.texts.every((text, index) => {
      const entry = other.texts[index]!;
      return text.id === entry.id && text.text === entry.text && text.mime === entry.mime && text.language === entry.language;
    }) &&
    draft.dataEvents.length === other.dataEvents.length &&
    draft.dataEvents.every((event, index) => {
      const entry = other.dataEvents[index]!;
      return (
        event.id === entry.id &&
        event.tag === entry.tag &&
        event.value === entry.value &&
        event.placeId === entry.placeId &&
        dateDraftsMatch(event.date, entry.date)
      );
    }) &&
    draft.repositories.length === other.repositories.length &&
    draft.repositories.every((link, index) => {
      const entry = other.repositories[index]!;
      return (
        link.id === entry.id &&
        link.repositoryId === entry.repositoryId &&
        link.callNumbers.length === entry.callNumbers.length &&
        link.callNumbers.every((callNumber, callIndex) => {
          const callEntry = entry.callNumbers[callIndex]!;
          return (
            callNumber.id === callEntry.id &&
            callNumber.value === callEntry.value &&
            callNumber.medium === callEntry.medium
          );
        })
      );
    }) &&
    draft.templateFields.length === other.templateFields.length &&
    draft.templateFields.every((field, index) => {
      const entry = other.templateFields[index]!;
      return field.id === entry.id && field.name === entry.name && field.value === entry.value;
    })
  );
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
