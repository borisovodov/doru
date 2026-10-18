import type {
  EventAttributeEnum,
  FamilyChildStatusEnum,
  PedigreeEnum,
  RestrictionEnum,
  SexEnum,
} from '../enumerations';
import type {
  Xref,
  FilePath,
  Integer,
  Language,
  ListEnum,
  MediaType,
  Pointer,
  Special,
  Text,
} from '../primitives';

import type { AddressStructure } from './common';
import type { AssociationStructure } from './common';
import type { ChangeDate } from './common';
import type { CreationDate } from './common';
import type { DatePeriodStructure } from './common';
import type { ExtensionRecord } from './extensions';
import type { FamilyAttributeStructure } from './family-structures';
import type { FamilyEventStructure } from './family-structures';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { IndividualAttributeStructure } from './individual-structures';
import type { IndividualEventStructure } from './individual-structures';
import type { LdsIndividualOrdinance } from './lds';
import type { MediaStructure } from './sources-media';
import type { MultimediaLink } from './sources-media';
import type { NonEventStructure } from './common';
import type { NoteStructure } from './common';
import type { NoteTranslation } from './common';
import type { PersonalNameStructure } from './names-places';
import type { PlaceStructure } from './names-places';
import type { SourceCitation } from './sources-media';
import type { SourceRepositoryCitation } from './sources-media';
import type { SpouseSealingOrdinance } from './lds';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.2 Records
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.2 FAMILY_RECORD — g7:record-FAM: a family, representing nuclear
 * families, marriage, cohabitation, fostering, adoption, and cultural
 * parallels, regardless of the gender of the partners.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.24), `FAM_RECORD` — the same record;
 * 5.5.1 assumes HUSB/father and WIFE/mother are male/female, has NCHI
 * directly under FAM (covered here by `FamilyChildCountAttribute`), and
 * lacks the 7.0-only ASSO, IDENTIFIER_STRUCTURE and CREA substructures.
 */
