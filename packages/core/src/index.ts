export type { IFileSystem } from './fs';
export type {
  AddressRecord,
  AssociationRecord,
  AttachmentsSnapshot,
  CensusEntry,
  CensusRecord,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  DateComponent,
  DateQuality,
  DateValue,
  DuplicateCandidateRecord,
  EvidenceFinding,
  EvidenceLinkRecord,
  EvidenceRecord,
  FactAge,
  FactParticipant,
  FactRecord,
  FactTypeRecord,
  FamilyChildLink,
  FamilyPartnerLink,
  FamilyRecord,
  HeaderRecord,
  IdentifierRecord,
  MediaFile,
  MediaLinkRecord,
  MediaRecord,
  NamePart,
  NamePartKind,
  NoteLinkRecord,
  NoteRecord,
  NoteTranslation,
  OrdinanceRecord,
  PersonName,
  PersonRecord,
  PlaceName,
  PlaceRecord,
  RepositoryRecord,
  ResearchActivityRecord,
  ResearchConclusion,
  ResearchDocumentRecord,
  RestrictionRecord,
  Sex,
  SourceRecord,
  SourceText,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TargetType,
  TimeValue,
  TitleRecord,
  TodoRecord,
  TreeDocument,
} from './model/types';
export { TARGET_TYPES, emptyAttachments, emptyDocument, factOf, factYear, placeName, signedYear } from './model/types';
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
export {
  TreeService,
  type PersonCounts,
  type RelativeRelation,
  type TreeStats,
  type UndoRedoState,
} from './service/tree';
export { addPersonOp } from './ops/addPerson';
export { updatePersonOp, deletePersonOp, reparentOp, addRelativeOp } from './ops/person';
export { addFamilyOp, deleteFamilyOp, updateFamilyOp } from './ops/family';
export { addFactOp, deleteFactOp, updateFactOp } from './ops/fact';
export { addMediaOp, deleteMediaOp } from './ops/media';
export { addPlaceOp, deletePlaceOp, updatePlaceOp } from './ops/place';
export {
  addAddressOp,
  addContactOp,
  addFactTypeOp,
  addIdentifierOp,
  addNoteOp,
  addRepositoryOp,
  addRestrictionOp,
  addSourceOp,
  addSubmitterOp,
  addTagOp,
  attachCitationOp,
  attachMediaOp,
  attachTagOp,
  deleteAddressOp,
  deleteContactOp,
  deleteFactTypeOp,
  deleteIdentifierOp,
  deleteNoteOp,
  deleteRepositoryOp,
  deleteRestrictionOp,
  deleteSourceOp,
  deleteSubmitterOp,
  deleteTagOp,
  detachCitationOp,
  detachMediaOp,
  detachTagOp,
  saveHeaderOp,
  splitNoteOp,
  updateAddressOp,
  updateCitationOp,
  updateFactTypeOp,
  updateNoteOp,
  updateRepositoryOp,
  updateSourceOp,
  updateSubmitterOp,
} from './ops/attachments';
export {
  addAliasOp,
  addAssociationOp,
  addCensusOp,
  addDuplicateOp,
  addEvidenceOp,
  addOrdinanceOp,
  addResearchActivityOp,
  addResearchDocumentOp,
  addTitleOp,
  addTodoOp,
  deleteAliasOp,
  deleteAssociationOp,
  deleteCensusOp,
  deleteDuplicateOp,
  deleteEvidenceOp,
  deleteOrdinanceOp,
  deleteResearchActivityOp,
  deleteResearchDocumentOp,
  deleteTitleOp,
  deleteTodoOp,
  updateAssociationOp,
  updateCensusOp,
  updateDuplicateOp,
  updateEvidenceOp,
  updateOrdinanceOp,
  updateResearchActivityOp,
  updateResearchDocumentOp,
  updateTitleOp,
  updateTodoOp,
} from './ops/research';
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
export { importGedcomDataset, type GedcomImportResult } from './import/gedcom';
export { buildGedcomDataset } from './export/gedcom';

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

export { detectParentCycles, type ValidationIssue } from './validate/validator';
