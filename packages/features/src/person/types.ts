import type {
  AddressRecord,
  AssociationRecord,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  MediaRecord,
  NoteLinkRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TitleRecord,
} from '@doru/core';

export interface MediaWithPath extends MediaRecord {
  absolutePath: string;
}

/**
 * The generic attachment CRUD shared by every entity editor: notes,
 * citations/sources, identifiers, contacts, restrictions and tags, all
 * addressed by a (targetType, targetId) pair.
 */
export interface AttachmentsApi {
  getNotes(targetType: string, targetId: string): Promise<NoteRecord[]>;
  addNote(note: NoteRecord): Promise<void>;
  updateNote(before: NoteRecord, after: NoteRecord, context?: NoteLinkRecord): Promise<void>;
  deleteNote(note: NoteRecord): Promise<void>;
  getCitations(targetType: string, targetId: string): Promise<CitationRecord[]>;
  updateCitation(before: CitationRecord, after: CitationRecord): Promise<void>;
  getSources(): Promise<SourceRecord[]>;
  addSource(source: SourceRecord, targetType?: string, targetId?: string): Promise<void>;
  attachSource(sourceId: string, targetType: string, targetId: string): Promise<void>;
  detachCitation(citationId: string): Promise<void>;
  getIdentifiers(targetType: string, targetId: string): Promise<IdentifierRecord[]>;
  addIdentifier(identifier: IdentifierRecord): Promise<void>;
  updateIdentifier(before: IdentifierRecord, after: IdentifierRecord): Promise<void>;
  deleteIdentifier(identifier: IdentifierRecord): Promise<void>;
  getContacts(targetType: string, targetId: string): Promise<ContactRecord[]>;
  addContact(contact: ContactRecord): Promise<void>;
  updateContact(before: ContactRecord, after: ContactRecord): Promise<void>;
  deleteContact(contact: ContactRecord): Promise<void>;
  getRestrictions(targetType: string, targetId: string): Promise<RestrictionRecord[]>;
  addRestriction(restriction: RestrictionRecord): Promise<void>;
  updateRestriction(before: RestrictionRecord, after: RestrictionRecord): Promise<void>;
  deleteRestriction(restriction: RestrictionRecord): Promise<void>;
  getTags(): Promise<TagRecord[]>;
  getTagLinks(targetType: string, targetId: string): Promise<Array<{ tagId: string; link: TagLinkRecord }>>;
  addTag(tag: TagRecord): Promise<void>;
  updateTag(before: TagRecord, after: TagRecord): Promise<void>;
  deleteTag(tag: TagRecord): Promise<void>;
  attachTag(link: TagLinkRecord): Promise<void>;
  detachTag(link: TagLinkRecord): Promise<void>;
  updateTagLink(before: TagLinkRecord, after: TagLinkRecord): Promise<void>;
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
  updateNote(before: NoteRecord, after: NoteRecord, context: NoteLinkRecord): Promise<void>;
  deleteNote(note: NoteRecord): Promise<void>;
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
  updateIdentifier(before: IdentifierRecord, after: IdentifierRecord): Promise<void>;
  deleteIdentifier(identifier: IdentifierRecord): Promise<void>;
  getContacts(personId: string): Promise<ContactRecord[]>;
  addContact(contact: ContactRecord): Promise<void>;
  updateContact(before: ContactRecord, after: ContactRecord): Promise<void>;
  deleteContact(contact: ContactRecord): Promise<void>;
  getRestrictions(personId: string): Promise<RestrictionRecord[]>;
  addRestriction(restriction: RestrictionRecord): Promise<void>;
  updateRestriction(before: RestrictionRecord, after: RestrictionRecord): Promise<void>;
  deleteRestriction(restriction: RestrictionRecord): Promise<void>;
  getTags(): Promise<TagRecord[]>;
  getAliases(personId: string): Promise<Array<{ id: string; aliasId: string }>>;
  addAlias(personId: string, aliasId: string): Promise<void>;
  deleteAlias(id: string, personId: string, aliasId: string): Promise<void>;
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
  addRecordSubmitter(submitterId: string, targetType: string, targetId: string): Promise<void>;
  deleteRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): Promise<void>;
  getTagLinks(personId: string): Promise<Array<{ tagId: string; link: TagLinkRecord }>>;
  addTag(tag: TagRecord): Promise<void>;
  updateTag(before: TagRecord, after: TagRecord): Promise<void>;
  deleteTag(tag: TagRecord): Promise<void>;
  attachTag(link: TagLinkRecord): Promise<void>;
  detachTag(link: TagLinkRecord): Promise<void>;
  updateTagLink(before: TagLinkRecord, after: TagLinkRecord): Promise<void>;
  getChanges(personId: string): Promise<ChangeRecord[]>;
  getPlaces(): Promise<PlaceRecord[]>;
  getAddresses(): Promise<AddressRecord[]>;
}

