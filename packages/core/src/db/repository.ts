import type { DatabaseSync } from 'node:sqlite';
import type {
  AddressRecord,
  AssociationRecord,
  AttachmentsSnapshot,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
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
  TreeDocument,
} from '../model/types';
import { emptyAttachments } from '../model/types';
import { AddressRepo } from './addressRepo';
import { AttachmentRepo } from './attachmentRepo';
import { DateRepo } from './dateRepo';
import { FactRepo } from './factRepo';
import { FamilyRepo } from './familyRepo';
import { MediaRepo } from './mediaRepo';
import { NameRepo } from './nameRepo';
import { NoteRepo } from './noteRepo';
import { PersonRepo, type PersonQuery, type PersonRow } from './personRepo';
import { PlaceRepo } from './placeRepo';
import { RelationRepo } from './relationRepo';
import { RepositoryRepo } from './repositoryRepo';
import { ResearchRepo } from './researchRepo';
import { SourceRepo } from './sourceRepo';
import { SubmitterRepo } from './submitterRepo';
import { TransactionScope } from './transaction';

export type { PersonQuery } from './personRepo';

export interface TreeRepository {
  insertPerson(person: PersonRecord): void;
  updatePerson(person: PersonRecord): void;
  getPerson(id: string): PersonRecord | undefined;
  deletePerson(id: string): boolean;
  listPersons(query?: PersonQuery): PersonRecord[];
  listAllPersons(): PersonRecord[];
  countPersons(): number;
  countFamilies(): number;
  insertFamily(family: FamilyRecord): void;
  updateFamily(family: FamilyRecord): void;
  getFamily(id: string): FamilyRecord | undefined;
  deleteFamily(id: string): boolean;
  listFamilies(): FamilyRecord[];
  /** Every family the person belongs to, as a partner or a child. */
  listFamiliesForPerson(personId: string): FamilyRecord[];
  insertFact(fact: FactRecord): void;
  updateFact(fact: FactRecord): void;
  deleteFact(id: string): boolean;
  listFactsForPerson(personId: string): FactRecord[];
  listFactsForFamily(familyId: string): FactRecord[];
  /** Every fact in the tree, ordered by date. */
  listAllFacts(): FactRecord[];
  /** Facts that happened at the given place. */
  listFactsForPlace(placeId: string): FactRecord[];
  insertPlace(place: PlaceRecord): void;
  updatePlace(place: PlaceRecord): void;
  getPlace(id: string): PlaceRecord | undefined;
  deletePlace(id: string): boolean;
  listPlaces(): PlaceRecord[];
  searchPlaces(query: string, limit?: number): PlaceRecord[];
  insertSource(source: SourceRecord): void;
  updateSource(source: SourceRecord): void;
  getSource(id: string): SourceRecord | undefined;
  deleteSource(id: string): boolean;
  listSources(): SourceRecord[];
  addSourceCitation(sourceId: string, targetType: string, targetId: string): void;
  insertCitation(citation: CitationRecord): void;
  updateCitation(citation: CitationRecord): void;
  deleteCitation(id: string): boolean;
  getCitation(id: string): CitationRecord | undefined;
  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }>;
  /** Full citation rows for a target, including page and quality. */
  listCitationRecordsFor(targetType: string, targetId: string): CitationRecord[];
  /** Every citation in the tree. */
  listAllCitations(): CitationRecord[];
  insertNote(note: NoteRecord): void;
  updateNote(note: NoteRecord): void;
  getNote(id: string): NoteRecord | undefined;
  deleteNote(id: string): boolean;
  addNoteLink(noteId: string, link: NoteLinkRecord): void;
  removeNoteLink(id: string): boolean;
  listNotes(): NoteRecord[];
  listNotesFor(targetType: string, targetId: string): NoteRecord[];
  insertMedia(media: MediaRecord): void;
  updateMedia(media: MediaRecord): void;
  getMedia(id: string): MediaRecord | undefined;
  deleteMedia(id: string): boolean;
  addMediaLink(mediaId: string, link: MediaLinkRecord): void;
  removeMediaLink(id: string): boolean;
  listMediaFor(targetType: string, targetId: string): MediaRecord[];
  listAllMedia(): MediaRecord[];
  insertRepository(repository: RepositoryRecord): void;
  updateRepository(repository: RepositoryRecord): void;
  getRepository(id: string): RepositoryRecord | undefined;
  deleteRepository(id: string): boolean;
  listRepositories(): RepositoryRecord[];
  insertSubmitter(submitter: SubmitterRecord): void;
  updateSubmitter(submitter: SubmitterRecord): void;
  getSubmitter(id: string): SubmitterRecord | undefined;
  deleteSubmitter(id: string): boolean;
  listSubmitters(): SubmitterRecord[];
  insertRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): void;
  listSubmittersFor(targetType: string, targetId: string): string[];
  listRecordSubmittersFor(
    targetType: string,
    targetId: string,
  ): Array<{ id: string; submitterId: string; targetType: string; targetId: string }>;
  deleteRecordSubmitter(id: string): boolean;
  insertAddress(address: AddressRecord): void;
  updateAddress(address: AddressRecord): void;
  getAddress(id: string): AddressRecord | undefined;
  deleteAddress(id: string): boolean;
  insertIdentifier(identifier: IdentifierRecord): void;
  deleteIdentifier(id: string): boolean;
  listIdentifiersFor(targetType: string, targetId: string): IdentifierRecord[];
  insertChange(change: ChangeRecord): void;
  listChangesFor(targetType: string, targetId: string): ChangeRecord[];
  insertContact(contact: ContactRecord): void;
  deleteContact(id: string): boolean;
  listContactsFor(targetType: string, targetId: string): ContactRecord[];
  insertRestriction(restriction: RestrictionRecord): void;
  deleteRestriction(id: string): boolean;
  listRestrictionsFor(targetType: string, targetId: string): RestrictionRecord[];
  insertTag(tag: TagRecord): void;
  deleteTag(id: string): boolean;
  updateTag(tag: TagRecord): void;
  listTags(): TagRecord[];
  insertTagLink(link: TagLinkRecord): void;
  deleteTagLink(id: string): boolean;
  listTagLinksFor(targetType: string, targetId: string): Array<{ tagId: string; link: TagLinkRecord }>;
  listTagLinksByTag(tagId: string): TagLinkRecord[];
  insertAssociation(association: AssociationRecord): void;
  updateAssociation(association: AssociationRecord): void;
  deleteAssociation(id: string): boolean;
  listAssociations(): AssociationRecord[];
  listAssociationsFor(personId: string): AssociationRecord[];
  insertAlias(id: string, personId: string, aliasId: string): void;
  deleteAlias(id: string): boolean;
  listAliasesFor(personId: string): Array<{ id: string; aliasId: string }>;
  insertTodo(todo: TodoRecord): void;
  updateTodo(todo: TodoRecord): void;
  deleteTodo(id: string): boolean;
  listTodos(): TodoRecord[];
  listTodosFor(targetType: string, targetId: string): TodoRecord[];
  insertTitle(title: TitleRecord): void;
  updateTitle(title: TitleRecord): void;
  deleteTitle(id: string): boolean;
  listTitles(): TitleRecord[];
  /** Everything attached to a target, for op snapshots before a cascade delete. */
  listAttachmentsFor(targetType: string, targetId: string): AttachmentsSnapshot;
  /** Removes every attachment of a target (cascade part of entity deletion). */
  deleteAttachmentsFor(targetType: string, targetId: string): void;
  /** Re-inserts a previously captured snapshot (the inverse of a cascade). */
  restoreAttachments(snapshot: AttachmentsSnapshot): void;
  toTreeDocument(): TreeDocument;
  transaction<T>(fn: () => T): T;
}

