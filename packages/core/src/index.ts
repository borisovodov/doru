export type { IFileSystem } from './fs';
export type {
  DateQuality,
  DateValue,
  FamilyRecord,
  NamePart,
  NoteRecord,
  PersonRecord,
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
  DEFAULT_SETTINGS,
  DEFAULT_THEME_CSS,
  HISTORY_FILE_NAME,
  PROJECT_DIRS,
  SETTINGS_FILE_NAME,
  THEME_FILE_NAME,
  TREE_FILE_NAME,
  type ProjectLayout,
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
export { addNoteOp, addSourceOp } from './ops/source';
export { importGedcomOp, type GedcomImportOp } from './ops/importGedcom';
export { computePedigree, type PedigreeNode } from './pedigree';
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