/** The service surface the source tab needs from its host application. */
export interface SourceEditorApi extends AttachmentsApi {
  updateSource(before: SourceRecord, after: SourceRecord): Promise<void>;
  deleteSource(source: SourceRecord): Promise<void>;
  getRepositories(): Promise<RepositoryRecord[]>;
  addRepository(repository: RepositoryRecord): Promise<void>;
  getTitles(): Promise<TitleRecord[]>;
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
  addRecordSubmitter(submitterId: string, targetType: string, targetId: string): Promise<void>;
  deleteRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): Promise<void>;
}

/** The service surface the place tab needs from its host application. */
export interface PlaceEditorApi extends AttachmentsApi {
  getPlaces(): Promise<PlaceRecord[]>;
  addPlace(place: PlaceRecord): Promise<void>;
  updatePlace(before: PlaceRecord, after: PlaceRecord): Promise<void>;
  deletePlace(place: PlaceRecord): Promise<void>;
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
  addRecordSubmitter(submitterId: string, targetType: string, targetId: string): Promise<void>;
  deleteRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): Promise<void>;
}

/** The service surface the registries view needs from its host application. */
export interface RegistriesEditorApi {
  getRepositories(): Promise<RepositoryRecord[]>;
  addRepository(repository: RepositoryRecord): Promise<void>;
  updateRepository(before: RepositoryRecord, after: RepositoryRecord): Promise<void>;
  deleteRepository(repository: RepositoryRecord): Promise<void>;
  getSubmitters(): Promise<SubmitterRecord[]>;
  addSubmitter(submitter: SubmitterRecord): Promise<void>;
  updateSubmitter(before: SubmitterRecord, after: SubmitterRecord): Promise<void>;
  deleteSubmitter(submitter: SubmitterRecord): Promise<void>;
  addAddress(address: AddressRecord): Promise<void>;
  updateAddress(before: AddressRecord, after: AddressRecord): Promise<void>;
  deleteAddress(address: AddressRecord): Promise<void>;
  getAddress(id: string): Promise<AddressRecord | undefined>;
}

/** The service surface the family tab needs from its host application. */
export interface FamilyEditorApi extends AttachmentsApi {
  getFacts(personId?: string, familyId?: string): Promise<FactRecord[]>;
  addFact(fact: FactRecord): Promise<void>;
  updateFact(before: FactRecord, after: FactRecord): Promise<void>;
  deleteFact(fact: FactRecord): Promise<void>;
  getPlaces(): Promise<PlaceRecord[]>;
  getAddresses(): Promise<AddressRecord[]>;
  updateFamily(before: FamilyRecord, after: FamilyRecord): Promise<void>;
  deleteFamily(family: FamilyRecord): Promise<void>;
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
  addRecordSubmitter(submitterId: string, targetType: string, targetId: string): Promise<void>;
  deleteRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): Promise<void>;
}
