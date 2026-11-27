import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyChildLink,
  FamilyPartnerLink,
  FamilyRecord,
  MediaLinkRecord,
  MediaRecord,
  NoteRecord,
  PersonName,
  PersonRecord,
  PlaceRecord,
  SubmitterLink,
  RecordTimestamps,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TargetRef,
  TaskRecord,
  TaskTargetLink,
  TitleRecord,
} from '../model/types';
import type { PersonQuery, TreeRepository } from '../db/repository';
import { partsFromFlat } from '../db/nameRepo';
import {
  collectNameIds,
  collectNamePartIds,
  isVisibleMedia,
  normalizeTaskPriority,
  normalizeTaskStatus,
  stampNewRecord,
  stampRecordEdit,
} from '../model/types';
import { isAttachmentTargetAllowed, type AttachmentTargetKind } from '../model/targetPolicy';
import {
  addAddressOp,
  addAliasOp,
  addAssociationOp,
  addContactOp,
  addFactOp,
  addFamilyOp,
  addMediaOp,
  updateMediaOp,
  updateMediaLinkOp,
  updateMediaLinksOp,
  addNoteOp,
  addPersonOp,
  addPlaceOp,
  addRelativeOp,
  addRepositoryOp,
  addSourceOp,
  addSubmitterOp,
  addSubmitterLinkOp,
  addTaskLinkOp,
  addTaskOp,
  addTitleOp,
  attachCitationOp,
  attachCitationsOp,
  attachMediaLinksOp,
  attachMediaOp,
  deleteAddressOp,
  deleteAliasOp,
  deleteAssociationOp,
  deleteContactOp,
  updateContactOp,
  deleteFactOp,
  deleteFamilyOp,
  deleteMediaOp,
  deleteNoteOp,
  deletePersonOp,
  deletePlaceOp,
  deleteRepositoryOp,
  deleteSourceOp,
  deleteSubmitterOp,
  deleteSubmitterLinkOp,
  deleteTaskLinkOp,
  deleteTaskOp,
  deleteTitleOp,
  detachCitationOp,
  detachMediaOp,
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
  updateTitleOp,
  updateTaskOp,
  type FactOwnerStamp,
  type FamilyLinkAttachments,
} from '../ops';
import { OpQueue, type NestedAttachments, type Op } from '../ops/op';
import { sameRecord } from '../ops/restore';

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
 * The attachment target policy is the single source of truth for which link
 * families may point at which records. This guard keeps the IPC and agent
 * paths consistent with the UI, which derives section visibility and picker
 * lists from the same sets.
 */
function assertTargetAllowed(kind: AttachmentTargetKind, targetType: string): void {
  if (!isAttachmentTargetAllowed(kind, targetType)) {
    throw new Error(`A ${kind} cannot target a ${targetType}.`);
  }
}

/**
 * Compares record content while ignoring the operational timestamps. An
 * autosave that leaves every field unchanged must not move `updatedAt` or
 * create an undo entry.
 */
function sameRecordContent<T extends RecordTimestamps>(left: T, right: T): boolean {
  const { createdAt: _leftCreatedAt, updatedAt: _leftUpdatedAt, ...leftContent } = left;
  const { createdAt: _rightCreatedAt, updatedAt: _rightUpdatedAt, ...rightContent } = right;
  return JSON.stringify(leftContent) === JSON.stringify(rightContent);
}

