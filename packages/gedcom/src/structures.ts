/**
 * GEDCOM 7.0 §3 Genealogical structures of the GEDCOM 7.0.18 specification.
 *
 * The structure organization rules are defined in GEDCOM 7.0 §3.2 (metasyntax rules
 * such as FAMILY_RECORD or PLACE_STRUCTURE); the meaning of each structure
 * is defined in GEDCOM 7.0 §3.3. Every interface cites the metasyntax rule it models
 * and its `g7:` URI. Field JSDoc comments record the GEDCOM tag and the
 * cardinality (`{0:1}`, `{1:1}`, `{0:M}`, `{1:M}`) of the substructure.
 *
 * This is a single model spanning GEDCOM 7.0 and GEDCOM 5.5.1. 5.5.1
 * references point into The GEDCOM Standard 5.5.1 chapter 2: record
 * structures p.23, substructures p.31, primitive elements p.41. Structures
 * and fields that exist only in one version are marked as such.
 *
 * Cardinality mapping to TypeScript:
 * - `{0:1}` — optional field
 * - `{1:1}` — required field
 * - `{0:M}` — optional array field
 * - `{1:M}` — required array field
 */

import type {
  AdoptionEnum,
  EventAttributeEnum,
  EventEnum,
  FamilyChildStatusEnum,
  MediaEnum,
  NameTypeEnum,
  OrdinanceStatusEnum,
  PedigreeEnum,
  QualityEnum,
  RestrictionEnum,
  RoleEnum,
  SexEnum,
} from './enumerations';
import type {
  AgeValue,
  CharacterSet,
  DateExact,
  DatePeriodValue,
  DateValue,
  ExtensionTag,
  FilePath,
  Integer,
  Language,
  Latitude,
  Longitude,
  MediaType,
  PersonalName,
  Pointer,
  Special,
  Tag,
  TagDefinitionValue,
  Text,
  TimeValue,
  Uri,
} from './primitives';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §1.5 Extensions
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §1.5 Extensions — a tagged extension structure. Tagged extension
 * structures may appear as records or as substructures of any other
 * structure. The payload type of an extension is defined by the extension
 * itself and is therefore kept as unparsed text.
 *
 * GEDCOM 5.5.1 §2 (p.56), `NEW_TAG` — 5.5.1 user-defined tags follow the
 * same underscore convention but have no documented-extension schema
 * mechanism (SCHEMA was removed in draft 5.4).
 */
export interface ExtensionStructure {
  /** GEDCOM 7.0 §1.5 — the tag: `extTag` for a tagged extension, or a `stdTag` for an extension-defined substructure. */
  tag: Tag;
  /** GEDCOM 7.0 §1.5 — payload, if any; its data type is defined by the extension. */
  payload?: Text;
  /** GEDCOM 7.0 §1.5 — extension-defined substructures; their meaning is defined by the tagged extension structure they occur within. */
  children: ExtensionStructure[];
}

/**
 * GEDCOM 7.0 §1.5 Extensions — an extension record: a tagged extension structure at
 * record level (level 0).
 */
export interface ExtensionRecord extends ExtensionStructure {
  /** GEDCOM 7.0 §1.5 — extension records are always tagged with an `extTag`. */
  tag: ExtensionTag;
}

/**
 * Base of every standard structure: any structure may carry extension
 * substructures (GEDCOM 7.0 §1.5: "Tagged extension structures may appear as records
 * or substructures of any other structure").
 */
export interface GedcomStructureBase {
  /** GEDCOM 7.0 §1.5 — extension substructures of this structure. */
  extensions?: ExtensionStructure[];
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.1 Document
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.1 Dataset — a set of structures conforming to chapters 1–3 of the
 * specification. The header must come first and the trailer last, with
 * any records in between.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.23), `LINEAGE_LINKED_GEDCOM` — the
 * same shape; 5.5.1 additionally has a single optional SUBMISSION record
 * directly after the header.
 */
export interface GedcomDataset {
  /** GEDCOM 7.0 §3.2.1 — `0 HEAD` {1:1}, g7:HEAD. */
  header: Header;
  /**
   * GEDCOM 5.5.1 §2 Record Structures (p.23) — `0 SUBMISSION_RECORD` {0:1},
   * the submission record. Removed in GEDCOM 7.0.
   */
  submission?: SubmissionRecord;
  /** GEDCOM 7.0 §3.2.1 — `0 <<RECORD>>` {0:M}. */
  records: GedcomRecord[];
  /** GEDCOM 7.0 §3.2.1 — `0 TRLR` {1:1}, g7:TRLR. */
  trailer: Trailer;
}

/**
 * GEDCOM 7.0 §1.4 The Header and Trailer / GEDCOM 7.0 §3.2.1 — the trailer pseudo-structure:
 * level 0, tag TRLR, no line value or substructures. It has no semantic
 * meaning; it marks the end of the dataset.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.23) — identical.
 */
export interface Trailer {
  tag: 'TRLR';
}

/**
 * GEDCOM 7.0 §1.4 The Header and Trailer / GEDCOM 7.0 §3.2.1 HEADER rule — the header
 * pseudo-structure, g7:HEAD. Its substructures provide metadata about the
 * entire dataset.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.23), `HEADER` — the same structure;
 * in 5.5.1 SOUR and SUBM are required ({1:1}) and the header additionally
 * carries SUBN, FILE, CHAR (required) and GEDC.FORM (required).
 */
export interface Header extends GedcomStructureBase {
  tag: 'HEAD';
  /** GEDC {1:1}, g7:GEDC — identifies the specification this document conforms to. GEDCOM 7.0 §3.2.1. */
  gedcom: Gedcom;
  /** SCHMA {0:1}, g7:SCHMA — the meaning of the extension tags used in the document. GEDCOM 7.0 §3.2.1, §1.5. */
  schema?: Schema;
  /** SOUR {0:1}, g7:HEAD-SOUR — the product producing this dataset. GEDCOM 7.0 §3.2.1; required {1:1} in 5.5.1. */
  source?: HeaderSource;
  /** DEST {0:1}, g7:DEST — an identifier for the system expected to receive this document. GEDCOM 7.0 §3.2.1. */
  destination?: Special;
  /** DATE {0:1}, g7:HEAD-DATE — the DateExact this document was created. GEDCOM 7.0 §3.2.1. */
  date?: DateExactStructure;
  /** SUBM {0:1}, g7:SUBM — the submitter of the dataset. GEDCOM 7.0 §3.2.1; required {1:1} in 5.5.1. */
  submitter?: Pointer<SubmitterRecord>;
  /**
   * SUBN {0:1} — a pointer to the submission record.
   * GEDCOM 5.5.1 §2 Record Structures (p.23). Removed in GEDCOM 7.0.
   */
  submission?: Pointer<SubmissionRecord>;
  /**
   * FILE {0:1} — the name of the GEDCOM transmission file.
   * GEDCOM 5.5.1 §2 Record Structures (p.23). Removed in GEDCOM 7.0.
   */
  fileName?: Text;
  /** COPR {0:1}, g7:COPR — a copyright statement. GEDCOM 7.0 §3.2.1. */
  copyright?: Text;
  /** LANG {0:1}, g7:HEAD-LANG — a default language for the document. GEDCOM 7.0 §3.2.1. */
  language?: Language;
  /** PLAC {0:1}, g7:HEAD-PLAC — the default PLAC.FORM; must not have a payload. GEDCOM 7.0 §3.2.1. */
  place?: HeaderPlace;
  /**
   * CHAR {1:1} — the character set used to interpret the transmission,
   * with an optional version substructure.
   * GEDCOM 5.5.1 §2 Record Structures (p.23) and GEDCOM 5.5.1 §3 (p.77).
   * Removed in GEDCOM 7.0, which mandates UTF-8.
   */
  characterSet?: CharacterSetStructure;
  /** <<NOTE_STRUCTURE>> {0:1} — should describe the contents of the document. GEDCOM 7.0 §3.2.1. */
  note?: NoteStructure;
}