/**
 * Facade over the per-entity repositories. Ops and services talk to this
 * interface; the entity split underneath is an implementation detail. The
 * facade also composes the aggregates: the person row plus names (NameRepo)
 * and facts (FactRepo), and the attachment snapshots used by ops.
 */
export class SqliteTreeRepository implements TreeRepository {
  private readonly transactions: TransactionScope;
  private readonly persons: PersonRepo;
  private readonly names: NameRepo;
  private readonly families: FamilyRepo;
  private readonly facts: FactRepo;
  private readonly places: PlaceRepo;
  private readonly sources: SourceRepo;
  private readonly notes: NoteRepo;
  private readonly media: MediaRepo;
  private readonly attachments: AttachmentRepo;
  private readonly repositories: RepositoryRepo;
  private readonly relations: RelationRepo;
  private readonly research: ResearchRepo;
  private readonly submitters: SubmitterRepo;
  private readonly addresses: AddressRepo;

  constructor(db: DatabaseSync) {
    this.transactions = new TransactionScope(db);
    const dates = new DateRepo(db);
    this.persons = new PersonRepo(db, this.transactions);
    this.names = new NameRepo(db, dates);
    this.families = new FamilyRepo(db, this.transactions, dates);
    this.facts = new FactRepo(db, dates);
    this.places = new PlaceRepo(db, dates);
    this.sources = new SourceRepo(db, dates);
    this.notes = new NoteRepo(db);
    this.media = new MediaRepo(db);
    this.attachments = new AttachmentRepo(db, dates);
    this.repositories = new RepositoryRepo(db);
    this.relations = new RelationRepo(db, dates);
    this.research = new ResearchRepo(db, dates);
    this.submitters = new SubmitterRepo(db);
    this.addresses = new AddressRepo(db);
  }