/**
 * The tree domain service: every mutation of the tree flows through here as
 * an op on the project's queue (one undo step per call), and every read goes
 * through the repository. The UI (IPC handlers) and the agents (MCP backend)
 * are thin adapters over this class — the domain rules (linking relatives,
 * detaching a deleted person) live here and nowhere else.
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
        media: this.repo.listMediaFor('person', personId).filter(isVisibleMedia).length,
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
        pending.apply({ repo: this.repo });
        return true;
      });
      if (applied) {
        this.queue.commitRedo();
      } else {
        // The entry can never become safe again: drop it and report the
        // refusal so the caller can explain it (or offer a fresh action).
        this.queue.discardRedo(pending);
        return { ...this.historyState(), redoBlocked: true };
      }
    }
    return this.historyState();
  }

  // --- persons -------------------------------------------------------------

  addPerson(person: PersonRecord): UndoRedoState {
    return this.apply(addPersonOp(stampNewRecord(person, Date.now())));
  }

  updatePerson(before: PersonRecord, after: PersonRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const now = Date.now();
      // Snapshot the stored pre-write aggregate and merge only the edit onto
      // it, so facts/names added by another writer survive a stale draft.
      const current = this.repo.getPerson(before.id) ?? before;
      const merged = this.mergePersonEdit(before, after, current);
      if (sameRecordContent(current, merged)) {
        return undefined;
      }
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
      return updatePersonOp(current, stampRecordEdit(current, merged, now), removed);
    });
  }

  /**
   * Deletes the person together with their family links and every
   * attachment (notes, citations, media links, contacts, …) — one undo
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
      const nested: NestedAttachments[] = [];
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
   * Adds a person linked to an anchor: as a child or spouse (reusing the
   * anchor's family when it exists, creating one otherwise), or as a parent
   * (a new family with the anchor as the child). One undo step removes the
   * person and the link.
   */
  addRelative(relation: RelativeRelation, anchorId: string, person: PersonRecord): UndoRedoState {
    const now = Date.now();
    let links: Array<{ before: FamilyRecord; after: FamilyRecord }> = [];
    let created: FamilyRecord | undefined;
    if (relation === 'parent') {
      created = stampNewRecord<FamilyRecord>(
        { id: crypto.randomUUID(), partners: [person.id], children: [anchorId] },
        now,
      );
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
        links = [{ before: target, after: stampRecordEdit(target, after, now) }];
      } else {
        created = stampNewRecord<FamilyRecord>(
          {
            id: crypto.randomUUID(),
            partners: relation === 'child' ? [anchorId] : [anchorId, person.id],
            children: relation === 'child' ? [person.id] : [],
          },
          now,
        );
      }
    }
    return this.apply(addRelativeOp(stampNewRecord(person, now), links, created));
  }

  // --- families ------------------------------------------------------------

  addFamily(family: FamilyRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      this.assertFamilyAcyclic(family);
      const stamped = stampNewRecord(family, Date.now());
      return addFamilyOp(stamped, (ctx) => {
        const members = new Set([
          ...stamped.partners,
          ...stamped.children,
          ...(stamped.partnerLinks ?? []).map((link) => link.personId),
          ...(stamped.childLinks ?? []).map((link) => link.childId),
        ]);
        for (const personId of members) {
          if (ctx.repo.getPerson(personId) === undefined) {
            return false;
          }
        }
        const graph = [...ctx.repo.listFamilies().filter((entry) => entry.id !== stamped.id), stamped];
        return !this.familyHasCycle(stamped, graph);
      });
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
        const kept: FamilyPartnerLink[] = [];
        for (const personId of after.partners) {
          const existing = links.find((link) => link.personId === personId);
          if (existing !== undefined) {
            kept.push(existing);
          } else if (!before.partners.includes(personId)) {
            // Only a member the draft added is created here; an unchanged id
            // whose link another writer removed stays removed.
            kept.push({ id: crypto.randomUUID(), personId });
          }
        }
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
          } else if (!before.children.includes(childId)) {
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
      // Preserve links another writer added even when the draft did not
      // touch the flat lists (for example, a metadata-only family edit).
      if (
        before.partnerLinks !== undefined &&
        after.partnerLinks !== undefined &&
        JSON.stringify(before.partnerLinks) === JSON.stringify(after.partnerLinks)
      ) {
        const knownPartnerIds = new Set([
          ...before.partnerLinks.map((link) => link.id),
          ...(candidate.partnerLinks ?? []).map((link) => link.id),
        ]);
        const extraPartners = (current.partnerLinks ?? []).filter((link) => !knownPartnerIds.has(link.id));
        if (extraPartners.length > 0) {
          const partnerLinks = [...(candidate.partnerLinks ?? []), ...extraPartners];
          candidate.partnerLinks = partnerLinks;
          candidate.partners = partnerLinks.map((link) => link.personId);
        }
      }
      if (
        before.childLinks !== undefined &&
        after.childLinks !== undefined &&
        JSON.stringify(before.childLinks) === JSON.stringify(after.childLinks)
      ) {
        const knownChildIds = new Set([
          ...before.childLinks.map((link) => link.id),
          ...(candidate.childLinks ?? []).map((link) => link.id),
        ]);
        const extraChildren = (current.childLinks ?? []).filter((link) => !knownChildIds.has(link.id));
        if (extraChildren.length > 0) {
          const childLinks = [...(candidate.childLinks ?? []), ...extraChildren];
          candidate.childLinks = childLinks;
          candidate.children = childLinks.map((link) => link.childId);
        }
      }
      // Validate against the graph inside the write transaction: another
      // connection must not close a cycle between the check and the write.
      this.assertFamilyAcyclic(candidate);
      if (sameRecordContent(current, candidate)) {
        return undefined;
      }
      const removed = this.removedLinkAttachments(current, candidate);
      const oldPartners = this.partnerIds(current);
      const nextPartners = this.partnerIds(candidate);
      const partnerRemap =
        JSON.stringify(oldPartners) === JSON.stringify(nextPartners)
          ? undefined
          : { from: oldPartners, to: nextPartners };
      return updateFamilyOp(current, stampRecordEdit(current, candidate, Date.now()), removed, partnerRemap);
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
    return this.apply(addPlaceOp(stampNewRecord(place, Date.now())));
  }

  updatePlace(before: PlaceRecord, after: PlaceRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getPlace(before.id) ?? before;
      if (sameRecordContent(current, after)) {
        return undefined;
      }
      const removed = this.removedPlaceChildAttachments(current, after);
      return updatePlaceOp(current, stampRecordEdit(current, after, Date.now()), removed);
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
      return deletePlaceOp(current, facts, attachments, { families, sources, childPlaces }, nested);
    });
  }

  // --- sources and citations ------------------------------------------------

  addSource(source: SourceRecord, targetType?: string, targetId?: string): UndoRedoState {
    if (targetType !== undefined && targetId !== undefined) {
      assertTargetAllowed('citation', targetType);
    }
    const citation = targetType && targetId ? { targetType, targetId } : undefined;
    return this.apply(addSourceOp(stampNewRecord(source, Date.now()), citation));
  }

  updateSource(before: SourceRecord, after: SourceRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getSource(before.id) ?? before;
      if (sameRecordContent(current, after)) {
        return undefined;
      }
      return updateSourceOp(current, stampRecordEdit(current, after, Date.now()));
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
    assertTargetAllowed('citation', targetType);
    return this.applyAfterCommit(() => {
      if (this.repo.listCitationRecordsFor(targetType, targetId).some((citation) => citation.sourceId === sourceId)) {
        return undefined;
      }
      const citation: CitationRecord = { id: crypto.randomUUID(), sourceId, targetType, targetId };
      return attachCitationOp(citation);
    });
  }

  /** Attaches one source to several targets with a separate citation per target. */
  attachSourceToTargets(sourceId: string, targets: readonly TargetRef[]): UndoRedoState {
    const citations = this.citationsForTargets(sourceId, targets);
    return citations.length === 0 ? this.historyState() : this.apply(attachCitationsOp(citations));
  }

  private citationsForTargets(sourceId: string, targets: readonly TargetRef[]): CitationRecord[] {
    const seen = new Set<string>();
    const citations: CitationRecord[] = [];
    for (const target of targets) {
      assertTargetAllowed('citation', target.targetType);
      const key = `${target.targetType}\u0000${target.targetId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (
        this.repo
          .listCitationRecordsFor(target.targetType, target.targetId)
          .some((citation) => citation.sourceId === sourceId)
      ) {
        continue;
      }
      citations.push({
        id: crypto.randomUUID(),
        sourceId,
        targetType: target.targetType,
        targetId: target.targetId,
      });
    }
    return citations;
  }

  updateCitation(before: CitationRecord, after: CitationRecord): UndoRedoState {
    assertTargetAllowed('citation', after.targetType);
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
    return this.applyAfterCommit(() => {
      const now = Date.now();
      return addFactOp(fact, this.factOwnerStamps([fact], now));
    });
  }

  updateFact(before: FactRecord, after: FactRecord): UndoRedoState {
    if (sameRecord(before, after)) {
      return this.historyState();
    }
    return this.applyAfterCommit(() => {
      const stored = this.repo.getFact(before.id);
      const current = stored ?? before;
      if (sameRecord(current, after)) {
        return undefined;
      }
      const now = Date.now();
      return updateFactOp(current, after, this.factOwnerStamps([current, after], now));
    });
  }

  deleteFact(fact: FactRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getFact(fact.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('fact', current.id);
      return deleteFactOp(current, attachments, this.factOwnerStamps([current], Date.now()));
    });
  }

  /**
   * The person/family aggregates whose edit instant a fact change moves. A
   * fact update can move a fact between owners, so the caller passes both
   * sides; duplicates collapse to one stamp per owner.
   */
  private factOwnerStamps(facts: readonly FactRecord[], now: number): FactOwnerStamp[] {
    const stamps = new Map<string, FactOwnerStamp>();
    for (const fact of facts) {
      if (fact.personId !== undefined) {
        const key = `person\u0000${fact.personId}`;
        if (!stamps.has(key)) {
          stamps.set(key, {
            targetType: 'person',
            targetId: fact.personId,
            before: this.repo.getPerson(fact.personId)?.updatedAt,
            after: now,
          });
        }
      } else if (fact.familyId !== undefined) {
        const key = `family\u0000${fact.familyId}`;
        if (!stamps.has(key)) {
          stamps.set(key, {
            targetType: 'family',
            targetId: fact.familyId,
            before: this.repo.getFamily(fact.familyId)?.updatedAt,
            after: now,
          });
        }
      }
    }
    return [...stamps.values()];
  }

  addNote(note: NoteRecord): UndoRedoState {
    if (!note.targetType || !note.targetId) {
      throw new Error('A note must have a target.');
    }
    assertTargetAllowed('note', note.targetType);
    const now = Date.now();
    return this.apply(addNoteOp({ ...note, createdAt: note.createdAt ?? now, updatedAt: now }));
  }

  /** Updates the note text; the owning target never changes. */
  updateNote(before: NoteRecord, after: NoteRecord): UndoRedoState {
    const stored = this.repo.getNote(before.id);
    if (stored === undefined) {
      return this.historyState();
    }
    const now = Date.now();
    return this.apply(updateNoteOp(stored, { ...stored, text: after.text, updatedAt: now }));
  }

  deleteNote(note: NoteRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getNote(note.id);
      if (current === undefined) {
        return undefined;
      }
      return deleteNoteOp(current);
    });
  }

  addMedia(media: MediaRecord): UndoRedoState {
    if (media.targetType !== undefined) {
      assertTargetAllowed('mediaLink', media.targetType);
    }
    for (const link of media.links ?? []) {
      assertTargetAllowed('mediaLink', link.targetType);
    }
    return this.apply(addMediaOp(stampNewRecord(media, Date.now())));
  }

  getMedia(id: string): MediaRecord | undefined {
    return this.repo.getMedia(id);
  }

  updateMedia(before: MediaRecord, after: MediaRecord): UndoRedoState {
    // Links are not persisted by this update path: attach, detach and relink
    // operations own the media_link rows and enforce the target policy there.
    return this.applyAfterCommit(() => {
      const now = Date.now();
      const current = this.repo.getMedia(before.id) ?? before;
      const merged: MediaRecord = { ...current };
      for (const key of ['title', 'path', 'date', 'links', 'targetType', 'targetId'] as const) {
        if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) {
          (merged as unknown as Record<string, unknown>)[key] = after[key];
        }
      }
      if (sameRecordContent(current, merged)) {
        return undefined;
      }
      return updateMediaOp(current, stampRecordEdit(current, merged, now));
    });
  }

  deleteMedia(media: MediaRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getMedia(media.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('media', current.id);
      return deleteMediaOp(current, attachments);
    });
  }

  attachMedia(link: MediaLinkRecord): UndoRedoState {
    assertTargetAllowed('mediaLink', link.targetType);
    return this.applyAfterCommit(() => {
      const media = this.repo.getMedia(link.mediaId);
      if (
        media?.links?.some((existing) => existing.targetType === link.targetType && existing.targetId === link.targetId)
      ) {
        return undefined;
      }
      const primaryBefore = this.repo.listMediaLinksFor(link.targetType, link.targetId).map((entry) => entry.link);
      return attachMediaOp(link, primaryBefore);
    });
  }

  /** Attaches one media record to several targets in a single undo step. */
  attachMediaToTargets(mediaId: string, targets: readonly TargetRef[]): UndoRedoState {
    if (this.repo.getMedia(mediaId) === undefined) {
      throw new Error(`media ${mediaId} no longer exists`);
    }
    for (const target of targets) {
      assertTargetAllowed('mediaLink', target.targetType);
    }
    const existing = new Set(
      (this.repo.getMedia(mediaId)?.links ?? []).map((link) => `${link.targetType}\u0000${link.targetId}`),
    );
    const links: MediaLinkRecord[] = [];
    for (const target of targets) {
      const key = `${target.targetType}\u0000${target.targetId}`;
      if (existing.has(key)) {
        continue;
      }
      existing.add(key);
      links.push({
        id: crypto.randomUUID(),
        mediaId,
        targetType: target.targetType,
        targetId: target.targetId,
      });
    }
    return links.length === 0 ? this.historyState() : this.apply(attachMediaLinksOp(links));
  }

  updateMediaLink(before: MediaLinkRecord, after: MediaLinkRecord): UndoRedoState {
    assertTargetAllowed('mediaLink', after.targetType);
    return this.applyAfterCommit(() => {
      const stored = this.repo.getMedia(before.mediaId)?.links?.find((link) => link.id === before.id);
      if (stored === undefined) {
        return undefined;
      }
      // The renderer supplies the full row; never let a mismatched id move the
      // update set to a different link while the target's primary flags change.
      const desired: MediaLinkRecord = { ...after, id: stored.id, mediaId: stored.mediaId };
      if (stored.targetType !== desired.targetType || stored.targetId !== desired.targetId) {
        // Moving a link between targets keeps the repository's normalization
        // path; capture both targets so undo can restore their sibling flags.
        return updateMediaLinkOp(stored, desired, {
          oldTarget: this.repo.listMediaLinksFor(stored.targetType, stored.targetId).map((entry) => entry.link),
          newTarget: this.repo.listMediaLinksFor(desired.targetType, desired.targetId).map((entry) => entry.link),
        });
      }
      const currentLinks = this.repo.listMediaLinksFor(stored.targetType, stored.targetId).map((entry) => entry.link);
      const nextLinks = currentLinks.map((link) => (link.id === stored.id ? { ...desired } : { ...link }));
      if (desired.primary === true) {
        for (const link of nextLinks) {
          link.primary = link.id === stored.id ? true : false;
        }
      } else {
        const primary = nextLinks.find((link) => link.primary === true);
        if (primary === undefined) {
          const first = nextLinks[0];
          if (first !== undefined) {
            first.primary = true;
          }
        } else {
          for (const link of nextLinks) {
            if (link.id !== primary.id) {
              link.primary = false;
            }
          }
        }
      }
      const nextById = new Map(nextLinks.map((link) => [link.id, link]));
      const pairs = currentLinks.flatMap((link) => {
        const next = nextById.get(link.id);
        return next === undefined || JSON.stringify(next) === JSON.stringify(link)
          ? []
          : [{ before: link, after: next }];
      });
      return pairs.length === 0 ? undefined : updateMediaLinksOp(pairs);
    });
  }

  detachMedia(link: MediaLinkRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const media = this.repo.getMedia(link.mediaId);
      const stored = media?.links?.find((entry) => entry.id === link.id);
      if (media === undefined || stored === undefined) {
        return undefined;
      }
      return detachMediaOp(stored);
    });
  }

  // --- universal attachments --------------------------------------------------

  listContactsFor(targetType: string, targetId: string): ContactRecord[] {
    return this.repo.listContactsFor(targetType, targetId);
  }

  addContact(contact: ContactRecord): UndoRedoState {
    assertTargetAllowed('contact', contact.targetType);
    return this.apply(addContactOp(contact));
  }

  deleteContact(contact: ContactRecord): UndoRedoState {
    return this.apply(deleteContactOp(contact));
  }

  updateContact(before: ContactRecord, after: ContactRecord): UndoRedoState {
    assertTargetAllowed('contact', after.targetType);
    return this.apply(updateContactOp(before, after));
  }

  // --- registries: repositories, submitters, addresses, fact types, header ------

  listRepositories(): RepositoryRecord[] {
    return this.repo.listRepositories();
  }

  addRepository(repository: RepositoryRecord): UndoRedoState {
    return this.apply(addRepositoryOp(stampNewRecord(repository, Date.now())));
  }

  listSubmitters(): SubmitterRecord[] {
    return this.repo.listSubmitters();
  }

  updateRepository(before: RepositoryRecord, after: RepositoryRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getRepository(before.id) ?? before;
      if (sameRecordContent(current, after)) {
        return undefined;
      }
      return updateRepositoryOp(current, stampRecordEdit(current, after, Date.now()));
    });
  }

  deleteRepository(repository: RepositoryRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      // Snapshot the consumers inside the delete transaction so a title added
      // just before deletion is still restored on undo.
      const current = this.repo.getRepository(repository.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('repository', current.id);
      const consumers = {
        sourceRepositories: this.repo.listSourceRepositoriesFor(current.id),
        titles: this.repo.listTitles().filter((title) => title.repositoryId === current.id),
      };
      return deleteRepositoryOp(current, attachments, consumers);
    });
  }

  addSubmitter(submitter: SubmitterRecord): UndoRedoState {
    return this.apply(addSubmitterOp(stampNewRecord(submitter, Date.now())));
  }

  updateSubmitter(before: SubmitterRecord, after: SubmitterRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getSubmitter(before.id) ?? before;
      if (sameRecordContent(current, after)) {
        return undefined;
      }
      return updateSubmitterOp(current, stampRecordEdit(current, after, Date.now()));
    });
  }

  deleteSubmitter(submitter: SubmitterRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getSubmitter(submitter.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('submitter', current.id);
      const consumers = { submitterLinks: this.repo.listSubmitterLinksForSubmitter(current.id) };
      return deleteSubmitterOp(current, attachments, consumers);
    });
  }

  /** The submitters linked as contributors of a record (GEDCOM SUBM on INDI/FAM). */
  listSubmitterLinksFor(targetType: string, targetId: string): SubmitterLink[] {
    return this.repo.listSubmitterLinksFor(targetType, targetId);
  }

  /** Every submitter link in the tree, for the global registries. */
  listAllSubmitterLinks(): SubmitterLink[] {
    return this.repo.listAllSubmitterLinks();
  }

  addSubmitterLink(
    submitterId: string,
    targetType: string,
    targetId: string,
    kind: SubmitterLink['kind'] = 'contributor',
  ): UndoRedoState {
    assertTargetAllowed('submitterLink', targetType);
    if (kind !== 'contributor' && targetType !== 'person') {
      throw new Error(`A submitterLink cannot target a ${targetType} for ${kind}.`);
    }
    return this.apply(addSubmitterLinkOp(submitterId, targetType, targetId, kind));
  }

  deleteSubmitterLink(
    id: string,
    _submitterId: string,
    _targetType: string,
    _targetId: string,
    _kind: SubmitterLink['kind'] = 'contributor',
  ): UndoRedoState {
    return this.applyAfterCommit(() => {
      // The caller may omit the kind; the inverse must preserve the stored one.
      const current = this.repo.getSubmitterLink(id);
      if (current === undefined) {
        return undefined;
      }
      return deleteSubmitterLinkOp(
        current.id,
        current.submitterId,
        current.targetType,
        current.targetId,
        current.kind ?? 'contributor',
      );
    });
  }

  addAddress(address: AddressRecord): UndoRedoState {
    return this.apply(addAddressOp(stampNewRecord(address, Date.now())));
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
      if (sameRecordContent(current, after)) {
        return undefined;
      }
      const removed = this.removedAddressLineAttachments(current, after);
      return updateAddressOp(current, stampRecordEdit(current, after, Date.now()), removed);
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

  addTask(task: TaskRecord): UndoRedoState {
    for (const link of task.targets) {
      assertTargetAllowed('taskLink', link.targetType);
    }
    const now = Date.now();
    return this.apply(
      addTaskOp({
        ...task,
        priority: normalizeTaskPriority(task.priority),
        status: normalizeTaskStatus(task.status),
        createdAt: task.createdAt ?? now,
        updatedAt: now,
      }),
    );
  }

  listTasks(): TaskRecord[] {
    return this.repo.listTasks();
  }

  listTasksFor(targetType: string, targetId: string): TaskRecord[] {
    return this.repo.listTasksFor(targetType, targetId);
  }

  listTaskLinksFor(targetType: string, targetId: string): TaskTargetLink[] {
    return this.repo.listTaskLinksFor(targetType, targetId);
  }

  addTaskLink(link: TaskTargetLink): UndoRedoState {
    assertTargetAllowed('taskLink', link.targetType);
    if (this.repo.getTask(link.taskId) === undefined) {
      throw new Error(`task ${link.taskId} no longer exists`);
    }
    if (this.repo.listTaskLinksFor(link.targetType, link.targetId).some((entry) => entry.taskId === link.taskId)) {
      return this.historyState();
    }
    return this.apply(addTaskLinkOp(link));
  }

  deleteTaskLink(link: TaskTargetLink): UndoRedoState {
    const current = this.repo.getTaskLink(link.id);
    if (current === undefined) {
      return this.historyState();
    }
    return this.apply(deleteTaskLinkOp(current));
  }

  updateTask(before: TaskRecord, after: TaskRecord): UndoRedoState {
    for (const link of after.targets) {
      assertTargetAllowed('taskLink', link.targetType);
    }
    return this.applyAfterCommit(() => {
      const current = this.repo.getTask(before.id);
      if (current === undefined) {
        return undefined;
      }
      return updateTaskOp(current, {
        ...after,
        priority: normalizeTaskPriority(after.priority),
        status: normalizeTaskStatus(after.status),
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      });
    });
  }

  deleteTask(task: TaskRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getTask(task.id);
      if (current === undefined) {
        return undefined;
      }
      const attachments = this.repo.listAttachmentsFor('task', current.id);
      return deleteTaskOp(current, attachments);
    });
  }

  addTitle(title: TitleRecord): UndoRedoState {
    return this.apply(addTitleOp(stampNewRecord(title, Date.now())));
  }

  listTitles(): TitleRecord[] {
    return this.repo.listTitles();
  }

  updateTitle(before: TitleRecord, after: TitleRecord): UndoRedoState {
    return this.applyAfterCommit(() => {
      const current = this.repo.getTitle(before.id) ?? before;
      if (sameRecordContent(current, after)) {
        return undefined;
      }
      return updateTitleOp(current, stampRecordEdit(current, after, Date.now()));
    });
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

  private familyHasCycle(family: FamilyRecord, graph: FamilyRecord[]): boolean {
    for (const childId of this.activeChildIds(family)) {
      for (const parentId of this.partnerIds(family)) {
        if (this.isAncestor(childId, parentId, graph)) {
          return true;
        }
      }
    }
    return false;
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
          // Occurrences are ordered rows, not unique ids: [P, P] + appended Q
          // must stay [P, P, Q]. Preserve concurrent removals and additions
          // by comparing multiplicities instead of a set difference.
          const count = (list: string[], id: string): number => list.filter((entry) => entry === id).length;
          const outputCounts = new Map<string, number>();
          const ids = new Set([...draft, ...storedPlaces, ...baseline]);
          for (const id of ids) {
            const draftCount = count(draft, id);
            const baselineCount = count(baseline, id);
            const storedCount = count(storedPlaces, id);
            const keptFromBaseline = Math.min(draftCount, storedCount);
            const draftAdded = Math.max(0, draftCount - baselineCount);
            const storedAdded = Math.max(0, storedCount - baselineCount);
            outputCounts.set(id, keptFromBaseline + Math.max(draftAdded, storedAdded));
          }
          const mergedPlaces: string[] = [];
          const emitted = new Map<string, number>();
          const emit = (id: string): void => {
            const target = outputCounts.get(id) ?? 0;
            if ((emitted.get(id) ?? 0) < target) {
              mergedPlaces.push(id);
              emitted.set(id, (emitted.get(id) ?? 0) + 1);
            }
          };
          const draftBaselineOrder = draft.filter((id) => baseline.includes(id));
          const baselineKeptOrder = baseline.filter((id) => draft.includes(id));
          const explicitReorder = JSON.stringify(draftBaselineOrder) !== JSON.stringify(baselineKeptOrder);
          const appendOnly = draft.every((id, index) =>
            baseline.includes(id) ? true : !draft.slice(index + 1).some((entry) => baseline.includes(entry)),
          );
          if (explicitReorder || !appendOnly) {
            for (const id of draft) {
              emit(id);
            }
            for (const id of storedPlaces) {
              emit(id);
            }
          } else {
            // Append-only (or removal-only) drafts keep the live order of the
            // surviving entries, then add the draft's new occurrences and
            // finally any concurrent additions.
            for (const id of storedPlaces) {
              if (baseline.includes(id)) {
                emit(id);
              }
            }
            for (const id of draft) {
              if (!baseline.includes(id)) {
                emit(id);
              }
            }
            for (const id of storedPlaces) {
              if (!baseline.includes(id)) {
                emit(id);
              }
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
    let names: PersonRecord['names'] = [];
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
    const beforeOrder = before.names.map((name) => name.id).filter((id) => afterNameIds.has(id));
    const draftOrder = after.names.map((name) => name.id).filter((id) => previousNames.has(id));
    if (draftOrder.length === beforeOrder.length && draftOrder.every((id, index) => id === beforeOrder[index])) {
      // The draft kept the original relative order; adopt a concurrent
      // reorder of existing names, but keep inserted names at the positions
      // the draft requested.
      const mergedById = new Map(names.map((name) => [name.id, name]));
      const ordered: PersonRecord['names'] = [];
      for (const name of current.names) {
        const merged = mergedById.get(name.id);
        if (merged !== undefined) {
          ordered.push(merged);
          mergedById.delete(name.id);
        }
      }
      for (const name of after.names) {
        if (previousNames.has(name.id)) {
          continue;
        }
        const merged = mergedById.get(name.id);
        if (merged === undefined) {
          continue;
        }
        const anchorIndex = after.names
          .slice(after.names.indexOf(name) + 1)
          .findIndex((entry) => previousNames.has(entry.id) && ordered.some((row) => row.id === entry.id));
        if (anchorIndex === -1) {
          ordered.push(merged);
        } else {
          const anchor = after.names[after.names.indexOf(name) + 1 + anchorIndex];
          if (anchor !== undefined) {
            ordered.splice(
              ordered.findIndex((row) => row.id === anchor.id),
              0,
              merged,
            );
          }
        }
        mergedById.delete(name.id);
      }
      for (const name of mergedById.values()) {
        ordered.push(name);
      }
      names = ordered;
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
    // The mutation and the undo entry must commit together; the op joins the
    // undo stack only after COMMIT so a failed write leaves no phantom entry.
    this.repo.transaction(() => {
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
      op.apply({ repo: this.repo });
    });
    if (op !== undefined) {
      this.queue.push(op);
    }
    return this.historyState();
  }

  private historyState(): UndoRedoState {
    return { canUndo: this.queue.canUndo(), canRedo: this.queue.canRedo() };
  }
}
