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
import type { CensusRecord } from './census-record';
import type { CreationDate } from './common';
import type { DateExactStructure } from './common';
import type { DateStructure } from './common';
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
import type { PlaceRecord } from './place-record';
import type { TodoRecord } from './todo-record';
import type { TodoStructure } from './todo-record';
import type { EventDefinitionRecord } from './event-definition-record';

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
  /** <<FAMILY_ATTRIBUTE_STRUCTURE>> {0:M}; the vendor childless markers `_NONE`/`_NONE Y` normalize into a `NCHI 0` entry here (see FamilyChildCountAttribute). */
  attributes?: FamilyAttributeStructure[];
  /** <<FAMILY_EVENT_STRUCTURE>> {0:M}. */
  events?: FamilyEventStructure[];
  /** <<NON_EVENT_STRUCTURE>> {0:M} — 7.0-only. When serializing to 5.5.1 the NO rule applies: every NO is dropped, records left empty by that are dropped too, and pointers to dropped records are removed (serialize/prepare.ts). */
  nonEvents?: NonEventStructure[];
  /**
   * _UPD {0:1} — the record's last-updated timestamp (a free text
   * value). Written by MyHeritage; not part of any GEDCOM version (see
   * GED-VIEW's summary: https://ged-view.com/guides/custom-gedcom-tags).
   * Recognized on input and written back as `_UPD` in both versions.
   */
  updatedAt?: Text;
  /**
   * _STAT {0:1} — the status of the marriage (Married, Unmarried, …).
   * Written by Legacy Family Tree under FAM (see its "Custom GEDCOM
   * Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not
   * part of any GEDCOM version. Recognized on input and written back as
   * `_STAT` in both versions. (The FTW `_MSTAT`/`_MEND` beginning and
   * ending statuses are the separate fields below.)
   */
  marriageStatus?: Text;
  /**
   * _MSTAT {0:1} — the status at the beginning of the marriage
   * (Friends, Engaged, Married, …). Written by Family Tree Maker
   * (Windows) under FAM (catalogued by the GEDCOM-L working group in
   * the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag and by Legacy:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_MSTAT` in both versions.
   */
  marriageBeginningStatus?: Text;
  /**
   * _MEND {0:1} — the status at the end of the marriage (Married,
   * Divorced, Annulled, Widowed, …). Written by Family Tree Maker
   * (Windows) under FAM (same sources as `marriageBeginningStatus`);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_MEND` in both versions.
   */
  marriageEndingStatus?: Text;
  /**
   * `_TYPE same-sex` {0:1} — the family is a same-sex union (marriage
   * or partnership): the German GEDCOM-L convention written by
   * Ahnenblatt and Familienbuch (see the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * catalog: https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). The
   * GEDCOM 7.0 FAMILY_RECORD describes its HUSB and WIFE as partners
   * but has no same-sex slot (its §1.5.3 even sketches a `_PARTNER`
   * extension); 5.5.1 has none either. Recognized on input in both
   * versions (case-insensitive) and written back as `_TYPE same-sex`
   * in both versions; the HUSB/WIFE tags carry the two partners
   * without gender semantics when this flag is set.
   */
  sameSexUnion?: true;
  /**
   * _TODO {0:M} — research tasks attached to the family: the GenoPro /
   * RootsMagic / Ahnenblatt to-do structure with the sub-tags DESC,
   * PRTY, STAT, DATE and NOTE (see TodoStructure; the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" catalog lists it under FAM too:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_TODO` in both versions.
   */
  todos?: TodoStructure[];
  /** HUSB {0:1}, g7:FAM-HUSB — one partner (a layout hint, not a gender assertion). */
  husband?: FamilyPartnerLink;
  /** WIFE {0:1}, g7:FAM-WIFE — the other partner. */
  wife?: FamilyPartnerLink;
  /** CHIL {0:M}, g7:CHIL — the children, chronological by birth; a voidPtr marks a placeholder for an unknown child. */
  children?: FamilyChildLink[];
  /**
   * <<ASSOCIATION_STRUCTURE>> {0:M} — 7.0-only: 5.5.1 FAM has no ASSO
   * slot. The German GEDCOM-L `_ASSO` form (agreement A3) is
   * recognized on input in both versions and written back to 5.5.1 as
   * `_ASSO` (7.0 uses the standard ASSO).
   */
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
  /**
   * _PREF Y {0:1} — marks the preferred partner. Written by Legacy
   * Family Tree under HUSB and WIFE (see its "Custom GEDCOM Tags"
   * help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm
   * — "_PREF = Indicates a Preferred spouse, child or parents"; the
   * FAM.HUSB/FAM.WIFE positions are catalogued in the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of any
   * GEDCOM version. Recognized on input and written back as `_PREF` in
   * both versions.
   */
  preferred?: boolean;
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
   * _PREF Y {0:1} — marks the preferred child. Written by Legacy
   * Family Tree (see its "Custom GEDCOM Tags" help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not part
   * of any GEDCOM version. Recognized on input and written back as
   * `_PREF` in both versions.
   */
  preferred?: boolean;
  /**
   * _STAT {0:1} — the child's birth multiplicity, free text (Twin,
   * Triplet, …). Written by Legacy Family Tree under CHIL (see its
   * "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not
   * part of any GEDCOM version (note this is unrelated to the
   * FAMC.STAT proof values). Recognized on input and written back as
   * `_STAT` under CHIL in both versions.
   */
  multiplicity?: Text;
  /**
   * _FREL {0:1} — the relationship of the child to the father in the
   * family (Natural, Adopted, Step, Foster, …). A vendor extension
   * written by Family Tree Maker and read by several programs; not part
   * of any GEDCOM version (catalogued in the Legacy Family Tree help,
   * "User-Defined GEDCOM Tags":
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm).
   * Recognized on input in both versions. Both versions of the standard
   * keep one PEDI value per INDI.FAMC link instead of a per-parent pair.
   * Serialized to 5.5.1 as `_FREL`/`_MREL`; when serializing to 7.0 the
   * pair is projected onto the matching FAMC link's PEDI when both
   * relations name the same known relationship (natural → BIRTH,
   * adopted → ADOPTED, foster → FOSTER, sealing → SEALING); otherwise
   * it is dropped.
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
  /**
   * _UPD {0:1} — the record's last-updated timestamp (a free text
   * value). Written by MyHeritage; not part of any GEDCOM version (see
   * GED-VIEW's summary: https://ged-view.com/guides/custom-gedcom-tags).
   * Recognized on input and written back as `_UPD` in both versions.
   */
  updatedAt?: Text;
  /**
   * _URL {0:1} — an internet address of the individual. Written by
   * Legacy Family Tree under INDI (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not part of any GEDCOM version. Recognized on input and
   * written back as `_URL` in both versions.
   */
  url?: Text;
  /**
   * _SOSA {0:1} — the individual's Sosa–Stradonitz (Ahnentafel)
   * number. Written by Ancestris, the French GEDCOM editor (see its
   * user guide, "Tags": https://docs.ancestris.org/books/user-guide/page/tags);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_SOSA` in both versions.
   */
  sosaNumber?: Text;
  /**
   * _FSFTID {0:1} — the person's FamilySearch Family Tree identifier
   * (PID, e.g. `KWJ1-2B3`), the permanent id of the person in the
   * FamilySearch shared tree. Written by Familienbuch, Legacy Family
   * Tree, Ancestral Quest, Family Historian and webtrees (catalogued
   * by the GEDCOM-L working group in the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input and written back as `_FSFTID`
   * in both versions. (The non-underscore `FSFTID` spelling of
   * RootsMagic stays a strict error: it is not in the accepted
   * non-underscore catalog — see docs/vendor-extensions.md chapter 8
   * and parsing/vendor-tags.ts.)
   */
  familySearchId?: Text;
  /**
   * _TAG {0:1} and _TAG2–_TAG9 {0:1 each} — the individual's named
   * tag marks (Tag 1 through Tag 9), kept in order. Written by Legacy
   * Family Tree under INDI (see its "Custom GEDCOM Tags" help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_TAG`/`_TAG2`… in both versions.
   */
  marks?: Text[];
  /**
   * _TODO {0:M} — research tasks attached to the individual: the
   * GenoPro / RootsMagic / Ahnenblatt to-do structure with the
   * sub-tags DESC, PRTY, STAT, DATE and NOTE (see TodoStructure; the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" catalog lists it under INDI:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_TODO` in both versions.
   */
  todos?: TodoStructure[];
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
  /**
   * _FREL {0:1} — the relationship of this child to the father in the
   * family (Natural, Adopted, Step, Foster, …). Under FAM.CHIL the tag
   * is written by Family Tree Maker and read by several programs;
   * AGES! writes the same tag under the INDI.FAMC link — "Beziehung
   * eines Kindes zum Vater" (catalogued by the GEDCOM-L working group
   * in the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Recognized on
   * input in both versions. Serialized to 5.5.1 as `_FREL`/`_MREL`;
   * when serializing to 7.0 an agreeing pair is projected onto this
   * link's PEDI (natural → BIRTH, adopted → ADOPTED, foster → FOSTER,
   * sealing → SEALING) and otherwise dropped (see serialize/prepare.ts).
   */
  fatherRelation?: Text;
  /**
   * _MREL {0:1} — the relationship of this child to the mother; see
   * `fatherRelation`.
   */
  motherRelation?: Text;
  /**
   * _PRIMARY Y {0:1} — marks the primary family for an adopted child.
   * Written by Ancestral Quest and PAF under FAMC (see the Legacy
   * "User-Defined GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm).
   * Recognized on input and written back as `_PRIMARY` in both
   * versions.
   */
  primary?: boolean;
  /**
   * _PREF Y {0:1} — marks the preferred parents for this child.
   * Written by Legacy Family Tree (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not part of any GEDCOM version. Recognized on input and
   * written back as `_PREF` in both versions. (Distinct from `primary`,
   * the AQ/PAF mark for an adopted child's main family.)
   */
  preferred?: boolean;
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
  /**
   * _PREF Y {0:1} — marks the preferred spouse. Written by Legacy
   * Family Tree (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not
   * part of any GEDCOM version. Recognized on input and written back as
   * `_PREF` in both versions.
   */
  preferred?: boolean;
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
  /**
   * _DATE {0:1} — a date associated with the media object, usually the
   * date of a picture or video. Written by Legacy Family Tree under
   * OBJE (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_DATE` in both versions.
   */
  date?: DateStructure;
  /**
   * _TYPE {0:1} — the kind of the media object (Photo, Sound, Video,
   * …). Written by Ancestral Quest, Family Origins, PAF and Legacy
   * under OBJE (see the Legacy "User-Defined GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_TYPE` in both versions.
   */
  objectType?: Text;
  /**
   * _SOUND {0:1} — a sound file attached to the picture or video.
   * Written by Legacy Family Tree under OBJE (see its "Custom GEDCOM
   * Tags" help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not part of any GEDCOM version. Recognized
   * on input and written back as `_SOUND` in both versions.
   */
  soundFile?: Text;
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
  /**
   * _DATE {0:M} — the principal date of the repository. The community
   * extension `_DATE`, registered in the FamilySearch GEDCOM registry
   * (structure/extension/_DATE.yaml; marked prerelease there): a
   * DateValue with the optional TIME and PHRASE substructures.
   * Recognized on input and written back as `_DATE` in both versions.
   */
  dates?: DateStructure[];
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
  /**
   * DATE / PLAC under PUBL {0:1 each} — the publication date and
   * place: the Ancestry.com Family Trees extensions, registered in the
   * FamilySearch GEDCOM registry
   * (structure/extension/Ancestry_PUBL_DATE.yaml and
   * Ancestry_PUBL_PLAC.yaml). Nonconformant uses of the standard tags
   * (GEDCOM 7.0 §1.5 permits them only under extension tags), accepted
   * per the registry. Written back in 7.0; dropped when serializing to
   * 5.5.1.
   */
  publicationDetails?: SourcePublicationDetails;
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
  /**
   * _TMPLT {0:1} — the Evidence Explained source template used to enter
   * the source: named FIELD/VALUE pairs (page, URL, film number, …)
   * plus an optional TID template identifier. Written by RootsMagic and
   * Family Tree Maker; not part of any GEDCOM version (see GED-VIEW's
   * summary: https://ged-view.com/guides/custom-gedcom-tags).
   * Recognized on input and written back as `_TMPLT` in both versions.
   */
  template?: EvidenceTemplate;
  /**
   * _FULL {0:1} — the text created by formatting the source's full
   * footnote template. Written by TMG-to-GEDCOM (see its "GEDCOM Tag
   * Names" help: https://tmgtogedcom.com/en/tag-names.htm); not part of
   * any GEDCOM version. Recognized on input and written back as `_FULL`
   * in both versions.
   */
  fullFootnote?: Text;
  /**
   * `_SOUR {0:M}` — a relocated citation under the source record
   * (structure/extension/_SOUR.yaml in the FamilySearch GEDCOM
   * registry, marked prerelease there): the standard `SOUR` tag moved
   * under the SOUR record, linking this source to another source it
   * was relocated from. The registry gives it the same payload (a
   * pointer to a SOUR record) and the same substructures as
   * SOURCE_CITATION (NOTE, OBJE, PAGE, QUAY, SNOTE, SOUR-DATA,
   * SOUR-EVEN). Recognized on input in both versions and written back
   * as `_SOUR` under the record in both versions.
   */
  relocatedCitations?: SourceCitation[];
}

