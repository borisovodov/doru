import type { FamilyRecord, PersonRecord } from '@doru/core';

export type RelativeRelation = 'child' | 'spouse' | 'parent';

export interface PersonCounts {
  notes: number;
  sources: number;
  media: number;
}

export interface TreeCanvasApi {
  /** Creates a person (used to add the first person of an empty tree). */
  addPerson(person: PersonRecord): Promise<void>;
  /** Creates a person and links them to the anchor (child/spouse/parent). */
  addRelative(relation: RelativeRelation, anchorId: string, person: PersonRecord): Promise<void>;
  /** Detaches the person from all families and deletes the record. */
  deletePerson(person: PersonRecord): Promise<void>;
  /** Moves a person (as a child) into the family of `newParentId`. */
  reparent(childId: string, newParentId: string): Promise<void>;
  /** Updates the person record (rename, dates). */
  updatePerson(before: PersonRecord, after: PersonRecord): Promise<void>;
  /** Badge counts (notes, sources, media) for the given persons. */
  getPersonCounts(personIds: string[]): Promise<Record<string, PersonCounts>>;
  /** Opens the full person editor (a PersonTab). */
  openEditor(personId: string): void;
}

export interface TreeCanvasProps {
  persons: PersonRecord[];
  families: FamilyRecord[];
  api: TreeCanvasApi;
  /** External focus request (e.g. a click in the People sidebar). */
  focusRequest?: { personId: string; nonce: number } | null;
}

export interface FocusHistory {
  stack: string[];
  index: number;
}
