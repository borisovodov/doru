import type { CitationRecord, FactRecord, FamilyRecord, MediaRecord, NoteRecord, PersonRecord, SourceRecord } from '../model/types';
import type { PersonQuery, TreeRepository } from '../db/repository';
import {
  addFactOp,
  addFamilyOp,
  addMediaOp,
  addNoteOp,
  addPersonOp,
  addRelativeOp,
  addSourceOp,
  attachCitationOp,
  deleteFactOp,
  deleteFamilyOp,
  deleteMediaOp,
  deletePersonOp,
  detachCitationOp,
  reparentOp,
  updateFamilyOp,
  updatePersonOp,
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
    this.queue.undo({ repo: this.repo });
    return this.historyState();
  }

  redo(): UndoRedoState {
    this.queue.redo({ repo: this.repo });
    return this.historyState();
  }

  // --- persons -------------------------------------------------------------

  addPerson(person: PersonRecord): UndoRedoState {
    return this.apply(addPersonOp(person));
  }

  updatePerson(before: PersonRecord, after: PersonRecord): UndoRedoState {
    return this.apply(updatePersonOp(before, after));
  }

  /** Deletes the person together with their family links — one undo step. */
  deletePerson(person: PersonRecord): UndoRedoState {
    const links = this.repo
      .listFamiliesForPerson(person.id)
      .map((family) => ({
        before: family,
        after: {
          ...family,
          partners: family.partners.filter((id) => id !== person.id),
          children: family.children.filter((id) => id !== person.id),
        },
      }));
    return this.apply(deletePersonOp(person, links));
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
        after: { ...family, children: family.children.filter((id) => id !== childId) },
      });
    }
    const target = this.repo
      .listFamiliesForPerson(newParentId)
      .find((entry) => entry.partners.includes(newParentId));
    if (target) {
      links.push({ before: target, after: { ...target, children: [...target.children, childId] } });
    }
    const created = target
      ? undefined
      : { id: crypto.randomUUID(), partners: [newParentId], children: [childId] };
    return this.apply(reparentOp(links, created));
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
            ? { ...target, children: [...target.children, person.id] }
            : { ...target, partners: [...target.partners, person.id] };
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
    return this.apply(deleteFamilyOp(family));
  }

  // --- sources and citations ------------------------------------------------

  addSource(source: SourceRecord, targetType?: string, targetId?: string): UndoRedoState {
    const citation = targetType && targetId ? { targetType, targetId } : undefined;
    return this.apply(addSourceOp(source, citation));
  }

  attachSource(sourceId: string, targetType: string, targetId: string): UndoRedoState {
    const citation: CitationRecord = { id: crypto.randomUUID(), sourceId, targetType, targetId };
    return this.apply(attachCitationOp(citation));
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

  deleteFact(fact: FactRecord): UndoRedoState {
    return this.apply(deleteFactOp(fact));
  }

  addNote(note: NoteRecord): UndoRedoState {
    return this.apply(addNoteOp(note));
  }

  addMedia(media: MediaRecord): UndoRedoState {
    return this.apply(addMediaOp(media));
  }

  deleteMedia(media: MediaRecord): UndoRedoState {
    return this.apply(deleteMediaOp(media));
  }

  // --- plumbing -------------------------------------------------------------

  private apply(op: Op): UndoRedoState {
    this.queue.apply(op, { repo: this.repo });
    return this.historyState();
  }

  private historyState(): UndoRedoState {
    return { canUndo: this.queue.canUndo(), canRedo: this.queue.canRedo() };
  }
}
