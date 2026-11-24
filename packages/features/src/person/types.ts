import type { MediaWithPath } from '@doru/ui/domain';
import type { AttachmentApi, ContributorApi } from '../attachments/useAttachments';
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
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TargetRef,
  TaskRecord,
  TaskTargetLink,
  TitleRecord,
} from '@doru/core';

export type { MediaWithPath } from '@doru/ui/domain';

/** Media operations for one target. */
export interface MediaTargetApi {
  getMediaFor(targetType: string, targetId: string): Promise<MediaWithPath[]>;
  getAllMedia(): Promise<MediaWithPath[]>;
  addMediaToTarget(targetType: string, targetId: string): Promise<void>;
  addMediaToTargets?(targets: TargetRef[]): Promise<void>;
  attachMedia(link: MediaLinkRecord): Promise<void>;
  attachMediaToTargets?(mediaId: string, targets: TargetRef[]): Promise<void>;
  detachMedia(link: MediaLinkRecord): Promise<void>;
  deleteMedia(media: MediaRecord): Promise<void>;
}

/** Media operations used by the media editor. */
export interface MediaAdminApi extends MediaTargetApi {
  getMedia(id: string): Promise<MediaWithPath | undefined>;
  /** Opens a source from a media attachment link. */
  openSource?: ((sourceId: string) => void) | undefined;
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
  addSourceToTargets?(source: SourceRecord, targets: TargetRef[]): Promise<void>;
  attachSource(sourceId: string, targetType: string, targetId: string): Promise<void>;
  attachSourceToTargets?(sourceId: string, targets: TargetRef[]): Promise<void>;
  detachCitation(citationId: string): Promise<void>;
  addIdentifier(identifier: IdentifierRecord): Promise<void>;
  updateIdentifier(before: IdentifierRecord, after: IdentifierRecord): Promise<void>;
  deleteIdentifier(identifier: IdentifierRecord): Promise<void>;
  addContact(contact: ContactRecord): Promise<void>;
  updateContact(before: ContactRecord, after: ContactRecord): Promise<void>;
  deleteContact(contact: ContactRecord): Promise<void>;
  addTag(tag: TagRecord): Promise<void>;
  updateTag(before: TagRecord, after: TagRecord): Promise<void>;
  deleteTag(tag: TagRecord): Promise<void>;
  attachTag(link: TagLinkRecord): Promise<void>;
  attachTagToTargets?(tagId: string, targets: TargetRef[]): Promise<void>;
  detachTag(link: TagLinkRecord): Promise<void>;
  updateTagLink(before: TagLinkRecord, after: TagLinkRecord): Promise<void>;
  getTasksFor(targetType: string, targetId: string): Promise<TaskRecord[]>;
  addTask(task: TaskRecord): Promise<void>;
  updateTask(before: TaskRecord, after: TaskRecord): Promise<void>;
  deleteTask(task: TaskRecord): Promise<void>;
  addTaskLink(link: TaskTargetLink): Promise<void>;
  deleteTaskLink(link: TaskTargetLink): Promise<void>;
  /** Opens the task tab of the app (host-level navigation). */
  openTask?: ((taskId: string) => void) | undefined;
}

/**
 * The service surface the person editor needs from its host application.
 * Grouping the callbacks into one object keeps component props small and
 * makes the wiring explicit in the app layer.
 */
export interface PersonEditorApi extends AttachmentsApi, ContributorApi {
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
  getPlaces(): Promise<PlaceRecord[]>;
  getAddresses(): Promise<AddressRecord[]>;
  addAddress(address: AddressRecord): Promise<AddressRecord>;
  updateAddress(before: AddressRecord, after: AddressRecord): Promise<AddressRecord>;
}

/** The service surface the source tab needs from its host application. */
export interface SourceEditorApi extends AttachmentsApi, ContributorApi {
  updateSource(before: SourceRecord, after: SourceRecord): Promise<void>;
  deleteSource(source: SourceRecord): Promise<void>;
  getRepositories(): Promise<RepositoryRecord[]>;
  addRepository(repository: RepositoryRecord): Promise<void>;
  getTitles(): Promise<TitleRecord[]>;
}

/** The service surface the place tab needs from its host application. */
export interface PlaceEditorApi extends AttachmentsApi, ContributorApi {
  getPlaces(): Promise<PlaceRecord[]>;
  addPlace(place: PlaceRecord): Promise<void>;
  updatePlace(before: PlaceRecord, after: PlaceRecord): Promise<void>;
  deletePlace(place: PlaceRecord): Promise<void>;
}

/** The service surface the registries view needs from its host application. */
export interface RegistriesEditorApi extends AttachmentsApi, ContributorApi {
  getRepositories(): Promise<RepositoryRecord[]>;
  addRepository(repository: RepositoryRecord): Promise<void>;
  updateRepository(before: RepositoryRecord, after: RepositoryRecord): Promise<void>;
  deleteRepository(repository: RepositoryRecord): Promise<void>;
  addSubmitter(submitter: SubmitterRecord): Promise<void>;
  updateSubmitter(before: SubmitterRecord, after: SubmitterRecord): Promise<void>;
  deleteSubmitter(submitter: SubmitterRecord): Promise<void>;
  addAddress(address: AddressRecord): Promise<void>;
  updateAddress(before: AddressRecord, after: AddressRecord): Promise<void>;
  deleteAddress(address: AddressRecord): Promise<void>;
  getAddress(id: string): Promise<AddressRecord | undefined>;
}

/** The service surface the title tab needs from its host application. */
export interface TitleEditorApi extends AttachmentsApi, ContributorApi {
  addTitle(title: TitleRecord): Promise<void>;
  updateTitle(before: TitleRecord, after: TitleRecord): Promise<void>;
  deleteTitle(title: TitleRecord): Promise<void>;
}

/** The service surface the task tab needs from its host application. */
export interface TaskEditorApi extends AttachmentsApi, ContributorApi {}

/** The service surface the family tab needs from its host application. */
export interface FamilyEditorApi extends AttachmentsApi, ContributorApi {
  getAssociationsForFamily(familyId: string): Promise<AssociationRecord[]>;
  addAssociation(association: AssociationRecord): Promise<void>;
  updateAssociation(before: AssociationRecord, after: AssociationRecord): Promise<void>;
  deleteAssociation(association: AssociationRecord): Promise<void>;
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
}
