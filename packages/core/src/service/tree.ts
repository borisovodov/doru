import type {
  AddressRecord,
  AssociationRecord,
  CensusRecord,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  DuplicateCandidateRecord,
  FactRecord,
  FactTypeRecord,
  FamilyRecord,
  IdentifierRecord,
  MediaLinkRecord,
  MediaRecord,
  NoteLinkRecord,
  NoteRecord,
  OrdinanceRecord,
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
} from '../model/types';
import type { PersonQuery, TreeRepository } from '../db/repository';
import {
  addAddressOp,
  addAliasOp,
  addAssociationOp,
  addCensusOp,
  addContactOp,
  addDuplicateOp,
  addFactOp,
  addFactTypeOp,
  addFamilyOp,
  addIdentifierOp,
  addMediaOp,
  addNoteOp,
  addOrdinanceOp,
  addPersonOp,
  addPlaceOp,
  addRelativeOp,
  addRepositoryOp,
  addRestrictionOp,
  addSourceOp,
  addSubmitterOp,
  addTagOp,
  addTitleOp,
  addTodoOp,
  attachCitationOp,
  attachMediaOp,
  attachTagOp,
  deleteAddressOp,
  deleteAliasOp,
  deleteAssociationOp,
  deleteCensusOp,
  deleteContactOp,
  deleteDuplicateOp,
  deleteFactOp,
  deleteFactTypeOp,
  deleteFamilyOp,
  deleteIdentifierOp,
  deleteMediaOp,
  deleteNoteOp,
  deleteOrdinanceOp,
  deletePersonOp,
  deletePlaceOp,
  deleteRepositoryOp,
  deleteRestrictionOp,
  deleteSourceOp,
  deleteSubmitterOp,
  deleteTagOp,
  deleteTitleOp,
  deleteTodoOp,
  detachCitationOp,
  detachMediaOp,
  detachTagOp,
  reparentOp,
  splitNoteOp,
  updateAddressOp,
  updateAssociationOp,
  updateCensusOp,
  updateCitationOp,
  updateDuplicateOp,
  updateFactOp,
  updateFactTypeOp,
  updateFamilyOp,
  updateNoteOp,
  updateOrdinanceOp,
  updatePersonOp,
  updatePlaceOp,
  updateRepositoryOp,
  updateSourceOp,
  updateSubmitterOp,
  updateTagOp,
  updateTitleOp,
  updateTodoOp,
  type FamilyLinkAttachments,
} from '../ops';
import { OpQueue, type Op } from '../ops/op';

export type RelativeRelation = 'child' | 'spouse' | 'parent';

export interface TreeStats {
  persons: number;
  families: number;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}

export interface PersonCounts {
  notes: number;
  sources: number;
  media: number;
}

/**
 * The tree domain service: every mutation of the tree flows through here as
 * an op on the project's queue (one undo step per call), and every read goes
 * through the repository. The UI (IPC handlers) and the agents (MCP backend)
 * are thin adapters over this class — the domain rules (linking relatives,
 * detaching a deleted person, reparenting) live here and nowhere else.
 */
export class TreeService {
  constructor(
    private readonly repo: TreeRepository,
    private readonly queue: OpQueue,
  ) {}

  // --- queries -------------------------------------------------------------

  listPersons(options: PersonQuery = {}): PersonRecord[] {
    return this.repo.listPersons(options);
  }

  listAllPersons(): PersonRecord[] {
    return this.repo.listAllPersons();
  }

  getPerson(id: string): PersonRecord | undefined {
    return this.repo.getPerson(id);
  }

  listFamilies(): FamilyRecord[] {
    return this.repo.listFamilies();
  }

  /** Every family the person belongs to, as a partner or a child. */
  listFamiliesForPerson(personId: string): FamilyRecord[] {
    return this.repo.listFamiliesForPerson(personId);
  }

  stats(): TreeStats {
    return { persons: this.repo.countPersons(), families: this.repo.countFamilies() };
  }

  listNotes(): NoteRecord[] {
    return this.repo.listNotes();
  }

