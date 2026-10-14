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
export { updatePersonOp } from './ops/person';
export { addNoteOp, addSourceOp, attachCitationOp, detachCitationOp, type CitationRecord } from './ops/source';
export { addFamilyOp, deleteFamilyOp, updateFamilyOp } from './ops/family';
export { addEventOp, addMediaOp, deleteEventOp, deleteMediaOp } from './ops/record';
export { importGedcomOp, type GedcomImportOp } from './ops/importGedcom';
export { computePedigree, type PedigreeNode } from './pedigree';
export {
  layoutPedigree,
  suggestFocusPerson,
  type ChartDirection,
  type LaidOutCard,
  type PedigreeCard,
  type PedigreeCardRole,
  type PedigreeEdge,
  type PedigreeEdgeKind,
  type PedigreeLayout,
  type PedigreeLayoutOptions,
} from './layout/pedigree';
export interface GedcomImportResult {
  importedPersons: number;
  importedFamilies: number;
  totalPersons: number;
}

export interface TreeStats {
  persons: number;
  families: number;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
}
export { ReadGedcomImporter, type GedcomImporter } from './gedcom/importer';
export { Gedcom70Writer, type GedcomWriter } from './gedcom/writer';
export { detectParentCycles, type ValidationIssue } from './validate/validator';
