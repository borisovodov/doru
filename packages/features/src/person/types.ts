import type { FactRecord, FamilyRecord, MediaRecord, NoteRecord, PersonRecord, SourceRecord } from '@doru/core';

export interface MediaWithPath extends MediaRecord {
  absolutePath: string;
}

export interface CitationInfo {
  id: string;
  source: SourceRecord;
}

/**
 * The service surface the person editor needs from its host application.
 * Grouping the callbacks into one object keeps component props small and
 * makes the wiring explicit in the app layer.
 */
export interface PersonEditorApi {
  addPerson(person: PersonRecord): Promise<void>;
  updatePerson(before: PersonRecord, after: PersonRecord): Promise<void>;
  getNotes(personId: string): Promise<NoteRecord[]>;
  addNote(personId: string, text: string): Promise<void>;
  getFamilies(): Promise<FamilyRecord[]>;
  addFamily(family: FamilyRecord): Promise<void>;
  updateFamily(before: FamilyRecord, after: FamilyRecord): Promise<void>;
  deleteFamily(family: FamilyRecord): Promise<void>;
  getSources(): Promise<SourceRecord[]>;
  getCitations(personId: string): Promise<CitationInfo[]>;
  addSource(source: SourceRecord, targetId: string): Promise<void>;
  attachSource(sourceId: string, targetId: string): Promise<void>;
  detachCitation(citationId: string): Promise<void>;
  getFacts(personId?: string, familyId?: string): Promise<FactRecord[]>;
  addFact(fact: FactRecord): Promise<void>;
  updateFact(before: FactRecord, after: FactRecord): Promise<void>;
  deleteFact(fact: FactRecord): Promise<void>;
  getMedia(personId: string): Promise<MediaWithPath[]>;
  addMedia(personId: string): Promise<void>;
  deleteMedia(media: MediaRecord): Promise<void>;
}