  listNotesFor(targetType: string, targetId: string): NoteRecord[] {
    return this.repo.listNotesFor(targetType, targetId);
  }

  listSources(): SourceRecord[] {
    return this.repo.listSources();
  }

  listCitationsFor(targetType: string, targetId: string): Array<{ id: string; source: SourceRecord }> {
    return this.repo.listCitationsFor(targetType, targetId);
  }

  /** Full citation rows for a target, including page and quality. */
  listCitationRecordsFor(targetType: string, targetId: string): CitationRecord[] {
    return this.repo.listCitationRecordsFor(targetType, targetId);
  }

  listAllCitations(): CitationRecord[] {
    return this.repo.listAllCitations();
  }

  listFactsFor(personId?: string, familyId?: string): FactRecord[] {
    if (personId) {
      return this.repo.listFactsForPerson(personId);
    }
    if (familyId) {
      return this.repo.listFactsForFamily(familyId);
    }
    return [];
  }

  /** Every fact in the tree, ordered by date. */
  listAllFacts(): FactRecord[] {
    return this.repo.listAllFacts();
  }

  listMediaFor(targetType: string, targetId: string): MediaRecord[] {
    return this.repo.listMediaFor(targetType, targetId);
  }

  listAllMedia(): MediaRecord[] {
    return this.repo.listAllMedia();
  }

  /** Badge counts (notes, citations, media) for a batch of persons. */
  personCounts(personIds: string[]): Record<string, PersonCounts> {
    const counts: Record<string, PersonCounts> = {};
    for (const personId of personIds) {
      counts[personId] = {
        notes: this.repo.listNotesFor('person', personId).length,
        sources: this.repo.listCitationsFor('person', personId).length,
        media: this.repo.listMediaFor('person', personId).length,
      };
    }
    return counts;
  }

  // --- history -------------------------------------------------------------

  undo(): UndoRedoState {
    const op = this.queue.undo({ repo: this.repo });
    if (op) {
      this.recordChange(op, 'changed');
    }
    return this.historyState();
  }

  redo(): UndoRedoState {
    const op = this.queue.redo({ repo: this.repo });
    if (op) {
      this.recordChange(op, 'changed');
    }
    return this.historyState();
  }

  // --- persons -------------------------------------------------------------

  addPerson(person: PersonRecord): UndoRedoState {
    return this.apply(addPersonOp(person));
  }

  updatePerson(before: PersonRecord, after: PersonRecord): UndoRedoState {
    return this.apply(updatePersonOp(before, after));
  }

  /**
   * Deletes the person together with their family links and every
   * attachment (notes, citations, media links, identifiers, …) — one undo
   * step restores everything, attachments included.
   */
  deletePerson(person: PersonRecord): UndoRedoState {
    const links = this.repo
      .listFamiliesForPerson(person.id)
      .map((family) => ({
        before: family,
        after: {
          ...family,
          partners: family.partners.filter((id) => id !== person.id),
          children: family.children.filter((id) => id !== person.id),
          partnerLinks: family.partnerLinks?.filter((link) => link.personId !== person.id),
          childLinks: family.childLinks?.filter((link) => link.childId !== person.id),
        },
      }));
    const attachments = this.repo.listAttachmentsFor('person', person.id);
    return this.apply(deletePersonOp(person, links, attachments));
  }

  /**
   * Moves a person (as a child) into the family of `newParentId`, creating
   * that family when it does not exist — one undo step.
   */
  reparent(childId: string, newParentId: string): UndoRedoState {
    const links: Array<{ before: FamilyRecord; after: FamilyRecord }> = [];
    for (const family of this.repo.listFamiliesForPerson(childId).filter((entry) => entry.children.includes(childId))) {
      links.push({
        before: family,
        after: {
          ...family,
          children: family.children.filter((id) => id !== childId),
          childLinks: family.childLinks?.filter((link) => link.childId !== childId),
        },
      });
    }
    const target = this.repo
      .listFamiliesForPerson(newParentId)
      .find((entry) => entry.partners.includes(newParentId));
    if (target) {
      links.push({
        before: target,
        after: {
          ...target,
          children: [...target.children, childId],
          childLinks: [...(target.childLinks ?? []), { id: crypto.randomUUID(), childId }],
        },
      });
    }
    const created = target
      ? undefined
      : { id: crypto.randomUUID(), partners: [newParentId], children: [childId] };
    return this.apply(reparentOp(links, created, childId));
  }

