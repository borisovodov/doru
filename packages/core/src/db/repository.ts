import type { DatabaseSync } from 'node:sqlite';
import type {
  AddressRecord,
  AssociationRecord,
  AttachmentsSnapshot,
  CitationRecord,
  ContactRecord,
  DateValue,
  FactFamilyLink,
  FactParticipant,
  FactRecord,
  FamilyRecord,
  MediaLinkRecord,
  MediaRecord,
  NoteRecord,
  PersonName,
  PersonRecord,
  PlaceRecord,
  SubmitterLink,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TaskRecord,
  TaskTargetLink,
  TitleRecord,
  TreeDocument,
} from '../model/types';
import { collectNameIds, collectNamePartIds, emptyAttachments } from '../model/types';
import { AddressRepo } from './addressRepo';
import { AttachmentRepo } from './attachmentRepo';
import { dateOwnerKey, DateRepo, type DateReservations } from './dateRepo';
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
  /** Bumps a person's aggregate edit instant without rewriting names or facts. */
  setPersonUpdatedAt(personId: string, updatedAt: number | undefined): void;
  insertFamily(family: FamilyRecord): void;
  updateFamily(family: FamilyRecord): void;
  /** Reconnects a surviving marriage-status row to its place. */
  setFamilyMarriageStatusPlaceId(statusId: string, placeId: string | undefined): void;
  /** Bumps a family's aggregate edit instant without rewriting links or facts. */
  setFamilyUpdatedAt(familyId: string, updatedAt: number | undefined): void;
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
  insertFactEventFamilyLink(factId: string, link: FactFamilyLink): void;
  listFactsForPerson(personId: string): FactRecord[];
  listFactsForFamily(familyId: string): FactRecord[];
  /** Facts that link to a family through fact_event_family. */
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
  listNotes(): NoteRecord[];
  listNotesFor(targetType: string, targetId: string): NoteRecord[];
  insertMedia(media: MediaRecord): void;
  updateMedia(media: MediaRecord): void;
  getMedia(id: string): MediaRecord | undefined;
  deleteMedia(id: string): boolean;
  addMediaLink(mediaId: string, link: MediaLinkRecord): void;
  /** Direct media links of a target, without recursive attachment collection. */
  listMediaLinksFor(targetType: string, targetId: string): Array<{ media: MediaRecord; link: MediaLinkRecord }>;
  updateMediaLink(link: MediaLinkRecord): void;
  updateMediaLinkRow(link: MediaLinkRecord): void;
  normalizePrimaryLink(targetType: string, targetId: string): void;
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
  insertSubmitterLink(
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind?: SubmitterLink['kind'],
  ): void;
  listSubmittersFor(targetType: string, targetId: string): string[];
  getSubmitterLink(id: string): SubmitterLink | undefined;
  listSubmitterLinksFor(targetType: string, targetId: string): SubmitterLink[];
  /** Every record a submitter contributes to, for the delete/undo snapshot. */
  listSubmitterLinksForSubmitter(submitterId: string): SubmitterLink[];
  /** Every submitter link in the tree, for the global registries. */
  listAllSubmitterLinks(): SubmitterLink[];
  deleteSubmitterLink(id: string): boolean;
  insertAddress(address: AddressRecord): void;
  updateAddress(address: AddressRecord): void;
  getAddress(id: string): AddressRecord | undefined;
  listAddresses(): AddressRecord[];
  deleteAddress(id: string): boolean;
  insertContact(contact: ContactRecord): void;
  deleteContact(id: string): boolean;
  updateContact(contact: ContactRecord): void;
  listContactsFor(targetType: string, targetId: string): ContactRecord[];
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
  insertTask(task: TaskRecord): void;
  updateTask(task: TaskRecord): void;
  getTask(id: string): TaskRecord | undefined;
  deleteTask(id: string): boolean;
  listTasks(): TaskRecord[];
  listTasksFor(targetType: string, targetId: string): TaskRecord[];
  listTaskLinksFor(targetType: string, targetId: string): TaskTargetLink[];
  insertTaskLink(link: TaskTargetLink): void;
  deleteTaskLink(id: string): boolean;
  getTaskLink(id: string): TaskTargetLink | undefined;
  deleteTaskLinksFor(targetType: string, targetId: string): void;
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
    this.names = new NameRepo(db, dates, this.transactions);
    this.families = new FamilyRepo(db, this.transactions, dates);
    this.facts = new FactRepo(db, dates, this.transactions);
    this.places = new PlaceRepo(db, dates, this.transactions);
    this.sources = new SourceRepo(db, dates, this.transactions);
    this.notes = new NoteRepo(db);
    this.media = new MediaRepo(db, dates, this.transactions);
    this.attachments = new AttachmentRepo(db);
    this.repositories = new RepositoryRepo(db);
    this.relations = new RelationRepo(db, dates, this.transactions);
    this.research = new ResearchRepo(db, this.transactions);
    this.submitters = new SubmitterRepo(db);
    this.addresses = new AddressRepo(db);
  }

  insertPerson(person: PersonRecord): void {
    this.transactions.run(() => {
      this.persons.insertPerson({
        id: person.id,
        sex: person.sex,
        deathStatus: person.deathStatus,
        addressId: person.addressId,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
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
      const reservedDates = personDateReservations(oldNames, oldFacts);
      this.persons.updatePerson({
        id: person.id,
        sex: person.sex,
        deathStatus: person.deathStatus,
        addressId: person.addressId,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
      });
      const newParts = this.names.replaceNamesForPerson(person.id, person.names, reservedDates);
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
          this.facts.updateFact(fact, reservedDates);
        } else {
          this.facts.insertFact(fact, reservedDates);
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

  setPersonUpdatedAt(personId: string, updatedAt: number | undefined): void {
    this.persons.setUpdatedAt(personId, updatedAt);
  }

  insertFamily(family: FamilyRecord): void {
    this.families.insertFamily(family);
  }

  setFamilyMarriageStatusPlaceId(statusId: string, placeId: string | undefined): void {
    this.families.setMarriageStatusPlaceId(statusId, placeId);
  }

  setFamilyUpdatedAt(familyId: string, updatedAt: number | undefined): void {
    this.families.setUpdatedAt(familyId, updatedAt);
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
      this.relations.deleteAssociationsForFamily(id);
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

  insertFactEventFamilyLink(factId: string, link: FactFamilyLink): void {
    this.facts.insertFactEventFamilyLink(factId, link);
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
    return this.notes.deleteNote(id);
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
    this.transactions.run(() => {
      this.media.updateMedia(media);
    });
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

  listMediaLinksFor(targetType: string, targetId: string): Array<{ media: MediaRecord; link: MediaLinkRecord }> {
    return this.media.listLinksFor(targetType, targetId);
  }

  updateMediaLink(link: MediaLinkRecord): void {
    this.media.updateMediaLink(link);
  }

  updateMediaLinkRow(link: MediaLinkRecord): void {
    this.media.updateMediaLinkRow(link);
  }

  normalizePrimaryLink(targetType: string, targetId: string): void {
    this.media.normalizePrimaryLink(targetType, targetId);
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

  insertSubmitterLink(
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: SubmitterLink['kind'] = 'contributor',
  ): void {
    this.submitters.insertSubmitterLink(id, submitterId, targetType, targetId, kind);
  }

  listSubmittersFor(targetType: string, targetId: string): string[] {
    return this.submitters.listSubmittersFor(targetType, targetId);
  }

  getSubmitterLink(id: string): SubmitterLink | undefined {
    return this.submitters.getSubmitterLink(id);
  }

  listSubmitterLinksFor(targetType: string, targetId: string): SubmitterLink[] {
    return this.submitters.listSubmitterLinksFor(targetType, targetId);
  }

  listSubmitterLinksForSubmitter(submitterId: string): SubmitterLink[] {
    return this.submitters.listSubmitterLinksForSubmitter(submitterId);
  }

  listAllSubmitterLinks(): SubmitterLink[] {
    return this.submitters.listAllSubmitterLinks();
  }

  deleteSubmitterLink(id: string): boolean {
    return this.submitters.deleteSubmitterLink(id);
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

  insertTask(task: TaskRecord): void {
    this.research.insertTask(task);
  }

  updateTask(task: TaskRecord): void {
    this.transactions.run(() => {
      this.research.updateTask(task);
    });
  }

  getTask(id: string): TaskRecord | undefined {
    return this.research.getTask(id);
  }

  deleteTask(id: string): boolean {
    return this.transactions.run(() => {
      this.deleteAttachmentsFor('task', id);
      return this.research.deleteTask(id);
    });
  }

  listTasks(): TaskRecord[] {
    return this.research.listTasks();
  }

  listTasksFor(targetType: string, targetId: string): TaskRecord[] {
    return this.research.listTasksFor(targetType, targetId);
  }

  listTaskLinksFor(targetType: string, targetId: string): TaskTargetLink[] {
    return this.research.listTaskLinksFor(targetType, targetId);
  }

  insertTaskLink(link: TaskTargetLink): void {
    this.research.insertTaskLink(link);
  }

  deleteTaskLink(id: string): boolean {
    return this.research.deleteTaskLink(id);
  }

  getTaskLink(id: string): TaskTargetLink | undefined {
    return this.research.getTaskLink(id);
  }

  deleteTaskLinksFor(targetType: string, targetId: string): void {
    this.research.deleteTaskLinksFor(targetType, targetId);
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
    const taskLinks = this.research.listTaskLinksFor(targetType, targetId);
    const linkedMedia = [...new Map(mediaLinks.map((entry) => [entry.media.id, entry.media])).values()];
    const snapshot: AttachmentsSnapshot = {
      notes: this.notes.listNotesFor(targetType, targetId),
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
      contacts: this.attachments.listContactsFor(targetType, targetId),
      taskLinks,
      submitterLinks: this.submitters.listSubmitterLinksFor(targetType, targetId),
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
    this.notes.deleteNotesFor(targetType, targetId);
    for (const citation of this.sources.listCitations(targetType, targetId)) {
      this.deleteAttachmentsForInternal('citation', citation.id, visited);
    }
    this.sources.deleteCitationsFor(targetType, targetId);
    const links = this.media.listLinksFor(targetType, targetId);
    const affectedMedia = new Map(links.map((entry) => [entry.media.id, entry.media]));
    this.media.deleteLinksFor(targetType, targetId);
    for (const media of affectedMedia.values()) {
      if (!this.media.hasMedia(media.id)) {
        this.markRemoved('media', media.id);
        this.deleteAttachmentsForInternal('media', media.id, visited);
      }
    }
    this.attachments.deleteAllFor(targetType, targetId);
    // Tasks are shared: drop only their link to this target and keep the task
    // (and its own attachments) alive as a free-standing record when needed.
    this.research.deleteTaskLinksFor(targetType, targetId);
    this.submitters.deleteSubmitterLinksFor(targetType, targetId);
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
    for (const note of snapshot.notes) {
      if (this.notes.getNote(note.id) === undefined) {
        this.notes.insertNote(note);
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
        // Reinsert without captured links so only this operation's links return.
        this.media.insertMedia({ ...entry.media, links: [] });
        restoredMedia.add(entry.media.id);
      }
      if (!this.media.hasLink(entry.link.id)) {
        this.media.addMediaLink(entry.media.id, entry.link);
      }
    }
    for (const nested of snapshot.mediaAttachments) {
      if (restoredMedia.has(nested.targetId) || this.media.hasMedia(nested.targetId)) {
        this.restoreAttachmentsInternal(nested.attachments, visitedFiles);
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
    for (const link of snapshot.taskLinks) {
      if (
        this.research.getTask(link.taskId) !== undefined &&
        !this.research.listTaskLinksFor(link.targetType, link.targetId).some((existing) => existing.id === link.id)
      ) {
        this.research.insertTaskLink(link);
      }
    }
    for (const entry of snapshot.submitterLinks) {
      if (
        this.getSubmitter(entry.submitterId) !== undefined &&
        !this.submitters
          .listSubmitterLinksFor(entry.targetType, entry.targetId)
          .some((existing) => existing.id === entry.id)
      ) {
        this.submitters.insertSubmitterLink(entry.id, entry.submitterId, entry.targetType, entry.targetId, entry.kind);
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
      for (const nested of [...node.citationAttachments, ...node.mediaAttachments]) {
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

/**
 * All date ids owned by a person aggregate before an update. Reserving them
 * for the whole operation keeps a copy written into another slot (a fact
 * copied from a removed name, or a date moved between facts) on a fresh id.
 */
function personDateReservations(names: PersonName[], facts: FactRecord[]): DateReservations {
  const reserved = new Map<string, string>();
  const visit = (name: PersonName): void => {
    if (name.date?.id !== undefined) {
      reserved.set(name.date.id, dateOwnerKey('person_name', name.id));
    }
    for (const variant of name.variants ?? []) {
      visit(variant);
    }
  };
  for (const name of names) {
    visit(name);
  }
  for (const fact of facts) {
    if (fact.date?.id !== undefined) {
      reserved.set(fact.date.id, dateOwnerKey('fact', fact.id, 'date'));
    }
    if (fact.sortDate?.id !== undefined) {
      reserved.set(fact.sortDate.id, dateOwnerKey('fact', fact.id, 'sortDate'));
    }
  }
  return reserved;
}

export function emptyAttachmentsSnapshot(): AttachmentsSnapshot {
  return emptyAttachments();
}
