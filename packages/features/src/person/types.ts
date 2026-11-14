import type { MediaWithPath } from '@doru/ui/domain';
import type { AttachmentApi } from '../attachments/useAttachments';
import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  MediaFile,
  MediaLinkRecord,
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
  TodoRecord,
} from '@doru/core';

export type { MediaWithPath } from '@doru/ui/domain';

/** Media operations for one target. */
export interface MediaTargetApi {
  getMediaFor(targetType: string, targetId: string): Promise<MediaWithPath[]>;
  getAllMedia(): Promise<MediaWithPath[]>;
  addMediaToTarget(targetType: string, targetId: string): Promise<void>;
  attachMedia(link: MediaLinkRecord): Promise<void>;
  detachMedia(link: MediaLinkRecord): Promise<void>;
  deleteMedia(media: MediaRecord): Promise<void>;
}

/** Media operations used by the media editor. */
export interface MediaAdminApi extends MediaTargetApi {
  getMedia(id: string): Promise<MediaWithPath | undefined>;
  updateMedia(before: MediaRecord, after: MediaRecord): Promise<void>;
  addMediaFile(mediaId: string): Promise<void>;
  removeMediaFile(media: MediaRecord, file: MediaFile): Promise<void>;
  updateMediaLink(before: MediaLinkRecord, after: MediaLinkRecord): Promise<void>;
}

export interface AttachmentsApi extends AttachmentApi, MediaTargetApi {
  addNote(note: NoteRecord): Promise<void>;
  updateNote(before: NoteRecord, after: NoteRecord, context?: NoteLinkRecord): Promise<void>;
  deleteNote(note: NoteRecord): Promise<void>;
  attachNote(noteId: string, link: NoteLinkRecord): Promise<void>;
  detachNote(note: NoteRecord, link: NoteLinkRecord): Promise<void>;
  updateCitation(before: CitationRecord, after: CitationRecord): Promise<void>;
  getSources(): Promise<SourceRecord[]>;
  addSource(source: SourceRecord, targetType?: string, targetId?: string): Promise<void>;
  attachSource(sourceId: string, targetType: string, targetId: string): Promise<void>;
  detachCitation(citationId: string): Promise<void>;
  addIdentifier(identifier: IdentifierRecord): Promise<void>;
  updateIdentifier(before: IdentifierRecord, after: IdentifierRecord): Promise<void>;
  deleteIdentifier(identifier: IdentifierRecord): Promise<void>;
  addContact(contact: ContactRecord): Promise<void>;
  updateContact(before: ContactRecord, after: ContactRecord): Promise<void>;
  deleteContact(contact: ContactRecord): Promise<void>;
  addRestriction(restriction: RestrictionRecord): Promise<void>;
  updateRestriction(before: RestrictionRecord, after: RestrictionRecord): Promise<void>;
  deleteRestriction(restriction: RestrictionRecord): Promise<void>;
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
export interface PersonEditorApi extends AttachmentsApi {
  addPerson(person: PersonRecord): Promise<void>;
  updatePerson(before: PersonRecord, after: PersonRecord): Promise<void>;
  getFamilies(): Promise<FamilyRecord[]>;
  addFamily(family: FamilyRecord): Promise<void>;
  updateFamily(before: FamilyRecord, after: FamilyRecord): Promise<void>;
  deleteFamily(family: FamilyRecord): Promise<void>;
  getAssociations(personId: string): Promise<AssociationRecord[]>;
  addAssociation(association: AssociationRecord): Promise<void>;
  updateAssociation(before: AssociationRecord, after: AssociationRecord): Promise<void>;
  deleteAssociation(association: AssociationRecord): Promise<void>;
  /** Opens the source tab of the app (host-level navigation). */
  openSource?: ((sourceId: string) => void) | undefined;
  getFacts(personId?: string, familyId?: string): Promise<FactRecord[]>;
  addFact(fact: FactRecord): Promise<void>;
  updateFact(before: FactRecord, after: FactRecord): Promise<void>;
  deleteFact(fact: FactRecord): Promise<void>;
  getMedia(personId: string): Promise<MediaWithPath[]>;
  addMedia(personId: string): Promise<void>;
  deleteMedia(media: MediaRecord): Promise<void>;
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
  getPlaces(): Promise<PlaceRecord[]>;
  getAddresses(): Promise<AddressRecord[]>;
  addAddress(address: AddressRecord): Promise<AddressRecord>;
  updateAddress(before: AddressRecord, after: AddressRecord): Promise<AddressRecord>;
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
export interface RegistriesEditorApi extends AttachmentsApi {
  getRepositories(): Promise<RepositoryRecord[]>;
  addRepository(repository: RepositoryRecord): Promise<void>;
  updateRepository(before: RepositoryRecord, after: RepositoryRecord): Promise<void>;
  deleteRepository(repository: RepositoryRecord): Promise<void>;
  getSubmitters(): Promise<SubmitterRecord[]>;
  addSubmitter(submitter: SubmitterRecord): Promise<void>;
  updateSubmitter(before: SubmitterRecord, after: SubmitterRecord): Promise<void>;
  deleteSubmitter(submitter: SubmitterRecord): Promise<void>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
  addRecordSubmitter(submitterId: string, targetType: string, targetId: string): Promise<void>;
  deleteRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): Promise<void>;
  addAddress(address: AddressRecord): Promise<void>;
  updateAddress(before: AddressRecord, after: AddressRecord): Promise<void>;
  deleteAddress(address: AddressRecord): Promise<void>;
  getAddress(id: string): Promise<AddressRecord | undefined>;
}

/** The service surface the title tab needs from its host application. */
export interface TitleEditorApi extends AttachmentsApi {
  addTitle(title: TitleRecord): Promise<void>;
  updateTitle(before: TitleRecord, after: TitleRecord): Promise<void>;
  deleteTitle(title: TitleRecord): Promise<void>;
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
  addRecordSubmitter(submitterId: string, targetType: string, targetId: string): Promise<void>;
  deleteRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): Promise<void>;
}

/** The service surface the task tab needs from its host application. */
export interface TodoEditorApi extends AttachmentsApi {
  addTodo(todo: TodoRecord): Promise<void>;
  updateTodo(before: TodoRecord, after: TodoRecord): Promise<void>;
  deleteTodo(todo: TodoRecord): Promise<void>;
  getSubmitters(): Promise<SubmitterRecord[]>;
  getRecordSubmitters(
    targetType: string,
    targetId: string,
  ): Promise<Array<{ id: string; submitterId: string; targetType: string; targetId: string }>>;
  addRecordSubmitter(submitterId: string, targetType: string, targetId: string): Promise<void>;
  deleteRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): Promise<void>;
}

/** The service surface the family tab needs from its host application. */
export interface FamilyEditorApi extends AttachmentsApi {
  getFacts(personId?: string, familyId?: string): Promise<FactRecord[]>;
  addFact(fact: FactRecord): Promise<void>;
  updateFact(before: FactRecord, after: FactRecord): Promise<void>;
  deleteFact(fact: FactRecord): Promise<void>;
  getPlaces(): Promise<PlaceRecord[]>;
  getAddresses(): Promise<AddressRecord[]>;
  addAddress(address: AddressRecord): Promise<AddressRecord>;
  updateAddress(before: AddressRecord, after: AddressRecord): Promise<AddressRecord>;
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