  /**
   * Adds a person linked to an anchor: as a child or spouse (reusing the
   * anchor's family when it exists, creating one otherwise), or as a parent
   * (a new family with the anchor as the child). One undo step removes the
   * person and the link.
   */
  addRelative(relation: RelativeRelation, anchorId: string, person: PersonRecord): UndoRedoState {
    let links: Array<{ before: FamilyRecord; after: FamilyRecord }> = [];
    let created: FamilyRecord | undefined;
    if (relation === 'parent') {
      created = { id: crypto.randomUUID(), partners: [person.id], children: [anchorId] };
    } else {
      const target = this.repo
        .listFamiliesForPerson(anchorId)
        .find((entry) => entry.partners.includes(anchorId));
      if (target) {
        const after =
          relation === 'child'
            ? {
                ...target,
                children: [...target.children, person.id],
                childLinks: [...(target.childLinks ?? []), { id: crypto.randomUUID(), childId: person.id }],
              }
            : {
                ...target,
                partners: [...target.partners, person.id],
                partnerLinks: [...(target.partnerLinks ?? []), { id: crypto.randomUUID(), personId: person.id }],
              };
        links = [{ before: target, after }];
      } else {
        created = {
          id: crypto.randomUUID(),
          partners: relation === 'child' ? [anchorId] : [anchorId, person.id],
          children: relation === 'child' ? [person.id] : [],
        };
      }
    }
    return this.apply(addRelativeOp(person, links, created));
  }

  // --- families ------------------------------------------------------------

  addFamily(family: FamilyRecord): UndoRedoState {
    return this.apply(addFamilyOp(family));
  }

  updateFamily(before: FamilyRecord, after: FamilyRecord): UndoRedoState {
    return this.apply(updateFamilyOp(before, after));
  }

  deleteFamily(family: FamilyRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('family', family.id);
    const linkAttachments: FamilyLinkAttachments[] = [];
    for (const link of family.partnerLinks ?? []) {
      linkAttachments.push({
        targetType: 'family_partner',
        targetId: link.id,
        attachments: this.repo.listAttachmentsFor('family_partner', link.id),
      });
    }
    for (const link of family.childLinks ?? []) {
      linkAttachments.push({
        targetType: 'family_child',
        targetId: link.id,
        attachments: this.repo.listAttachmentsFor('family_child', link.id),
      });
    }
    return this.apply(deleteFamilyOp(family, attachments, linkAttachments));
  }

  // --- places ---------------------------------------------------------------

  listPlaces(): PlaceRecord[] {
    return this.repo.listPlaces();
  }

  searchPlaces(query: string, limit?: number): PlaceRecord[] {
    return this.repo.searchPlaces(query, limit);
  }

  getPlace(id: string): PlaceRecord | undefined {
    return this.repo.getPlace(id);
  }

  /** The facts that happened at the place. */
  listFactsForPlace(placeId: string): FactRecord[] {
    return this.repo.listFactsForPlace(placeId);
  }

  addPlace(place: PlaceRecord): UndoRedoState {
    return this.apply(addPlaceOp(place));
  }

  updatePlace(before: PlaceRecord, after: PlaceRecord): UndoRedoState {
    return this.apply(updatePlaceOp(before, after));
  }

  /**
   * Deletes the place, detaching the facts that reference it (their raw
   * place string survives in `place_text`) — one undo step restores both.
   */
  deletePlace(place: PlaceRecord): UndoRedoState {
    const facts = this.repo
      .listFactsForPlace(place.id)
      .map((fact) => ({ before: fact, after: { ...fact, placeId: undefined } }));
    const attachments = this.repo.listAttachmentsFor('place', place.id);
    return this.apply(deletePlaceOp(place, facts, attachments));
  }

