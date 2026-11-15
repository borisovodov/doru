import type { CensusRecord } from './census-record';
import type { GroupRecord } from './group-record';
import type { OccurrenceRecord } from './occurrence-record';
import type { ContactRecord, EducationRecord, MarriageRecord, OccupationRecord, TwinRecord } from './genopro-entity';
import type { TitleRecord } from './title-record';
import type { EvidenceRecord, ResearchActivityRecord, ResearchDocumentRecord, TagRecord } from './evidence-record';
import type { TreeCategoryRecord, TreeTagRecord } from './tree-tag-record';
import type { ExtensionRecord } from './extensions';
import type { PlaceRecord } from './place-record';
import type { PublishedSiteRecord } from './published-site-record';
import type { TodoRecord } from './todo-record';
import type { EventDefinitionRecord } from './event-definition-record';
import type { DuplicateCandidateRecord } from './duplicate-record';
import type { FamilyRecord } from './family-record';
import type { IndividualRecord } from './individual-record';
import type { MultimediaRecord } from './multimedia-record';
import type { SourceRecord } from './source-record';
import type { RepositoryRecord } from './repository-record';
import type { SharedNoteRecord, NoteRecord } from './note-record';
import type { SubmitterRecord, SubmissionRecord } from './submitter-record';

/**
 * GEDCOM 7.0 §3.2.1 RECORD — the union of all record types: the standard records
 * of GEDCOM 7.0 (g7:record-*) and GEDCOM 5.5.1 (SUBN, NOTE), plus
 * extension records (GEDCOM 7.0 §1.5).
 */
export type GedcomRecord =
  | FamilyRecord
  | IndividualRecord
  | MultimediaRecord
  | RepositoryRecord
  | SharedNoteRecord
  | SourceRecord
  | SubmitterRecord
  | SubmissionRecord
  | NoteRecord
  | CensusRecord
  | PlaceRecord
  | TodoRecord
  | EventDefinitionRecord
  | DuplicateCandidateRecord
  | PublishedSiteRecord
  | GroupRecord
  | OccurrenceRecord
  | TreeTagRecord
  | TreeCategoryRecord
  | OccupationRecord
  | EducationRecord
  | ContactRecord
  | MarriageRecord
  | TwinRecord
  | TitleRecord
  | EvidenceRecord
  | ResearchDocumentRecord
  | ResearchActivityRecord
  | TagRecord
  | ExtensionRecord;