/**
 * GEDCOM 5.5.1 §2 Record Structures (p.23) — the CHAR substructure of the
 * header: the character set of the transmission and its optional version.
 * Removed in GEDCOM 7.0.
 */
export interface CharacterSetStructure extends GedcomStructureBase {
  /** The CHAR payload, {1:1} CHARACTER_SET (ANSEL, UTF-8, UNICODE or ASCII). */
  payload: CharacterSet;
  /** VERS {0:1} — the version of the character set standard. */
  version?: Text;
}

/**
 * GEDCOM 7.0 §3.2.1 HEADER rule — g7:GEDC: a container for information about the
 * entire document.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.23), `GEDC` — in 5.5.1 the FORM
 * substructure is required ({1:1}) and holds the GEDCOM form
 * (`LINEAGE-LINKED`).
 */
export interface Gedcom extends GedcomStructureBase {
  /** VERS {1:1}, g7:GEDC-VERS — the version number of the official specification this document conforms to (must include major and minor, e.g. "7.0"). GEDCOM 7.0 §3.2.1. */
  version: Special;
  /**
   * FORM {1:1} — the GEDCOM form used to construct the transmission
   * (`LINEAGE-LINKED`). GEDCOM 5.5.1 §2 (p.50). Removed in GEDCOM 7.0.
   */
  form?: Text;
}

/**
 * GEDCOM 7.0 §3.2.1 HEADER rule — g7:SCHMA: a container for the tag definitions of
 * the extension tags used in the document. GEDCOM 7.0 §1.5.
 *
 * 7.0-only: 5.5.1 removed the SCHEMA concept in draft 5.4.
 */
export interface Schema extends GedcomStructureBase {
  /** TAG {0:M}, g7:TAG — a tag definition. GEDCOM 7.0 §3.2.1. */
  tagDefinitions: TagDefinitionStructure[];
}

/**
 * GEDCOM 7.0 §3.2.1 HEADER rule — g7:TAG: a tag definition; its payload has the Tag
 * Definition data type (GEDCOM 7.0 §2.14). GEDCOM 7.0 §1.5.1.
 */
export interface TagDefinitionStructure extends GedcomStructureBase {
  /** GEDCOM 7.0 §2.14 TagDef — the extension tag and the URI it abbreviates. */
  payload: TagDefinitionValue;
}

/**
 * GEDCOM 7.0 §3.2.1 HEADER rule — g7:HEAD-SOUR: an identifier for the product
 * producing this dataset, with details about it.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.23), `HEADER` — identical; in 5.5.1
 * SOUR is required ({1:1}) and its payload is the APPROVED_SYSTEM_ID
 * obtained through the GEDCOM registration process.
 */
export interface HeaderSource extends GedcomStructureBase {
  /** VERS {0:1}, g7:VERS — the version level of the product. GEDCOM 7.0 §3.2.1. */
  version?: Special;
  /** NAME {0:1}, g7:NAME — the name of the product. GEDCOM 7.0 §3.2.1. */
  name?: Text;
  /** CORP {0:1}, g7:CORP — the corporation creating the product. GEDCOM 7.0 §3.2.1. */
  corporation?: Corporation;
  /** DATA {0:1}, g7:HEAD-SOUR-DATA — the larger database this data is extracted from (deprecated; use NAME instead). GEDCOM 7.0 §3.2.1. */
  data?: HeaderSourceData;
}

/**
 * GEDCOM 7.0 §3.2.1 HEADER rule — g7:CORP: the name of the business, corporation, or
 * person that produced or commissioned the product.
 *
 * GEDCOM 5.5.1 §2 (p.54), `NAME_OF_BUSINESS` — identical; PHON, EMAIL,
 * FAX and WWW under CORP are 7.0-only (in 5.5.1 they live inside the
 * ADDRESS_STRUCTURE).
 */
export interface Corporation extends GedcomStructureBase {
  /** The CORP payload, {1:1} Text. */
  payload: Text;
  /** <<ADDRESS_STRUCTURE>> {0:1}. */
  address?: AddressStructure;
  /** PHON {0:M}, g7:PHON. */
  phone?: Special[];
  /** EMAIL {0:M}, g7:EMAIL. */
  email?: Special[];
  /** FAX {0:M}, g7:FAX. */
  fax?: Special[];
  /** WWW {0:M}, g7:WWW. */
  www?: Special[];
}

/**
 * GEDCOM 7.0 §3.2.1 HEADER rule — g7:HEAD-SOUR-DATA: the database, electronic data
 * source, or digital repository from which this dataset was exported.
 *
 * GEDCOM 5.5.1 §2 (p.54), `NAME_OF_SOURCE_DATA` — identical; 5.5.1's DATE
 * payload is `PUBLICATION_DATE` (a DateExact) and its COPR may use CONT/CONC
 * continuations.
 */
export interface HeaderSourceData extends GedcomStructureBase {
  /** The DATA payload, {1:1} Text. */
  payload: Text;
  /** DATE {0:1}, g7:DATE-exact — when the data was entered into the source. */
  date?: DateExactStructure;
  /** COPR {0:1}, g7:COPR — a copyright statement for the data. */
  copyright?: Text;
}

/**
 * GEDCOM 7.0 §3.2.1 HEADER rule — g7:HEAD-PLAC: a placeholder for providing a default
 * PLAC.FORM. Must not have a payload.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.23), `HEADER` — identical
 * (PLAC.FORM {1:1}).
 */
export interface HeaderPlace extends GedcomStructureBase {
  /** FORM {1:1}, g7:HEAD-PLAC-FORM — any PLAC with no FORM shall be treated as if it has this FORM. */
  form: Text[];
}

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
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: RestrictionEnum[];
  /** <<FAMILY_ATTRIBUTE_STRUCTURE>> {0:M}. */
  attributes?: FamilyAttributeStructure[];
  /** <<FAMILY_EVENT_STRUCTURE>> {0:M}. */
  events?: FamilyEventStructure[];
  /** <<NON_EVENT_STRUCTURE>> {0:M} — 7.0-only. */
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
  /** <<CREATION_DATE>> {0:1} — 7.0-only. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0.
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
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: RestrictionEnum[];
  /** <<PERSONAL_NAME_STRUCTURE>> {0:M}. */
  names?: PersonalNameStructure[];
  /** SEX {0:1}, g7:SEX — Enum of g7:enumset-SEX. */
  sex?: SexEnum;
  /** <<INDIVIDUAL_ATTRIBUTE_STRUCTURE>> {0:M}. */
  attributes?: IndividualAttributeStructure[];
  /** <<INDIVIDUAL_EVENT_STRUCTURE>> {0:M}. */
  events?: IndividualEventStructure[];
  /** <<NON_EVENT_STRUCTURE>> {0:M} — 7.0-only. */
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
  /** <<CREATION_DATE>> {0:1} — 7.0-only. */
  creationDate?: CreationDate;
  /**
   * RFN {0:1} — a permanent record file number uniquely identifying this
   * record within a registered network resource.
   * GEDCOM 5.5.1 §2 (p.57). Removed in GEDCOM 7.0.
   */
  recordFileNumber?: Text;
  /**
   * AFN {0:1} — the unique permanent record number of this individual in
   * Ancestral File. GEDCOM 5.5.1 §2 (p.42). Removed in GEDCOM 7.0.
   */
  ancestralFileNumber?: Text;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0.
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
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: RestrictionEnum[];
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
  /** <<CREATION_DATE>> {0:1} — 7.0-only. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0.
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
  /** <<CREATION_DATE>> {0:1} — 7.0-only. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0.
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
  /** The SNOTE payload, {1:1} Text. */
  payload: Text;
  /** MIME {0:1}, g7:MIME — the media type of the payload. */
  mediaType?: MediaType;
  /** LANG {0:1}, g7:LANG — the language of the payload. */
  language?: Language;
  /** TRAN {0:M}, g7:NOTE-TRAN — translations of the payload. Each must have a MIME or LANG substructure or both. */
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
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0.
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
  /** <<CREATION_DATE>> {0:1} — 7.0-only. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0.
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
 * rather than a full PLACE_STRUCTURE.
 */