  insertPerson(person: PersonRecord): void {
    this.transactions.run(() => {
      this.persons.insertPerson({ id: person.id, xref: person.xref, sex: person.sex });
      this.names.replaceNamesForPerson(person.id, person.names);
      for (const fact of person.facts) {
        this.facts.insertFact(fact);
      }
    });
  }

  /**
   * Replaces the person aggregate: identity fields and names are rewritten
   * in full, facts are synchronized by id (inserted when new, updated when
   * present, deleted when missing from the incoming list). Callers pass the
   * complete facts list; the before/after snapshot semantics make a save
   * from a stale view drop facts it did not know about — the renderer
   * reloads on external changes to keep that window small.
   */
  updatePerson(person: PersonRecord): void {
    this.transactions.run(() => {
      this.persons.updatePerson({ id: person.id, xref: person.xref, sex: person.sex });
      this.names.replaceNamesForPerson(person.id, person.names);
      const existing = this.facts.listFactsForPerson(person.id);
      const incoming = new Map(person.facts.map((fact) => [fact.id, fact]));
      for (const fact of person.facts) {
        if (existing.some((entry) => entry.id === fact.id)) {
          this.facts.updateFact(fact);
        } else {
          this.facts.insertFact(fact);
        }
      }
      for (const old of existing) {
        if (!incoming.has(old.id)) {
          this.facts.deleteFact(old.id);
        }
      }
    });
  }

  getPerson(id: string): PersonRecord | undefined {
    const base = this.persons.getPerson(id);
    if (!base) {
      return undefined;
    }
    return {
      ...base,
      names: this.names.listNamesForPerson(id),
      facts: this.facts.listFactsForPerson(id),
    };
  }

