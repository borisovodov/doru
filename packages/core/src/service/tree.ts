import type {
  AddressRecord,
  AssociationRecord,
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
  RecordSubmitterLink,
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
import { collectNameIds, collectNamePartIds, isProjectMediaPath } from '../model/types';
import {
  addAddressOp,
  addAliasOp,
  addAssociationOp,
  addContactOp,
  addFactOp,
  addFamilyOp,
  addIdentifierOp,
  addMediaOp,
  updateMediaOp,
  updateMediaLinkOp,
  addNoteOp,
  addPersonOp,
  attachNoteOp,
  addPlaceOp,
  addRelativeOp,
  addRepositoryOp,
  addRestrictionOp,
  addSourceOp,
  addSubmitterOp,
  addRecordSubmitterOp,
  addTagOp,
  addTitleOp,
  addTodoOp,
  attachCitationOp,
  attachMediaOp,
  attachTagOp,
  deleteAddressOp,
  deleteAliasOp,
  deleteAssociationOp,
  deleteContactOp,
  updateContactOp,
  deleteFactOp,
  deleteFamilyOp,
  deleteIdentifierOp,
  updateIdentifierOp,
  deleteMediaOp,
  deleteNoteOp,
  deletePersonOp,
  deletePlaceOp,
  deleteRepositoryOp,
  deleteRestrictionOp,
  updateRestrictionOp,
  deleteSourceOp,
  deleteSubmitterOp,
  deleteRecordSubmitterOp,
  deleteTagOp,
  deleteTitleOp,
  deleteTodoOp,
  detachCitationOp,
  detachMediaOp,
  detachNoteOp,
  detachTagOp,
  updateTagLinkOp,
  reparentOp,
  splitNoteOp,
  updateAddressOp,
  updateAssociationOp,
  updateCitationOp,
  updateFactOp,
  updateFamilyOp,
  updateNoteOp,
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
import { OpQueue, type NestedAttachments, type Op } from '../ops/op';

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

/** A family link would make a person their own ancestor. */
export class ParentCycleError extends Error {
  readonly code = 'parent-cycle';

  constructor(
    readonly childId: string,
    readonly parentId: string,
  ) {
    super(`Linking ${childId} as a child of ${parentId} would create a parent cycle`);
    this.name = 'ParentCycleError';
  }
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
    /** The local user stamped into change-log rows (the OS account in the desktop app). */
    private readonly changeUser?: string,
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
        media: this.repo
          .listMediaFor('person', personId)
          .filter((media) => (media.files ?? []).some((file) => isProjectMediaPath(file.path))).length,
      };
    }
    return counts;
  }

  // --- history -------------------------------------------------------------

  undo(): UndoRedoState {
    const pending = this.queue.peekUndo();
    if (pending) {
      // Record before the inverse mutates the tree: recording afterwards
      // would leave a change row for a target the inverse just deleted.
      this.recordChange(pending, 'changed');
      this.queue.undo({ repo: this.repo });
    }
    return this.historyState();
  }

  redo(): UndoRedoState {
    const pending = this.queue.peekRedo();
    if (pending) {
      this.recordChange(pending, 'changed');
      this.queue.redo({ repo: this.repo });
    }
    return this.historyState();
  }

  // --- persons -------------------------------------------------------------

  addPerson(person: PersonRecord): UndoRedoState {
    return this.apply(addPersonOp(person));
  }

  updatePerson(before: PersonRecord, after: PersonRecord): UndoRedoState {
    const removed: NestedAttachments[] = [];
    const nextNames = new Set(collectNameIds(after.names));
    for (const nameId of collectNameIds(before.names)) {
      if (!nextNames.has(nameId)) {
        removed.push({
          targetType: 'name',
          targetId: nameId,
          attachments: this.repo.listAttachmentsFor('name', nameId),
        });
      }
    }
    const nextParts = new Set(collectNamePartIds(after.names));
    for (const partId of collectNamePartIds(before.names)) {
      if (!nextParts.has(partId)) {
        removed.push({
          targetType: 'name_part',
          targetId: partId,
          attachments: this.repo.listAttachmentsFor('name_part', partId),
        });
      }
    }
    const nextFacts = new Set(after.facts.map((fact) => fact.id));
    for (const fact of before.facts) {
      if (!nextFacts.has(fact.id)) {
        removed.push({
          targetType: 'fact',
          targetId: fact.id,
          attachments: this.repo.listAttachmentsFor('fact', fact.id),
        });
      }
    }
    return this.apply(updatePersonOp(before, after, removed));
  }

  /**
   * Deletes the person together with their family links and every
   * attachment (notes, citations, media links, identifiers, …) — one undo
   * step restores everything, attachments included.
   */
  deletePerson(person: PersonRecord): UndoRedoState {
    const links = this.repo.listFamiliesForPerson(person.id).map((family) => ({
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
    const nested: NestedAttachments[] = [
      {
        targetType: 'person_sex',
        targetId: person.id,
        attachments: this.repo.listAttachmentsFor('person_sex', person.id),
      },
    ];
    for (const nameId of collectNameIds(person.names)) {
      nested.push({
        targetType: 'name',
        targetId: nameId,
        attachments: this.repo.listAttachmentsFor('name', nameId),
      });
    }
    for (const partId of collectNamePartIds(person.names)) {
      nested.push({
        targetType: 'name_part',
        targetId: partId,
        attachments: this.repo.listAttachmentsFor('name_part', partId),
      });
    }
    for (const fact of person.facts) {
      nested.push({
        targetType: 'fact',
        targetId: fact.id,
        attachments: this.repo.listAttachmentsFor('fact', fact.id),
      });
    }
    const associations = this.repo.listAssociationsFor(person.id);
    for (const association of associations) {
      nested.push({
        targetType: 'association',
        targetId: association.id,
        attachments: this.repo.listAttachmentsFor('association', association.id),
      });
    }
    const aliases = this.repo.listAliasRowsFor(person.id);
    const ownFactIds = new Set(this.repo.listFactsForPerson(person.id).map((fact) => fact.id));
    const participants = this.repo
      .listParticipantsForPerson(person.id)
      .filter((entry) => !ownFactIds.has(entry.factId));
    const linkAttachments = links.flatMap(({ before, after }) => this.removedLinkAttachments(before, after));
    return this.apply(
      deletePersonOp(person, links, attachments, nested, linkAttachments, associations, aliases, participants),
    );
  }

  /**
   * Moves a person (as a child) into the family of `newParentId`, creating
   * that family when it does not exist — one undo step.
   */
  reparent(childId: string, newParentId: string): UndoRedoState {
    if (this.isAncestor(childId, newParentId, this.repo.listFamilies())) {
      throw new ParentCycleError(childId, newParentId);
    }
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
    const target = this.repo.listFamiliesForPerson(newParentId).find((entry) => entry.partners.includes(newParentId));
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
    const created = target ? undefined : { id: crypto.randomUUID(), partners: [newParentId], children: [childId] };
    const linkAttachments = links.flatMap(({ before, after }) => this.removedLinkAttachments(before, after));
    return this.apply(reparentOp(links, created, childId, linkAttachments));
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
      const target = this.repo.listFamiliesForPerson(anchorId).find((entry) => entry.partners.includes(anchorId));
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
    this.assertFamilyAcyclic(family);
    return this.apply(addFamilyOp(family));
  }

  updateFamily(before: FamilyRecord, after: FamilyRecord): UndoRedoState {
    this.assertFamilyAcyclic(after);
    const removed = this.removedLinkAttachments(before, after);
    return this.apply(updateFamilyOp(before, after, removed));
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
    for (const status of family.marriageStatuses ?? []) {
      linkAttachments.push({
        targetType: 'family_marriage_status',
        targetId: status.id,
        attachments: this.repo.listAttachmentsFor('family_marriage_status', status.id),
      });
    }
    const facts = this.repo.listFactsForFamily(family.id);
    const linkedFacts = this.repo
      .listAllFacts()
      .filter((fact) => (fact.familyLinks ?? []).some((link) => link.familyId === family.id));
    const associations = this.repo.listAssociationsForFamily(family.id);
    const nested: NestedAttachments[] = [
      ...facts.map((fact) => ({
        targetType: 'fact',
        targetId: fact.id,
        attachments: this.repo.listAttachmentsFor('fact', fact.id),
      })),
      ...associations.map((association) => ({
        targetType: 'association',
        targetId: association.id,
        attachments: this.repo.listAttachmentsFor('association', association.id),
      })),
    ];
    return this.apply(deleteFamilyOp(family, attachments, linkAttachments, nested, facts, associations, linkedFacts));
  }

  // --- places ---------------------------------------------------------------

  listPlaces(): PlaceRecord[] {
    return this.repo.listPlaces();
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
    const removed = this.removedPlaceChildAttachments(before, after);
    return this.apply(updatePlaceOp(before, after, removed));
  }

  /**
   * Deletes the place, detaching the facts that reference it (their raw
   * place string survives in `place_text`) and restoring every affected
   * link, attachment and date row on undo.
   */
  deletePlace(place: PlaceRecord): UndoRedoState {
    const byId = new Map<string, FactRecord>();
    for (const fact of [
      ...this.repo.listFactsForPlace(place.id),
      ...this.repo.listFactsWithAdditionalPlace(place.id),
    ]) {
      byId.set(fact.id, fact);
    }
    const facts = [...byId.values()].map((fact) => {
      const after: FactRecord = { ...fact };
      if (fact.placeId === place.id) {
        delete after.placeId;
      }
      const additional = fact.additionalPlaceIds?.filter((id) => id !== place.id) ?? [];
      if (additional.length > 0) {
        after.additionalPlaceIds = additional;
      } else {
        delete after.additionalPlaceIds;
      }
      return { before: fact, after };
    });
    const families = this.repo
      .listFamilies()
      .filter((family) => (family.marriageStatuses ?? []).some((status) => status.placeId === place.id));
    const sources = this.repo
      .listSources()
      .filter((source) => (source.dataEvents ?? []).some((event) => event.placeId === place.id));
    const media = this.repo.listAllMedia().filter((entry) => entry.placeId === place.id);
    const childPlaces = this.repo
      .listPlaces()
      .filter((child) => (child.hierarchy ?? []).some((link) => link.parentId === place.id));
    const nested: NestedAttachments[] = [];
    for (const name of place.names) {
      nested.push({
        targetType: 'place_name',
        targetId: name.id,
        attachments: this.repo.listAttachmentsFor('place_name', name.id),
      });
    }
    const hierarchyLinks = [
      ...(place.hierarchy ?? []),
      ...childPlaces.flatMap((child) => (child.hierarchy ?? []).filter((link) => link.parentId === place.id)),
    ];
    for (const link of hierarchyLinks) {
      nested.push({
        targetType: 'place_hierarchy',
        targetId: link.id,
        attachments: this.repo.listAttachmentsFor('place_hierarchy', link.id),
      });
    }
    const attachments = this.repo.listAttachmentsFor('place', place.id);
    return this.apply(deletePlaceOp(place, facts, attachments, { families, sources, childPlaces, media }, nested));
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
    const citationAttachments = citations.map((citation) => ({
      targetType: 'citation',
      targetId: citation.id,
      attachments: this.repo.listAttachmentsFor('citation', citation.id),
    }));
    return this.apply(deleteSourceOp(source, attachments, citations, citationAttachments));
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

  /** Attaches an existing note to another target (makes it shared). */
  attachNote(noteId: string, link: NoteLinkRecord): UndoRedoState {
    return this.apply(attachNoteOp(noteId, link));
  }

  /**
   * Removes one context link. Detaching the last link deletes the note; the
   * op keeps the note and its attachments for undo.
   */
  detachNote(note: NoteRecord, link: NoteLinkRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('note', note.id);
    return this.apply(detachNoteOp(note, link, attachments));
  }

  deleteNote(note: NoteRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('note', note.id);
    return this.apply(deleteNoteOp(note, attachments));
  }

  addMedia(media: MediaRecord): UndoRedoState {
    return this.apply(addMediaOp(media));
  }

  getMedia(id: string): MediaRecord | undefined {
    return this.repo.getMedia(id);
  }

  updateMedia(before: MediaRecord, after: MediaRecord): UndoRedoState {
    const current = this.repo.getMedia(before.id) ?? before;
    const remaining = new Set((after.files ?? []).map((file) => file.id));
    const removedFiles = (current.files ?? []).filter((file) => !remaining.has(file.id));
    const fileAttachments = removedFiles.map((file) => ({
      targetType: 'media_file',
      targetId: file.id,
      attachments: this.repo.listAttachmentsFor('media_file', file.id),
    }));
    return this.apply(updateMediaOp(current, after, fileAttachments));
  }

  deleteMedia(media: MediaRecord): UndoRedoState {
    const current = this.repo.getMedia(media.id) ?? media;
    const attachments = this.repo.listAttachmentsFor('media', media.id);
    const fileAttachments = (current.files ?? []).map((file) => ({
      targetType: 'media_file',
      targetId: file.id,
      attachments: this.repo.listAttachmentsFor('media_file', file.id),
    }));
    const linkAttachments = (current.links ?? []).map((link) => ({
      targetType: 'media_link',
      targetId: link.id,
      attachments: this.repo.listAttachmentsFor('media_link', link.id),
    }));
    return this.apply(deleteMediaOp(current, attachments, fileAttachments, linkAttachments));
  }

  attachMedia(link: MediaLinkRecord): UndoRedoState {
    const media = this.repo.getMedia(link.mediaId);
    const attachments = this.repo.listAttachmentsFor('media', link.mediaId);
    const fileAttachments = (media?.files ?? []).map((file) => ({
      targetType: 'media_file',
      targetId: file.id,
      attachments: this.repo.listAttachmentsFor('media_file', file.id),
    }));
    return this.apply(attachMediaOp(link, media, attachments, fileAttachments));
  }

  updateMediaLink(before: MediaLinkRecord, after: MediaLinkRecord): UndoRedoState {
    return this.apply(updateMediaLinkOp(before, after));
  }

  detachMedia(link: MediaLinkRecord): UndoRedoState {
    const media = this.repo.getMedia(link.mediaId);
    const attachments = this.repo.listAttachmentsFor('media', link.mediaId);
    const fileAttachments = (media?.files ?? []).map((file) => ({
      targetType: 'media_file',
      targetId: file.id,
      attachments: this.repo.listAttachmentsFor('media_file', file.id),
    }));
    const linkAttachments = this.repo.listAttachmentsFor('media_link', link.id);
    return this.apply(detachMediaOp(link, media, attachments, fileAttachments, linkAttachments));
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

  updateIdentifier(before: IdentifierRecord, after: IdentifierRecord): UndoRedoState {
    return this.apply(updateIdentifierOp(before, after));
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

  updateContact(before: ContactRecord, after: ContactRecord): UndoRedoState {
    return this.apply(updateContactOp(before, after));
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

  updateRestriction(before: RestrictionRecord, after: RestrictionRecord): UndoRedoState {
    return this.apply(updateRestrictionOp(before, after));
  }

  listTags(): TagRecord[] {
    return this.repo.listTags();
  }

  listTagLinksFor(targetType: string, targetId: string): Array<{ tagId: string; link: TagLinkRecord }> {
    return this.repo.listTagLinksFor(targetType, targetId);
  }

  listAllTagLinks(): TagLinkRecord[] {
    return this.repo.listAllTagLinks();
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

  updateTagLink(before: TagLinkRecord, after: TagLinkRecord): UndoRedoState {
    return this.apply(updateTagLinkOp(before, after));
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
    const consumers = {
      sourceRepositories: this.repo.listSourceRepositoriesFor(repository.id),
      todos: this.repo.listTodos().filter((todo) => todo.repositoryId === repository.id),
      titles: this.repo.listTitles().filter((title) => title.repositoryId === repository.id),
    };
    return this.apply(deleteRepositoryOp(repository, attachments, consumers));
  }

  addSubmitter(submitter: SubmitterRecord): UndoRedoState {
    return this.apply(addSubmitterOp(submitter));
  }

  updateSubmitter(before: SubmitterRecord, after: SubmitterRecord): UndoRedoState {
    return this.apply(updateSubmitterOp(before, after));
  }

  deleteSubmitter(submitter: SubmitterRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('submitter', submitter.id);
    const consumers = { recordSubmitters: this.repo.listRecordSubmittersForSubmitter(submitter.id) };
    return this.apply(deleteSubmitterOp(submitter, attachments, consumers));
  }

  /** The submitters linked as contributors of a record (GEDCOM SUBM on INDI/FAM). */
  listRecordSubmittersFor(targetType: string, targetId: string): RecordSubmitterLink[] {
    return this.repo.listRecordSubmittersFor(targetType, targetId);
  }

  /** Every submitter link in the tree, for the global registries. */
  listAllRecordSubmitters(): RecordSubmitterLink[] {
    return this.repo.listAllRecordSubmitters();
  }

  addRecordSubmitter(
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: RecordSubmitterLink['kind'] = 'contributor',
  ): UndoRedoState {
    return this.apply(addRecordSubmitterOp(submitterId, targetType, targetId, kind));
  }

  deleteRecordSubmitter(
    id: string,
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: RecordSubmitterLink['kind'] = 'contributor',
  ): UndoRedoState {
    return this.apply(deleteRecordSubmitterOp(id, submitterId, targetType, targetId, kind));
  }

  addAddress(address: AddressRecord): UndoRedoState {
    return this.apply(addAddressOp(address));
  }

  getAddress(id: string): AddressRecord | undefined {
    return this.repo.getAddress(id);
  }

  listAddresses(): AddressRecord[] {
    return this.repo.listAddresses();
  }

  updateAddress(before: AddressRecord, after: AddressRecord): UndoRedoState {
    const removed = this.removedAddressLineAttachments(before, after);
    return this.apply(updateAddressOp(before, after, removed));
  }

  deleteAddress(address: AddressRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('address', address.id);
    const nested: NestedAttachments[] = address.lines.map((line) => ({
      targetType: 'address_line',
      targetId: line.id,
      attachments: this.repo.listAttachmentsFor('address_line', line.id),
    }));
    const consumers = {
      repositories: this.repo.listRepositories().filter((entry) => entry.addressId === address.id),
      submitters: this.repo.listSubmitters().filter((entry) => entry.addressId === address.id),
      facts: this.repo.listAllFacts().filter((entry) => entry.addressId === address.id),
      persons: this.repo.listAllPersons().filter((entry) => entry.addressId === address.id),
    };
    return this.apply(deleteAddressOp(address, attachments, consumers, nested));
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

  listAssociations(): AssociationRecord[] {
    return this.repo.listAssociations();
  }

  listAssociationsFor(personId: string): AssociationRecord[] {
    return this.repo.listAssociationsFor(personId);
  }

  addAlias(personId: string, aliasId: string): UndoRedoState {
    return this.apply(addAliasOp(crypto.randomUUID(), personId, aliasId));
  }

  listAliasesFor(personId: string): Array<{ id: string; aliasId: string }> {
    return this.repo.listAliasesFor(personId);
  }

  deleteAlias(id: string, personId: string, aliasId: string): UndoRedoState {
    return this.apply(deleteAliasOp(id, personId, aliasId));
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

  addTitle(title: TitleRecord): UndoRedoState {
    return this.apply(addTitleOp(title));
  }

  listTitles(): TitleRecord[] {
    return this.repo.listTitles();
  }

  updateTitle(before: TitleRecord, after: TitleRecord): UndoRedoState {
    return this.apply(updateTitleOp(before, after));
  }

  deleteTitle(title: TitleRecord): UndoRedoState {
    const attachments = this.repo.listAttachmentsFor('title', title.id);
    const consumers = { sources: this.repo.listSourcesForTitle(title.id) };
    return this.apply(deleteTitleOp(title, attachments, consumers));
  }

  // --- plumbing -------------------------------------------------------------

  /**
   * Rejects a family whose partner/child links would close a parent cycle.
   * The family itself is part of the graph so a single update that reverses
   * an existing parent/child pair is caught too.
   */
  private assertFamilyAcyclic(family: FamilyRecord): void {
    const graph = [...this.repo.listFamilies().filter((entry) => entry.id !== family.id), family];
    for (const childId of family.children) {
      for (const parentId of family.partners) {
        if (this.isAncestor(childId, parentId, graph)) {
          throw new ParentCycleError(childId, parentId);
        }
      }
    }
  }

  /** True when `ancestorId` is `personId` itself or one of their ancestors. */
  private isAncestor(ancestorId: string, personId: string, families: FamilyRecord[]): boolean {
    if (ancestorId === personId) {
      return true;
    }
    const seen = new Set<string>();
    const stack = [personId];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      for (const family of families) {
        if (!family.children.includes(current)) {
          continue;
        }
        for (const parent of family.partners) {
          if (parent === ancestorId) {
            return true;
          }
          if (!seen.has(parent)) {
            seen.add(parent);
            stack.push(parent);
          }
        }
      }
    }
    return false;
  }

  /** Attachments of address-line rows that an update removes. */
  private removedAddressLineAttachments(before: AddressRecord, after: AddressRecord): NestedAttachments[] {
    const removed: NestedAttachments[] = [];
    const nextLines = new Set(after.lines.map((line) => line.id));
    for (const line of before.lines) {
      if (!nextLines.has(line.id)) {
        removed.push({
          targetType: 'address_line',
          targetId: line.id,
          attachments: this.repo.listAttachmentsFor('address_line', line.id),
        });
      }
    }
    return removed;
  }

  /** Attachments of place-name and place-hierarchy rows that an update removes. */
  private removedPlaceChildAttachments(before: PlaceRecord, after: PlaceRecord): NestedAttachments[] {
    const removed: NestedAttachments[] = [];
    const nextNames = new Set(after.names.map((name) => name.id));
    for (const name of before.names) {
      if (!nextNames.has(name.id)) {
        removed.push({
          targetType: 'place_name',
          targetId: name.id,
          attachments: this.repo.listAttachmentsFor('place_name', name.id),
        });
      }
    }
    const nextHierarchy = new Set((after.hierarchy ?? []).map((link) => link.id));
    for (const link of before.hierarchy ?? []) {
      if (!nextHierarchy.has(link.id)) {
        removed.push({
          targetType: 'place_hierarchy',
          targetId: link.id,
          attachments: this.repo.listAttachmentsFor('place_hierarchy', link.id),
        });
      }
    }
    return removed;
  }

  /** Attachments of the partner/child/status rows that a family update removes. */
  private removedLinkAttachments(before: FamilyRecord, after: FamilyRecord): FamilyLinkAttachments[] {
    const removed: FamilyLinkAttachments[] = [];
    const afterPartners = new Set((after.partnerLinks ?? []).map((link) => link.id));
    for (const link of before.partnerLinks ?? []) {
      if (!afterPartners.has(link.id)) {
        removed.push({
          targetType: 'family_partner',
          targetId: link.id,
          attachments: this.repo.listAttachmentsFor('family_partner', link.id),
        });
      }
    }
    const afterChildren = new Set((after.childLinks ?? []).map((link) => link.id));
    for (const link of before.childLinks ?? []) {
      if (!afterChildren.has(link.id)) {
        removed.push({
          targetType: 'family_child',
          targetId: link.id,
          attachments: this.repo.listAttachmentsFor('family_child', link.id),
        });
      }
    }
    const afterStatuses = new Set((after.marriageStatuses ?? []).map((status) => status.id));
    for (const status of before.marriageStatuses ?? []) {
      if (!afterStatuses.has(status.id)) {
        removed.push({
          targetType: 'family_marriage_status',
          targetId: status.id,
          attachments: this.repo.listAttachmentsFor('family_marriage_status', status.id),
        });
      }
    }
    return removed;
  }

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
      user: this.changeUser,
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