export interface SourceDataEvent extends GedcomStructureBase {
  /** The EVEN payload, {1:1} List:Enum of g7:enumset-EVENATTR. */
  payload: EventAttributeEnum[];
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
  /** LANG {0:M}, g7:SUBM-LANG — languages the subject of the record understands. */
  languages?: Language[];
  /** <<IDENTIFIER_STRUCTURE>> {0:M}. */
  identifiers?: IdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
  /** <<CREATION_DATE>> {0:1} — 7.0-only. */
  creationDate?: CreationDate;
  /**
   * RFN {0:1} — a registered number of a submitter of Ancestral File data.
   * GEDCOM 5.5.1 §2 (p.63). Removed in GEDCOM 7.0.
   */
  registeredRfn?: Text;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0.
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
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0.
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

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 Substructures — address, dates, identifiers, notes
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.3 ADDRESS_STRUCTURE — g7:ADDR: a specific building, plot, or
 * location. The payload is the full formatted address as it would appear
 * on a mailing label; if the substructures and the payload disagree, the
 * payload shall be taken as correct.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.31), `ADDRESS_STRUCTURE` — the same
 * structure, but in 5.5.1 it also carries the contact substructures PHON,
 * EMAIL, FAX and WWW {0:3} each (in 7.0 they moved to the record level;
 * see the 5.5.1 overlay notes).
 */
export interface AddressStructure extends GedcomStructureBase {
  /** The ADDR payload, {1:1} Special — the full formatted address. */
  payload: Special;
  /** ADR1 {0:1}, g7:ADR1 — first line of the address; should not be added to new files. */
  line1?: Special;
  /** ADR2 {0:1}, g7:ADR2 — second line of the address; should not be added to new files. */
  line2?: Special;
  /** ADR3 {0:1}, g7:ADR3 — third line of the address; should not be added to new files. */
  line3?: Special;
  /** CITY {0:1}, g7:CITY — the name of the city. */
  city?: Special;
  /** STAE {0:1}, g7:STAE — a geographical division of a larger jurisdictional area. */
  state?: Special;
  /** POST {0:1}, g7:POST — a postal code. */
  postalCode?: Special;
  /** CTRY {0:1}, g7:CTRY — the name of the country. */
  country?: Special;
}

/**
 * GEDCOM 7.0 §3.2.3 ASSOCIATION_STRUCTURE — g7:ASSO: an individual associated with
 * the subject of the superstructure. The nature of the association is
 * given by the ROLE substructure.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.31), `ASSOCIATION_STRUCTURE` — the same
 * pointer, but 5.5.1 states the association with the RELA tag (a free-text
 * relation descriptor) instead of the ROLE enumeration; see the 5.5.1
 * overlay notes.
 */
