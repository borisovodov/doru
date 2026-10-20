export type { IFileSystem } from './fs';
export type {
  DateQuality,
  DateValue,
  EventRecord,
  FamilyRecord,
  MediaRecord,
  NamePart,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  Sex,
  SourceRecord,
  TreeDocument,
} from './model/types';
export { emptyDocument } from './model/types';
export { DORU_APPLICATION_ID, SCHEMA_SQL, SCHEMA_VERSION } from './db/schema';
export { TreeStore, type ITreeStore, type TreeStoreFactory } from './db/store';
export {
  SqliteTreeRepository,
  type PersonQuery,
  type TreeRepository,
} from './db/repository';
export {
  MEDIA_DIR_NAME,
  TREE_FILE_EXTENSION,
} from './project/layout';
export {
  ProjectOpener,
  type OpenedProject,
  type ProjectLogger,
  type ProjectSummary,
} from './project/opener';
export { RecentProjects, type RecentProject } from './project/recent';
export { OpQueue, type MutationContext, type Op } from './ops/op';
export { addPersonOp } from './ops/addPerson';
export { updatePersonOp, deletePersonOp, reparentOp, addRelativeOp } from './ops/person';
export { addNoteOp, addSourceOp, attachCitationOp, detachCitationOp, type CitationRecord } from './ops/source';
export { addFamilyOp, deleteFamilyOp, updateFamilyOp } from './ops/family';
export { addEventOp, addMediaOp, deleteEventOp, deleteMediaOp } from './ops/record';
export { computePedigree, type PedigreeNode } from './pedigree';
export {
  layoutPedigree,
  suggestFocusPerson,
  isDescendantOf,
  type ChartKind,
  type LaidOutCard,
  type PedigreeCard,
  type PedigreeCardRole,
  type PedigreeEdge,
  type PedigreeEdgeKind,
  type PedigreeLayout,
  type PedigreeLayoutOptions,
  type PedigreeLine,
} from './layout/pedigree';
export { renderPedigreeSvg, type SvgRenderOptions } from './layout/svg';
export interface GedcomImportResult {
  importedPersons: number;
  importedFamilies: number;
  totalPersons: number;
}

/**
 * The renderer-facing identity of the project bound to a window: a real
 * `.doru` path, or an `untitled:` id for a project that was created from a
 * GEDCOM import and has not been saved to a `.doru` file yet.
 */
export interface ProjectBinding {
  /** Internal key: a `.doru` path or an `untitled:` id. */
  path: string;
  /** Whether the project has not been saved to a `.doru` file yet. */
  untitled: boolean;
  /** Display name for the window title (the file name, with extension). */
  name: string;
}

export interface TreeStats {
  persons: number;
  families: number;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}
export { detectParentCycles, type ValidationIssue } from './validate/validator';