  // --- sources and citations ------------------------------------------------

  addSource(source: SourceRecord, targetType?: string, targetId?: string): UndoRedoState {
    const citation = targetType && targetId ? { targetType, targetId } : undefined;
    return this.apply(addSourceOp(source, citation));
  }

  updateSource(before: SourceRecord, after: SourceRecord): UndoRedoState {
    return this.apply(updateSourceOp(before, after));
  }

  deleteSource(source: SourceRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('source', source.id);
    const citations = this.repo.listAllCitations().filter((citation) => citation.sourceId === source.id);
    return this.apply(deleteSourceOp(source, attachments, citations));
  }

  attachSource(sourceId: string, targetType: string, targetId: string): UndoRedoState {
    const citation: CitationRecord = { id: crypto.randomUUID(), sourceId, targetType, targetId };
    return this.apply(attachCitationOp(citation));
  }

  updateCitation(before: CitationRecord, after: CitationRecord): UndoRedoState {
    return this.apply(updateCitationOp(before, after));
  }

  detachCitation(citationId: string): UndoRedoState {
    const citation = this.repo.getCitation(citationId);
    if (!citation) {
      return this.historyState();
    }
    return this.apply(detachCitationOp(citation));
  }

  // --- facts, notes, media ---------------------------------------------------

  addFact(fact: FactRecord): UndoRedoState {
    return this.apply(addFactOp(fact));
  }

  updateFact(before: FactRecord, after: FactRecord): UndoRedoState {
    return this.apply(updateFactOp(before, after));
  }

  deleteFact(fact: FactRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('fact', fact.id);
    return this.apply(deleteFactOp(fact, attachments));
  }

  addNote(note: NoteRecord): UndoRedoState {
    return this.apply(addNoteOp(note));
  }

  /**
   * Updates a note. Editing a note that is attached to several places from
   * one of them splits it (copy-on-write): a new note with the edited text
   * takes the context's link, the shared text stays untouched.
   */
  updateNote(before: NoteRecord, after: NoteRecord, context?: NoteLinkRecord): UndoRedoState {
    const links = before.links ?? [];
    if (context && links.length > 1) {
      const matching = links.find(
        (link) => link.targetType === context.targetType && link.targetId === context.targetId,
      );
      if (matching) {
        const copy: NoteRecord = { ...after, id: crypto.randomUUID(), xref: undefined, links: [matching] };
        return this.apply(splitNoteOp(before.id, copy, matching));
      }
    }
    return this.apply(updateNoteOp(before, after));
  }

  deleteNote(note: NoteRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('note', note.id);
    return this.apply(deleteNoteOp(note, attachments));
  }

  addMedia(media: MediaRecord): UndoRedoState {
    return this.apply(addMediaOp(media));
  }

  deleteMedia(media: MediaRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('media', media.id);
    return this.apply(deleteMediaOp(media, attachments));
  }

  attachMedia(link: MediaLinkRecord): UndoRedoState {
    return this.apply(attachMediaOp(link));
  }

  detachMedia(link: MediaLinkRecord): UndoRedoState {
    return this.apply(detachMediaOp(link));
  }

  // --- universal attachments --------------------------------------------------

  listIdentifiersFor(targetType: string, targetId: string): IdentifierRecord[] {
    return this.repo.listIdentifiersFor(targetType, targetId);
  }

  addIdentifier(identifier: IdentifierRecord): UndoRedoState {
    return this.apply(addIdentifierOp(identifier));
  }

  deleteIdentifier(identifier: IdentifierRecord): UndoRedoState {
    return this.apply(deleteIdentifierOp(identifier));
  }

  listContactsFor(targetType: string, targetId: string): ContactRecord[] {
    return this.repo.listContactsFor(targetType, targetId);
  }

  addContact(contact: ContactRecord): UndoRedoState {
    return this.apply(addContactOp(contact));
  }