export interface AssociationStructure extends GedcomStructureBase {
  tag: 'ASSO';
  /** The ASSO payload, {1:1} pointer to an INDI record; a voidPtr with a PHRASE describes an unreferenced person. */
  individual: Pointer<IndividualRecord>;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
  /** ROLE {1:1}, g7:ROLE — Enum of g7:enumset-ROLE. */
  role: RoleStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 ASSOCIATION_STRUCTURE — g7:ROLE: an enumerated value indicating
 * what role a person played in an event or a person's life.
 *
 * GEDCOM 5.5.1 §2 (p.61), `ROLE_IN_EVENT` — the same context; 5.5.1
 * additionally allows any free-form role descriptor enclosed in
 * parentheses (see the 5.5.1 overlay notes).
 */
export interface RoleStructure extends GedcomStructureBase {
  /** The ROLE payload, {1:1} Enum of g7:enumset-ROLE. */
  payload: RoleEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 CHANGE_DATE — g7:CHAN: the date of the most recent modification
 * of the superstructure, optionally with notes about that modification.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.31), `CHANGE_DATE` — identical.
 */
export interface ChangeDate extends GedcomStructureBase {
  tag: 'CHAN';
  /** DATE {1:1}, g7:DATE-exact — the date of the most recent modification. */
  date: DateExactStructure;
  /** <<NOTE_STRUCTURE>> {0:M} — may describe previous changes as well. */
  notes?: NoteStructure[];
}

/**
 * GEDCOM 7.0 §3.2.3 CREATION_DATE — g7:CREA: the date of the initial creation of the
 * superstructure. Should not be modified after the structure is created.
 *
 * 7.0-only: 5.5.1 has no CREA.
 */
export interface CreationDate extends GedcomStructureBase {
  tag: 'CREA';
  /** DATE {1:1}, g7:DATE-exact. */
  date: DateExactStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 DATE_VALUE — g7:DATE: a date, optionally with a time and/or a
 * phrase. The payload is a DateValue; it may be empty when a PHRASE or
 * TIME is desired instead.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.47), `DATE_VALUE` — identical
 * context; 5.5.1 keeps the phrase inside the payload (parenthesized) and
 * supports the `INT` (interpreted) prefix, both moved to the PHRASE
 * substructure in 7.0.
 */
export interface DateStructure extends GedcomStructureBase {
  /** The DATE payload, {1:1} DateValue; absent when the payload is the empty string. */
  value?: DateValue;
  /** TIME {0:1}, g7:TIME — asserts the event happened at a specific time on a single day. */
  time?: TimeValue;
  /** PHRASE {0:1}, g7:PHRASE — textual information that cannot be expressed in the payload. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 — g7:DATE-exact: a fully-known Gregorian date with an optional
 * time. Used by CHANGE_DATE, CREATION_DATE, HEAD.DATE,
 * HEAD.SOUR.DATA.DATE and ord-STAT.DATE.
 *
 * GEDCOM 5.5.1 §2 — the same context (CHAN.DATE `CHANGE_DATE` p.44,
 * HEAD.DATE `TRANSMISSION_DATE` p.63, HEAD.SOUR.DATA.DATE
 * `PUBLICATION_DATE` p.59, STAT.DATE).
 */
export interface DateExactStructure extends GedcomStructureBase {
  /** The DATE payload, {1:1} DateExact. */
  value: DateExact;
  /** TIME {0:1}, g7:TIME. */
  time?: TimeValue;
}

/**
 * GEDCOM 7.0 §3.2.3 — g7:NO-DATE / g7:DATA-EVEN-DATE: a DatePeriod payload with an
 * optional phrase. The payload may be empty.
 *
 * GEDCOM 5.5.1 §2 Primitive Elements (p.46), `DATE_PERIOD` — identical
 * form for DATA.DATE.
 */
export interface DatePeriodStructure extends GedcomStructureBase {
  /** The DATE payload, DatePeriod; absent when the payload is the empty string. */
  value?: DatePeriodValue;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 EVENT_DETAIL — g7:SDATE: a date used as a sorting hint. Intended
 * for use when the actual date is unknown but the display order depends
 * on date; it conveys no historical meaning.
 *
 * 7.0-only: 5.5.1 has no SDATE.
 */
export interface SortDateStructure extends GedcomStructureBase {
  /** The SDATE payload, {0:1} DateValue. */
  value?: DateValue;
  /** TIME {0:1}, g7:TIME. */
  time?: TimeValue;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 EVENT_DETAIL — substructures shared by most individual and
 * family events and attributes.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `EVENT_DETAIL` — the same set of
 * substructures; 5.5.1 has no PHON/EMAIL/FAX/WWW, SDATE, ASSO or UID here
 * (all 7.0-only) and places the TYPE tag inside this structure (in 7.0 it
 * sits directly under the event/attribute).
 */
export interface EventDetail extends GedcomStructureBase {
  /** <<DATE_VALUE>> {0:1}, g7:DATE. */
  date?: DateStructure;
  /** <<PLACE_STRUCTURE>> {0:1}, g7:PLAC. */
  place?: PlaceStructure;
  /** <<ADDRESS_STRUCTURE>> {0:1}, g7:ADDR. */
  address?: AddressStructure;
  /** PHON {0:M}, g7:PHON. */
  phone?: Special[];
  /** EMAIL {0:M}, g7:EMAIL. */
  email?: Special[];
  /** FAX {0:M}, g7:FAX. */
  fax?: Special[];
  /** WWW {0:M}, g7:WWW. */
  www?: Special[];
  /** AGNC {0:1}, g7:AGNC — the entity responsible for the associated context. */
  agency?: Text;
  /** RELI {0:1}, g7:RELI — a religious denomination associated with the event or attribute. */
  religiousAffiliation?: Text;
  /** CAUS {0:1}, g7:CAUS — the reasons which precipitated an event. */
  cause?: Text;
  /** RESN {0:1}, g7:RESN — List:Enum of g7:enumset-RESN. */
  restriction?: RestrictionEnum[];
  /** SDATE {0:1}, g7:SDATE — a sorting hint. */
  sortDate?: SortDateStructure;
  /** <<ASSOCIATION_STRUCTURE>> {0:M}. */
  associations?: AssociationStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /** UID {0:M}, g7:UID. */
  uniqueIds?: Special[];
}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_DETAIL — substructures shared by most
 * individual events and attributes: the EVENT_DETAIL plus the age of the
 * individual.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.34), `INDIVIDUAL_EVENT_DETAIL` —
 * identical ({1:1} EVENT_DETAIL plus {0:1} AGE).
 */
export interface IndividualEventDetail extends EventDetail {
  /** AGE {0:1}, g7:AGE — the age of the individual at the time the event occurred. */
  age?: AgeStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_EVENT_DETAIL — substructures shared by most family events
 * and attributes: the ages of each partner at the event, plus the
 * EVENT_DETAIL.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `FAMILY_EVENT_DETAIL` — identical.
 */
export interface FamilyEventDetail extends GedcomStructureBase {
  /** HUSB {0:1}, g7:HUSB — details of the FAM-HUSB partner. */
  husband?: FamilyPartnerEventDetail;
  /** WIFE {0:1}, g7:WIFE — details of the FAM-WIFE partner. */
  wife?: FamilyPartnerEventDetail;
  /** <<EVENT_DETAIL>> {0:1}. */
  detail?: EventDetail;
}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_EVENT_DETAIL — g7:HUSB / g7:WIFE: the age of one partner
 * at the time of the event.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `FAMILY_EVENT_DETAIL` — identical.
 */
export interface FamilyPartnerEventDetail extends GedcomStructureBase {
  /** AGE {1:1}, g7:AGE — the age of the partner at the event. */
  age: AgeStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 — g7:AGE: the age of an individual at the time an event
 * occurred, with an optional phrase.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `AGE` — identical context; see the
 * `AgeValue` primitive for the 5.5.1 keyword values.
 */
export interface AgeStructure extends GedcomStructureBase {
  /** The AGE payload, {1:1} Age. */
  payload: AgeValue;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 IDENTIFIER_STRUCTURE — g7:REFN: a user-generated identifier for
 * a structure.
 *
 * GEDCOM 5.5.1 §2 (p.63), `USER_REFERENCE_NUMBER` — identical tag and
 * meaning; in 5.5.1 REFN may repeat ({0:M}) at the record level.
 */
export interface ReferenceIdentifierStructure extends GedcomStructureBase {
  tag: 'REFN';
  /** The REFN payload, {1:1} Special. */
  payload: Special;
  /** TYPE {0:1}, g7:TYPE. */
  type?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 IDENTIFIER_STRUCTURE — g7:UID: a globally-unique identifier of
 * the superstructure, to be preserved across edits. It is recommended
 * that new identifiers be formatted as UUIDs per RFC 9562 Section 4.
 *
 * 7.0-only: 5.5.1 has no UID.
 */
export interface UniqueIdentifierStructure extends GedcomStructureBase {
  tag: 'UID';
  /** The UID payload, {1:1} Special. */
  payload: Special;
}

/**
 * GEDCOM 7.0 §3.2.3 IDENTIFIER_STRUCTURE — g7:EXID: an identifier for the subject of
 * the superstructure, maintained by the external authority given in TYPE.
 * 7.0-only: 5.5.1 has no EXID.
 */
export interface ExternalIdentifierStructure extends GedcomStructureBase {
  tag: 'EXID';
  /** The EXID payload, {1:1} Special. */
  payload: Special;
  /** TYPE {0:1}, g7:EXID-TYPE — the authority issuing the EXID, as a URI. Deprecated to omit. */
  type?: Uri;
}

/**
 * GEDCOM 7.0 §3.2.3 IDENTIFIER_STRUCTURE — the union of the three identifier
 * structures.
 */
export type IdentifierStructure =
  | ReferenceIdentifierStructure
  | UniqueIdentifierStructure
  | ExternalIdentifierStructure;

/**
 * GEDCOM 7.0 §3.2.3 NON_EVENT_STRUCTURE — g7:NO: indicates that a specific type of
 * event, given in the payload, did not happen within a given date period
 * (or never happened if there is no DATE substructure).
 *
 * 7.0-only: 5.5.1 explicitly leaves a convention for never-happened
 * events to a future release.
 */
export interface NonEventStructure extends GedcomStructureBase {
  tag: 'NO';
  /** The NO payload, {1:1} Enum of g7:enumset-EVEN. */
  payload: EventEnum;
  /** DATE {0:1}, g7:NO-DATE — the DatePeriod during which the event did not occur. */
  date?: DatePeriodStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 NOTE_STRUCTURE — g7:NOTE: a catch-all location for information
 * that does not fully fit within other structures.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.37), `NOTE_STRUCTURE` — identical inline
 * form; MIME, LANG and TRAN are 7.0-only.
 */
export interface Note extends GedcomStructureBase {
  tag: 'NOTE';
  /** The NOTE payload, {1:1} Text. */
  payload: Text;
  /** MIME {0:1}, g7:MIME — the media type of the payload. */
  mediaType?: MediaType;
  /** LANG {0:1}, g7:LANG — the language of the payload. */
  language?: Language;
  /** TRAN {0:M}, g7:NOTE-TRAN — translations of the payload. Each must have a MIME or LANG substructure or both. */
  translations?: NoteTranslation[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 NOTE_STRUCTURE — g7:SNOTE: a pointer to a note shared by
 * multiple structures.
 */
export interface SharedNoteReference extends GedcomStructureBase {
  tag: 'SNOTE';
  /** The SNOTE payload, {1:1} pointer to a SNOTE record. */
  note: Pointer<SharedNoteRecord>;
}

/**
 * GEDCOM 5.5.1 §2 Substructures (p.37), `NOTE_STRUCTURE` — a pointer to a
 * NOTE record, 5.5.1's shared-note mechanism. GEDCOM 7.0 replaced this
 * with the SNOTE pointer; both variants exist in this model.
 */
export interface NoteReference extends GedcomStructureBase {
  tag: 'NOTE';
  /** The NOTE payload, {1:1} pointer to a NOTE record. */
  note: Pointer<NoteRecord>;
}

/**
 * GEDCOM 7.0 §3.2.3 NOTE_STRUCTURE — a note structure: an inline NOTE, a
 * GEDCOM 5.5.1 NOTE-record pointer, or a GEDCOM 7.0 SNOTE-record pointer.
 * Narrow the pointer variants with the `in` operator (`'note' in value`).
 */
export type NoteStructure = Note | NoteReference | SharedNoteReference;

/**
 * GEDCOM 7.0 §3.2.3 NOTE_STRUCTURE / SHARED_NOTE_RECORD — g7:NOTE-TRAN: a
 * translation of the note payload into a different language, script, or
 * media type.
 *
 * 7.0-only: 5.5.1 has no TRAN.
 */
export interface NoteTranslation extends GedcomStructureBase {
  /** The TRAN payload, {1:1} Text. */
  payload: Text;
  /** MIME {0:1}, g7:MIME — missing means the same as the superstructure. */
  mediaType?: MediaType;
  /** LANG {0:1}, g7:LANG — missing means the same as the superstructure. */
  language?: Language;
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 Substructures — names and places
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.3 PERSONAL_NAME_STRUCTURE — g7:INDI-NAME: a name of an individual,
 * represented the manner the name is normally spoken, with the surname
 * separated by slashes in the payload. The payload is the primary
 * representation; the pieces are optional auxiliary information.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.38), `PERSONAL_NAME_STRUCTURE` — the
 * same payload, TYPE and PIECES; 5.5.1 additionally has the phonetic (FONE)
 * and romanized (ROMN) variation substructures, NOTE/SOURCE_CITATION are
 * 7.0-only, and TRAN is 7.0-only (see the 5.5.1 overlay notes).
 */
export interface PersonalNameStructure extends GedcomStructureBase {
  tag: 'NAME';
  /** The NAME payload, {1:1} PersonalName. */
  payload: PersonalName;
  /** TYPE {0:1}, g7:NAME-TYPE — Enum of g7:enumset-NAME-TYPE. */
  type?: NameTypeStructure;
  /** <<PERSONAL_NAME_PIECES>> {0:1}. */
  pieces?: PersonalNamePieces;
  /** TRAN {0:M}, g7:NAME-TRAN — translations or transliterations. Each must have a LANG substructure. */
  translations?: NameTranslation[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 PERSONAL_NAME_STRUCTURE — g7:NAME-TYPE: an enumerated value
 * indicating the type of the name.
 *
 * GEDCOM 5.5.1 §2 (p.56), `NAME_TYPE` — identical context; see
 * `NameTypeEnum` for the 5.5.1 value differences.
 */
export interface NameTypeStructure extends GedcomStructureBase {
  /** The TYPE payload, {1:1} Enum of g7:enumset-NAME-TYPE. */
  payload: NameTypeEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 PERSONAL_NAME_PIECES — optional isolated name parts. Multiple
 * parts with the same tag express at least a user preference for
 * splitting; the specification does not define how they combine.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.37), `PERSONAL_NAME_PIECES` — the same
 * pieces; 5.5.1 allows at most one of each tag (comma-separated values)
 * and permits NOTE and SOURCE_CITATION substructures beneath the pieces
 * (removed in 7.0).
 */
export interface PersonalNamePieces extends GedcomStructureBase {
  /** NPFX {0:M}, g7:NPFX — text before the given and surname parts. */
  namePrefixes?: Text[];
  /** GIVN {0:M}, g7:GIVN — given or earned names. */
  givenNames?: Text[];
  /** NICK {0:M}, g7:NICK — descriptive or familiar names. */
  nicknames?: Text[];
  /** SPFX {0:M}, g7:SPFX — non-indexing pre-parts of a surname. */
  surnamePrefixes?: Text[];
  /** SURN {0:M}, g7:SURN — family names. */
  surnames?: Text[];
  /** NSFX {0:M}, g7:NSFX — text after the given and surname parts. */
  nameSuffixes?: Text[];
  /** <<NOTE_STRUCTURE>> {0:M} — 5.5.1-only. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M} — 5.5.1-only. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 PERSONAL_NAME_STRUCTURE — g7:NAME-TRAN: a translation or
 * transliteration of the name into a different language or script.
 *
 * 7.0-only: 5.5.1 expresses name variants through the FONE (phonetic) and
 * ROMN (romanized) substructures instead (see the 5.5.1 overlay notes).
 */
export interface NameTranslation extends GedcomStructureBase {
  /** The TRAN payload, {1:1} PersonalName. */
  payload: PersonalName;
  /** LANG {1:1}, g7:LANG. */
  language: Language;
  /** <<PERSONAL_NAME_PIECES>> {0:1}. */
  pieces?: PersonalNamePieces;
}

/**
 * GEDCOM 7.0 §3.2.3 PLACE_STRUCTURE — g7:PLAC: a place, represented as a list of
 * jurisdictional entities ordered from the lowest to the highest
 * jurisdiction.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.38), `PLACE_STRUCTURE` — the same
 * payload, FORM and MAP; 5.5.1 additionally has the phonetic (FONE) and
 * romanized (ROMN) variation substructures, LANG/TRAN/EXID are 7.0-only
 * (see the 5.5.1 overlay notes).
 */
export interface PlaceStructure extends GedcomStructureBase {
  tag: 'PLAC';
  /** The PLAC payload, {1:1} List:Text — jurisdiction names, smallest to largest; unknown jurisdictions are empty strings. */
  payload: Text[];
  /** FORM {0:1}, g7:PLAC-FORM — the jurisdiction types, with the same number of elements and order as the payload. */
  form?: Text[];
  /** LANG {0:1}, g7:LANG — the language of the payload. */
  language?: Language;
  /** TRAN {0:M}, g7:PLAC-TRAN — translations or transliterations. Each must have a LANG substructure. */
  translations?: PlaceTranslation[];
  /** MAP {0:1}, g7:MAP — a representative point for the location. */
  map?: MapCoordinates;
  /** EXID {0:M}, g7:EXID — external identifiers for the place. */
  externalIds?: ExternalIdentifierStructure[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * GEDCOM 7.0 §3.2.3 PLACE_STRUCTURE — g7:PLAC-TRAN: a translation or transliteration
 * of the place into a different language or script. Should use the same
 * FORM as the payload.
 *
 * 7.0-only: 5.5.1 expresses place variants through the FONE (phonetic)
 * and ROMN (romanized) substructures instead (see the 5.5.1 overlay
 * notes).
 */
export interface PlaceTranslation extends GedcomStructureBase {
  /** The TRAN payload, {1:1} List:Text. */
  payload: Text[];
  /** LANG {1:1}, g7:LANG. */
  language: Language;
}

/**
 * GEDCOM 7.0 §3.2.3 PLACE_STRUCTURE — g7:MAP: a representative point for a location,
 * as defined by LATI and LONG substructures. Provides neither accuracy
 * nor region size.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.38), `MAP` — identical (LATI {1:1} +
 * LONG {1:1}).
 */
export interface MapCoordinates extends GedcomStructureBase {
  /** LATI {1:1}, g7:LATI — a latitudinal coordinate. */
  latitude: Latitude;
  /** LONG {1:1}, g7:LONG — a longitudinal coordinate. */
  longitude: Longitude;
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 Substructures — sources and media
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_CITATION — g7:SOUR: a citation indicating that the
 * pointed-to source record supports the claims made in the superstructure.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.39), `SOURCE_CITATION` — the same
 * structure; 5.5.1 additionally permits a non-pointer form whose payload
 * is a free-text source description instead of an xref, and its SOUR.EVEN
 * has no PHRASE (see the 5.5.1 overlay notes).
 */
export interface SourceCitation extends GedcomStructureBase {
  tag: 'SOUR';
  /** The SOUR payload, {1:1} pointer to a SOUR record; a voidPtr may be used with the citation text in PAGE. */
  source: Pointer<SourceRecord>;
  /** PAGE {0:1}, g7:PAGE — a specific location within the information referenced. */
  page?: Text;
  /** DATA {0:1}, g7:SOUR-DATA — the relevant data from the source. */
  data?: SourceCitationData;
  /** EVEN {0:1}, g7:SOUR-EVEN — Enum of g7:enumset-EVENATTR: what event the relevant material was recording. */
  event?: SourceCitationEvent;
  /** QUAY {0:1}, g7:QUAY — Enum of g7:enumset-QUAY: an estimation of the reliability of the source for these claims. */
  quality?: QualityEnum;
  /** <<MULTIMEDIA_LINK>> {0:M} — digital copies of the cited part of the source. */
  media?: MultimediaLink[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_CITATION — g7:SOUR-DATA: the relevant data from the
 * source.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.39), `SOURCE_CITATION` — identical
 * (DATE `ENTRY_RECORDING_DATE` {0:1}, TEXT {0:M}).
 */
export interface SourceCitationData extends GedcomStructureBase {
  /** <<DATE_VALUE>> {0:1} — when the data was entered into the source. */
  date?: DateStructure;
  /** TEXT {0:M}, g7:TEXT — the relevant text from the source. */
  texts?: SourceText[];
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_CITATION — g7:SOUR-EVEN: the type of event or attribute
 * responsible for the source entry being recorded.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.39), `SOURCE_CITATION` — identical EVEN
 * `EVENT_TYPE_CITED_FROM` (p.49) and ROLE `ROLE_IN_EVENT` (p.61);
 * PHRASE is 7.0-only.
 */
export interface SourceCitationEvent extends GedcomStructureBase {
  /** The EVEN payload, {1:1} Enum of g7:enumset-EVENATTR. */
  payload: EventAttributeEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
  /** ROLE {0:1}, g7:ROLE — Enum of g7:enumset-ROLE: what role the subject played in the event. */
  role?: RoleStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_REPOSITORY_CITATION — g7:REPO: a pointer to the name and
 * address record of the holder of the source document.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.40), `SOURCE_REPOSITORY_CITATION` — the
 * same structure; in 5.5.1 the REPO payload may be empty (`[ptr|<NULL>]`).
 */
export interface SourceRepositoryCitation extends GedcomStructureBase {
  tag: 'REPO';
  /** The REPO payload, {1:1} pointer to a REPO record. */
  repository: Pointer<RepositoryRecord>;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** CALN {0:M}, g7:CALN — the call number of the source at that repository. */
  callNumbers?: CallNumberStructure[];
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_REPOSITORY_CITATION — g7:CALN: an identification or
 * reference description used to file and retrieve items from the holdings
 * of a repository. Despite the word "number", may contain any character.
 *
 * GEDCOM 5.5.1 §2 (p.61), `SOURCE_CALL_NUMBER` — identical CALN {0:M} +
 * MEDI {0:1}; PHRASE is 7.0-only.
 */
export interface CallNumberStructure extends GedcomStructureBase {
  /** The CALN payload, {1:1} Special. */
  payload: Special;
  /** MEDI {0:1}, g7:MEDI — Enum of g7:enumset-MEDI: the medium found at that call number. */
  medium?: MediaStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 SOURCE_REPOSITORY_CITATION / MULTIMEDIA_RECORD — g7:MEDI: an
 * enumerated value providing information about the medium in which
 * information is stored.
 *
 * GEDCOM 5.5.1 §2 (p.62), `SOURCE_MEDIA_TYPE` — identical value set
 * (lowercase); PHRASE is 7.0-only.
 */
export interface MediaStructure extends GedcomStructureBase {
  /** The MEDI payload, {1:1} Enum of g7:enumset-MEDI. */
  payload: MediaEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 MULTIMEDIA_LINK — g7:OBJE: links the superstructure to the
 * MULTIMEDIA_RECORD with the given pointer.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.37), `MULTIMEDIA_LINK` — 5.5.1
 * additionally permits an inline form (OBJE without a pointer, carrying
 * FILE/FORM/MEDI/TITL directly); see the 5.5.1 overlay notes.
 */
export interface MultimediaLink extends GedcomStructureBase {
  tag: 'OBJE';
  /** The OBJE payload, {1:1} pointer to an OBJE record. */
  object: Pointer<MultimediaRecord>;
  /** CROP {0:1}, g7:CROP — a subregion of an image to display. */
  crop?: CropStructure;
  /** TITL {0:1}, g7:TITL — supersedes any OBJE.FILE.TITL in the multimedia record. */
  title?: Text;
}

/**
 * GEDCOM 7.0 §3.2.3 MULTIMEDIA_LINK — g7:CROP: a subregion of an image to display.
 * LEFT and TOP indicate the top-left corner; WIDTH and HEIGHT the extent.
 * Omitted LEFT and TOP default to 0; omitted WIDTH and HEIGHT default to
 * the image size minus the corner.
 *
 * 7.0-only: 5.5.1 has no CROP.
 */
export interface CropStructure extends GedcomStructureBase {
  /** TOP {0:1}, g7:TOP — pixels to not display from the top. */
  top?: Integer;
  /** LEFT {0:1}, g7:LEFT — pixels to not display from the left. */
  left?: Integer;
  /** HEIGHT {0:1}, g7:HEIGHT — how many pixels to display vertically. */
  height?: Integer;
  /** WIDTH {0:1}, g7:WIDTH — how many pixels to display horizontally. */
  width?: Integer;
}

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE / FAMILY_EVENT_STRUCTURE
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §2.4 / GEDCOM 7.0 §3.2.3 — the optional `Y` payload of event structures: the event
 * is known to have occurred without providing any additional information
 * about it (GEDCOM 7.0 §3.3.1).
 */
export type EventAssertion = 'Y';

/** Base of the family attribute structures of GEDCOM 7.0 §3.2.3. */
interface FamilyAttributeBase<Tag extends string, TPayload> extends GedcomStructureBase {
  tag: Tag;
  /** {1:1} — the payload of the attribute. */
  payload: TPayload;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the attribute. */
  type?: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE — g7:FAM-NCHI: the number of children
 * that belong to this family. GEDCOM 7.0 §3.3.2.2.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.24), `FAM_RECORD` — in 5.5.1 NCHI
 * sits directly under the FAM record ({0:1}) with the same
 * `COUNT_OF_CHILDREN` meaning.
 */
export interface FamilyChildCountAttribute extends FamilyAttributeBase<'NCHI', Integer> {}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE — g7:FAM-RESI: an address or place of
 * residence where a family resided. GEDCOM 7.0 §3.3.2.2.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `FAMILY_EVENT_STRUCTURE` — in
 * 5.5.1 FAM.RESI is a family *event* with no payload (see the 5.5.1
 * overlay notes).
 */
export interface FamilyResidenceAttribute extends FamilyAttributeBase<'RESI', Text> {}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE — g7:FAM-FACT: a generic family
 * attribute; must have a TYPE substructure to define what kind of
 * attribute is being provided. GEDCOM 7.0 §3.3.2.2.
 *
 * 7.0-only: 5.5.1 has no FAM.FACT.
 */
export interface FamilyGenericAttribute extends GedcomStructureBase {
  tag: 'FACT';
  /** The FACT payload, {1:1} Text. */
  payload: Text;
  /** TYPE {1:1}, g7:TYPE — required for FAM.FACT. */
  type: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/** GEDCOM 7.0 §3.2.3 FAMILY_ATTRIBUTE_STRUCTURE — the union of family attributes. */
export type FamilyAttributeStructure =
  | FamilyChildCountAttribute
  | FamilyResidenceAttribute
  | FamilyGenericAttribute;

/** Base of the family event structures of GEDCOM 7.0 §3.2.3.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.32), `FAMILY_EVENT_STRUCTURE` — the
 * same event set; in 5.5.1 only MARR has the optional `Y` payload, and
 * RESI is one of the family events (see the 5.5.1 overlay notes).
 */
interface FamilyEventBase<Tag extends string> extends GedcomStructureBase {
  tag: Tag;
  /** {1:1} — `[Y|<NULL>]`: the optional `Y` payload asserting the event occurred (GEDCOM 7.0 §3.3.1). */
  payload?: EventAssertion;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the event. */
  type?: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:ANUL: annulment. GEDCOM 7.0 §3.3.1.2. */
export interface AnnulmentEvent extends FamilyEventBase<'ANUL'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:FAM-CENS: census. GEDCOM 7.0 §3.3.1.2. */
export interface FamilyCensusEvent extends FamilyEventBase<'CENS'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:DIV: divorce. GEDCOM 7.0 §3.3.1.2. */
export interface DivorceEvent extends FamilyEventBase<'DIV'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:DIVF: divorce filed. GEDCOM 7.0 §3.3.1.2. */
export interface DivorceFilingEvent extends FamilyEventBase<'DIVF'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:ENGA: engagement. GEDCOM 7.0 §3.3.1.2. */
export interface EngagementEvent extends FamilyEventBase<'ENGA'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARB: marriage bann. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageBannEvent extends FamilyEventBase<'MARB'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARC: marriage contract. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageContractEvent extends FamilyEventBase<'MARC'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARL: marriage license. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageLicenseEvent extends FamilyEventBase<'MARL'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARR: marriage. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageEvent extends FamilyEventBase<'MARR'> {}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:MARS: marriage settlement. GEDCOM 7.0 §3.3.1.2. */
export interface MarriageSettlementEvent extends FamilyEventBase<'MARS'> {}

/**
 * GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — g7:FAM-EVEN: a generic family event;
 * must have a TYPE substructure to define what kind of event is being
 * provided. GEDCOM 7.0 §3.3.1.2.
 */
export interface FamilyGenericEvent extends GedcomStructureBase {
  tag: 'EVEN';
  /** The EVEN payload, {1:1} Text — may be the empty string. */
  payload: Text;
  /** TYPE {1:1}, g7:TYPE — required for FAM.EVEN. */
  type: Text;
  /** <<FAMILY_EVENT_DETAIL>> {0:1}. */
  detail?: FamilyEventDetail;
}

/** GEDCOM 7.0 §3.2.3 FAMILY_EVENT_STRUCTURE — the union of family events. */
export type FamilyEventStructure =
  | AnnulmentEvent
  | FamilyCensusEvent
  | DivorceEvent
  | DivorceFilingEvent
  | EngagementEvent
  | MarriageBannEvent
  | MarriageContractEvent
  | MarriageLicenseEvent
  | MarriageEvent
  | MarriageSettlementEvent
  | FamilyGenericEvent;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE / INDIVIDUAL_EVENT_STRUCTURE
// ---------------------------------------------------------------------------

/** Base of the individual attribute structures of GEDCOM 7.0 §3.2.3.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.33), `INDIVIDUAL_ATTRIBUTE_STRUCTURE` —
 * the same attribute set.
 */
interface IndividualAttributeBase<Tag extends string, TPayload> extends GedcomStructureBase {
  tag: Tag;
  /** {1:1} — the payload of the attribute. */
  payload: TPayload;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the attribute. */
  type?: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:CAST: caste. GEDCOM 7.0 §3.3.2.1. */
export interface CasteAttribute extends IndividualAttributeBase<'CAST', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:DSCR: physical description. GEDCOM 7.0 §3.3.2.1. */
export interface PhysicalDescriptionAttribute extends IndividualAttributeBase<'DSCR', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:EDUC: education. GEDCOM 7.0 §3.3.2.1. */
export interface EducationAttribute extends IndividualAttributeBase<'EDUC', Text> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:IDNO: a number or other
 * string assigned to identify a person within some significant external
 * system; must have a TYPE substructure. GEDCOM 7.0 §3.3.2.1.
 */
export interface IdentificationNumberAttribute extends GedcomStructureBase {
  tag: 'IDNO';
  /** The IDNO payload, {1:1} Special. */
  payload: Special;
  /** TYPE {1:1}, g7:TYPE — required for IDNO. */
  type: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:NATI: nationality. GEDCOM 7.0 §3.3.2.1. */
export interface NationalityAttribute extends IndividualAttributeBase<'NATI', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-NCHI: the number of children this person is known to be the parent of. GEDCOM 7.0 §3.3.2.1. */
export interface IndividualChildCountAttribute extends IndividualAttributeBase<'NCHI', Integer> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:NMR: the number of times this person has participated in a family as a spouse or parent. GEDCOM 7.0 §3.3.2.1. */
export interface MarriageCountAttribute extends IndividualAttributeBase<'NMR', Integer> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:OCCU: occupation. GEDCOM 7.0 §3.3.2.1. */
export interface OccupationAttribute extends IndividualAttributeBase<'OCCU', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:PROP: property. GEDCOM 7.0 §3.3.2.1. */
export interface PropertyAttribute extends IndividualAttributeBase<'PROP', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-RELI: religion. GEDCOM 7.0 §3.3.2.1. */
export interface IndividualReligionAttribute extends IndividualAttributeBase<'RELI', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-RESI: residence. GEDCOM 7.0 §3.3.2.1. */
export interface IndividualResidenceAttribute extends IndividualAttributeBase<'RESI', Text> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:SSN: social security number; a type of IDNO. GEDCOM 7.0 §3.3.2.1. */
export interface SocialSecurityNumberAttribute extends IndividualAttributeBase<'SSN', Special> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-TITL: title. GEDCOM 7.0 §3.3.2.1. */
export interface IndividualTitleAttribute extends IndividualAttributeBase<'TITL', Text> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — g7:INDI-FACT: a generic
 * individual attribute; must have a TYPE substructure to define what kind
 * of attribute is being provided. GEDCOM 7.0 §3.3.2.1.
 */
export interface IndividualGenericAttribute extends GedcomStructureBase {
  tag: 'FACT';
  /** The FACT payload, {1:1} Text. */
  payload: Text;
  /** TYPE {1:1}, g7:TYPE — required for INDI.FACT. */
  type: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_ATTRIBUTE_STRUCTURE — the union of individual attributes. */
export type IndividualAttributeStructure =
  | CasteAttribute
  | PhysicalDescriptionAttribute
  | EducationAttribute
  | IdentificationNumberAttribute
  | NationalityAttribute
  | IndividualChildCountAttribute
  | MarriageCountAttribute
  | OccupationAttribute
  | PropertyAttribute
  | IndividualReligionAttribute
  | IndividualResidenceAttribute
  | SocialSecurityNumberAttribute
  | IndividualTitleAttribute
  | IndividualGenericAttribute;

/** Base of the individual event structures of GEDCOM 7.0 §3.2.3.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.34), `INDIVIDUAL_EVENT_STRUCTURE` —
 * the same event set; in 5.5.1 only BIRT, CHR and DEAT have the optional
 * `Y` payload.
 */
interface IndividualEventBase<Tag extends string> extends GedcomStructureBase {
  tag: Tag;
  /** {1:1} — `[Y|<NULL>]`: the optional `Y` payload asserting the event occurred (GEDCOM 7.0 §3.3.1). */
  payload?: EventAssertion;
  /** TYPE {0:1}, g7:TYPE — a descriptive word or phrase further classifying the event. */
  type?: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:ADOP: adoption; creation of a
 * legally approved child-parent relationship. May have a FAMC with an
 * optional ADOP substructure indicating which parents adopted.
 * GEDCOM 7.0 §3.3.1.1.
 */
export interface AdoptionEvent extends IndividualEventBase<'ADOP'> {
  /** FAMC {0:1}, g7:ADOP-FAMC — the individual or couple that adopted this individual. */
  adoptionFamily?: AdoptionFamilyLink;
}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:ADOP-FAMC: the family that
 * adopted the individual, with an indication of which parent(s) adopted.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.34), `INDIVIDUAL_EVENT_STRUCTURE` —
 * identical (ADOP.FAMC + ADOP {0:1} `ADOPTED_BY_WHICH_PARENT`).
 */
export interface AdoptionFamilyLink extends GedcomStructureBase {
  /** The FAMC payload, {1:1} pointer to a FAM record. */
  family: Pointer<FamilyRecord>;
  /** ADOP {0:1}, g7:FAMC-ADOP — Enum of g7:enumset-ADOP. */
  adoption?: AdoptionStructure;
}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:FAMC-ADOP: an enumerated value
 * indicating which parent(s) in the family adopted this individual.
 */
export interface AdoptionStructure extends GedcomStructureBase {
  /** The ADOP payload, {1:1} Enum of g7:enumset-ADOP. */
  payload: AdoptionEnum;
  /** PHRASE {0:1}, g7:PHRASE. */
  phrase?: Text;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BAPM: baptism. GEDCOM 7.0 §3.3.1.1. */
export interface BaptismEvent extends IndividualEventBase<'BAPM'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BARM: Bar Mitzvah. GEDCOM 7.0 §3.3.1.1. */
export interface BarMitzvahEvent extends IndividualEventBase<'BARM'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BASM: Bas Mitzvah. GEDCOM 7.0 §3.3.1.1. */
export interface BasMitzvahEvent extends IndividualEventBase<'BASM'> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BIRT: birth; entering into life.
 * May have a FAMC (bare pointer) indicating the family at birth.
 * GEDCOM 7.0 §3.3.1.1.
 */
export interface BirthEvent extends IndividualEventBase<'BIRT'> {
  /** FAMC {0:1}, g7:FAMC — the family with which this event is associated. */
  familyChild?: Pointer<FamilyRecord>;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BLES: blessing. GEDCOM 7.0 §3.3.1.1. */
export interface BlessingEvent extends IndividualEventBase<'BLES'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:BURI: depositing remains. GEDCOM 7.0 §3.3.1.1. */
export interface BurialEvent extends IndividualEventBase<'BURI'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:INDI-CENS: census. GEDCOM 7.0 §3.3.1.1. */
export interface CensusEvent extends IndividualEventBase<'CENS'> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:CHR: christening. May have a
 * FAMC (bare pointer) indicating the family at christening. GEDCOM 7.0 §3.3.1.1.
 */
export interface ChristeningEvent extends IndividualEventBase<'CHR'> {
  /** FAMC {0:1}, g7:FAMC — the family with which this event is associated. */
  familyChild?: Pointer<FamilyRecord>;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:CHRA: adult christening. GEDCOM 7.0 §3.3.1.1. */
export interface AdultChristeningEvent extends IndividualEventBase<'CHRA'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:CONF: confirmation. GEDCOM 7.0 §3.3.1.1. */
export interface ConfirmationEvent extends IndividualEventBase<'CONF'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:CREM: cremation. GEDCOM 7.0 §3.3.1.1. */
export interface CremationEvent extends IndividualEventBase<'CREM'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:DEAT: death. GEDCOM 7.0 §3.3.1.1. */
export interface DeathEvent extends IndividualEventBase<'DEAT'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:EMIG: emigration. GEDCOM 7.0 §3.3.1.1. */
export interface EmigrationEvent extends IndividualEventBase<'EMIG'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:FCOM: first communion. GEDCOM 7.0 §3.3.1.1. */
export interface FirstCommunionEvent extends IndividualEventBase<'FCOM'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:GRAD: graduation. GEDCOM 7.0 §3.3.1.1. */
export interface GraduationEvent extends IndividualEventBase<'GRAD'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:IMMI: immigration. GEDCOM 7.0 §3.3.1.1. */
export interface ImmigrationEvent extends IndividualEventBase<'IMMI'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:NATU: naturalization. GEDCOM 7.0 §3.3.1.1. */
export interface NaturalizationEvent extends IndividualEventBase<'NATU'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:ORDN: ordination. GEDCOM 7.0 §3.3.1.1. */
export interface OrdinationEvent extends IndividualEventBase<'ORDN'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:PROB: probate. GEDCOM 7.0 §3.3.1.1. */
export interface ProbateEvent extends IndividualEventBase<'PROB'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:RETI: retirement. GEDCOM 7.0 §3.3.1.1. */
export interface RetirementEvent extends IndividualEventBase<'RETI'> {}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:WILL: will. GEDCOM 7.0 §3.3.1.1. */
export interface WillEvent extends IndividualEventBase<'WILL'> {}

/**
 * GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — g7:INDI-EVEN: a generic individual
 * event; must have a TYPE substructure to define what kind of event is
 * being provided. GEDCOM 7.0 §3.3.1.1.
 */
export interface IndividualGenericEvent extends GedcomStructureBase {
  tag: 'EVEN';
  /** The EVEN payload, {1:1} Text — may be the empty string. */
  payload: Text;
  /** TYPE {1:1}, g7:TYPE — required for INDI.EVEN. */
  type: Text;
  /** <<INDIVIDUAL_EVENT_DETAIL>> {0:1}. */
  detail?: IndividualEventDetail;
}

/** GEDCOM 7.0 §3.2.3 INDIVIDUAL_EVENT_STRUCTURE — the union of individual events. */
export type IndividualEventStructure =
  | AdoptionEvent
  | BaptismEvent
  | BarMitzvahEvent
  | BasMitzvahEvent
  | BirthEvent
  | BlessingEvent
  | BurialEvent
  | CensusEvent
  | ChristeningEvent
  | AdultChristeningEvent
  | ConfirmationEvent
  | CremationEvent
  | DeathEvent
  | EmigrationEvent
  | FirstCommunionEvent
  | GraduationEvent
  | ImmigrationEvent
  | NaturalizationEvent
  | OrdinationEvent
  | ProbateEvent
  | RetirementEvent
  | WillEvent
  | IndividualGenericEvent;

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 LDS ordinances / GEDCOM 7.0 §3.3.3
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.3 LDS_ORDINANCE_DETAIL — substructures shared by the Latter-day
 * Saint ordinance structures.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.35), `LDS_INDIVIDUAL_ORDINANCE` /
 * (p.36) `LDS_SPOUSE_SEALING` — the same DATE, TEMP, PLAC, STAT, NOTE and
 * SOUR substructures; 5.5.1's STAT value sets are per-ordinance (see
 * `OrdinanceStatusEnum`).
 */
export interface LdsOrdinanceDetail extends GedcomStructureBase {
  /** <<DATE_VALUE>> {0:1} — should be in the GREGORIAN calendar and 1830 or later. */
  date?: DateStructure;
  /** TEMP {0:1}, g7:TEMP — the name of the temple. */
  temple?: Text;
  /** <<PLACE_STRUCTURE>> {0:1} — used only for ordinances performed by the recipient in life. */
  place?: PlaceStructure;
  /** STAT {0:1}, g7:ord-STAT — Enum of g7:enumset-ord-STAT. */
  status?: OrdinanceStatusStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 LDS_ORDINANCE_DETAIL — g7:ord-STAT: an enumerated value
 * assessing the state or condition of an ordinance, with the date it was
 * assigned.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.35–36) — identical STAT + DATE {1:1}
 * shape; see `OrdinanceStatusEnum` for the 5.5.1 per-ordinance value sets.
 */
export interface OrdinanceStatusStructure extends GedcomStructureBase {
  /** The STAT payload, {1:1} Enum of g7:enumset-ord-STAT. */
  payload: OrdinanceStatusEnum;
  /** DATE {1:1}, g7:DATE-exact. */
  date: DateExactStructure;
}

/** Base of the LDS individual ordinance structures of GEDCOM 7.0 §3.2.3. */
interface LdsOrdinanceBase<Tag extends string> extends GedcomStructureBase {
  tag: Tag;
  /** <<LDS_ORDINANCE_DETAIL>> {0:1}. */
  detail?: LdsOrdinanceDetail;
}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:BAPL: baptism. GEDCOM 7.0 §3.3.3. */
export interface BaptismOrdinance extends LdsOrdinanceBase<'BAPL'> {}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:CONL: confirmation. GEDCOM 7.0 §3.3.3. */
export interface ConfirmationOrdinance extends LdsOrdinanceBase<'CONL'> {}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:ENDL: endowment. GEDCOM 7.0 §3.3.3. */
export interface EndowmentOrdinance extends LdsOrdinanceBase<'ENDL'> {}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:INIL: initiatory. GEDCOM 7.0 §3.3.3. */
export interface InitiatoryOrdinance extends LdsOrdinanceBase<'INIL'> {}

/**
 * GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:SLGC: sealing of a child to
 * parents. GEDCOM 7.0 §3.3.3.
 */
export interface ChildSealingOrdinance extends LdsOrdinanceBase<'SLGC'> {
  /** FAMC {1:1}, g7:FAMC — the family the child was sealed to. */
  family: Pointer<FamilyRecord>;
}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — the union of individual ordinances. */
export type LdsIndividualOrdinance =
  | BaptismOrdinance
  | ConfirmationOrdinance
  | EndowmentOrdinance
  | InitiatoryOrdinance
  | ChildSealingOrdinance;

/**
 * GEDCOM 7.0 §3.2.3 LDS_SPOUSE_SEALING — g7:SLGS: sealing of spouses. GEDCOM 7.0 §3.3.3.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.36), `LDS_SPOUSE_SEALING` — identical.
 */
export interface SpouseSealingOrdinance extends GedcomStructureBase {
  tag: 'SLGS';
  /** <<LDS_ORDINANCE_DETAIL>> {0:1}. */
  detail?: LdsOrdinanceDetail;
}