/**
 * The vendor `_TMPLT` Evidence Explained source template: a template
 * identifier plus named field/value pairs. See SourceRecord.template.
 */
export interface EvidenceTemplate extends GedcomStructureBase {
  tag: '_TMPLT';
  /** TID {0:1} — the template identifier. */
  templateId?: Text;
  /** FIELD {1:M} — the template fields. */
  fields: EvidenceTemplateField[];
}

/**
 * One FIELD of an EvidenceTemplate: a NAME {1:1} with an optional
 * VALUE {0:1}. See SourceRecord.template.
 */
export interface EvidenceTemplateField extends GedcomStructureBase {
  tag: 'FIELD';
  /** NAME {1:1} — the field name. */
  name: Text;
  /** VALUE {0:1} — the field value. */
  value?: Text;
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
  /**
   * The user-supplied values of the 5.5.1 `EVENTS_RECORDED` list,
   * kept verbatim: GEDCOM 5.5.1 §2 (p.50) permits any value alongside
   * the `EVENT_ATTRIBUTE_TYPE` tags — "If the event or attribute
   * doesn't translate to one of these tag codes, then a user supplied
   * value is expected and will be generally classified in the category
   * of other". The known tags go to `payload`, everything else here;
   * the list has no ordering semantics in 5.5.1, so the grouping is
   * lossless. 7.0 has no slot for these values (only extTag extension
   * values, which stay in `payload`): when serializing to 7.0 an EVEN
   * whose payload is empty is dropped entirely, otherwise the
   * user-defined values are dropped silently. 5.5.1 writes them back
   * verbatim after the enums.
   */
  userDefined?: Text[];
}

/**
 * The Ancestry.com Family Trees publication details under SOUR.PUBL:
 * the publication date (a DateExact) and place (a place name), each
 * {0:1}. See SourceRecord.publicationDetails.
 */
export interface SourcePublicationDetails extends GedcomStructureBase {
  /** DATE {0:1} — the publication date (a DateExact). */
  date?: DateExactStructure;
  /** PLAC {0:1} — the publication place (a plain place name). */
  place?: Text;
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
  | CensusRecord
  | PlaceRecord
  | TodoRecord
  | EventDefinitionRecord
  | ExtensionRecord;