  deleteContact(contact: ContactRecord): UndoRedoState {
    return this.apply(deleteContactOp(contact));
  }

  listRestrictionsFor(targetType: string, targetId: string): RestrictionRecord[] {
    return this.repo.listRestrictionsFor(targetType, targetId);
  }

  addRestriction(restriction: RestrictionRecord): UndoRedoState {
    return this.apply(addRestrictionOp(restriction));
  }

  deleteRestriction(restriction: RestrictionRecord): UndoRedoState {
    return this.apply(deleteRestrictionOp(restriction));
  }

  listTags(): TagRecord[] {
    return this.repo.listTags();
  }

  listTagLinksFor(targetType: string, targetId: string): Array<{ tagId: string; link: TagLinkRecord }> {
    return this.repo.listTagLinksFor(targetType, targetId);
  }

  addTag(tag: TagRecord): UndoRedoState {
    return this.apply(addTagOp(tag));
  }

  updateTag(before: TagRecord, after: TagRecord): UndoRedoState {
    return this.apply(updateTagOp(before, after));
  }

  deleteTag(tag: TagRecord): UndoRedoState {
    return this.apply(deleteTagOp(tag, this.repo.listTagLinksByTag(tag.id)));
  }

  attachTag(link: TagLinkRecord): UndoRedoState {
    return this.apply(attachTagOp(link));
  }

  detachTag(link: TagLinkRecord): UndoRedoState {
    return this.apply(detachTagOp(link));
  }

  /** The change-log rows of a target (created/changed history). */
  listChangesFor(targetType: string, targetId: string): ChangeRecord[] {
    return this.repo.listChangesFor(targetType, targetId);
  }

  // --- registries: repositories, submitters, addresses, fact types, header ------

  listRepositories(): RepositoryRecord[] {
    return this.repo.listRepositories();
  }

  addRepository(repository: RepositoryRecord): UndoRedoState {
    return this.apply(addRepositoryOp(repository));
  }

  listSubmitters(): SubmitterRecord[] {
    return this.repo.listSubmitters();
  }

  updateRepository(before: RepositoryRecord, after: RepositoryRecord): UndoRedoState {
    return this.apply(updateRepositoryOp(before, after));
  }

  deleteRepository(repository: RepositoryRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('repository', repository.id);
    return this.apply(deleteRepositoryOp(repository, attachments));
  }

  addSubmitter(submitter: SubmitterRecord): UndoRedoState {
    return this.apply(addSubmitterOp(submitter));
  }

  updateSubmitter(before: SubmitterRecord, after: SubmitterRecord): UndoRedoState {
    return this.apply(updateSubmitterOp(before, after));
  }

  deleteSubmitter(submitter: SubmitterRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('submitter', submitter.id);
    return this.apply(deleteSubmitterOp(submitter, attachments));
  }

  addAddress(address: AddressRecord): UndoRedoState {
    return this.apply(addAddressOp(address));
  }

  getAddress(id: string): AddressRecord | undefined {
    return this.repo.getAddress(id);
  }

  updateAddress(before: AddressRecord, after: AddressRecord): UndoRedoState {
    return this.apply(updateAddressOp(before, after));
  }

  deleteAddress(address: AddressRecord): UndoRedoState {
    return this.apply(deleteAddressOp(address));
  }

  addFactType(type: FactTypeRecord): UndoRedoState {
    return this.apply(addFactTypeOp(type));
  }

  updateFactType(before: FactTypeRecord, after: FactTypeRecord): UndoRedoState {
    return this.apply(updateFactTypeOp(before, after));
  }

  deleteFactType(type: FactTypeRecord): UndoRedoState {
    return this.apply(deleteFactTypeOp(type));
  }

  // --- relations and the research layer ----------------------------------------

  /** Every non-family relation of the person (GEDCOM ASSO). */
  listAssociationsFor(personId: string): AssociationRecord[] {
    return this.repo.listAssociationsFor(personId);
  }