export interface FamilyRecord extends GedcomStructureBase {
  tag: 'FAM';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: ListEnum<RestrictionEnum>;
  /** <<FAMILY_ATTRIBUTE_STRUCTURE>> {0:M}. */
  attributes?: FamilyAttributeStructure[];
  /** <<FAMILY_EVENT_STRUCTURE>> {0:M}. */
  events?: FamilyEventStructure[];
  /** <<NON_EVENT_STRUCTURE>> {0:M} — 7.0-only. When serializing to 5.5.1 the NO rule applies: every NO is dropped, records left empty by that are dropped too, and pointers to dropped records are removed (serialize/prepare.ts). */
  nonEvents?: NonEventStructure[];
  /** HUSB {0:1}, g7:FAM-HUSB — one partner (a layout hint, not a gender assertion). */
  husband?: FamilyPartnerLink;
  /** WIFE {0:1}, g7:FAM-WIFE — the other partner. */
  wife?: FamilyPartnerLink;
  /** CHIL {0:M}, g7:CHIL — the children, chronological by birth; a voidPtr marks a placeholder for an unknown child. */
  children?: FamilyChildLink[];
  /** <<ASSOCIATION_STRUCTURE>> {0:M} — 7.0-only. */
  associations?: AssociationStructure[];
  /** SUBM {0:M}, g7:SUBM — submitters that contributed this record. */
  submitters?: Pointer<SubmitterRecord>[];
  /** <<LDS_SPOUSE_SEALING>> {0:M}. */
  spouseSealings?: SpouseSealingOrdinance[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. Dropped when serializing to 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 FAMILY_RECORD — g7:FAM-HUSB / g7:FAM-WIFE: a pointer to a
 * partner, with an optional phrase.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.24), `FAM_RECORD` — identical
 * pointers; PHRASE is 7.0-only.
 */
export interface FamilyPartnerLink extends GedcomStructureBase {
  /** The HUSB/WIFE payload, {1:1} pointer to an INDI record. */
  partner: Pointer<IndividualRecord>;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 FAMILY_RECORD — g7:CHIL: a pointer to a child of the family,
 * with an optional phrase.
 */
export interface FamilyChildLink extends GedcomStructureBase {
  /** The CHIL payload, {1:1} pointer to an INDI record. */
  child: Pointer<IndividualRecord>;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
  /**
   * _FREL {0:1} — the relationship of the child to the father in the
   * family (Natural, Adopted, Step, Foster, …). A vendor extension
   * written by Family Tree Maker and read by several programs; not part
   * of any GEDCOM version (catalogued in the Legacy Family Tree help,
   * "User-Defined GEDCOM Tags":
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm).
   * Both versions of the standard keep one PEDI value per INDI.FAMC
   * link instead of a per-parent pair. When serializing to 7.0 the pair
   * is projected onto the matching FAMC link's PEDI when both relations
   * name the same known relationship (natural → BIRTH, adopted →
   * ADOPTED, foster → FOSTER, sealing → SEALING); otherwise it is
   * dropped.
   */
  fatherRelation?: Text;
  /**
   * _MREL {0:1} — the relationship of the child to the mother; see
   * `fatherRelation`.
   */
  motherRelation?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 INDIVIDUAL_RECORD — g7:record-INDI: a compilation of facts or
 * hypothesized facts about an individual. Facts may be distributed across
 * multiple INDI records connected by ALIA pointers.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.25), `INDIVIDUAL_RECORD` — the same
 * record; 5.5.1 additionally has RFN, AFN and RIN and lacks the 7.0-only
 * NON_EVENT, INIL ordinance and CREA substructures.
 */
export interface IndividualRecord extends GedcomStructureBase {
  tag: 'INDI';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: ListEnum<RestrictionEnum>;
  /** <<PERSONAL_NAME_STRUCTURE>> {0:M}. */
  names?: PersonalNameStructure[];
  /** SEX {0:1}, g7:SEX — Enum of g7:enumset-SEX. */
  sex?: SexEnum;
  /** <<INDIVIDUAL_ATTRIBUTE_STRUCTURE>> {0:M}. */
  attributes?: IndividualAttributeStructure[];
  /** <<INDIVIDUAL_EVENT_STRUCTURE>> {0:M}. */
  events?: IndividualEventStructure[];
  /** <<NON_EVENT_STRUCTURE>> {0:M} — 7.0-only. When serializing to 5.5.1 the NO rule applies: every NO is dropped, records left empty by that are dropped too, and pointers to dropped records are removed (serialize/prepare.ts). */
  nonEvents?: NonEventStructure[];
  /** <<LDS_INDIVIDUAL_ORDINANCE>> {0:M}. */
  ordinances?: LdsIndividualOrdinance[];
  /** FAMC {0:M}, g7:INDI-FAMC — the families in which this individual appears as a child. */
  childFamilies?: ChildFamilyLink[];
  /** FAMS {0:M}, g7:FAMS — the families in which this individual appears as a partner. */
  spouseFamilies?: SpouseFamilyLink[];
  /** SUBM {0:M}, g7:SUBM — submitters that contributed this record. */
  submitters?: Pointer<SubmitterRecord>[];
  /** <<ASSOCIATION_STRUCTURE>> {0:M}. */
  associations?: AssociationStructure[];
  /** ALIA {0:M}, g7:ALIA — links to other INDI records about the same individual. */
  aliases?: AliasLink[];
  /** ANCI {0:M}, g7:ANCI — interest in additional research for ancestors. */
  ancestorInterests?: Pointer<SubmitterRecord>[];
  /** DESI {0:M}, g7:DESI — interest in research to identify additional descendants. */
  descendantInterests?: Pointer<SubmitterRecord>[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. Dropped when serializing to 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RFN {0:1} — a permanent record file number uniquely identifying this
   * record within a registered network resource.
   * GEDCOM 5.5.1 §2 (p.57). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  recordFileNumber?: Text;
  /**
   * AFN {0:1} — the unique permanent record number of this individual in
   * Ancestral File. GEDCOM 5.5.1 §2 (p.42). Removed in GEDCOM 7.0;
   * dropped when serializing to 7.0.
   */
  ancestralFileNumber?: Text;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 INDIVIDUAL_RECORD — g7:INDI-FAMC: the family in which an
 * individual appears as a child, with pedigree and status details.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.31), `CHILD_TO_FAMILY_LINK` — identical
 * (FAMC + PEDI + STAT + NOTE).
 */
export interface ChildFamilyLink extends GedcomStructureBase {
  /** The FAMC payload, {1:1} pointer to a FAM record. */
  family: Pointer<FamilyRecord>;
  /** PEDI {0:1}, g7:PEDI — Enum of g7:enumset-PEDI. */
  pedigree?: PedigreeStructure;
  /** STAT {0:1}, g7:FAMC-STAT — Enum of g7:enumset-FAMC-STAT. */
  status?: FamilyChildStatusStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * GEDCOM 7.0 §3.2.2 INDIVIDUAL_RECORD — g7:PEDI: an enumerated value indicating the
 * type of child-to-family relationship.
 *
 * GEDCOM 5.5.1 §2 (p.57), `PEDIGREE_LINKAGE_TYPE` — identical context.
 */
export interface PedigreeStructure extends GedcomStructureBase {
  /** The PEDI payload, {1:1} Enum of g7:enumset-PEDI. */
  payload: PedigreeEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 INDIVIDUAL_RECORD — g7:FAMC-STAT: an enumerated value assessing
 * the state of a researcher's belief in a family connection.
 *
 * GEDCOM 5.5.1 §2 (p.44), `CHILD_LINKAGE_STATUS` — identical context.
 */
export interface FamilyChildStatusStructure extends GedcomStructureBase {
  /** The STAT payload, {1:1} Enum of g7:enumset-FAMC-STAT. */
  payload: FamilyChildStatusEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 INDIVIDUAL_RECORD — g7:FAMS: the family in which an individual
 * appears as a partner.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.40), `SPOUSE_TO_FAMILY_LINK` —
 * identical (FAMS + NOTE).
 */
export interface SpouseFamilyLink extends GedcomStructureBase {
  /** The FAMS payload, {1:1} pointer to a FAM record. */
  family: Pointer<FamilyRecord>;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * GEDCOM 7.0 §3.2.2 INDIVIDUAL_RECORD — g7:ALIA: a pointer to another INDI record
 * about the same individual.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.25), `INDIVIDUAL_RECORD` — identical
 * ALIA {0:M}; PHRASE is 7.0-only.
 */
export interface AliasLink extends GedcomStructureBase {
  /** The ALIA payload, {1:1} pointer to an INDI record. */
  individual: Pointer<IndividualRecord>;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:record-OBJE: a multimedia record
 * referring to one or more external digital files.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.26), `MULTIMEDIA_RECORD` — the same
 * record; 5.5.1 has no RESN or IDENTIFIER_STRUCTURE and classifies the
 * medium via FILE.FORM.TYPE instead of FILE.FORM.MEDI.
 */
export interface MultimediaRecord extends GedcomStructureBase {
  tag: 'OBJE';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: ListEnum<RestrictionEnum>;
  /** FILE {1:M}, g7:FILE — the external files, grouped together. */
  files: MediaFile[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. Dropped when serializing to 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:FILE: a reference to an external file.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.26), `MULTIMEDIA_RECORD` — the same
 * FILE {1:M} + FORM {1:1} + TITL {0:1}; in 5.5.1 the medium is classified
 * by FILE.FORM.TYPE (`SOURCE_MEDIA_TYPE`) instead of FILE.FORM.MEDI, and
 * TRAN is 7.0-only.
 */
export interface MediaFile extends GedcomStructureBase {
  /** The FILE payload, {1:1} FilePath. */
  payload: FilePath;
  /** FORM {1:1}, g7:FORM — the media type of the file. */
  form: MediaFormatStructure;
  /** TITL {0:1}, g7:TITL — a title of the file. */
  title?: Text;
  /** TRAN {0:M}, g7:FILE-TRAN — the same content in a different digital format. */
  translations?: MediaFileTranslation[];
}

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:FORM: the media type of the file
 * referenced by the superstructure, with an optional medium.
 */
export interface MediaFormatStructure extends GedcomStructureBase {
  /** The FORM payload, {1:1} MediaType. */
  payload: MediaType;
  /** MEDI {0:1}, g7:MEDI — Enum of g7:enumset-MEDI; the medium from which the file was derived. */
  medium?: MediaStructure;
}

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:FILE-TRAN: a representation of the file in
 * a different digital format (not a different human language).
 */
export interface MediaFileTranslation extends GedcomStructureBase {
  /** The TRAN payload, {1:1} FilePath. */
  payload: FilePath;
  /** FORM {1:1}, g7:FORM — the media type of the translated file. */
  form: MediaFormatStructure;
}

/**
 * GEDCOM 7.0 §3.2.2 REPOSITORY_RECORD — g7:record-REPO: information about an
 * institution or person that has a collection of sources.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.27), `REPOSITORY_RECORD` — the same
 * record; 5.5.1 has no PHON/EMAIL/FAX/WWW on the record (they live inside
 * the ADDRESS_STRUCTURE in 5.5.1) and no IDENTIFIER_STRUCTURE.
 */
export interface RepositoryRecord extends GedcomStructureBase {
  tag: 'REPO';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** NAME {1:1}, g7:NAME. */
  name: Text;
  /** <<ADDRESS_STRUCTURE>> {0:1}. */
  address?: AddressStructure;
  /** PHON {0:M}, g7:PHON — 7.0-only. */
  phone?: Special[];
  /** EMAIL {0:M}, g7:EMAIL — 7.0-only. */
  email?: Special[];
  /** FAX {0:M}, g7:FAX — 7.0-only. */
  fax?: Special[];
  /** WWW {0:M}, g7:WWW — 7.0-only. */
  www?: Special[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. Dropped when serializing to 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 SHARED_NOTE_RECORD — g7:record-SNOTE: a catch-all location for
 * information that does not fully fit within other structures, shared by
 * multiple structures via pointers.
 *
 * 7.0-only: 5.5.1 has no SNOTE record; its shared-note mechanism is the
 * NOTE_RECORD (see `NoteRecord`).
 */
export interface SharedNoteRecord extends GedcomStructureBase {
  tag: 'SNOTE';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** The SNOTE payload, {1:1} Text. */
  payload: Text;
  /** MIME {0:1}, g7:MIME — the media type of the payload. Dropped when serializing to 5.5.1. */
  mediaType?: MediaType;
  /** LANG {0:1}, g7:LANG — the language of the payload. Dropped when serializing to 5.5.1. */
  language?: Language;
  /** TRAN {0:M}, g7:NOTE-TRAN — translations of the payload. Each must have a MIME or LANG substructure or both. Dropped when serializing to 5.5.1. */
  translations?: NoteTranslation[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1}. */
  creationDate?: CreationDate;
}

/**
 * GEDCOM 5.5.1 §2 Record Structures (p.27), `NOTE_RECORD` — a note record
 * shared via pointers (`@XREF:NOTE@ NOTE`). 5.5.1-only: GEDCOM 7.0 replaced
 * it with the SHARED_NOTE_RECORD (SNOTE), which adds MIME, LANG and TRAN
 * substructures.
 */
export interface NoteRecord extends GedcomStructureBase {
  tag: 'NOTE';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** The NOTE payload, {1:1} SUBMITTER_TEXT. */
  payload: Text;
  /** <<IDENTIFIER_STRUCTURE>> {0:M} — 5.5.1 REFN {0:M} + TYPE. */
  identifiers?: IdentifierStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 SOURCE_RECORD — g7:record-SOUR: a description of an entire
 * source.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.27), `SOURCE_RECORD` — the same
 * record; 5.5.1 has no IDENTIFIER_STRUCTURE, no MIME/LANG under TEXT, and
 * the DATA.PLAC payload is a plain place name rather than a full
 * PLACE_STRUCTURE.
 */
export interface SourceRecord extends GedcomStructureBase {
  tag: 'SOUR';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** DATA {0:1}, g7:DATA — the content of the source (as opposed to metadata about it). */
  data?: SourceRecordData;
  /** AUTH {0:1}, g7:AUTH — the person, agency, or entity who created the record. */
  author?: Text;
  /** TITL {0:1}, g7:TITL — the title of the source. */
  title?: Text;
  /** ABBR {0:1}, g7:ABBR — a short name used for sorting, filing, and retrieving records. */
  abbreviation?: Text;
  /** PUBL {0:1}, g7:PUBL — when and where the record was created. */
  publication?: Text;
  /** TEXT {0:1}, g7:TEXT — a verbatim copy of any description contained within the source. */
  text?: SourceText;
  /** <<SOURCE_REPOSITORY_CITATION>> {0:M}. */
  repositoryCitations?: SourceRepositoryCitation[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. Dropped when serializing to 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
}

/**
 * GEDCOM 7.0 §3.2.2 SOURCE_RECORD — g7:DATA: a description of the content of the
 * source.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.27), `SOURCE_RECORD` — identical
 * DATA {0:1} (EVEN, DATE, PLAC, AGNC, NOTE).
 */
export interface SourceRecordData extends GedcomStructureBase {
  /** EVEN {0:M}, g7:DATA-EVEN — List:Enum of g7:enumset-EVENATTR: the types of events recorded in the source. */
  events?: SourceDataEvent[];
  /** AGNC {0:1}, g7:AGNC — the organization responsible for creating or archiving the records. */
  agency?: Text;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * GEDCOM 7.0 §3.2.2 SOURCE_RECORD — g7:DATA-EVEN: the types of events recorded in a
 * particular source.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.27), `SOURCE_RECORD` — identical
 * EVEN {0:M} with the comma-separated `EVENTS_RECORDED` list; 5.5.1's
 * DATA.PLAC payload is a plain place name (`SOURCE_JURISDICTION_PLACE`)
 * rather than a full PLACE_STRUCTURE and is modelled as a PlaceStructure
 * with only the payload filled.
 */
export interface SourceDataEvent extends GedcomStructureBase {
  /** The EVEN payload, {1:1} List:Enum of g7:enumset-EVENATTR. */
  payload: ListEnum<EventAttributeEnum>;
  /** DATE {0:1}, g7:DATA-EVEN-DATE — the DatePeriod covered by the entire source. */
  date?: DatePeriodStructure;
  /** <<PLACE_STRUCTURE>> {0:1}. */
  place?: PlaceStructure;
}

/**
 * GEDCOM 7.0 §3.2.2 SOURCE_RECORD — g7:TEXT: a verbatim copy of text contained in
 * the source.
 *
 * GEDCOM 5.5.1 §2 (p.63), `TEXT_FROM_SOURCE` — identical context; MIME and
 * LANG are 7.0-only.
 */
export interface SourceText extends GedcomStructureBase {
  /** The TEXT payload, {1:1} Text. */
  payload: Text;
  /** MIME {0:1}, g7:MIME. */
  mediaType?: MediaType;
  /** LANG {0:1}, g7:LANG. */
  language?: Language;
}

/**
 * GEDCOM 7.0 §3.2.2 SUBMITTER_RECORD — g7:record-SUBM: a contributor of information
 * to the document.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.28), `SUBMITTER_RECORD` — the same
 * record; 5.5.1 has no PHON/EMAIL/FAX/WWW on the record (they live inside
 * the ADDRESS_STRUCTURE in 5.5.1), no IDENTIFIER_STRUCTURE, limits LANG to
 * at most 3 preferences, and additionally has the RFN tag.
 */
export interface SubmitterRecord extends GedcomStructureBase {
  tag: 'SUBM';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** NAME {1:1}, g7:NAME. */
  name: Text;
  /** <<ADDRESS_STRUCTURE>> {0:1}. */
  address?: AddressStructure;
  /** PHON {0:M}, g7:PHON — 7.0-only. */
  phone?: Special[];
  /** EMAIL {0:M}, g7:EMAIL — 7.0-only. */
  email?: Special[];
  /** FAX {0:M}, g7:FAX — 7.0-only. */
  fax?: Special[];
  /** WWW {0:M}, g7:WWW — 7.0-only. */
  www?: Special[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /** LANG {0:M}, g7:SUBM-LANG — languages the subject of the record understands. At most 3 in 5.5.1 ({0:3}); the limit is enforced at validation time, not in the types. */
  languages?: Language[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. Dropped when serializing to 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RFN {0:1} — a registered number of a submitter of Ancestral File data.
   * GEDCOM 5.5.1 §2 (p.63). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  registeredRfn?: Text;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
}

/**
 * GEDCOM 5.5.1 §2 Record Structures (p.28), `SUBMISSION_RECORD` — the
 * submission record: instructions and information sent to the receiving
 * system (TempleReady / Ancestral File). Each transmission has at most
 * one. Removed in GEDCOM 7.0.
 */
export interface SubmissionRecord extends GedcomStructureBase {
  tag: 'SUBN';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. GEDCOM 7.0 §1.3; GEDCOM 5.5.1 §2 Primitive Elements (p.64), `XREF` (max 22 characters). */
  xref?: Xref;
  /** SUBM {0:1} — the submitter this submission belongs to. */
  submitter?: Pointer<SubmitterRecord>;
  /** FAMF {0:1} — the name of the family file for temple ordinances. */
  familyFile?: Text;
  /** TEMP {0:1} — the temple code. */
  temple?: Text;
  /** ANCE {0:1} — the number of generations of ancestors included. */
  generationsOfAncestors?: Integer;
  /** DESC {0:1} — the number of generations of descendants included. */
  generationsOfDescendants?: Integer;
  /** ORDI {0:1} — whether the submission should be processed for temple ordinance clearing. */
  ordinanceProcessFlag?: 'yes' | 'no';
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
}

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
  | ExtensionRecord;
