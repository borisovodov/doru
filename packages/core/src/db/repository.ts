import type { DatabaseSync } from 'node:sqlite';
import type {
  AddressRecord,
  AssociationRecord,
  AttachmentsSnapshot,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  DateValue,
  FactFamilyLink,
  FactParticipant,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  MediaLinkRecord,
  MediaRecord,
  NoteLinkRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RecordSubmitterLink,
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
import { collectNameIds, collectNamePartIds, emptyAttachments } from '../model/types';
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
  listPersonIdsForAddress(addressId: string): string[];
  countPersons(): number;
  countFamilies(): number;
  /** Reconnects a person to an address without rewriting names or facts. */
  setPersonAddressId(personId: string, addressId: string | undefined): void;
  insertFamily(family: FamilyRecord): void;
  updateFamily(family: FamilyRecord): void;
  /** Reconnects a surviving marriage-status row to its place. */
  setFamilyMarriageStatusPlaceId(statusId: string, placeId: string | undefined): void;
  getFamily(id: string): FamilyRecord | undefined;
  deleteFamily(id: string): boolean;
  listFamilies(): FamilyRecord[];
  /** Every family the person belongs to, as a partner or a child. */
  listFamiliesForPerson(personId: string): FamilyRecord[];
  insertFact(fact: FactRecord): void;
  updateFact(fact: FactRecord): void;
  getFact(id: string): FactRecord | undefined;
  /** Reconnects a fact to an address without rewriting its other fields. */
  setFactAddressId(factId: string, addressId: string | undefined): void;
  /** Reconnects a fact to its primary place without rewriting other fields. */
  setFactPlaceId(factId: string, placeId: string | undefined): void;
  /** Detaches one deleted place from the current fact. */
  detachFactPlace(factId: string, placeId: string): void;
  /** Re-adds one additional place row to a surviving fact. */
  insertFactPlace(factId: string, placeId: string, position: number): void;
  deleteFact(id: string): boolean;
  /** Adds an event-family link after the family records exist. */
  insertFactFamilyLink(factId: string, link: FactFamilyLink): void;
  listFactsForPerson(personId: string): FactRecord[];
  listFactsForFamily(familyId: string): FactRecord[];
  /** Facts that link to a family through fact_family. */
  listFactsLinkedToFamily(familyId: string): FactRecord[];
  /** Fact ids that reference an address. */
  listFactIdsForAddress(addressId: string): string[];
  /** Every fact in the tree, ordered by date. */
  listAllFacts(): FactRecord[];
  /** Facts that happened at the given place. */
  listFactsForPlace(placeId: string): FactRecord[];
  /** Facts that list the place among their additional places. */
  listFactsWithAdditionalPlace(placeId: string): FactRecord[];
  listFactPlaceRows(placeId: string): Array<{ factId: string; position: number }>;
  /** Participants that point at a person, with their fact id, for delete/undo snapshots. */
  listParticipantsForPerson(personId: string): Array<{ factId: string; participant: FactParticipant }>;
  insertParticipant(factId: string, participant: FactParticipant): void;
  insertPlace(place: PlaceRecord): void;
  /** Re-inserts one hierarchy row after a place-delete undo. */
  insertPlaceHierarchy(childId: string, link: { id: string; parentId: string; type?: string; date?: DateValue }): void;
  updatePlace(place: PlaceRecord): void;
  getPlace(id: string): PlaceRecord | undefined;
  deletePlace(id: string): boolean;
  listPlaces(): PlaceRecord[];
  insertSource(source: SourceRecord): void;
  updateSource(source: SourceRecord): void;
  /** Reconnects a surviving source data event to its place. */
  setSourceDataEventPlaceId(eventId: string, placeId: string | undefined): void;
  getSource(id: string): SourceRecord | undefined;
  deleteSource(id: string): boolean;
  listSources(): SourceRecord[];
  /** Source→repository links of one repository, with call numbers, for delete/undo snapshots. */
  listSourceRepositoriesFor(repositoryId: string): Array<{
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers: Array<{ id: string; value: string; medium?: string }>;
  }>;
  restoreSourceRepository(link: {
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers?: Array<{ id: string; value: string; medium?: string }>;
  }): void;
  /** Sources citing a bibliographic title, for the title delete/undo snapshot. */
  listSourcesForTitle(titleId: string): Array<{ id: string; titleId: string }>;
  setSourceTitle(sourceId: string, titleId: string | undefined): void;
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
  /** Reconnects a surviving media row to its place without rewriting files. */
  setMediaPlaceId(mediaId: string, placeId: string | undefined): void;
  getMedia(id: string): MediaRecord | undefined;
  deleteMedia(id: string): boolean;
  addMediaLink(mediaId: string, link: MediaLinkRecord): void;
  /** Direct media links of a target, without recursive attachment collection. */
  listMediaLinksFor(targetType: string, targetId: string): Array<{ media: MediaRecord; link: MediaLinkRecord }>;
  /** True when this link id already exists, without hydrating its target. */
  hasMediaLink(id: string): boolean;
  hasMediaFile(id: string): boolean;
  updateMediaLink(link: MediaLinkRecord): void;
  removeMediaLink(id: string): boolean;
  listMediaFor(targetType: string, targetId: string): MediaRecord[];
  listAllMedia(): MediaRecord[];
  insertRepository(repository: RepositoryRecord): void;
  updateRepository(repository: RepositoryRecord): void;
  /** Reconnects a repository to an address without rewriting its other fields. */
  setRepositoryAddressId(repositoryId: string, addressId: string | undefined): void;
  getRepository(id: string): RepositoryRecord | undefined;
  deleteRepository(id: string): boolean;
  listRepositories(): RepositoryRecord[];
  insertSubmitter(submitter: SubmitterRecord): void;
  updateSubmitter(submitter: SubmitterRecord): void;
  /** Reconnects a submitter to an address without rewriting their other fields. */
  setSubmitterAddressId(submitterId: string, addressId: string | undefined): void;
  getSubmitter(id: string): SubmitterRecord | undefined;
  deleteSubmitter(id: string): boolean;
  listSubmitters(): SubmitterRecord[];
  insertRecordSubmitter(
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind?: RecordSubmitterLink['kind'],
  ): void;
  listSubmittersFor(targetType: string, targetId: string): string[];
  getRecordSubmitter(id: string): RecordSubmitterLink | undefined;
  listRecordSubmittersFor(targetType: string, targetId: string): RecordSubmitterLink[];
  /** Every record a submitter contributes to, for the delete/undo snapshot. */
  listRecordSubmittersForSubmitter(submitterId: string): RecordSubmitterLink[];
  /** Every submitter link in the tree, for the global registries. */
  listAllRecordSubmitters(): RecordSubmitterLink[];
  deleteRecordSubmitter(id: string): boolean;
  insertAddress(address: AddressRecord): void;
  updateAddress(address: AddressRecord): void;
  getAddress(id: string): AddressRecord | undefined;
  listAddresses(): AddressRecord[];
  deleteAddress(id: string): boolean;
  insertIdentifier(identifier: IdentifierRecord): void;
  deleteIdentifier(id: string): boolean;
  updateIdentifier(identifier: IdentifierRecord): void;
  listIdentifiersFor(targetType: string, targetId: string): IdentifierRecord[];
  insertChange(change: ChangeRecord): void;
  listChangesFor(targetType: string, targetId: string): ChangeRecord[];
  /** Marks a change row written by an undo/redo replay, not by a user edit. */
  markReplayChange(id: string): void;
  isReplayChange(id: string): boolean;
  insertContact(contact: ContactRecord): void;
  deleteContact(id: string): boolean;
  updateContact(contact: ContactRecord): void;
  listContactsFor(targetType: string, targetId: string): ContactRecord[];
  insertRestriction(restriction: RestrictionRecord): void;
  deleteRestriction(id: string): boolean;
  updateRestriction(restriction: RestrictionRecord): void;
  listRestrictionsFor(targetType: string, targetId: string): RestrictionRecord[];
  insertTag(tag: TagRecord): void;
  deleteTag(id: string): boolean;
  updateTag(tag: TagRecord): void;
  listTags(): TagRecord[];
  insertTagLink(link: TagLinkRecord): void;
  deleteTagLink(id: string): boolean;
  updateTagLink(link: TagLinkRecord): void;
  listTagLinksFor(targetType: string, targetId: string): Array<{ tagId: string; link: TagLinkRecord }>;
  listTagLinksByTag(tagId: string): TagLinkRecord[];
  getTagLink(id: string): TagLinkRecord | undefined;
  /** Every tag link in the tree, for the global tag registry. */
  listAllTagLinks(): TagLinkRecord[];
  insertAssociation(association: AssociationRecord): void;
  updateAssociation(association: AssociationRecord): void;
  deleteAssociation(id: string): boolean;
  listAssociations(): AssociationRecord[];
  listAssociationsFor(personId: string): AssociationRecord[];
  listAssociationsForFamily(familyId: string): AssociationRecord[];
  insertAlias(id: string, personId: string, aliasId: string): void;
  deleteAlias(id: string): boolean;
  listAliasesFor(personId: string): Array<{ id: string; aliasId: string }>;
  /** Exact direction of every alias link involving a person, for snapshots. */
  listAliasRowsFor(personId: string): Array<{ id: string; personId: string; aliasId: string }>;
  insertTodo(todo: TodoRecord): void;
  updateTodo(todo: TodoRecord): void;
  getTodo(id: string): TodoRecord | undefined;
  /** Reconnects a todo to a repository without rewriting its other fields. */
  setTodoRepositoryId(todoId: string, repositoryId: string | undefined): void;
  deleteTodo(id: string): boolean;
  listTodos(): TodoRecord[];
  listTodosFor(targetType: string, targetId: string): TodoRecord[];
  insertTitle(title: TitleRecord): void;
  updateTitle(title: TitleRecord): void;
  getTitle(id: string): TitleRecord | undefined;
  /** Reconnects a title to a repository without rewriting its other fields. */
  setTitleRepositoryId(titleId: string, repositoryId: string | undefined): void;
  deleteTitle(id: string): boolean;
  listTitles(): TitleRecord[];
  /** Everything attached to a target, for op snapshots before a cascade delete. */
  listAttachmentsFor(targetType: string, targetId: string): AttachmentsSnapshot;
  /** Removes every attachment of a target (cascade part of entity deletion). */
  deleteAttachmentsFor(targetType: string, targetId: string): void;
  /** Re-inserts a previously captured snapshot (the inverse of a cascade). */
  restoreAttachments(snapshot: AttachmentsSnapshot): void;
  /** Binds a snapshot tree to the current application's removal set. */
  bindSnapshots(snapshot: AttachmentsSnapshot): void;
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
  private readonly snapshotMarkers = new WeakMap<object, Set<string>>();
  private readonly replayChangeIds = new Set<string>();
  private readonly transactionFrames: Set<string>[] = [];
  private readonly restoreScopes: Set<AttachmentsSnapshot>[] = [];
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
    this.facts = new FactRepo(db, dates, this.transactions);
    this.places = new PlaceRepo(db, dates, this.transactions);
    this.sources = new SourceRepo(db, dates);
    this.notes = new NoteRepo(db);
    this.media = new MediaRepo(db, dates, this.transactions);
    this.attachments = new AttachmentRepo(db, dates);
    this.repositories = new RepositoryRepo(db);
    this.relations = new RelationRepo(db, dates);
    this.research = new ResearchRepo(db, dates);
    this.submitters = new SubmitterRepo(db);
    this.addresses = new AddressRepo(db);
  }

  insertPerson(person: PersonRecord): void {
    this.transactions.run(() => {
      this.persons.insertPerson({
        id: person.id,
        xref: person.xref,
        sex: person.sex,
        deathStatus: person.deathStatus,
        addressId: person.addressId,
      });
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
      const oldNames = this.names.listNamesForPerson(person.id);
      const oldFacts = this.facts.listFactsForPerson(person.id);
      this.persons.updatePerson({
        id: person.id,
        xref: person.xref,
        sex: person.sex,
        deathStatus: person.deathStatus,
        addressId: person.addressId,
      });
      const newParts = this.names.replaceNamesForPerson(person.id, person.names);
      const newNames = new Set(collectNameIds(person.names));
      for (const nameId of collectNameIds(oldNames)) {
        if (!newNames.has(nameId)) {
          this.deleteAttachmentsFor('name', nameId);
        }
      }
      for (const partId of collectNamePartIds(oldNames)) {
        if (!newParts.has(partId)) {
          this.deleteAttachmentsFor('name_part', partId);
        }
      }
      const incoming = new Map(person.facts.map((fact) => [fact.id, fact]));
      for (const fact of person.facts) {
        if (oldFacts.some((entry) => entry.id === fact.id)) {
          this.facts.updateFact(fact);
        } else {
          this.facts.insertFact(fact);
        }
      }
      for (const old of oldFacts) {
        if (!incoming.has(old.id)) {
          this.deleteAttachmentsFor('fact', old.id);
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
      const names = this.names.listNamesForPerson(id);
      for (const nameId of collectNameIds(names)) {
        this.deleteAttachmentsFor('name', nameId);
      }
      for (const partId of collectNamePartIds(names)) {
        this.deleteAttachmentsFor('name_part', partId);
      }
      for (const fact of this.facts.listFactsForPerson(id)) {
        this.deleteAttachmentsFor('fact', fact.id);
      }
      for (const association of this.relations.listAssociationsFor(id)) {
        this.deleteAttachmentsFor('association', association.id);
      }
      this.deleteAttachmentsFor('person', id);
      this.deleteAttachmentsFor('person_sex', id);
      this.names.deleteNamesForPerson(id);
      this.facts.deleteFactsForPerson(id);
      this.relations.deleteAssociationsForPerson(id);
      this.relations.deleteAliasesForPerson(id);
      for (const family of this.families.listFamiliesForPerson(id)) {
        this.updateFamily({
          ...family,
          partners: family.partners.filter((personId) => personId !== id),
          children: family.children.filter((childId) => childId !== id),
          partnerLinks: family.partnerLinks?.filter((link) => link.personId !== id),
          childLinks: family.childLinks?.filter((link) => link.childId !== id),
        });
      }
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

  listPersonIdsForAddress(addressId: string): string[] {
    return this.persons.listPersonIdsForAddress(addressId);
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

  setPersonAddressId(personId: string, addressId: string | undefined): void {
    this.persons.setAddressId(personId, addressId);
  }

  insertFamily(family: FamilyRecord): void {
    this.families.insertFamily(family);
  }

  setFamilyMarriageStatusPlaceId(statusId: string, placeId: string | undefined): void {
    this.families.setMarriageStatusPlaceId(statusId, placeId);
  }

  updateFamily(family: FamilyRecord): void {
    this.transactions.run(() => {
      const before = this.families.getFamily(family.id);
      this.families.updateFamily(family);
      const after = this.families.getFamily(family.id);
      if (!before || !after) {
        return;
      }
      const afterPartners = new Set((after.partnerLinks ?? []).map((link) => link.id));
      for (const link of before.partnerLinks ?? []) {
        if (!afterPartners.has(link.id)) {
          this.deleteAttachmentsFor('family_partner', link.id);
        }
      }
      const afterChildren = new Set((after.childLinks ?? []).map((link) => link.id));
      for (const link of before.childLinks ?? []) {
        if (!afterChildren.has(link.id)) {
          this.deleteAttachmentsFor('family_child', link.id);
        }
      }
      const afterStatuses = new Set((after.marriageStatuses ?? []).map((status) => status.id));
      for (const status of before.marriageStatuses ?? []) {
        if (!afterStatuses.has(status.id)) {
          this.deleteAttachmentsFor('family_marriage_status', status.id);
        }
      }
    });
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
      for (const status of family?.marriageStatuses ?? []) {
        this.deleteAttachmentsFor('family_marriage_status', status.id);
      }
      for (const association of this.relations.listAssociationsForFamily(id)) {
        this.deleteAttachmentsFor('association', association.id);
      }
      for (const fact of this.facts.listFactsForFamily(id)) {
        this.deleteAttachmentsFor('fact', fact.id);
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

  getFact(id: string): FactRecord | undefined {
    return this.facts.getFact(id);
  }

  setFactAddressId(factId: string, addressId: string | undefined): void {
    this.facts.setFactAddressId(factId, addressId);
  }

  setFactPlaceId(factId: string, placeId: string | undefined): void {
    this.facts.setFactPlaceId(factId, placeId);
  }

  detachFactPlace(factId: string, placeId: string): void {
    this.facts.detachFactPlace(factId, placeId);
  }

  insertFactPlace(factId: string, placeId: string, position: number): void {
    this.facts.insertFactPlace(factId, placeId, position);
  }

  insertFactFamilyLink(factId: string, link: FactFamilyLink): void {
    this.facts.insertFactFamilyLink(factId, link);
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

  listFactsLinkedToFamily(familyId: string): FactRecord[] {
    return this.facts.listFactsLinkedToFamily(familyId);
  }

  listFactIdsForAddress(addressId: string): string[] {
    return this.facts.listFactIdsForAddress(addressId);
  }

  listAllFacts(): FactRecord[] {
    return this.facts.listAllFacts();
  }

  listFactsForPlace(placeId: string): FactRecord[] {
    return this.facts.listFactsForPlace(placeId);
  }

  listFactsWithAdditionalPlace(placeId: string): FactRecord[] {
    return this.facts.listFactsWithAdditionalPlace(placeId);
  }

  listFactPlaceRows(placeId: string): Array<{ factId: string; position: number }> {
    return this.facts.listFactPlaceRows(placeId);
  }

  listParticipantsForPerson(personId: string): Array<{ factId: string; participant: FactParticipant }> {
    return this.facts.listParticipantsForPerson(personId);
  }

  insertParticipant(factId: string, participant: FactParticipant): void {
    this.facts.insertParticipant(factId, participant);
  }

  insertPlace(place: PlaceRecord): void {
    this.places.insertPlace(place);
  }

  insertPlaceHierarchy(childId: string, link: { id: string; parentId: string; type?: string; date?: DateValue }): void {
    this.places.insertHierarchyLink(childId, link);
  }

  updatePlace(place: PlaceRecord): void {
    this.transactions.run(() => {
      const before = this.places.getPlace(place.id);
      this.places.updatePlace(place);
      if (!before) {
        return;
      }
      const nextNames = new Set(place.names.map((name) => name.id));
      for (const name of before.names) {
        if (!nextNames.has(name.id)) {
          this.deleteAttachmentsFor('place_name', name.id);
        }
      }
      const nextHierarchy = new Set((place.hierarchy ?? []).map((link) => link.id));
      for (const link of before.hierarchy ?? []) {
        if (!nextHierarchy.has(link.id)) {
          this.deleteAttachmentsFor('place_hierarchy', link.id);
        }
      }
    });
  }

  getPlace(id: string): PlaceRecord | undefined {
    return this.places.getPlace(id);
  }

  deletePlace(id: string): boolean {
    return this.transactions.run(() => {
      const place = this.places.getPlace(id);
      this.deleteAttachmentsFor('place', id);
      for (const name of place?.names ?? []) {
        this.deleteAttachmentsFor('place_name', name.id);
      }
      for (const link of place?.hierarchy ?? []) {
        this.deleteAttachmentsFor('place_hierarchy', link.id);
      }
      for (const link of this.places.listHierarchyLinksByParent(id)) {
        this.deleteAttachmentsFor('place_hierarchy', link.id);
      }
      return this.places.deletePlace(id);
    });
  }

  listPlaces(): PlaceRecord[] {
    return this.places.listPlaces();
  }

  insertSource(source: SourceRecord): void {
    this.sources.insertSource(source);
  }

  setSourceDataEventPlaceId(eventId: string, placeId: string | undefined): void {
    this.sources.setDataEventPlaceId(eventId, placeId);
  }

  updateSource(source: SourceRecord): void {
    this.transactions.run(() => {
      this.sources.updateSource(source);
    });
  }

  getSource(id: string): SourceRecord | undefined {
    return this.sources.getSource(id);
  }

  deleteSource(id: string): boolean {
    return this.transactions.run(() => {
      for (const citation of this.sources.listAllCitations().filter((entry) => entry.sourceId === id)) {
        this.deleteAttachmentsFor('citation', citation.id);
      }
      this.deleteAttachmentsFor('source', id);
      return this.sources.deleteSource(id);
    });
  }

  listSources(): SourceRecord[] {
    return this.sources.listSources();
  }

  listSourceRepositoriesFor(repositoryId: string): Array<{
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers: Array<{ id: string; value: string; medium?: string }>;
  }> {
    return this.sources.listSourceRepositoriesFor(repositoryId);
  }

  restoreSourceRepository(link: {
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers?: Array<{ id: string; value: string; medium?: string }>;
  }): void {
    this.sources.restoreSourceRepository(link);
  }

  listSourcesForTitle(titleId: string): Array<{ id: string; titleId: string }> {
    return this.sources.listSourcesForTitle(titleId);
  }

  setSourceTitle(sourceId: string, titleId: string | undefined): void {
    this.sources.setSourceTitle(sourceId, titleId);
  }

  addSourceCitation(sourceId: string, targetType: string, targetId: string): void {
    this.sources.addSourceCitation(sourceId, targetType, targetId);
  }

  insertCitation(citation: CitationRecord): void {
    this.sources.insertCitation(citation);
  }

  updateCitation(citation: CitationRecord): void {
    this.transactions.run(() => {
      this.sources.updateCitation(citation);
    });
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

  setMediaPlaceId(mediaId: string, placeId: string | undefined): void {
    this.media.setPlaceId(mediaId, placeId);
  }

  updateMedia(media: MediaRecord): void {
    // The row update and the cleanup of removed files must commit together:
    // a cleanup failure must not leave the new record saved.
    this.transactions.run(() => {
      const before = this.media.getMedia(media.id);
      this.media.updateMedia(media);
      // Read the files the writer actually kept: when `files` is omitted the
      // repository derives the row from `path` and may retain the existing id.
      const remaining = new Set((this.media.getMedia(media.id)?.files ?? []).map((file) => file.id));
      for (const file of before?.files ?? []) {
        if (!remaining.has(file.id)) {
          this.deleteAttachmentsFor('media_file', file.id);
        }
      }
    });
  }

  getMedia(id: string): MediaRecord | undefined {
    return this.media.getMedia(id);
  }

  deleteMedia(id: string): boolean {
    return this.transactions.run(() => {
      const media = this.media.getMedia(id);
      this.deleteAttachmentsFor('media', id);
      for (const link of media?.links ?? []) {
        this.deleteAttachmentsFor('media_link', link.id);
      }
      for (const file of media?.files ?? []) {
        this.deleteAttachmentsFor('media_file', file.id);
      }
      return this.media.deleteMedia(id);
    });
  }

  addMediaLink(mediaId: string, link: MediaLinkRecord): void {
    this.media.addMediaLink(mediaId, link);
  }

  listMediaLinksFor(targetType: string, targetId: string): Array<{ media: MediaRecord; link: MediaLinkRecord }> {
    return this.media.listLinksFor(targetType, targetId);
  }

  hasMediaLink(id: string): boolean {
    return this.media.hasLink(id);
  }

  hasMediaFile(id: string): boolean {
    return this.media.hasFile(id);
  }

  updateMediaLink(link: MediaLinkRecord): void {
    this.media.updateMediaLink(link);
  }

  removeMediaLink(id: string): boolean {
    return this.transactions.run(() => {
      const mediaId = this.media.getMediaIdForLink(id);
      const media = mediaId !== undefined ? this.media.getMedia(mediaId) : undefined;
      this.deleteAttachmentsFor('media_link', id);
      const removed = this.media.removeMediaLink(id);
      if (removed && mediaId !== undefined && this.media.getMedia(mediaId) === undefined) {
        this.deleteAttachmentsFor('media', mediaId);
        for (const file of media?.files ?? []) {
          this.deleteAttachmentsFor('media_file', file.id);
        }
      }
      return removed;
    });
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

  setRepositoryAddressId(repositoryId: string, addressId: string | undefined): void {
    this.repositories.setAddressId(repositoryId, addressId);
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

  setSubmitterAddressId(submitterId: string, addressId: string | undefined): void {
    this.submitters.setAddressId(submitterId, addressId);
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

  insertRecordSubmitter(
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: RecordSubmitterLink['kind'] = 'contributor',
  ): void {
    this.submitters.insertRecordSubmitter(id, submitterId, targetType, targetId, kind);
  }

  listSubmittersFor(targetType: string, targetId: string): string[] {
    return this.submitters.listSubmittersFor(targetType, targetId);
  }

  getRecordSubmitter(id: string): RecordSubmitterLink | undefined {
    return this.submitters.getRecordSubmitter(id);
  }

  listRecordSubmittersFor(targetType: string, targetId: string): RecordSubmitterLink[] {
    return this.submitters.listRecordSubmittersFor(targetType, targetId);
  }

  listRecordSubmittersForSubmitter(submitterId: string): RecordSubmitterLink[] {
    return this.submitters.listRecordSubmittersForSubmitter(submitterId);
  }

  listAllRecordSubmitters(): RecordSubmitterLink[] {
    return this.submitters.listAllRecordSubmitters();
  }

  deleteRecordSubmitter(id: string): boolean {
    return this.submitters.deleteRecordSubmitter(id);
  }

  insertAddress(address: AddressRecord): void {
    this.addresses.insertAddress(address);
  }

  updateAddress(address: AddressRecord): void {
    this.transactions.run(() => {
      const before = this.addresses.getAddress(address.id);
      this.addresses.updateAddress(address);
      if (!before) {
        return;
      }
      const nextLines = new Set(address.lines.map((line) => line.id));
      for (const line of before.lines) {
        if (!nextLines.has(line.id)) {
          this.deleteAttachmentsFor('address_line', line.id);
        }
      }
    });
  }

  getAddress(id: string): AddressRecord | undefined {
    return this.addresses.getAddress(id);
  }

  listAddresses(): AddressRecord[] {
    return this.addresses.listAddresses();
  }

  deleteAddress(id: string): boolean {
    return this.transactions.run(() => {
      const address = this.addresses.getAddress(id);
      this.deleteAttachmentsFor('address', id);
      for (const line of address?.lines ?? []) {
        this.deleteAttachmentsFor('address_line', line.id);
      }
      return this.addresses.deleteAddress(id);
    });
  }

  insertIdentifier(identifier: IdentifierRecord): void {
    this.attachments.insertIdentifier(identifier);
  }

  deleteIdentifier(id: string): boolean {
    return this.attachments.deleteIdentifier(id);
  }

  updateIdentifier(identifier: IdentifierRecord): void {
    this.attachments.updateIdentifier(identifier);
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

  markReplayChange(id: string): void {
    this.replayChangeIds.add(id);
  }

  isReplayChange(id: string): boolean {
    return this.replayChangeIds.has(id);
  }

  insertContact(contact: ContactRecord): void {
    this.attachments.insertContact(contact);
  }

  deleteContact(id: string): boolean {
    return this.attachments.deleteContact(id);
  }

  updateContact(contact: ContactRecord): void {
    this.attachments.updateContact(contact);
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

  updateRestriction(restriction: RestrictionRecord): void {
    this.attachments.updateRestriction(restriction);
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

  updateTagLink(link: TagLinkRecord): void {
    this.transactions.run(() => {
      this.attachments.updateTagLink(link);
    });
  }

  listTagLinksFor(targetType: string, targetId: string): Array<{ tagId: string; link: TagLinkRecord }> {
    return this.attachments.listTagLinksFor(targetType, targetId);
  }

  listTagLinksByTag(tagId: string): TagLinkRecord[] {
    return this.attachments.listTagLinksByTag(tagId);
  }

  getTagLink(id: string): TagLinkRecord | undefined {
    return this.attachments.getTagLink(id);
  }

  listAllTagLinks(): TagLinkRecord[] {
    return this.attachments.listAllTagLinks();
  }

  insertAssociation(association: AssociationRecord): void {
    this.relations.insertAssociation(association);
  }

  updateAssociation(association: AssociationRecord): void {
    this.transactions.run(() => {
      this.relations.updateAssociation(association);
    });
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

  listAssociationsForFamily(familyId: string): AssociationRecord[] {
    return this.relations.listAssociationsForFamily(familyId);
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

  listAliasRowsFor(personId: string): Array<{ id: string; personId: string; aliasId: string }> {
    return this.relations.listAliasRowsFor(personId);
  }

  insertTodo(todo: TodoRecord): void {
    this.research.insertTodo(todo);
  }

  updateTodo(todo: TodoRecord): void {
    this.transactions.run(() => {
      this.research.updateTodo(todo);
    });
  }

  getTodo(id: string): TodoRecord | undefined {
    return this.research.getTodo(id);
  }

  setTodoRepositoryId(todoId: string, repositoryId: string | undefined): void {
    this.research.setTodoRepositoryId(todoId, repositoryId);
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
    this.transactions.run(() => {
      this.research.updateTitle(title);
    });
  }

  getTitle(id: string): TitleRecord | undefined {
    return this.research.getTitle(id);
  }

  setTitleRepositoryId(titleId: string, repositoryId: string | undefined): void {
    this.research.setTitleRepositoryId(titleId, repositoryId);
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
    const snapshot = this.collectAttachments(targetType, targetId, { cache: new Map(), visiting: new Set() });
    this.registerSnapshot(snapshot);
    return snapshot;
  }

  private collectAttachments(
    targetType: string,
    targetId: string,
    state: { cache: Map<string, AttachmentsSnapshot>; visiting: Set<string> },
  ): AttachmentsSnapshot {
    const key = `${targetType}:${targetId}`;
    const cached = state.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (state.visiting.has(key)) {
      return emptyAttachments();
    }
    state.visiting.add(key);
    const mediaLinks = this.media.listLinksFor(targetType, targetId);
    const citations = this.sources.listCitations(targetType, targetId);
    const todos = this.research.listTodosFor(targetType, targetId);
    const noteLinks = this.notes.listLinksFor(targetType, targetId);
    // Capture every linked note: another target removed by the same
    // operation may take the note's last link, and this snapshot is then
    // the only place its attachments were recorded.
    const linkedNoteIds = [...new Set(noteLinks.map((entry) => entry.note.id))];
    const linkedMedia = [...new Map(mediaLinks.map((entry) => [entry.media.id, entry.media])).values()];
    const snapshot: AttachmentsSnapshot = {
      noteLinks,
      noteAttachments: linkedNoteIds.map((noteId) => ({
        targetType: 'note',
        targetId: noteId,
        attachments: this.collectAttachments('note', noteId, state),
      })),
      citations,
      citationAttachments: citations.map((citation) => ({
        targetType: 'citation',
        targetId: citation.id,
        attachments: this.collectAttachments('citation', citation.id, state),
      })),
      mediaLinks,
      mediaAttachments: linkedMedia.map((media) => ({
        targetType: 'media',
        targetId: media.id,
        attachments: this.collectAttachments('media', media.id, state),
      })),
      mediaFileAttachments: linkedMedia.flatMap((media) =>
        (media.files ?? []).map((file) => ({
          targetType: 'media_file',
          targetId: file.id,
          attachments: this.collectAttachments('media_file', file.id, state),
        })),
      ),
      mediaLinkAttachments: mediaLinks.map((entry) => ({
        targetType: 'media_link',
        targetId: entry.link.id,
        attachments: this.collectAttachments('media_link', entry.link.id, state),
      })),
      identifiers: this.attachments.listIdentifiersFor(targetType, targetId),
      contacts: this.attachments.listContactsFor(targetType, targetId),
      restrictions: this.attachments.listRestrictionsFor(targetType, targetId),
      changes: this.attachments.listChangesFor(targetType, targetId),
      tagLinks: this.attachments.listTagLinksFor(targetType, targetId),
      todos,
      todoAttachments: todos.map((todo) => ({
        targetType: 'todo',
        targetId: todo.id,
        attachments: this.collectAttachments('todo', todo.id, state),
      })),
      recordSubmitters: this.submitters.listRecordSubmittersFor(targetType, targetId),
    };
    state.visiting.delete(key);
    state.cache.set(key, snapshot);
    return snapshot;
  }

  deleteAttachmentsFor(targetType: string, targetId: string): void {
    this.deleteAttachmentsForInternal(targetType, targetId, new Set());
  }

  private deleteAttachmentsForInternal(targetType: string, targetId: string, visited: Set<string>): void {
    const key = `${targetType}:${targetId}`;
    if (visited.has(key)) {
      return;
    }
    visited.add(key);
    this.markRemoved(targetType, targetId);
    const noteLinks = this.notes.listLinksFor(targetType, targetId);
    const removedLinksByNote = new Map<string, number>();
    for (const entry of noteLinks) {
      removedLinksByNote.set(entry.note.id, (removedLinksByNote.get(entry.note.id) ?? 0) + 1);
    }
    const deletedNoteIds = [...removedLinksByNote]
      .filter(([noteId, removed]) => this.notes.countLinksForNote(noteId) - removed <= 0)
      .map(([noteId]) => noteId);
    this.notes.deleteLinksFor(targetType, targetId);
    // A note that just lost its last link is gone; its own attachments must
    // follow it instead of being left behind as orphan rows.
    for (const noteId of deletedNoteIds) {
      this.markRemoved('note', noteId);
      this.deleteAttachmentsForInternal('note', noteId, visited);
    }
    for (const citation of this.sources.listCitations(targetType, targetId)) {
      this.deleteAttachmentsForInternal('citation', citation.id, visited);
    }
    this.sources.deleteCitationsFor(targetType, targetId);
    const links = this.media.listLinksFor(targetType, targetId);
    for (const entry of links) {
      this.deleteAttachmentsForInternal('media_link', entry.link.id, visited);
    }
    const affectedMedia = new Map(links.map((entry) => [entry.media.id, entry.media]));
    this.media.deleteLinksFor(targetType, targetId);
    for (const media of affectedMedia.values()) {
      if (!this.media.hasMedia(media.id)) {
        this.markRemoved('media', media.id);
        this.deleteAttachmentsForInternal('media', media.id, visited);
        for (const file of media.files ?? []) {
          this.markRemoved('media_file', file.id);
          this.deleteAttachmentsForInternal('media_file', file.id, visited);
        }
      }
    }
    this.attachments.deleteAllFor(targetType, targetId);
    for (const todo of this.research.listTodosFor(targetType, targetId)) {
      this.deleteAttachmentsForInternal('todo', todo.id, visited);
    }
    this.research.deleteTodosFor(targetType, targetId);
    this.submitters.deleteRecordSubmittersFor(targetType, targetId);
  }

  restoreAttachments(snapshot: AttachmentsSnapshot): void {
    const scope = this.restoreScopes[this.restoreScopes.length - 1];
    if (scope !== undefined) {
      if (scope.has(snapshot)) {
        return;
      }
      scope.add(snapshot);
      this.restoreAttachmentsInternal(snapshot, scope);
      return;
    }
    this.restoreAttachmentsInternal(snapshot, new Set());
  }

  private restoreAttachmentsInternal(snapshot: AttachmentsSnapshot, visitedFiles: Set<AttachmentsSnapshot>): void {
    const removed = this.removedTargets(snapshot);
    const restoredNotes = new Set<string>();
    for (const entry of snapshot.noteLinks) {
      if (this.notes.getNote(entry.note.id) === undefined) {
        // Only a note that this operation removed may come back; a note
        // deleted by another writer after the operation stays deleted.
        if (removed.size > 0 && !removed.has(`note\u0000${entry.note.id}`)) {
          continue;
        }
        // Reinsert without its captured links: only the links this operation
        // removed may come back.
        this.notes.insertNote({ ...entry.note, links: [] });
        restoredNotes.add(entry.note.id);
      }
      if (!this.notes.hasLink(entry.link.id)) {
        this.notes.addNoteLink(entry.note.id, entry.link);
      }
    }
    for (const nested of snapshot.noteAttachments) {
      if (restoredNotes.has(nested.targetId)) {
        this.restoreAttachmentsInternal(nested.attachments, visitedFiles);
      }
    }
    const skippedCitations = new Set<string>();
    for (const citation of snapshot.citations) {
      if (this.sources.getSource(citation.sourceId) === undefined) {
        skippedCitations.add(citation.id);
        continue;
      }
      if (this.sources.getCitation(citation.id) === undefined) {
        this.sources.insertCitation(citation);
      }
    }
    for (const nested of snapshot.citationAttachments) {
      if (!skippedCitations.has(nested.targetId)) {
        this.restoreAttachmentsInternal(nested.attachments, visitedFiles);
      }
    }
    const restoredMedia = new Set<string>();
    for (const entry of snapshot.mediaLinks) {
      if (this.media.getMedia(entry.media.id) === undefined) {
        if (removed.size > 0 && !removed.has(`media\u0000${entry.media.id}`)) {
          continue;
        }
        // The historical place may have been deleted while the media record
        // was gone; keep the raw place text and restore the rest. Reinsert
        // without captured links so only this operation's links return.
        const placeMissing = entry.media.placeId !== undefined && this.getPlace(entry.media.placeId) === undefined;
        this.media.insertMedia(
          placeMissing ? { ...entry.media, placeId: undefined, links: [] } : { ...entry.media, links: [] },
        );
        restoredMedia.add(entry.media.id);
      }
      if (!this.media.hasLink(entry.link.id)) {
        this.media.addMediaLink(entry.media.id, entry.link);
      }
    }
    for (const nested of snapshot.mediaAttachments) {
      if (restoredMedia.has(nested.targetId)) {
        this.restoreAttachmentsInternal(nested.attachments, visitedFiles);
      }
    }
    for (const nested of snapshot.mediaFileAttachments) {
      if (
        (removed.size === 0 || removed.has(`media_file\u0000${nested.targetId}`)) &&
        this.media.hasFile(nested.targetId) &&
        !visitedFiles.has(nested.attachments)
      ) {
        visitedFiles.add(nested.attachments);
        this.restoreAttachmentsInternal(nested.attachments, visitedFiles);
      }
    }
    for (const nested of snapshot.mediaLinkAttachments) {
      if (
        (removed.size === 0 || removed.has(`media_link\u0000${nested.targetId}`)) &&
        this.media.hasLink(nested.targetId)
      ) {
        this.restoreAttachmentsInternal(nested.attachments, visitedFiles);
      }
    }
    const identifierIds = new Set(
      [...new Set(snapshot.identifiers.map((entry) => `${entry.targetType}:${entry.targetId}`))].flatMap((key) => {
        const [targetType, targetId] = key.split(':');
        return this.attachments.listIdentifiersFor(targetType as string, targetId as string).map((entry) => entry.id);
      }),
    );
    for (const identifier of snapshot.identifiers) {
      if (!identifierIds.has(identifier.id)) {
        this.attachments.insertIdentifier(identifier);
        identifierIds.add(identifier.id);
      }
    }
    const contactIds = new Set(
      [...new Set(snapshot.contacts.map((entry) => `${entry.targetType}:${entry.targetId}`))].flatMap((key) => {
        const [targetType, targetId] = key.split(':');
        return this.attachments.listContactsFor(targetType as string, targetId as string).map((entry) => entry.id);
      }),
    );
    for (const contact of snapshot.contacts) {
      if (!contactIds.has(contact.id)) {
        this.attachments.insertContact(contact);
        contactIds.add(contact.id);
      }
    }
    const restrictionIds = new Set(
      [...new Set(snapshot.restrictions.map((entry) => `${entry.targetType}:${entry.targetId}`))].flatMap((key) => {
        const [targetType, targetId] = key.split(':');
        return this.attachments.listRestrictionsFor(targetType as string, targetId as string).map((entry) => entry.id);
      }),
    );
    for (const restriction of snapshot.restrictions) {
      if (!restrictionIds.has(restriction.id)) {
        this.attachments.insertRestriction(restriction);
        restrictionIds.add(restriction.id);
      }
    }
    const changeIds = new Set(
      [...new Set(snapshot.changes.map((entry) => `${entry.targetType}:${entry.targetId}`))].flatMap((key) => {
        const [targetType, targetId] = key.split(':');
        return this.attachments.listChangesFor(targetType as string, targetId as string).map((entry) => entry.id);
      }),
    );
    for (const change of snapshot.changes) {
      if (!changeIds.has(change.id)) {
        this.attachments.insertChange(change);
        changeIds.add(change.id);
      }
    }
    const tags = new Set(this.listTags().map((tag) => tag.id));
    const tagLinkIds = new Set(
      [...new Set(snapshot.tagLinks.map((entry) => `${entry.link.targetType}:${entry.link.targetId}`))].flatMap(
        (key) => {
          const [targetType, targetId] = key.split(':');
          return this.attachments
            .listTagLinksFor(targetType as string, targetId as string)
            .map((entry) => entry.link.id);
        },
      ),
    );
    for (const entry of snapshot.tagLinks) {
      if (tags.has(entry.tagId) && !tagLinkIds.has(entry.link.id)) {
        this.attachments.insertTagLink(entry.link);
        tagLinkIds.add(entry.link.id);
      }
    }
    for (const todo of snapshot.todos) {
      if (this.research.getTodo(todo.id) === undefined) {
        if (removed.size > 0 && !removed.has(`todo\u0000${todo.id}`)) {
          continue;
        }
        const repositoryMissing =
          todo.repositoryId !== undefined && this.getRepository(todo.repositoryId) === undefined;
        this.research.insertTodo(repositoryMissing ? { ...todo, repositoryId: undefined } : todo);
      }
    }
    for (const nested of snapshot.todoAttachments) {
      if (this.research.getTodo(nested.targetId) !== undefined) {
        this.restoreAttachmentsInternal(nested.attachments, visitedFiles);
      }
    }
    for (const entry of snapshot.recordSubmitters) {
      if (
        this.getSubmitter(entry.submitterId) !== undefined &&
        !this.submitters
          .listRecordSubmittersFor(entry.targetType, entry.targetId)
          .some((existing) => existing.id === entry.id)
      ) {
        this.submitters.insertRecordSubmitter(
          entry.id,
          entry.submitterId,
          entry.targetType,
          entry.targetId,
          entry.kind,
        );
      }
    }
  }

  toTreeDocument(): TreeDocument {
    return {
      persons: new Map(this.listAllPersons().map((person) => [person.id, person])),
      families: new Map(this.listFamilies().map((family) => [family.id, family])),
    };
  }

  transaction<T>(fn: () => T): T {
    const frame = new Set<string>();
    this.transactionFrames.push(frame);
    this.restoreScopes.push(new Set());
    try {
      return this.transactions.run(fn);
    } finally {
      this.restoreScopes.pop();
      this.transactionFrames.pop();
    }
  }

  /** Registers a snapshot tree so this operation's deletes can annotate it. */
  private registerSnapshot(snapshot: AttachmentsSnapshot): void {
    const frame = this.transactionFrames[0];
    if (frame === undefined) {
      return;
    }
    const visited = new WeakSet<object>();
    const visit = (node: AttachmentsSnapshot): void => {
      if (visited.has(node)) {
        return;
      }
      visited.add(node);
      this.snapshotMarkers.set(node, frame);
      for (const nested of [
        ...node.noteAttachments,
        ...node.citationAttachments,
        ...node.mediaAttachments,
        ...node.mediaFileAttachments,
        ...node.mediaLinkAttachments,
        ...node.todoAttachments,
      ]) {
        visit(nested.attachments);
      }
    };
    visit(snapshot);
  }

  /** Binds an op's snapshots to the current application's removal set. */
  bindSnapshots(snapshot: AttachmentsSnapshot): void {
    this.registerSnapshot(snapshot);
  }

  private markRemoved(targetType: string, targetId: string): void {
    const key = `${targetType}\u0000${targetId}`;
    for (const frame of this.transactionFrames) {
      frame.add(key);
    }
  }

  private removedTargets(snapshot: AttachmentsSnapshot): Set<string> {
    return this.snapshotMarkers.get(snapshot) ?? new Set();
  }
}

export function emptyAttachmentsSnapshot(): AttachmentsSnapshot {
  return emptyAttachments();
}
