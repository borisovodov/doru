import type {
  AssociationRecord,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  RestrictionRecord,
  SourceRecord,
  TagLinkRecord,
  TagRecord,
} from '@doru/core';

export interface MediaWithPath extends MediaRecord {
  absolutePath: string;
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
  getAssociations(personId: string): Promise<AssociationRecord[]>;
  addAssociation(association: AssociationRecord): Promise<void>;
  updateAssociation(before: AssociationRecord, after: AssociationRecord): Promise<void>;
  deleteAssociation(association: AssociationRecord): Promise<void>;
  getSources(): Promise<SourceRecord[]>;
  getCitations(personId: string): Promise<CitationRecord[]>;
  addSource(source: SourceRecord, targetId: string): Promise<void>;
  attachSource(sourceId: string, targetId: string): Promise<void>;
  detachCitation(citationId: string): Promise<void>;
  updateCitation(before: CitationRecord, after: CitationRecord): Promise<void>;
  /** Opens the source tab of the app (host-level navigation). */
  openSource?: ((sourceId: string) => void) | undefined;
  getFacts(personId?: string, familyId?: string): Promise<FactRecord[]>;
  addFact(fact: FactRecord): Promise<void>;
  updateFact(before: FactRecord, after: FactRecord): Promise<void>;
  deleteFact(fact: FactRecord): Promise<void>;
  getMedia(personId: string): Promise<MediaWithPath[]>;
  addMedia(personId: string): Promise<void>;
  deleteMedia(media: MediaRecord): Promise<void>;
  getIdentifiers(personId: string): Promise<IdentifierRecord[]>;
  addIdentifier(identifier: IdentifierRecord): Promise<void>;
  deleteIdentifier(identifier: IdentifierRecord): Promise<void>;
  getContacts(personId: string): Promise<ContactRecord[]>;
  addContact(contact: ContactRecord): Promise<void>;
  deleteContact(contact: ContactRecord): Promise<void>;
  getRestrictions(personId: string): Promise<RestrictionRecord[]>;
  addRestriction(restriction: RestrictionRecord): Promise<void>;
  deleteRestriction(restriction: RestrictionRecord): Promise<void>;
  getTags(): Promise<TagRecord[]>;
  getTagLinks(personId: string): Promise<Array<{ tagId: string; link: TagLinkRecord }>>;
  addTag(tag: TagRecord): Promise<void>;
  attachTag(link: TagLinkRecord): Promise<void>;
  detachTag(link: TagLinkRecord): Promise<void>;
  getChanges(personId: string): Promise<ChangeRecord[]>;
  getPlaces(): Promise<PlaceRecord[]>;
}

/** The service surface the source tab needs from its host application. */
export interface SourceEditorApi {
  getSources(): Promise<SourceRecord[]>;
  updateSource(before: SourceRecord, after: SourceRecord): Promise<void>;
  deleteSource(source: SourceRecord): Promise<void>;
  getRepositories(): Promise<RepositoryRecord[]>;
  addRepository(repository: RepositoryRecord): Promise<void>;
}

/** The service surface the place tab needs from its host application. */
export interface PlaceEditorApi {
  getPlaces(): Promise<PlaceRecord[]>;
  updatePlace(before: PlaceRecord, after: PlaceRecord): Promise<void>;
  deletePlace(place: PlaceRecord): Promise<void>;
}
