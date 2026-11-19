import type {
  AddressRecord,
  AssociationRecord,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyChildLink,
  FamilyPartnerLink,
  FamilyRecord,
  IdentifierRecord,
  MediaLinkRecord,
  MediaRecord,
  NoteLinkRecord,
  NoteRecord,
  PersonName,
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
import { partsFromFlat } from '../db/nameRepo';
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
  /** The last redo was refused because newer data would have been lost. */
  redoBlocked?: boolean;
  /** The last undo was dropped because its target no longer exists. */
  undoBlocked?: boolean;
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
      try {
        this.repo.transaction(() => {
          // Record before the inverse mutates the tree: recording afterwards
          // would leave a change row for a target the inverse just deleted.
          this.recordChange(pending, 'changed');
          pending.inverse({ repo: this.repo });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (/no longer exists|cannot merge deleted/.test(message)) {
          // The target vanished under the history entry; dropping it lets
          // older entries remain reachable instead of blocking undo forever.
          this.queue.discardUndo();
          return { ...this.historyState(), undoBlocked: true };
        }
        throw error;
      }
      // The inverse committed; only now move the entry between stacks so a
      // failed replay or commit can still be retried.
      this.queue.commitUndo();
    }
    return this.historyState();
  }

  redo(): UndoRedoState {
    const pending = this.queue.peekRedo();
    if (pending) {
      const applied = this.repo.transaction(() => {
        if (pending.redoSafe !== undefined && !pending.redoSafe({ repo: this.repo })) {
          return false;
        }
        for (const snapshot of pending.snapshots ?? []) {
          this.repo.bindSnapshots(snapshot);
        }
        this.recordChange(pending, 'changed');
        pending.apply({ repo: this.repo });
        return true;
      });
      if (applied) {
        this.queue.commitRedo();
      } else {
        // The entry can never become safe again: drop it and report the
        // refusal so the caller can explain it (or offer a fresh action).
        this.queue.discardRedo();
        return { ...this.historyState(), redoBlocked: true };
      }
    }
    return this.historyState();
  }

  // --- persons -------------------------------------------------------------

  addPerson(person: PersonRecord): UndoRedoState {
    return this.apply(addPersonOp(person));
  }

  updatePerson(before: PersonRecord, after: PersonRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      // Snapshot the stored pre-write aggregate and merge only the edit onto
      // it, so facts/names added by another writer survive a stale draft.
      const current = this.repo.getPerson(before.id) ?? before;
      const merged = this.mergePersonEdit(before, after, current);
      const removed: NestedAttachments[] = [];
      const nextNames = new Set(collectNameIds(merged.names));
      for (const nameId of collectNameIds(current.names)) {
        if (!nextNames.has(nameId)) {
          removed.push({
            targetType: 'name',
            targetId: nameId,
            attachments: this.repo.listAttachmentsFor('name', nameId),
          });
        }
      }
      const currentNameById = new Map(current.names.map((name) => [name.id, name]));
      const nextParts = new Set<string>();
      const addResolvedParts = (name: PersonName, existing: PersonName | undefined): void => {
        if (name.parts === undefined) {
          for (const part of partsFromFlat(name, existing?.parts)) {
            nextParts.add(part.id);
          }
        } else {
          for (const part of name.parts) {
            nextParts.add(part.id);
          }
        }
        for (const variant of name.variants ?? []) {
          addResolvedParts(
            variant,
            existing?.variants?.find((entry) => entry.id === variant.id),
          );
        }
      };
      for (const name of merged.names) {
        addResolvedParts(name, currentNameById.get(name.id));
      }
      for (const partId of collectNamePartIds(current.names)) {
        if (!nextParts.has(partId)) {
          removed.push({
            targetType: 'name_part',
            targetId: partId,
            attachments: this.repo.listAttachmentsFor('name_part', partId),
          });
        }
      }
      const nextFacts = new Set(merged.facts.map((fact) => fact.id));
      for (const fact of current.facts) {
        if (!nextFacts.has(fact.id)) {
          removed.push({
            targetType: 'fact',
            targetId: fact.id,
            attachments: this.repo.listAttachmentsFor('fact', fact.id),
          });
        }
      }
      return updatePersonOp(current, merged, removed);
    });
  }

  /**
   * Deletes the person together with their family links and every
   * attachment (notes, citations, media links, identifiers, …) — one undo
   * step restores everything, attachments included.
   */
  deletePerson(person: PersonRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getPerson(person.id);
      if (current === undefined) {
        return undefined;
      }
      const links = this.repo.listFamiliesForPerson(current.id).map((family) => ({
        before: family,
        after: {
          ...family,
          partners: family.partners.filter((id) => id !== current.id),
          children: family.children.filter((id) => id !== current.id),
          partnerLinks: family.partnerLinks?.filter((link) => link.personId !== current.id),
          childLinks: family.childLinks?.filter((link) => link.childId !== current.id),
        },
      }));
      const attachments = this.repo.listAttachmentsFor('person', current.id);
      const nested: NestedAttachments[] = [
        {
          targetType: 'person_sex',
          targetId: current.id,
          attachments: this.repo.listAttachmentsFor('person_sex', current.id),
        },
      ];
      for (const nameId of collectNameIds(current.names)) {
        nested.push({
          targetType: 'name',
          targetId: nameId,
          attachments: this.repo.listAttachmentsFor('name', nameId),
        });
      }
      for (const partId of collectNamePartIds(current.names)) {
        nested.push({
          targetType: 'name_part',
          targetId: partId,
          attachments: this.repo.listAttachmentsFor('name_part', partId),
        });
      }
      for (const fact of current.facts) {
        nested.push({
          targetType: 'fact',
          targetId: fact.id,
          attachments: this.repo.listAttachmentsFor('fact', fact.id),
        });
      }
      const associations = this.repo.listAssociationsFor(current.id);
      for (const association of associations) {
        nested.push({
          targetType: 'association',
          targetId: association.id,
          attachments: this.repo.listAttachmentsFor('association', association.id),
        });
      }
      const aliases = this.repo.listAliasRowsFor(current.id);
      const ownFactIds = new Set(this.repo.listFactsForPerson(current.id).map((fact) => fact.id));
      const participants = this.repo
        .listParticipantsForPerson(current.id)
        .filter((entry) => !ownFactIds.has(entry.factId));
      const linkAttachments = links.flatMap(({ before, after }) => this.removedLinkAttachments(before, after));
      return deletePersonOp(current, links, attachments, nested, linkAttachments, associations, aliases, participants);
    });
  }

  /**
   * Moves a person (as a child) into the family of `newParentId`, creating
   * that family when it does not exist — one undo step.
   */
  reparent(childId: string, newParentId: string): UndoRedoState {
    return this.applyAfterCommit(() => {
      // Every read, validation and snapshot runs inside the write
      // transaction: a concurrent writer cannot introduce a cycle between
      // the check and the commit.
      if (this.isAncestor(childId, newParentId, this.repo.listFamilies())) {
        throw new ParentCycleError(childId, newParentId);
      }
      const target = this.repo.listFamiliesForPerson(newParentId).find((entry) => entry.partners.includes(newParentId));
      const links: Array<{ before: FamilyRecord; after: FamilyRecord }> = [];
      for (const family of this.repo
        .listFamiliesForPerson(childId)
        .filter((entry) => entry.children.includes(childId) && entry.id !== target?.id)) {
        links.push({
          before: family,
          after: {
            ...family,
            children: family.children.filter((id) => id !== childId),
            childLinks: family.childLinks?.filter((link) => link.childId !== childId),
          },
        });
      }
      if (target) {
        const existing = (target.childLinks ?? []).find((link) => link.childId === childId);
        // Only activating a disproven link clears its evidence; an already
        // active (or challenged) link keeps its status and phrase.
        const childLinks = existing
          ? (target.childLinks ?? []).map((link) =>
              link.childId === childId && link.status === 'disproven'
                ? { ...link, status: undefined, statusPhrase: undefined }
                : link,
            )
          : [...(target.childLinks ?? []), { id: crypto.randomUUID(), childId }];
        const after = {
          ...target,
          children: target.children.includes(childId) ? target.children : [...target.children, childId],
          childLinks,
        };
        this.assertFamilyAcyclic(after);
        links.push({ before: target, after });
      }
      const created = target ? undefined : { id: crypto.randomUUID(), partners: [newParentId], children: [childId] };
      const linkAttachments = links.flatMap(({ before, after }) => this.removedLinkAttachments(before, after));
      return reparentOp(links, created, childId, linkAttachments, (ctx) => {
        if (ctx.repo.getPerson(childId) === undefined || ctx.repo.getPerson(newParentId) === undefined) {
          return false;
        }
        for (const link of linkAttachments) {
          if (
            JSON.stringify(ctx.repo.listAttachmentsFor(link.targetType, link.targetId)) !==
            JSON.stringify(link.attachments)
          ) {
            return false;
          }
        }
        for (const link of links) {
          if (JSON.stringify(ctx.repo.getFamily(link.before.id)) !== JSON.stringify(link.before)) {
            return false;
          }
        }
        const changed = new Set(links.map((link) => link.after.id));
        const graph = [
          ...ctx.repo.listFamilies().filter((entry) => !changed.has(entry.id)),
          ...links.map((link) => link.after),
          ...(created ? [created] : []),
        ];
        const proposed = [...links.map((link) => link.after), ...(created ? [created] : [])];
        for (const family of proposed) {
          for (const child of this.activeChildIds(family)) {
            for (const parent of this.partnerIds(family)) {
              if (this.isAncestor(child, parent, graph)) {
                return false;
              }
            }
          }
        }
        return true;
      });
    });
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
    return this.applyAfterCommit(() => {
      this.assertFamilyAcyclic(family);
      return addFamilyOp(family);
    });
  }

  updateFamily(before: FamilyRecord, after: FamilyRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getFamily(before.id) ?? before;
      // A caller that edits the flat partner/child lists while carrying the
      // A caller that edits the flat partner/child lists while carrying the
      // old link rows unchanged means the flat list wins; rebuild the explicit
      // links so their metadata survives and disproven child links are kept.
      const candidate: FamilyRecord = { ...after };
      if (
        after.partnerLinks !== undefined &&
        JSON.stringify(after.partnerLinks) === JSON.stringify(before.partnerLinks) &&
        JSON.stringify(after.partners) !== JSON.stringify(before.partners)
      ) {
        const links: FamilyPartnerLink[] =
          current.partnerLinks ?? current.partners.map((personId) => ({ id: crypto.randomUUID(), personId }));
        const kept = after.partners.map(
          (personId) => links.find((link) => link.personId === personId) ?? { id: crypto.randomUUID(), personId },
        );
        for (const link of links) {
          if (!before.partners.includes(link.personId) && !after.partners.includes(link.personId)) {
            kept.push(link);
          }
        }
        candidate.partnerLinks = kept;
        candidate.partners = kept.map((link) => link.personId);
      }
      if (
        after.childLinks !== undefined &&
        JSON.stringify(after.childLinks) === JSON.stringify(before.childLinks) &&
        JSON.stringify(after.children) !== JSON.stringify(before.children)
      ) {
        const links: FamilyChildLink[] =
          current.childLinks ?? current.children.map((childId) => ({ id: crypto.randomUUID(), childId }));
        const kept: FamilyChildLink[] = [];
        for (const childId of after.children) {
          const existing = links.find((link) => link.childId === childId);
          if (existing !== undefined) {
            const newlySelected = !before.children.includes(childId);
            kept.push(
              newlySelected && existing.status === 'disproven'
                ? { ...existing, status: undefined, statusPhrase: undefined }
                : existing,
            );
          } else {
            kept.push({ id: crypto.randomUUID(), childId });
          }
        }
        for (const link of links) {
          const concurrent = !before.children.includes(link.childId) && !after.children.includes(link.childId);
          if ((link.status === 'disproven' || concurrent) && !kept.some((entry) => entry.childId === link.childId)) {
            kept.push(link);
          }
        }
        candidate.childLinks = kept;
        candidate.children = kept.map((link) => link.childId);
      }
      // Validate against the graph inside the write transaction: another
      // connection must not close a cycle between the check and the write.
      this.assertFamilyAcyclic(candidate);
      const removed = this.removedLinkAttachments(current, candidate);
      const oldPartners = this.partnerIds(current);
      const nextPartners = this.partnerIds(candidate);
      const adoptionUpdates: Array<{ before: FactRecord; after: FactRecord }> = [];
      if (JSON.stringify(oldPartners) !== JSON.stringify(nextPartners)) {
        for (const fact of this.repo.listFactsLinkedToFamily(current.id)) {
          const state = { changed: false };
          const familyLinks = (fact.familyLinks ?? []).map((link) => {
            if (link.familyId !== current.id || link.adoptedBy === undefined || link.adoptedBy === 'BOTH') {
              return link;
            }
            const personId = oldPartners[link.adoptedBy === 'HUSB' ? 0 : 1];
            if (personId === undefined) {
              return link;
            }
            const nextIndex = nextPartners.indexOf(personId);
            const adoptedBy: 'HUSB' | 'WIFE' | undefined =
              nextIndex < 0 ? undefined : nextIndex === 0 ? 'HUSB' : 'WIFE';
            if (adoptedBy === link.adoptedBy) {
              return link;
            }
            state.changed = true;
            return { ...link, adoptedBy };
          });
          if (state.changed) {
            adoptionUpdates.push({ before: fact, after: { ...fact, familyLinks } });
          }
        }
      }
      return updateFamilyOp(current, candidate, removed, adoptionUpdates);
    });
  }

  deleteFamily(family: FamilyRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getFamily(family.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('family', current.id);
      const linkAttachments: FamilyLinkAttachments[] = [];
      for (const link of current.partnerLinks ?? []) {
        linkAttachments.push({
          targetType: 'family_partner',
          targetId: link.id,
          attachments: this.repo.listAttachmentsFor('family_partner', link.id),
        });
      }
      for (const link of current.childLinks ?? []) {
        linkAttachments.push({
          targetType: 'family_child',
          targetId: link.id,
          attachments: this.repo.listAttachmentsFor('family_child', link.id),
        });
      }
      for (const status of current.marriageStatuses ?? []) {
        linkAttachments.push({
          targetType: 'family_marriage_status',
          targetId: status.id,
          attachments: this.repo.listAttachmentsFor('family_marriage_status', status.id),
        });
      }
      const facts = this.repo.listFactsForFamily(current.id);
      const linkedFacts = this.repo.listFactsLinkedToFamily(current.id);
      const associations = this.repo.listAssociationsForFamily(current.id);
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
      return deleteFamilyOp(current, attachments, linkAttachments, nested, facts, associations, linkedFacts);
    });
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
    return this.applyAfterCommit(() => {
      const current = this.repo.getPlace(before.id) ?? before;
      const removed = this.removedPlaceChildAttachments(current, after);
      return updatePlaceOp(current, after, removed);
    });
  }

  /**
   * Deletes the place, detaching the facts that reference it (their raw
   * place string survives in `place_text`) and restoring every affected
   * link, attachment and date row on undo.
   */
  deletePlace(place: PlaceRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getPlace(place.id);
      if (current === undefined) {
        return undefined;
      }
      const byId = new Map<string, FactRecord>();
      for (const fact of [
        ...this.repo.listFactsForPlace(current.id),
        ...this.repo.listFactsWithAdditionalPlace(current.id),
      ]) {
        byId.set(fact.id, fact);
      }
      const placePositions = new Map<string, number[]>();
      for (const row of this.repo.listFactPlaceRows(current.id)) {
        const positions = placePositions.get(row.factId) ?? [];
        positions.push(row.position);
        placePositions.set(row.factId, positions);
      }
      const facts = [...byId.values()].map((fact) => {
        const after: FactRecord = { ...fact };
        if (fact.placeId === current.id) {
          delete after.placeId;
        }
        const additional = fact.additionalPlaceIds?.filter((id) => id !== current.id) ?? [];
        if (additional.length > 0) {
          after.additionalPlaceIds = additional;
        } else {
          delete after.additionalPlaceIds;
        }
        const positions = placePositions.get(fact.id);
        return positions === undefined ? { before: fact, after } : { before: fact, after, positions };
      });
      const families = this.repo
        .listFamilies()
        .filter((family) => (family.marriageStatuses ?? []).some((status) => status.placeId === current.id));
      const sources = this.repo
        .listSources()
        .filter((source) => (source.dataEvents ?? []).some((event) => event.placeId === current.id));
      const media = this.repo.listAllMedia().filter((entry) => entry.placeId === current.id);
      const childPlaces = this.repo
        .listPlaces()
        .filter((child) => (child.hierarchy ?? []).some((link) => link.parentId === current.id));
      const nested: NestedAttachments[] = [];
      for (const name of current.names) {
        nested.push({
          targetType: 'place_name',
          targetId: name.id,
          attachments: this.repo.listAttachmentsFor('place_name', name.id),
        });
      }
      const hierarchyLinks = [
        ...(current.hierarchy ?? []),
        ...childPlaces.flatMap((child) => (child.hierarchy ?? []).filter((link) => link.parentId === current.id)),
      ];
      for (const link of hierarchyLinks) {
        nested.push({
          targetType: 'place_hierarchy',
          targetId: link.id,
          attachments: this.repo.listAttachmentsFor('place_hierarchy', link.id),
        });
      }
      const attachments = this.repo.listAttachmentsFor('place', current.id);
      return deletePlaceOp(current, facts, attachments, { families, sources, childPlaces, media }, nested);
    });
  }

  // --- sources and citations ------------------------------------------------

  addSource(source: SourceRecord, targetType?: string, targetId?: string): UndoRedoState {
    const citation = targetType && targetId ? { targetType, targetId } : undefined;
    return this.apply(addSourceOp(source, citation));
  }

  updateSource(before: SourceRecord, after: SourceRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getSource(before.id) ?? before;
      return updateSourceOp(current, after);
    });
  }

  deleteSource(source: SourceRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getSource(source.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('source', current.id);
      const citations = this.repo.listAllCitations().filter((citation) => citation.sourceId === current.id);
      const citationAttachments = citations.map((citation) => ({
        targetType: 'citation',
        targetId: citation.id,
        attachments: this.repo.listAttachmentsFor('citation', citation.id),
      }));
      return deleteSourceOp(current, attachments, citations, citationAttachments);
    });
  }

  attachSource(sourceId: string, targetType: string, targetId: string): UndoRedoState {
    const citation: CitationRecord = { id: crypto.randomUUID(), sourceId, targetType, targetId };
    return this.apply(attachCitationOp(citation));
  }

  updateCitation(before: CitationRecord, after: CitationRecord): UndoRedoState {
    return this.apply(updateCitationOp(before, after));
  }

  detachCitation(citationId: string): UndoRedoState {
    return this.applyAfterCommit(() => {
      const citation = this.repo.getCitation(citationId);
      if (!citation) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('citation', citation.id);
      return detachCitationOp(citation, attachments);
    });
  }

  // --- facts, notes, media ---------------------------------------------------

  addFact(fact: FactRecord): UndoRedoState {
    return this.apply(addFactOp(fact));
  }

  updateFact(before: FactRecord, after: FactRecord): UndoRedoState {
    return this.apply(updateFactOp(before, after));
  }

  deleteFact(fact: FactRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getFact(fact.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('fact', current.id);
      return deleteFactOp(current, attachments);
    });
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
    return this.applyAfterCommit(() => {
      const attachments = this.repo.listAttachmentsFor('note', note.id);
      return detachNoteOp(note, link, attachments);
    });
  }

  deleteNote(note: NoteRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getNote(note.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('note', current.id);
      return deleteNoteOp(current, attachments);
    });
  }

  addMedia(media: MediaRecord): UndoRedoState {
    return this.apply(addMediaOp(media));
  }

  getMedia(id: string): MediaRecord | undefined {
    return this.repo.getMedia(id);
  }

  updateMedia(before: MediaRecord, after: MediaRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getMedia(before.id) ?? before;
      const merged: MediaRecord = { ...current };
      for (const key of [
        'xref',
        'title',
        'path',
        'date',
        'place',
        'placeId',
        'objectType',
        'description',
        'keywords',
        'files',
        'links',
        'targetType',
        'targetId',
      ] as const) {
        if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) {
          (merged as unknown as Record<string, unknown>)[key] = after[key];
        }
      }
      const pathChanged = before.path !== after.path;
      if (pathChanged && after.files === undefined) {
        delete merged.files;
      }
      const pathMatch =
        merged.path !== undefined ? (current.files ?? []).find((file) => file.path === merged.path) : undefined;
      const writtenFiles =
        merged.files ??
        (pathChanged && merged.path !== undefined
          ? [{ id: pathMatch?.id ?? crypto.randomUUID(), path: merged.path }]
          : pathMatch !== undefined
            ? [pathMatch]
            : []);
      const remaining = new Set(writtenFiles.map((file) => file.id));
      const removedFiles = (current.files ?? []).filter((file) => !remaining.has(file.id));
      const fileAttachments = removedFiles.map((file) => ({
        targetType: 'media_file',
        targetId: file.id,
        attachments: this.repo.listAttachmentsFor('media_file', file.id),
      }));
      return updateMediaOp(current, merged, fileAttachments);
    });
  }

  deleteMedia(media: MediaRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getMedia(media.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('media', current.id);
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
      return deleteMediaOp(current, attachments, fileAttachments, linkAttachments);
    });
  }

  attachMedia(link: MediaLinkRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const media = this.repo.getMedia(link.mediaId);
      const attachments = this.repo.listAttachmentsFor('media', link.mediaId);
      const fileAttachments = (media?.files ?? []).map((file) => ({
        targetType: 'media_file',
        targetId: file.id,
        attachments: this.repo.listAttachmentsFor('media_file', file.id),
      }));
      return attachMediaOp(link, media, attachments, fileAttachments);
    });
  }

  updateMediaLink(before: MediaLinkRecord, after: MediaLinkRecord): UndoRedoState {
    return this.apply(updateMediaLinkOp(before, after));
  }

  detachMedia(link: MediaLinkRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const media = this.repo.getMedia(link.mediaId);
      const stored = media?.links?.find((entry) => entry.id === link.id) ?? link;
      const attachments = this.repo.listAttachmentsFor('media', link.mediaId);
      const fileAttachments = (media?.files ?? []).map((file) => ({
        targetType: 'media_file',
        targetId: file.id,
        attachments: this.repo.listAttachmentsFor('media_file', file.id),
      }));
      const linkAttachments = this.repo.listAttachmentsFor('media_link', stored.id);
      return detachMediaOp(stored, media, attachments, fileAttachments, linkAttachments);
    });
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
    return this.applyAfterCommit(() => {
      const stored = this.repo.listTags().find((entry) => entry.id === tag.id);
      if (stored === undefined) {
        return undefined;
      }
      return deleteTagOp(
        stored,
        this.repo.listTagLinksByTag(stored.id),
        this.repo.listAttachmentsFor('tag', stored.id),
      );
    });
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
    return this.applyAfterCommit(() => {
      // Snapshot the consumers inside the delete transaction so a task added
      // just before deletion is still restored on undo.
      const current = this.repo.getRepository(repository.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('repository', current.id);
      const consumers = {
        sourceRepositories: this.repo.listSourceRepositoriesFor(current.id),
        todos: this.repo.listTodos().filter((todo) => todo.repositoryId === current.id),
        titles: this.repo.listTitles().filter((title) => title.repositoryId === current.id),
      };
      return deleteRepositoryOp(current, attachments, consumers);
    });
  }

  addSubmitter(submitter: SubmitterRecord): UndoRedoState {
    return this.apply(addSubmitterOp(submitter));
  }

  updateSubmitter(before: SubmitterRecord, after: SubmitterRecord): UndoRedoState {
    return this.apply(updateSubmitterOp(before, after));
  }

  deleteSubmitter(submitter: SubmitterRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getSubmitter(submitter.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('submitter', current.id);
      const consumers = { recordSubmitters: this.repo.listRecordSubmittersForSubmitter(current.id) };
      return deleteSubmitterOp(current, attachments, consumers);
    });
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
    _submitterId: string,
    _targetType: string,
    _targetId: string,
    _kind: RecordSubmitterLink['kind'] = 'contributor',
  ): UndoRedoState {
    return this.applyAfterCommit(() => {
      // The caller may omit the kind; the inverse must preserve the stored one.
      const current = this.repo.getRecordSubmitter(id);
      if (current === undefined) {
        return undefined;
      }
      return deleteRecordSubmitterOp(
        current.id,
        current.submitterId,
        current.targetType,
        current.targetId,
        current.kind ?? 'contributor',
      );
    });
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
    return this.applyAfterCommit(() => {
      const current = this.repo.getAddress(before.id) ?? before;
      const removed = this.removedAddressLineAttachments(current, after);
      return updateAddressOp(current, after, removed);
    });
  }

  deleteAddress(address: AddressRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getAddress(address.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('address', current.id);
      const nested: NestedAttachments[] = current.lines.map((line) => ({
        targetType: 'address_line',
        targetId: line.id,
        attachments: this.repo.listAttachmentsFor('address_line', line.id),
      }));
      const consumers = {
        repositories: this.repo.listRepositories().filter((entry) => entry.addressId === current.id),
        submitters: this.repo.listSubmitters().filter((entry) => entry.addressId === current.id),
        factIds: this.repo.listFactIdsForAddress(current.id),
        personIds: this.repo.listPersonIdsForAddress(current.id),
      };
      return deleteAddressOp(current, attachments, consumers, nested);
    });
  }

  addAssociation(association: AssociationRecord): UndoRedoState {
    return this.apply(addAssociationOp(association));
  }

  updateAssociation(before: AssociationRecord, after: AssociationRecord): UndoRedoState {
    return this.apply(updateAssociationOp(before, after));
  }

  deleteAssociation(association: AssociationRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const stored = this.repo.listAssociations().find((entry) => entry.id === association.id);
      if (stored === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('association', stored.id);
      return deleteAssociationOp(stored, attachments);
    });
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
    return this.applyAfterCommit(() => {
      const current = this.repo.getTodo(todo.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('todo', current.id);
      return deleteTodoOp(current, attachments);
    });
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
    return this.applyAfterCommit(() => {
      const current = this.repo.getTitle(title.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('title', current.id);
      const consumers = { sources: this.repo.listSourcesForTitle(current.id) };
      return deleteTitleOp(current, attachments, consumers);
    });
  }

  // --- plumbing -------------------------------------------------------------

  /**
   * Rejects a family whose partner/child links would close a parent cycle.
   * The family itself is part of the graph so a single update that reverses
   * an existing parent/child pair is caught too.
   */
  private assertFamilyAcyclic(family: FamilyRecord): void {
    const graph = [...this.repo.listFamilies().filter((entry) => entry.id !== family.id), family];
    for (const childId of this.activeChildIds(family)) {
      for (const parentId of this.partnerIds(family)) {
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
        if (!this.activeChildIds(family).includes(current)) {
          continue;
        }
        for (const parent of this.partnerIds(family)) {
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

  private mergeChangedFields(before: unknown, after: unknown, stored: unknown): unknown {
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return stored;
    }
    if (Array.isArray(after) && before === undefined) {
      // An optional ID-bearing collection that was absent in the draft's
      // baseline: the stored rows are concurrent additions, not removals, so
      // keep them next to the draft's own new rows.
      const afterRows: unknown[] = after;
      const storedRows: unknown[] = Array.isArray(stored) ? stored : [];
      const afterIds = new Set<string>(
        afterRows.flatMap((entry) =>
          typeof entry === 'object' && entry !== null && 'id' in entry ? [(entry as { id: string }).id] : [],
        ),
      );
      const merged: unknown[] = [...afterRows];
      for (const entry of storedRows) {
        if (typeof entry === 'object' && entry !== null && 'id' in entry) {
          if (!afterIds.has((entry as { id: string }).id)) {
            merged.push(entry);
          }
        }
      }
      return merged;
    }
    if (Array.isArray(before) && Array.isArray(after)) {
      const beforeRows: unknown[] = before;
      const afterRows: unknown[] = after;
      const storedRows: unknown[] = Array.isArray(stored) ? stored : [];
      const beforeById = new Map<string, unknown>(
        beforeRows.flatMap((entry) =>
          typeof entry === 'object' && entry !== null && 'id' in entry
            ? [[(entry as { id: string }).id, entry] as const]
            : [],
        ),
      );
      const storedById = new Map<string, unknown>(
        storedRows.flatMap((entry) =>
          typeof entry === 'object' && entry !== null && 'id' in entry
            ? [[(entry as { id: string }).id, entry] as const]
            : [],
        ),
      );
      const afterIds = new Set<string>(
        afterRows.flatMap((entry) =>
          typeof entry === 'object' && entry !== null && 'id' in entry ? [(entry as { id: string }).id] : [],
        ),
      );
      const merged: unknown[] = afterRows.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null || !('id' in entry)) {
          return [entry];
        }
        const id = (entry as { id: string }).id;
        const previous = beforeById.get(id);
        const storedEntry = storedById.get(id);
        if (previous === undefined) {
          return [entry];
        }
        if (JSON.stringify(previous) === JSON.stringify(entry)) {
          return storedEntry === undefined ? [] : [storedEntry];
        }
        if (storedEntry === undefined) {
          throw new Error(`cannot merge deleted row ${id}`);
        }
        return [this.mergeChangedFields(previous, entry, storedEntry)];
      });
      for (const entry of storedRows) {
        if (typeof entry === 'object' && entry !== null && 'id' in entry) {
          const id = (entry as { id: string }).id;
          if (!beforeById.has(id) && !afterIds.has(id)) {
            merged.push(entry);
          }
        }
      }
      return merged;
    }
    if (
      typeof before === 'object' &&
      before !== null &&
      typeof after === 'object' &&
      after !== null &&
      !Array.isArray(before) &&
      !Array.isArray(after) &&
      typeof stored === 'object' &&
      stored !== null &&
      !Array.isArray(stored)
    ) {
      const beforeRecord = before as Record<string, unknown>;
      const afterRecord = after as Record<string, unknown>;
      const storedRecord = stored as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...storedRecord };
      for (const key of new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])) {
        if (key === 'additionalPlaceIds') {
          const baseline = Array.isArray(beforeRecord[key]) ? (beforeRecord[key] as string[]) : [];
          const draft = Array.isArray(afterRecord[key]) ? (afterRecord[key] as string[]) : [];
          const storedPlaces = Array.isArray(storedRecord[key]) ? (storedRecord[key] as string[]) : [];
          if (JSON.stringify(draft) === JSON.stringify(baseline)) {
            merged[key] = storedPlaces.length > 0 ? storedPlaces : undefined;
            continue;
          }
          const removed = new Set(baseline.filter((id) => !draft.includes(id)));
          const mergedPlaces: string[] = [];
          for (const id of draft) {
            if (!removed.has(id) && !mergedPlaces.includes(id)) {
              mergedPlaces.push(id);
            }
          }
          for (const id of storedPlaces) {
            if (!mergedPlaces.includes(id) && !baseline.includes(id)) {
              mergedPlaces.push(id);
            }
          }
          merged[key] = mergedPlaces.length > 0 ? mergedPlaces : undefined;
          continue;
        }
        if (
          (key === 'participants' || key === 'ages') &&
          afterRecord[key] === undefined &&
          Array.isArray(beforeRecord[key])
        ) {
          const baseline = new Set(
            (beforeRecord[key] as unknown[]).flatMap((entry) =>
              typeof entry === 'object' && entry !== null && 'id' in entry ? [(entry as { id: string }).id] : [],
            ),
          );
          const storedRows = Array.isArray(storedRecord[key]) ? (storedRecord[key] as unknown[]) : [];
          const remaining = storedRows.filter(
            (entry) =>
              !(
                typeof entry === 'object' &&
                entry !== null &&
                'id' in entry &&
                baseline.has((entry as { id: string }).id)
              ),
          );
          merged[key] = remaining.length > 0 ? remaining : undefined;
          continue;
        }
        if (key === 'familyLinks' && afterRecord[key] === undefined && Array.isArray(beforeRecord[key])) {
          // A draft that clears its last family link omits the field; remove
          // only the baseline IDs and keep concurrent additions.
          const baseline = new Set(
            (beforeRecord[key] as unknown[]).flatMap((entry) =>
              typeof entry === 'object' && entry !== null && 'id' in entry ? [(entry as { id: string }).id] : [],
            ),
          );
          const storedLinks = Array.isArray(storedRecord[key]) ? (storedRecord[key] as unknown[]) : [];
          const remaining = storedLinks.filter(
            (entry) =>
              !(
                typeof entry === 'object' &&
                entry !== null &&
                'id' in entry &&
                baseline.has((entry as { id: string }).id)
              ),
          );
          merged[key] = remaining.length > 0 ? remaining : undefined;
          continue;
        }
        merged[key] = this.mergeChangedFields(beforeRecord[key], afterRecord[key], storedRecord[key]);
      }
      return merged;
    }
    return after;
  }

  private mergePersonEdit(before: PersonRecord, after: PersonRecord, current: PersonRecord): PersonRecord {
    const previousNames = new Map(before.names.map((name) => [name.id, name]));
    const currentNames = new Map(current.names.map((name) => [name.id, name]));
    const afterNameIds = new Set(after.names.map((name) => name.id));
    const names: PersonRecord['names'] = [];
    for (const name of after.names) {
      const previous = previousNames.get(name.id);
      const stored = currentNames.get(name.id);
      if (previous === undefined) {
        names.push(name);
      } else if (JSON.stringify(previous) === JSON.stringify(name)) {
        if (stored !== undefined) {
          names.push(stored);
        }
      } else {
        if (stored === undefined) {
          throw new Error(`cannot merge deleted name ${name.id}`);
        }
        names.push(this.mergeChangedFields(previous, name, stored) as PersonRecord['names'][number]);
      }
    }
    for (const name of current.names) {
      if (!previousNames.has(name.id) && !afterNameIds.has(name.id)) {
        names.push(name);
      }
    }

    const previousFacts = new Map(before.facts.map((fact) => [fact.id, fact]));
    const currentFacts = new Map(current.facts.map((fact) => [fact.id, fact]));
    const afterFactIds = new Set(after.facts.map((fact) => fact.id));
    const facts: PersonRecord['facts'] = [];
    for (const fact of after.facts) {
      const previous = previousFacts.get(fact.id);
      const stored = currentFacts.get(fact.id);
      if (previous === undefined) {
        facts.push(fact);
      } else if (JSON.stringify(previous) === JSON.stringify(fact)) {
        if (stored !== undefined) {
          facts.push(stored);
        }
      } else {
        if (stored === undefined) {
          throw new Error(`cannot merge deleted fact ${fact.id}`);
        }
        facts.push(this.mergeChangedFields(previous, fact, stored) as PersonRecord['facts'][number]);
      }
    }
    for (const fact of current.facts) {
      if (!previousFacts.has(fact.id) && !afterFactIds.has(fact.id)) {
        facts.push(fact);
      }
    }

    return {
      id: current.id,
      xref: after.xref === before.xref ? current.xref : after.xref,
      sex: after.sex === before.sex ? current.sex : after.sex,
      deathStatus: after.deathStatus === before.deathStatus ? current.deathStatus : after.deathStatus,
      addressId: after.addressId === before.addressId ? current.addressId : after.addressId,
      names,
      facts,
    };
  }

  /** Parent ids from explicit partner links when present, else the flat list. */
  private partnerIds(family: FamilyRecord): string[] {
    return family.partnerLinks !== undefined ? family.partnerLinks.map((link) => link.personId) : family.partners;
  }

  private activeChildIds(family: FamilyRecord): string[] {
    return family.childLinks !== undefined
      ? family.childLinks.filter((link) => link.status !== 'disproven').map((link) => link.childId)
      : family.children;
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
    // The change-log row and the mutation must commit together; the op joins
    // the undo stack only after COMMIT so a failed write leaves no history.
    this.repo.transaction(() => {
      this.recordChange(op, op.change?.kind ?? 'changed');
      op.apply({ repo: this.repo });
    });
    this.queue.push(op);
    return this.historyState();
  }

  /**
   * Applies a mutation inside one transaction and publishes it to the undo
   * stack only after COMMIT succeeds. A failed save must not leave a phantom
   * undo entry or discard the redo history.
   */
  private applyAfterCommit(build: () => Op | undefined): UndoRedoState {
    let op: Op | undefined;
    this.repo.transaction(() => {
      op = build();
      if (op === undefined) {
        return;
      }
      this.recordChange(op, op.change?.kind ?? 'changed');
      op.apply({ repo: this.repo });
    });
    if (op !== undefined) {
      this.queue.push(op);
    }
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