  addAssociation(association: AssociationRecord): UndoRedoState {
    return this.apply(addAssociationOp(association));
  }

  updateAssociation(before: AssociationRecord, after: AssociationRecord): UndoRedoState {
    return this.apply(updateAssociationOp(before, after));
  }

  deleteAssociation(association: AssociationRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('association', association.id);
    return this.apply(deleteAssociationOp(association, attachments));
  }

  addAlias(personId: string, aliasId: string): UndoRedoState {
    return this.apply(addAliasOp(crypto.randomUUID(), personId, aliasId));
  }

  deleteAlias(id: string, personId: string, aliasId: string): UndoRedoState {
    return this.apply(deleteAliasOp(id, personId, aliasId));
  }

  addOrdinance(ordinance: OrdinanceRecord): UndoRedoState {
    return this.apply(addOrdinanceOp(ordinance));
  }

  updateOrdinance(before: OrdinanceRecord, after: OrdinanceRecord): UndoRedoState {
    return this.apply(updateOrdinanceOp(before, after));
  }

  deleteOrdinance(ordinance: OrdinanceRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('ordinance', ordinance.id);
    return this.apply(deleteOrdinanceOp(ordinance, attachments));
  }

  addTodo(todo: TodoRecord): UndoRedoState {
    return this.apply(addTodoOp(todo));
  }

  listTodos(): TodoRecord[] {
    return this.repo.listTodos();
  }

  listTodosFor(targetType: string, targetId: string): TodoRecord[] {
    return this.repo.listTodosFor(targetType, targetId);
  }

  updateTodo(before: TodoRecord, after: TodoRecord): UndoRedoState {
    return this.apply(updateTodoOp(before, after));
  }

  deleteTodo(todo: TodoRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('todo', todo.id);
    return this.apply(deleteTodoOp(todo, attachments));
  }

  addCensus(census: CensusRecord): UndoRedoState {
    return this.apply(addCensusOp(census));
  }

  updateCensus(before: CensusRecord, after: CensusRecord): UndoRedoState {
    return this.apply(updateCensusOp(before, after));
  }

  deleteCensus(census: CensusRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('census', census.id);
    return this.apply(deleteCensusOp(census, attachments));
  }

  addDuplicate(duplicate: DuplicateCandidateRecord): UndoRedoState {
    return this.apply(addDuplicateOp(duplicate));
  }

  updateDuplicate(before: DuplicateCandidateRecord, after: DuplicateCandidateRecord): UndoRedoState {
    return this.apply(updateDuplicateOp(before, after));
  }

  deleteDuplicate(duplicate: DuplicateCandidateRecord): UndoRedoState {
    return this.apply(deleteDuplicateOp(duplicate));
  }

  addTitle(title: TitleRecord): UndoRedoState {
    return this.apply(addTitleOp(title));
  }

  updateTitle(before: TitleRecord, after: TitleRecord): UndoRedoState {
    return this.apply(updateTitleOp(before, after));
  }

  deleteTitle(title: TitleRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('title', title.id);
    return this.apply(deleteTitleOp(title, attachments));
  }

  // --- plumbing -------------------------------------------------------------

  private apply(op: Op): UndoRedoState {
    this.recordChange(op, op.change?.kind ?? 'changed');
    this.queue.apply(op, { repo: this.repo });
    return this.historyState();
  }

  /**
   * Records the change-log row for an op on the entity it touches. Runs
   * before the mutation; the row disappears with the entity when the op
   * deletes it and is restored from the op's attachment snapshot on undo.
   */
  private recordChange(op: Op, kind: 'created' | 'changed'): void {
    if (!op.change) {
      return;
    }
    const now = new Date();
    this.repo.insertChange({
      id: crypto.randomUUID(),
      targetType: op.change.targetType,
      targetId: op.change.targetId,
      kind,
      date: {
        quality: 'exact',
        component: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
        },
        time: { hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds() },
      },
    });
  }

  private historyState(): UndoRedoState {
    return { canUndo: this.queue.canUndo(), canRedo: this.queue.canRedo() };
  }
}