  /**
   * Deletes the person together with their name index rows, facts (and
   * their dates), family links and every attachment. The op that deletes a
   * person captures the attachments first and restores them on undo.
   */
  deletePerson(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('person', id);
      this.names.deleteFtsForPerson(id);
      this.facts.deleteFactsForPerson(id);
      this.families.removePersonFromFamilies(id);
      return this.persons.deletePerson(id);
    });
  }

  listPersons(query?: PersonQuery): PersonRecord[] {
    const bases = this.persons.listPersons(query);
    return this.withAggregates(bases);
  }

  listAllPersons(): PersonRecord[] {
    return this.withAggregates(this.persons.listAllPersons());
  }

  /** Attaches each person's names and facts, loaded in batched queries. */
  private withAggregates(bases: PersonRow[]): PersonRecord[] {
    const ids = bases.map((base) => base.id);
    const namesByPerson = this.names.listNamesForMany(ids);
    const factsByPerson = this.facts.listFactsForPersons(ids);
    return bases.map((base) => ({
      ...base,
      names: namesByPerson.get(base.id) ?? [],
      facts: factsByPerson.get(base.id) ?? [],
    }));
  }

  countPersons(): number {
    return this.persons.countPersons();
  }

  countFamilies(): number {
    return this.families.countFamilies();
  }

  insertFamily(family: FamilyRecord): void {
    this.families.insertFamily(family);
  }

  updateFamily(family: FamilyRecord): void {
    this.families.updateFamily(family);
  }

  getFamily(id: string): FamilyRecord | undefined {
    return this.families.getFamily(id);
  }

  deleteFamily(id: string): boolean {
    return this.transactions.run(() => {
      const family = this.families.getFamily(id);
      // Link rows cascade with the family; their attachments must go too.
      for (const link of family?.partnerLinks ?? []) {
        this.deleteAttachmentsFor('family_partner', link.id);
      }
      for (const link of family?.childLinks ?? []) {
        this.deleteAttachmentsFor('family_child', link.id);
      }
      this.deleteAttachmentsFor('family', id);
      this.facts.deleteFactsForFamily(id);
      return this.families.deleteFamily(id);
    });
  }

  listFamilies(): FamilyRecord[] {
    return this.families.listFamilies();
  }

  listFamiliesForPerson(personId: string): FamilyRecord[] {
    return this.families.listFamiliesForPerson(personId);
  }

  insertFact(fact: FactRecord): void {
    this.facts.insertFact(fact);
  }

  updateFact(fact: FactRecord): void {
    this.facts.updateFact(fact);
  }

  deleteFact(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('fact', id);
      return this.facts.deleteFact(id);
    });
  }

  listFactsForPerson(personId: string): FactRecord[] {
    return this.facts.listFactsForPerson(personId);
  }

  listFactsForFamily(familyId: string): FactRecord[] {
    return this.facts.listFactsForFamily(familyId);
  }

  listAllFacts(): FactRecord[] {
    return this.facts.listAllFacts();
  }

  listFactsForPlace(placeId: string): FactRecord[] {
    return this.facts.listFactsForPlace(placeId);
  }

  insertPlace(place: PlaceRecord): void {
    this.places.insertPlace(place);
  }

  updatePlace(place: PlaceRecord): void {
    this.places.updatePlace(place);
  }

  getPlace(id: string): PlaceRecord | undefined {
    return this.places.getPlace(id);
  }

  deletePlace(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('place', id);
      return this.places.deletePlace(id);
    });
  }

  listPlaces(): PlaceRecord[] {
    return this.places.listPlaces();
  }

  searchPlaces(query: string, limit?: number): PlaceRecord[] {
    return this.places.searchPlaces(query, limit);
  }

  insertSource(source: SourceRecord): void {
    this.sources.insertSource(source);
  }

  updateSource(source: SourceRecord): void {
    this.sources.updateSource(source);
  }

  getSource(id: string): SourceRecord | undefined {
    return this.sources.getSource(id);
  }

  deleteSource(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('source', id);
      return this.sources.deleteSource(id);
    });
  }

  listSources(): SourceRecord[] {
    return this.sources.listSources();
  }

  addSourceCitation(sourceId: string, targetType: string, targetId: string): void {
    this.sources.addSourceCitation(sourceId, targetType, targetId);
  }

  insertCitation(citation: CitationRecord): void {
    this.sources.insertCitation(citation);
  }

  updateCitation(citation: CitationRecord): void {
    this.sources.updateCitation(citation);
  }

  deleteCitation(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('citation', id);
      return this.sources.deleteCitation(id);
    });
  }

  getCitation(id: string): CitationRecord | undefined {
    return this.sources.getCitation(id);
  }

  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }> {
    return this.sources.listCitationsFor(targetType, targetId);
  }

  listCitationRecordsFor(targetType: string, targetId: string): CitationRecord[] {
    return this.sources.listCitations(targetType, targetId);
  }

  listAllCitations(): CitationRecord[] {
    return this.sources.listAllCitations();
  }

  insertNote(note: NoteRecord): void {
    this.notes.insertNote(note);
  }

  updateNote(note: NoteRecord): void {
    this.notes.updateNote(note);
  }

  getNote(id: string): NoteRecord | undefined {
    return this.notes.getNote(id);
  }

  deleteNote(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('note', id);
      return this.notes.deleteNote(id);
    });
  }

  addNoteLink(noteId: string, link: NoteLinkRecord): void {
    this.notes.addNoteLink(noteId, link);
  }

  removeNoteLink(id: string): boolean {
    return this.notes.removeNoteLink(id);
  }

  listNotes(): NoteRecord[] {
    return this.notes.listNotes();
  }

  listNotesFor(targetType: string, targetId: string): NoteRecord[] {
    return this.notes.listNotesFor(targetType, targetId);
  }

  insertMedia(media: MediaRecord): void {
    this.media.insertMedia(media);
  }

  updateMedia(media: MediaRecord): void {
    this.media.updateMedia(media);
  }

  getMedia(id: string): MediaRecord | undefined {
    return this.media.getMedia(id);
  }

  deleteMedia(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('media', id);
      return this.media.deleteMedia(id);
    });
  }

  addMediaLink(mediaId: string, link: MediaLinkRecord): void {
    this.media.addMediaLink(mediaId, link);
  }

  removeMediaLink(id: string): boolean {
    return this.media.removeMediaLink(id);
  }

  listMediaFor(targetType: string, targetId: string): MediaRecord[] {
    return this.media.listMediaFor(targetType, targetId);
  }

  listAllMedia(): MediaRecord[] {
    return this.media.listAllMedia();
  }

  insertRepository(repository: RepositoryRecord): void {
    this.repositories.insertRepository(repository);
  }

  updateRepository(repository: RepositoryRecord): void {
    this.repositories.updateRepository(repository);
  }

  getRepository(id: string): RepositoryRecord | undefined {
    return this.repositories.getRepository(id);
  }

  deleteRepository(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('repository', id);
      return this.repositories.deleteRepository(id);
    });
  }

  listRepositories(): RepositoryRecord[] {
    return this.repositories.listRepositories();
  }

  insertSubmitter(submitter: SubmitterRecord): void {
    this.submitters.insertSubmitter(submitter);
  }

  updateSubmitter(submitter: SubmitterRecord): void {
    this.submitters.updateSubmitter(submitter);
  }

  getSubmitter(id: string): SubmitterRecord | undefined {
    return this.submitters.getSubmitter(id);
  }

  deleteSubmitter(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('submitter', id);
      return this.submitters.deleteSubmitter(id);
    });
  }

  listSubmitters(): SubmitterRecord[] {
    return this.submitters.listSubmitters();
  }

  insertRecordSubmitter(id: string, submitterId: string, targetType: string, targetId: string): void {
    this.submitters.insertRecordSubmitter(id, submitterId, targetType, targetId);
  }

  listSubmittersFor(targetType: string, targetId: string): string[] {
    return this.submitters.listSubmittersFor(targetType, targetId);
  }

  listRecordSubmittersFor(
    targetType: string,
    targetId: string,
  ): Array<{ id: string; submitterId: string; targetType: string; targetId: string }> {
    return this.submitters.listRecordSubmittersFor(targetType, targetId);
  }

  deleteRecordSubmitter(id: string): boolean {
    return this.submitters.deleteRecordSubmitter(id);
  }

  insertAddress(address: AddressRecord): void {
    this.addresses.insertAddress(address);
  }

  updateAddress(address: AddressRecord): void {
    this.addresses.updateAddress(address);
  }

  getAddress(id: string): AddressRecord | undefined {
    return this.addresses.getAddress(id);
  }

  deleteAddress(id: string): boolean {
    return this.addresses.deleteAddress(id);
  }

  insertIdentifier(identifier: IdentifierRecord): void {
    this.attachments.insertIdentifier(identifier);
  }

  deleteIdentifier(id: string): boolean {
    return this.attachments.deleteIdentifier(id);
  }

  listIdentifiersFor(targetType: string, targetId: string): IdentifierRecord[] {
    return this.attachments.listIdentifiersFor(targetType, targetId);
  }

  insertChange(change: ChangeRecord): void {
    this.attachments.insertChange(change);
  }

  listChangesFor(targetType: string, targetId: string): ChangeRecord[] {
    return this.attachments.listChangesFor(targetType, targetId);
  }

  insertContact(contact: ContactRecord): void {
    this.attachments.insertContact(contact);
  }

  deleteContact(id: string): boolean {
    return this.attachments.deleteContact(id);
  }

  listContactsFor(targetType: string, targetId: string): ContactRecord[] {
    return this.attachments.listContactsFor(targetType, targetId);
  }

  insertRestriction(restriction: RestrictionRecord): void {
    this.attachments.insertRestriction(restriction);
  }

  deleteRestriction(id: string): boolean {
    return this.attachments.deleteRestriction(id);
  }

  listRestrictionsFor(targetType: string, targetId: string): RestrictionRecord[] {
    return this.attachments.listRestrictionsFor(targetType, targetId);
  }

  insertTag(tag: TagRecord): void {
    this.attachments.insertTag(tag);
  }

  deleteTag(id: string): boolean {
    return this.attachments.deleteTag(id);
  }

  updateTag(tag: TagRecord): void {
    this.attachments.updateTag(tag);
  }

  listTags(): TagRecord[] {
    return this.attachments.listTags();
  }

  insertTagLink(link: TagLinkRecord): void {
    this.attachments.insertTagLink(link);
  }

  deleteTagLink(id: string): boolean {
    return this.attachments.deleteTagLink(id);
  }

  listTagLinksFor(targetType: string, targetId: string): Array<{ tagId: string; link: TagLinkRecord }> {
    return this.attachments.listTagLinksFor(targetType, targetId);
  }

  listTagLinksByTag(tagId: string): TagLinkRecord[] {
    return this.attachments.listTagLinksByTag(tagId);
  }

  insertAssociation(association: AssociationRecord): void {
    this.relations.insertAssociation(association);
  }

  updateAssociation(association: AssociationRecord): void {
    this.relations.updateAssociation(association);
  }

  deleteAssociation(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('association', id);
      return this.relations.deleteAssociation(id);
    });
  }

  listAssociations(): AssociationRecord[] {
    return this.relations.listAssociations();
  }

  listAssociationsFor(personId: string): AssociationRecord[] {
    return this.relations.listAssociationsFor(personId);
  }

  insertAlias(id: string, personId: string, aliasId: string): void {
    this.relations.insertAlias(id, personId, aliasId);
  }

  deleteAlias(id: string): boolean {
    return this.relations.deleteAlias(id);
  }

  listAliasesFor(personId: string): Array<{ id: string; aliasId: string }> {
    return this.relations.listAliasesFor(personId);
  }

  insertTodo(todo: TodoRecord): void {
    this.research.insertTodo(todo);
  }

  updateTodo(todo: TodoRecord): void {
    this.research.updateTodo(todo);
  }

  deleteTodo(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('todo', id);
      return this.research.deleteTodo(id);
    });
  }

  listTodos(): TodoRecord[] {
    return this.research.listTodos();
  }

  listTodosFor(targetType: string, targetId: string): TodoRecord[] {
    return this.research.listTodosFor(targetType, targetId);
  }

  insertTitle(title: TitleRecord): void {
    this.research.insertTitle(title);
  }

  updateTitle(title: TitleRecord): void {
    this.research.updateTitle(title);
  }

  deleteTitle(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('title', id);
      return this.research.deleteTitle(id);
    });
  }

  listTitles(): TitleRecord[] {
    return this.research.listTitles();
  }

  listAttachmentsFor(targetType: string, targetId: string): AttachmentsSnapshot {
    return {
      noteLinks: this.notes.listLinksFor(targetType, targetId),
      citations: this.sources.listCitations(targetType, targetId),
      mediaLinks: this.media.listLinksFor(targetType, targetId),
      identifiers: this.attachments.listIdentifiersFor(targetType, targetId),
      contacts: this.attachments.listContactsFor(targetType, targetId),
      restrictions: this.attachments.listRestrictionsFor(targetType, targetId),
      changes: this.attachments.listChangesFor(targetType, targetId),
      tagLinks: this.attachments.listTagLinksFor(targetType, targetId),
      todos: this.research.listTodosFor(targetType, targetId),
      recordSubmitters: this.submitters.listRecordSubmittersFor(targetType, targetId),
    };
  }

  deleteAttachmentsFor(targetType: string, targetId: string): void {
    this.notes.deleteLinksFor(targetType, targetId);
    this.sources.deleteCitationsFor(targetType, targetId);
    this.media.deleteLinksFor(targetType, targetId);
    this.attachments.deleteAllFor(targetType, targetId);
    this.research.deleteTodosFor(targetType, targetId);
    this.submitters.deleteRecordSubmittersFor(targetType, targetId);
  }

  restoreAttachments(snapshot: AttachmentsSnapshot): void {
    for (const entry of snapshot.noteLinks) {
      if (this.notes.getNote(entry.note.id) === undefined) {
        // The note was deleted (it had no other links): re-inserting it
        // restores all of its links at once.
        this.notes.insertNote(entry.note);
      } else {
        this.notes.addNoteLink(entry.note.id, entry.link);
      }
    }
    for (const citation of snapshot.citations) {
      this.sources.insertCitation(citation);
    }
    for (const entry of snapshot.mediaLinks) {
      if (this.media.getMedia(entry.media.id) === undefined) {
        this.media.insertMedia(entry.media);
      } else {
        this.media.addMediaLink(entry.media.id, entry.link);
      }
    }
    for (const identifier of snapshot.identifiers) {
      this.attachments.insertIdentifier(identifier);
    }
    for (const contact of snapshot.contacts) {
      this.attachments.insertContact(contact);
    }
    for (const restriction of snapshot.restrictions) {
      this.attachments.insertRestriction(restriction);
    }
    for (const change of snapshot.changes) {
      this.attachments.insertChange(change);
    }
    for (const entry of snapshot.tagLinks) {
      this.attachments.insertTagLink(entry.link);
    }
    for (const todo of snapshot.todos) {
      this.research.insertTodo(todo);
    }
    for (const entry of snapshot.recordSubmitters) {
      this.submitters.insertRecordSubmitter(entry.id, entry.submitterId, entry.targetType, entry.targetId);
    }
  }

  toTreeDocument(): TreeDocument {
    return {
      persons: new Map(this.listAllPersons().map((person) => [person.id, person])),
      families: new Map(this.listFamilies().map((family) => [family.id, family])),
    };
  }

  transaction<T>(fn: () => T): T {
    return this.transactions.run(fn);
  }
}

export function emptyAttachmentsSnapshot(): AttachmentsSnapshot {
  return emptyAttachments();
}
