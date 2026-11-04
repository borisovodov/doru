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
import type { GroupRecord } from './group-record';
import type { OccurrenceRecord } from './occurrence-record';
import type {
  ContactRecord,
  EducationRecord,
  MarriageRecord,
  OccupationRecord,
  TwinRecord,
} from './genopro-entity';
import type { TitleRecord } from './title-record';
import type { TreeCategoryRecord, TreeTagRecord } from './tree-tag-record';
import type { DateExactStructure } from './common';
import type { DateStructure } from './common';
import type { DatePeriodStructure } from './common';
import type { ExtensionRecord } from './extensions';
import type { ExtensionStructure } from './extensions';
import type { FamilyAttributeStructure } from './family-structures';
import type { FamilyEventStructure } from './family-structures';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { ImportFileReference } from './common';
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
import type { SpouseSealingOrdinance, ChildSealingOrdinance } from './lds';
import type { PlaceRecord } from './place-record';
import type { PublishedSiteRecord } from './published-site-record';
import type { TodoRecord } from './todo-record';
import type { TodoStructure } from './todo-record';
import type { EventDefinitionRecord } from './event-definition-record';
import type { DuplicateCandidateRecord } from './duplicate-record';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.2 Records
// ---------------------------------------------------------------------------

/**
 * The USM6 (Der Stammbaum ≤ V6) birth-type code, `BTYP` under BIRT:
 * 1 = single birth, 2 = twin, 3 = multiple birth, 4 = the child died at
 * birth. The values are documented in the GenWiki "GEDCOM/_Nutzerdef-Tag"
 * article's "Tabelle 2" ("Abweichungen vom Standard bei der Verwendung",
 * itself based on gencom.org.nz/GEDCOM_tags.html):
 * <https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag>. The wire spelling
 * is the digit; see BirthEvent.birthType.
 */
export type UsmBirthType = '1' | '2' | '3' | '4';

/**
 * The USM6 (Der Stammbaum ≤ V6) parent–child relationship code, `MTYP`
 * under INDI.FAMC: 1 = marital child, 2 = non-marital child, 3 =
 * adoption without incorporation, 4 = adoption with incorporation,
 * 5 = unknown, 6 = uncertain. Same source as `UsmBirthType`; see
 * ChildFamilyLink.parentalRelationKind.
 */
export type UsmParentalRelationKind = '1' | '2' | '3' | '4' | '5' | '6';

/**
 * The USM6 (Der Stammbaum ≤ V6) family relationship code, `UTYP` under
 * FAM: 1 = married, 2 = married and separated, 3 = married and
 * divorced, 4 = marriage annulled, 5 = non-marital union. Same source
 * as `UsmBirthType`; see FamilyRecord.unionKind.
 */
export type UsmUnionKind = '1' | '2' | '3' | '4' | '5';

/**
 * One Family Historian record flag: the `_FLGS` block under an
 * individual carries one child per flag, where the child tag is the
 * flag's generated tag (two underscores plus up to 13 characters of
 * the flag name) and the payload is the full flag name
 * (`__1871_CENSUS 1871 Census`). Documented in the Family Historian
 * User Group knowledge base, "GEDCOM Extension List":
 * <https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/>. See
 * IndividualRecord.recordFlags.
 */
export interface RecordFlagStructure extends GedcomStructureBase {
  /** The generated flag tag (`__…`). */
  tag: Text;
  /** The full flag name (the payload of the flag line). */
  name: Text;
}

/**
 * The Ahnenblatt internet-search block, `_INET` under INDI: the
 * structure for further details of an internet search
 * ("Struktur für weitere Details einer Internetsuche"). Documented by
 * the GenWiki "GEDCOM/_Nutzerdef-Tag" table, which lists the five
 * substructures `_MHRM`, `_MHSM`, `_MHAV`, `_RDATE` and `_SDATE`
 * (https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); the individual
 * meanings of the five tags are not separately catalogued there, so
 * their values are kept verbatim as free text. Not part of any GEDCOM
 * version. Recognized on input and written back as the `_INET` block
 * in both versions. See IndividualRecord.internetSearch.
 */
export interface InternetSearchStructure extends GedcomStructureBase {
  tag: '_INET';
  /** _MHRM {0:1} — kept verbatim (the value set is undocumented). */
  mhrm?: Text;
  /** _MHSM {0:1} — kept verbatim (the value set is undocumented). */
  mhsm?: Text;
  /** _MHAV {0:1} — kept verbatim (the value set is undocumented). */
  mhav?: Text;
  /** _RDATE {0:1} — kept verbatim ("usage like DATE"). */
  researchDate?: Text;
  /** _SDATE {0:1} — kept verbatim. */
  searchDate?: Text;
}

/**
 * The Mac Family Tree 7 source-quality block, `_QUAL` under a SOUR
 * record: the vendor's assessment of a source, split into the quality
 * of the source itself (`_SOUR`), the quality of the information in it
 * (`_INFO`) and the strength of the evidence (`_EVID`). The three
 * substructures are free text (the vendor documents no value scale).
 * Documented in the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
 * <https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag>. See
 * SourceRecord.quality.
 */
export interface MftSourceQuality extends GedcomStructureBase {
  tag: '_QUAL';
  /** _SOUR {0:1} — the quality of the source itself. */
  source?: Text;
  /** _INFO {0:1} — the quality of the information in the source. */
  information?: Text;
  /** _EVID {0:1} — the strength of the evidence in the source. */
  evidence?: Text;
}

/**
 * The Family Origins (FO7) `_CORR` correspondence block under an
 * individual: a correspondence entry with the REAS (reason), RESP
 * (response) and RPLY (reply status) children. Catalogued in the
 * Legacy "User-Defined GEDCOM Tags" help (see
 * IndividualRecord.correspondence); not part of any GEDCOM version.
 * The three children are free text (the catalogs document no value
 * sets); any other children stay generic extensions of the block.
 * Recognized on input and written back as the `_CORR` block in both
 * versions.
 */
export interface CorrespondenceStructure extends GedcomStructureBase {
  tag: '_CORR';
  /** REAS {0:1} — the reason for the correspondence. */
  reason?: Text;
  /** RESP {0:1} — the response received. */
  response?: Text;
  /** RPLY {0:1} — the reply status (the catalog documents `Y`|`N`). */
  replyStatus?: Text;
}

/**
 * One GEDCOM-L FAM F7 `_STAT` entry: the status of a marriage (NOT
 * MARRIED, NEVER MARRIED, UNKNOWN, or a user plain text) with the
 * optional DATE, PLAC, NOTE and SOUR substructures (the STATUS_STRUCTURE
 * of the GEDCOM-L agreement FAM F7 / F7.1–F7.4; see the GenWiki
 * "GEDCOM/FAM-Tag" article: https://wiki.genealogy.net/GEDCOM/FAM-Tag).
 * The agreement gives the FAM record any number of `_STAT` entries
 * (F7.4); programs writing the bare status line (Legacy Family Tree,
 * Ancestral Quest, Ages!, GEN_DO!, webtrees — see Legacy's "Custom
 * GEDCOM Tags" help:
 * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm) are the
 * single-entry, no-substructure case. Not part of any GEDCOM version.
 * Recognized on input and written back as the `_STAT` lines in both
 * versions.
 */
export interface MarriageStatusStructure extends GedcomStructureBase {
  /** The _STAT payload, {1:1} — the status text ({1:120} in F7.1). */
  payload: Text;
  /** DATE {0:1} — the period the status applies to. */
  date?: DateStructure;
  /** <<PLACE_STRUCTURE>> {0:1}. */
  place?: PlaceStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * The RootsMagic `_WEBTAG` external web link under an individual: the
 * link text (NAME) and the address (URL), written by RootsMagic (see
 * the webtrees per-vendor custom-tag registry, RootsMagic.php:
 * <https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/RootsMagic.php>).
 * Not part of any GEDCOM version. Recognized on input and written back
 * as the `_WEBTAG` block in both versions.
 */
export interface WebTagStructure extends GedcomStructureBase {
  /** NAME {0:1} — the link text. */
  name?: Text;
  /** URL {0:1} — the address of the link. Missing URL is tolerated (the full-leniency container rule). */
  url?: Text;
}

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
   * _CREAT {0:1} — the date the record was created (a free text value;
   * the wire format of GenPlus, which writes it, is undocumented, so
   * the value is kept verbatim rather than parsed into the 7.0 CREA
   * structure). Catalogued by the GEDCOM-L working group in the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" table
   * (https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_CREAT` in both versions.
   */
  createdAt?: Text;
  /**
   * _STAT {0:M} — the statuses of the marriage (Married, Unmarried,
   * …). Written by Legacy Family Tree, Ancestral Quest, Ages!, GEN_DO!
   * and webtrees under FAM as a bare status line (see Legacy's "Custom
   * GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); the
   * GEDCOM-L agreement FAM F7 additionally defines the full
   * STATUS_STRUCTURE — the status text with the optional DATE, PLAC,
   * NOTE and SOUR substructures, any number of times per family (F7.4;
   * see the GenWiki "GEDCOM/FAM-Tag" article:
   * https://wiki.genealogy.net/GEDCOM/FAM-Tag). Not part of any GEDCOM
   * version. Recognized on input and written back as the `_STAT` lines
   * in both versions. (The FTW `_MSTAT`/`_MEND` beginning and ending
   * statuses are the separate fields below.)
   */
  marriageStatuses?: MarriageStatusStructure[];
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
   * _TAG2–_TAG9 {0:1 each} — the family's named tag marks (Tag 2
   * through Tag 9), kept in order. Written by Legacy Family Tree under
   * FAM (see its "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm; the
   * INDI twin is IndividualRecord.marks); not part of any GEDCOM
   * version. Recognized on input and written back as `_TAG2`… in both
   * versions.
   */
  marks?: Text[];
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
   * _WITN {0:M} — the witnesses of the family, as free text (names,
   * not pointers): the German GEDCOM-L convention (agreement ASSO A4)
   * places the text form under the family record or the event (see the
   * GenWiki "GEDCOM/ASSO-Tag" article:
   * https://wiki.genealogy.net/GEDCOM/ASSO-Tag). Not part of any GEDCOM
   * version. Recognized on input and written back as `_WITN` in both
   * versions. (Under an event the same tag types into
   * EventDetail.witnesses.) GES2000 writes the combined godparents
   * and witnesses of the family here too, under the tag `_GODT`
   * ("Paten und Zeugen als Text", the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); recognized on
   * input and written back as `_WITN`.
   */
  witnesses?: Text[];
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
  /**
   * UTYP {0:1} — the kind of relationship the partners are in: 1 =
   * married, 2 = married and separated, 3 = married and divorced, 4 =
   * marriage annulled, 5 = non-marital union. Written by Der Stammbaum
   * ≤ V6 (USM6) under FAM; the values are documented in the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" article's "Tabelle 2" (see UsmUnionKind).
   * Not part of any GEDCOM version. Recognized in any file and
   * written back as `_UTYP` in 5.5.1; dropped on 7.0 output (7.0 cannot
   * spell a non-underscore extension tag).
   */
  unionKind?: UsmUnionKind;
  /**
   * `_UST` {0:1} — the union status of the couple (Heredis' "union
   * status" of the family: MARRIED, DIVORCED, SEPARATED, COMMON_LAW,
   * COHABITATION, ENGAGEMENT, UNKNOWN — observed in Heredis exports,
   * e.g. the corpus file "Dudouyt Heredis 2014-Export.ged", HEAD.SOUR
   * "Heredis MAC2021"; kept verbatim, the value set is not documented
   * by the vendor). GenoPro's `RELATION` under FAM carries the same
   * fact (Marriage, Divorce, CommittedRelationship, SeparationLegal,
   * Widowed, …) and normalizes into this slot. Not part of any GEDCOM
   * version. Recognized on input and written back as `_UST` in both
   * versions.
   */
  unionStatus?: Text;
  /**
   * `_FTSID` {0:1} — the family's id in the FamilySearch shared tree
   * (the Swarm family-tree packs write it under FAM too; see
   * IndividualRecord.familyTreeSystemId). Recognized on input and
   * written back as `_FTSID` in both versions.
   */
  familyTreeSystemId?: Text;
  /**
   * `_GCID` {0:1} — the record's GEDitCOM id (a UUID assigned by
   * GEDitCOM II, John A. Nairn / RSAC Software — HEAD.SOUR "GEDitCOM
   * II" in the corpus file Ajmani.ged). Not part of any GEDCOM
   * version. Recognized on input and written back as `_GCID` in both
   * versions.
   */
  geditcomId?: Text;
  /**
   * NUMB {0:1} — a running number the exporter assigns to the record
   * (`1 NUMB 1`, the French gedcom-to-xml files). Kept verbatim. Not
   * part of any GEDCOM version. Recognized on input and written back
   * as `NUMB` in both versions.
   */
  sequenceNumber?: Text;
  /**
   * `_PREF Y` {0:1} — marks the preferred family (the family of the
   * preferred parents, from the child's perspective). Written by
   * Legacy Family Tree at the FAM level — the same "_PREF = Indicates
   * a Preferred spouse, child or parents" tag it writes under
   * HUSB/WIFE/CHIL/MARR (see FamilyPartnerLink.preferred). Not part
   * of any GEDCOM version. Recognized on input and written back as
   * `_PREF Y` in both versions.
   */
  preferred?: boolean;
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
  /**
   * SLGC {0:M} — the LDS child sealings under the FAM record (see
   * ChildSealingOrdinance).
   */
  childSealings?: ChildSealingOrdinance[];
  /**
   * `_MHID` {0:1} — the family's MyHeritage family-tree identifier
   * (`family-555` in MyHeritage exports; the same tag under INDI
   * carries the person id, see IndividualRecord.myHeritageId). Not
   * part of any GEDCOM version. Recognized on input and written back
   * as `_MHID` in both versions.
   */
  myHeritageId?: Text;
  /**
   * `_CONF` {0:1} — the confidence level of the family record as a
   * whole (the family-tree-skill fixture writes PROVEN / PROBABLE
   * under FAM, https://github.com/cjcovell/family-tree-skill; the
   * same convention the Hutson data uses on sources). Not part of any
   * GEDCOM version. Recognized on input and written back as `_CONF`
   * in both versions.
   */
  confidence?: Text;
  /**
   * `_CURRENT` {0:1} — the family is the current (primary) family of
   * its members. Written with a `Y` by exports in the wild (observed
   * in the CS555 test corpora and other hand-built files). Presence
   * flag: an absent value or `Y` sets it, `N` clears it. Not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_CURRENT Y` in both versions.
   */
  current?: boolean;
  /**
   * `_PRIMARY` {0:1} — the family is the primary family of its
   * members (same source as `current`; under INDI.FAMC the same tag
   * types as ChildFamilyLink.primary). Recognized on input and
   * written back as `_PRIMARY Y` in both versions.
   */
  primary?: boolean;
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
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
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
  /** PHRASE {0:1}, g7:PHRASE (GEDCOM 7.0 §3.2.2 FAMILY_RECORD). 5.5.1 has no PHRASE slot; dropped when serializing to 5.5.1. */
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
  /**
   * _NAM {0:1} — the married name of this partner ("Ehenamen des
   * Mannes oder der Frau"), a name used like INDI.NAME. Written by
   * GES2000 under FAM.HUSB/FAM.WIFE; Legacy Family Tree writes the
   * same fact as the FAM-level `_MARRNAME` (see FamilyRecord, where
   * it attaches to whichever partner line it follows). Source: the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag. Not part of any
   * GEDCOM version. Recognized on input and written back as `_NAM` in
   * both versions.
   */
  name?: PersonalNameStructure;
  /**
   * _ZVST {0:1} — the partner's civil status at the time of the
   * marriage, free text (e.g. "verw." widowed, "ledig" unmarried).
   * Written by GES2000 under FAM.HUSB/FAM.WIFE (same source as
   * `name`). Not part of any GEDCOM version. Recognized on input and
   * written back as `_ZVST` in both versions.
   */
  civilStatus?: Text;
  /**
   * _NR {0:1} — the ordinal number of the marriage for this partner
   * ("Laufende Nummer der Ehe"). Written by GES2000 under
   * FAM.HUSB/FAM.WIFE (same source as `name`). Not part of any GEDCOM
   * version. Recognized on input and written back as `_NR` in both
   * versions.
   */
  marriageNumber?: Integer;
}

/**
 * GEDCOM 7.0 §3.2.2 FAMILY_RECORD — g7:CHIL: a pointer to a child of the family,
 * with an optional phrase.
 */
export interface FamilyChildLink extends GedcomStructureBase {
  /** The CHIL payload, {1:1} pointer to an INDI record. */
  child: Pointer<IndividualRecord>;
  /** PHRASE {0:1}, g7:PHRASE (GEDCOM 7.0 §3.2.2 FAMILY_RECORD). 5.5.1 has no PHRASE slot; dropped when serializing to 5.5.1. */
  phrase?: Text;
  /**
   * _PREF Y {0:1} — marks the preferred child. Written by Legacy
   * Family Tree (see its "Custom GEDCOM Tags" help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm); not part
   * of any GEDCOM version. Recognized on input and written back as
   * `_PREF` in both versions.
   */
  preferred?: boolean;
  /**
   * NOTE {0:M} — notes attached to the child link (GEDCOM 5.5.1
   * `CHILD_TO_FAMILY_LINK`, p.31); the character-tree `QUOT`
   * quotations normalize into this slot.
   */
  notes?: NoteStructure[];
  /**
   * SLGC {0:M} — the child's LDS sealing to the parents, written
   * under the FAM.CHIL link (see ChildSealingOrdinance).
   */
  sealings?: ChildSealingOrdinance[];
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
  /**
   * SEX {0:1}, g7:SEX — Enum of g7:enumset-SEX (M, F, X, U). The
   * GEDCOM 5.5.5 values are also accepted in any file: X (intersex;
   * also a 7.0 value) and N (not recorded; 5.5.5 §2 p.104 only). On
   * export the serializers project: 5.5.1 drops X and N (the SEX line
   * disappears), 7.0 drops N (see the `sex` projection in
   * serialize/emitter/values.ts).
   */
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
   * _CREAT {0:1} — the date the record was created (a free text value;
   * the wire format of GenPlus, which writes it, is undocumented, so
   * the value is kept verbatim rather than parsed into the 7.0 CREA
   * structure). Catalogued by the GEDCOM-L working group in the
   * GenWiki "GEDCOM/_Nutzerdef-Tag" table
   * (https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_CREAT` in both versions.
   */
  createdAt?: Text;
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
   * the same slot also accepts GES2000's `_AHNNR` (the ancestor-table
   * number, catalogued by the GEDCOM-L working group in the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). Not part of any
   * GEDCOM version. Recognized on input and written back as `_SOSA` in
   * both versions.
   */
  sosaNumber?: Text;
  /**
   * _FSFTID {0:1} — the person's FamilySearch Family Tree identifier
   * (PID, e.g. `KWJ1-2B3`), the permanent id of the person in the
   * FamilySearch shared tree. Written by Familienbuch, Legacy Family
   * Tree, Ancestral Quest, Family Historian and webtrees (catalogued
   * by the GEDCOM-L working group in the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); Mac Family Tree
   * and Familienbuch write the same value as `_FID`, and RootsMagic
   * writes the non-underscore `FSFTID` — both normalize into this
   * field. Not part of any GEDCOM version. Recognized on input and
   * written back as `_FSFTID` in both versions.
   */
  familySearchId?: Text;
  /**
   * `_FTSID` {0:1} — the person's id in the FamilySearch shared tree
   * in the UUID form written by the Swarm public-release family-tree
   * pack builder (HEAD.SOUR "SwarmFamilyTreePacks" in the samoilev_swarm
   * corpus files) — the same fact the `_FSFTID` PID spelling carries
   * (see `familySearchId`), in a different id form, so it keeps its
   * own slot. Not part of any GEDCOM version. Recognized on input and
   * written back as `_FTSID` in both versions.
   */
  familyTreeSystemId?: Text;
  /**
   * ADDR {0:1} — the person's contact address, written directly under
   * the INDI record (PAF and other exporters; neither standard has
   * the position — the 5.5.1/7.0 address lives under events).
   * Recognized on input with the full address grammar (the `_NAME`
   * label, ADR1–CTRY, contacts) and written back as the ADDR block
   * under the INDI record in 5.5.1; dropped on 7.0 output (7.0 has no
   * INDI address position either).
   */
  address?: AddressStructure;
  /**
   * `_MHID` {0:1} — the person's MyHeritage family-tree identifier
   * (`individual-12345` in MyHeritage exports; the same tag under FAM
   * carries the tree's family id, `family-555`). The MyHeritage
   * "My Heritage Family Tree" export writes it under every INDI and
   * FAM record. Not part of any GEDCOM version. Recognized on input
   * and written back as `_MHID` in both versions.
   */
  myHeritageId?: Text;
  /**
   * `_FIL` {0:1} — the person's filiation: their child status relative
   * to the parents recorded in the file. Written by Heredis under
   * every INDI record (observed in Heredis exports — e.g. the corpus
   * file "Dudouyt Heredis 2014-Export.ged", HEAD.SOUR "Heredis
   * MAC2021"); the observed value set is LEGITIMATE_CHILD,
   * NATURAL_CHILD, ADOPTED_CHILD and RELATIONSHIP_UNKNOW, kept
   * verbatim (free text; Heredis does not document the wire format —
   * the webtrees per-vendor registry lists `INDI:_FIL` as "what do
   * they mean?", https://github.com/fisharebest/webtrees, Heredis.php).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as `_FIL` in both versions.
   */
  filiation?: Text;
  /**
  /**
   * `_GCID` {0:1} — the record's GEDitCOM id (a UUID assigned by
   * GEDitCOM II, John A. Nairn / RSAC Software — HEAD.SOUR "GEDitCOM
   * II" in the corpus file Ajmani.ged). Not part of any GEDCOM
   * version. Recognized on input and written back as `_GCID` in both
   * versions.
   */
  geditcomId?: Text;
  /**
   * NUMB {0:1} — a running number the exporter assigns to the record
   * (`1 NUMB 1`, the French gedcom-to-xml files). Kept verbatim. Not
   * part of any GEDCOM version. Recognized on input and written back
   * as `NUMB` in both versions.
   */
  sequenceNumber?: Text;
  /**
   * `_MTTAG {0:M}` — pointers to the MyHeritage tree tags applied to
   * the person (`1 _MTTAG @T10@`; see TreeTagRecord). Not part of any
   * GEDCOM version. Recognized on input and written back as `_MTTAG`
   * in both versions.
   */
  treeTags?: Pointer<TreeTagRecord>[];
  /**
   * `_AMTID` {0:1} — the person's Ancestry Member Tree reference
   * (`412781982829:1030:210595317`: the tree id, family id and person
   * id RootsMagic records for its Ancestry sync; observed in real
   * RootsMagic exports). Not part of any GEDCOM version. Recognized on
   * input and written back as `_AMTID` in both versions.
   */
  ancestryMemberTreeId?: Text;
  /**
   * `_APID` {0:M} — Ancestry.com record references directly under the
   * INDI record, format `dbid::record` (in the wild often prefixed,
   * e.g. `1,7602::12345`) — the same tag and value shape the
   * citations carry (see SourceCitation.ancestryPointers). Not part
   * of any GEDCOM version (documented by TMG to GEDCOM:
   * https://tmgtogedcom.com/en/apid.htm). Recognized on input and
   * written back as `_APID` in both versions.
   */
  ancestryPointers?: Text[];
  /**
   * `_SOSADABOVILLE` {0:1} — the person's Sosa–d'Aboville number
   * (`1 G1`: the Sosa generation followed by the position letter
   * within it), the numbering Ancestris assigns in its d'Aboville
   * view (the Ancestris user guide, "Tags":
   * https://docs.ancestris.org/books/user-guide/page/tags — the same
   * page documents `_SOSA`). Kept as free text. Not part of any
   * GEDCOM version. Recognized on input and written back as
   * `_SOSADABOVILLE` in both versions.
   */
  sosaDAboville?: Text;
  /**
   * `_OCREF @xref@` {0:M} — a pointer to a shared occurrence record
   * (the glamberson gedcom-occurrences extension, see
   * OccurrenceRecord): the documented occurrence of the person in a
   * source the record describes
   * (https://github.com/glamberson/gedcom-occurrences). The pointer
   * must resolve to an existing `_OCUR` record
   * (`document.xref-not-found` otherwise). Written back as `_OCREF`
   * in both versions.
   */
  occurrences?: Pointer<OccurrenceRecord>[];
  /**
   * _TAG {0:1} and _TAG2–_TAG9 {0:1 each} — the individual's named
   * tag marks (Tag 1 through Tag 9), kept in order. Written by Legacy
   * Family Tree under INDI (see its "Custom GEDCOM Tags" help: https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_TAG`/`_TAG2`… in both versions.
   */
  marks?: Text[];
  /**
   * `_EMAIL` {0:M} — the individual's e-mail addresses. Written by
   * Brother's Keeper, Family Origins and PAF under INDI (catalogued by
   * the GEDCOM-L working group in the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * table: https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag, and the
   * Legacy "User-Defined GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version (the contact fields of the ADDRESS
   * and event structures are the standard positions). Recognized on
   * input and written back as `_EMAIL` in both versions.
   */
  email?: Text[];
  /**
   * PHON {0:M} — the individual's phone numbers, written directly
   * under the INDI record (PAF and the ged4web exports; the standard
   * positions are the event/address contacts). Not part of any GEDCOM
   * version. Recognized on input and written back as `PHON` in both
   * versions.
   */
  phone?: Text[];
  /**
   * FAX {0:M} — the individual's fax numbers, written directly under
   * the INDI record (PAF; see `phone`). Not part of any GEDCOM
   * version. Recognized on input and written back as `FAX` in both
   * versions.
   */
  fax?: Text[];
  /**
   * ISDEAD {0:1} — the person's vital flag (Y/N): the GenoPro trees
   * assert the person is dead without a DEAT event (observed in the
   * linguatree family tree, HEAD.SOUR "GenoPro"). Not part of any
   * GEDCOM version. Recognized on input and written back as
   * `ISDEAD Y`/`ISDEAD N` in both versions.
   */
  deceased?: boolean;
  /**
   * `_WLNK {0:M}` — an external web link attached to the person: the
   * TITL description and the NOTE payload carrying the URL (observed
   * in the Ancestry-family exports, e.g. nextjs-genealogy's
   * data_family.ged). Not part of any GEDCOM version. Recognized on
   * input and written back as the `_WLNK` block in both versions.
   */
  webLinks?: WebLinkStructure[];
  /**
   * OCCUPATIONS/EDUCATIONS/CONTACTS/UNIONS/TWINS {0:M} — pointers to
   * the GenoPro entity records of the person (see the
   * genopro-entity model). Recognized on input and written back as
   * the container lines in both versions.
   */
  occupations?: Pointer<OccupationRecord>[];
  educations?: Pointer<EducationRecord>[];
  contacts?: Pointer<ContactRecord>[];
  marriages?: Pointer<MarriageRecord>[];
  twins?: Pointer<TwinRecord>[];
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
  /**
   * SIGN {0:1} — the person can sign (write their name). Written by
   * Der Stammbaum ≤ V6 (USM6) under INDI with a yes/no value; the
   * meaning is documented in the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * article's "Tabelle 2" ("Person kann unterschreiben [ja/nein]"):
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag. Not part of any
   * GEDCOM version. Heredis writes the person's *signature* (free
   * text) under the same tag (the webtrees per-vendor custom-tag
   * registry, Heredis.php:
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Heredis.php)
   * — a payload that is not one of the flag spellings (`Y`, `YES`,
   * `J`/`JA`, `1` set the flag; `N`, `NO`, `NEIN`, `0` clear it) is
   * therefore kept as a generic extension of the record instead of
   * failing the import. The 5.5.1 write-back uses the underscore
   * spelling `_SIGN 1`/`_SIGN 0` (the USM6 wire spelling is a
   * non-underscore vendor tag, and 5.5.1 requires user-defined tags
   * to begin with an underscore; both spellings are recognized on
   * input); 7.0 output drops the tag.
   */
  canSign?: boolean;
  /**
   * _CORR {0:1} — the correspondence entry of Family Origins (FO7): a
   * block with the children REAS (the reason), RESP (the response) and
   * RPLY (the reply status). Catalogued in the Legacy "User-Defined
   * GEDCOM Tags" help ("Correspondence entry", with the REAS/RESP/RPLY
   * sub-tags: https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm);
   * not part of any GEDCOM version. Recognized on input and written
   * back as the `_CORR` block in both versions. (The bare
   * non-underscore REAS/RESP/RPLY under INDI are typed separately as
   * FACTs — see the legacy rules of parsing/vendor-tags.ts.)
   */
  correspondence?: CorrespondenceStructure;
  /**
   * _BKM {0:1} — the person is bookmarked. Written by Mac Family Tree
   * 7 under INDI (see the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input in both versions (the
   * presence-style flag convention: an absent value or `Y` marks the
   * flag set, `N` clears it) and written back as `_BKM Y` in both
   * versions.
   */
  bookmarked?: boolean;
  /**
   * _STP {0:1} — the start person: the individual shown first when the
   * file is opened. Written by Mac Family Tree 7 under INDI (same
   * source as `bookmarked`); not part of any GEDCOM version.
   * Recognized on input in both versions with the same presence-style
   * convention and written back as `_STP Y` in both versions.
   */
  startPerson?: boolean;
  /**
   * _ADPF {0:1} — the person was adopted by their father. Written by
   * Brother's Keeper 6+ under INDI (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" catalog:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input in both versions (the
   * presence-style flag convention: an absent value or `Y` marks the
   * flag set, `N` clears it) and written back as `_ADPF Y` in both
   * versions.
   */
  adoptedByFather?: boolean;
  /**
   * _ADPM {0:1} — the person was adopted by their mother. Written by
   * Brother's Keeper 6+ under INDI (same source and export rule as
   * `adoptedByFather`); written back as `_ADPM Y`.
   */
  adoptedByMother?: boolean;
  /**
   * _GODP {0:M} — the godparents of the individual, as free text
   * (names, not pointers): the German GEDCOM-L convention (agreement
   * ASSO A4) places the text form under the individual record or under
   * the baptism/christening event (see the GenWiki "GEDCOM/ASSO-Tag"
   * article: https://wiki.genealogy.net/GEDCOM/ASSO-Tag). Not part of
   * any GEDCOM version. Recognized on input and written back as `_GODP`
   * in both versions. (Under an event the same tag types into
   * EventDetail.godparents.)
   */
  godparents?: Text[];
  /**
   * _WITN {0:M} — the witnesses of the individual, as free text
   * (names, not pointers): the German GEDCOM-L convention (agreement
   * ASSO A4); same source and export rule as `godparents`. (Under an
   * event the same tag types into EventDetail.witnesses.)
   */
  witnesses?: Text[];
  /**
   * _WEBTAG {0:M} — external web links: the RootsMagic `_WEBTAG` block
   * with the NAME text and the URL address (see WebTagStructure and the
   * webtrees per-vendor custom-tag registry, RootsMagic.php:
   * <https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/RootsMagic.php>).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as the `_WEBTAG` blocks in both versions.
   */
  webTags?: WebTagStructure[];
  /**
   * _FLGS {0:1} — the record flags: the Family Historian marks
   * attached to an individual record, each flag a child line whose
   * double-underscore tag is generated from the flag name and whose
   * payload is the full name (see RecordFlagStructure). Documented in
   * the Family Historian User Group knowledge base, "GEDCOM Extension
   * List": <https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/>.
   * Not part of any GEDCOM version. Recognized on input and written
   * back as the `_FLGS` block in both versions.
   */
  recordFlags?: RecordFlagStructure[];
  /**
   * _INET {0:1} — the Ahnenblatt internet-search block (see
   * InternetSearchStructure): the record's internet-search details,
   * kept verbatim. Not part of any GEDCOM version. Recognized on
   * input and written back as the `_INET` block in both versions.
   */
  internetSearch?: InternetSearchStructure;
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
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
}

/**
 * The FamilySearch profile link of the Swarm family-tree packs: a
 * `_PLINK` block under an INDI.FAMC link, naming the linked profile
 * as recorded in the FamilySearch shared tree. Written by the Swarm
 * public-release family-tree pack builder (HEAD.SOUR
 * "SwarmFamilyTreePacks" in the samoilev_swarm corpus files:
 * https://github.com/samoilev_swarm); the wire format is
 * undocumented. Not part of any GEDCOM version. Recognized on input
 * and written back as the `_PLINK` block in both versions.
 */
export interface ProfileLink extends GedcomStructureBase {
  tag: '_PLINK';
  /** The _PLINK payload, {0:1} — a pointer to the linked profile's INDI record (kept verbatim; the linked person may not have a record in the file). */
  individual?: Pointer<IndividualRecord>;
  /** _FTSID {0:1} — the linked profile's FamilySearch tree id (a UUID). */
  familyTreeId?: Text;
  /** PEDI {0:1} — the pedigree kind of the link (birth, adoptive, …; the same lenient PEDI grammar the FAMC link uses). */
  pedigree?: PedigreeStructure;
  /** <<SOURCE_CITATION>> {0:M} — the citations backing the link. */
  citations?: SourceCitation[];
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
  // Note: GEDCOM 7.0's INDI.FAMC has no direct PHRASE substructure
  // (g7:INDI-FAMC := FAMC + PEDI{0:1} + STAT{0:1} +
  // <<NOTE_STRUCTURE>>{0:M}, GEDCOM 7.0 §3.2.2); a phrase describing
  // the family belongs to the PEDI or STAT children, which each carry
  // their own PHRASE {0:1}. A PHRASE directly under FAMC is not legal
  // in any version and is discarded on input.
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
   * _HUSB {0:1} — the child's status within the family on the
   * father's side. Written by Ancestral Quest under the INDI.FAMC link
   * ("used to indicate a child status within a family", the Legacy
   * "User-Defined GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm;
   * the GenWiki "GEDCOM/_Nutzerdef-Tag" table gives the position
   * INDI.FAMC: https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag). The
   * value is free text (the catalog does not document a value set).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as `_HUSB` in both versions.
   */
  fatherChildStatus?: Text;
  /**
   * _WIFE {0:1} — the child's status within the family on the
   * mother's side; the Ancestral Quest twin of `fatherChildStatus`
   * (same sources and export rule).
   */
  motherChildStatus?: Text;
  /**
   * MTYP {0:1} — the kind of parent–child relationship: 1 = marital
   * child, 2 = non-marital child, 3 = adoption without incorporation,
   * 4 = adoption with incorporation, 5 = unknown, 6 = uncertain.
   * Written by Der Stammbaum ≤ V6 (USM6) under the INDI.FAMC link; the
   * values are documented in the GenWiki "GEDCOM/_Nutzerdef-Tag"
   * article's "Tabelle 2" (see UsmParentalRelationKind). Not part of
   * any GEDCOM version. Recognized in any file and written back as
   * `MTYP` in 5.5.1; dropped on 7.0 output.
   */
  parentalRelationKind?: UsmParentalRelationKind;
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
  /**
   * _PLINK {0:M} — the FamilySearch profile links of the Swarm
   * family-tree packs, attached to the FAMC link (see ProfileLink).
   */
  profileLinks?: ProfileLink[];
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
  /** PHRASE {0:1}, g7:PHRASE (a substructure of g7:PEDI, GEDCOM 7.0 §3.2.2). 5.5.1 has no PHRASE slot; dropped when serializing to 5.5.1. */
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
  /** PHRASE {0:1}, g7:PHRASE (a substructure of g7:FAMC-STAT, GEDCOM 7.0 §3.2.2). 5.5.1 has no PHRASE slot; dropped when serializing to 5.5.1. */
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
   * DATE {0:1} — the date of the family link itself (when the link
   * was established; files in the wild write `2 DATE` under FAMS —
   * observed in the cousin-marriage exercise files). Neither standard
   * has the slot. Recognized on input and written back as `DATE`
   * under the FAMS line in both versions.
   */
  date?: DateStructure;
  // Note: GEDCOM 7.0's INDI.FAMS has no PHRASE substructure at all
  // (g7:FAMS := FAMS + <<NOTE_STRUCTURE>>{0:M}, GEDCOM 7.0 §3.2.2); a
  // PHRASE under FAMS is not legal in any version and is discarded on
  // input.
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
  /** PHRASE {0:1}, g7:PHRASE (GEDCOM 7.0 §3.2.2 INDIVIDUAL_RECORD). 5.5.1 has no PHRASE slot; dropped when serializing to 5.5.1. */
  phrase?: Text;
}

/**
 * The `_WLNK` web-link block under an INDI record (see
 * IndividualRecord.webLinks): the TITL description and the NOTE
 * payload carrying the URL.
 */
export interface WebLinkStructure extends GedcomStructureBase {
  tag: '_WLNK';
  /** TITL {0:1} — the link's description. */
  title?: Text;
  /** NOTE {0:1} — the link's URL, carried as the NOTE payload. */
  url?: Text;
}

/**
 * The Ancestry.com Family Trees media clone block: `_CLON {0:M}` under
 * the OBJE record, one per clone of the media object (the same object
 * linked from another tree or person). The wire format is
 * undocumented; the shape is taken from Ancestry's own exports — e.g.
 * the GEDCOM.NET test tree (HEAD.SOUR "Ancestry.com Family Trees",
 * VERS 2025.08): https://github.com/JasonRawlins/Gedcom (file
 * GedcomNetTestTree.ged) — where each block carries `_TID` (tree id),
 * `_PID` (person id), `_OID` (object id), `_USER` (user token, with
 * the `_ENCR` encrypted flag) and `_DATE` (clone timestamp). Not part
 * of any GEDCOM version; recognized on input and written back as the
 * `_CLON` block in both versions.
 */
export interface AncestryClone extends GedcomStructureBase {
  tag: '_CLON';
  /** _TID {0:1} — the id of the tree the clone belongs to (kept verbatim). */
  treeId?: Text;
  /** _PID {0:1} — the id of the person the clone belongs to (kept verbatim). */
  personId?: Text;
  /** _OID {0:1} — the clone's object id (a UUID). */
  objectId?: Text;
  /** _USER {0:1} — the clone's user token (kept verbatim). */
  user?: Text;
  /** _ENCR {0:1} — 1 when the clone's `_USER` token is encrypted. */
  userEncrypted?: boolean;
  /** _DATE {0:1} — the clone timestamp (kept verbatim; the wire format is undocumented). */
  date?: Text;
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
   * PLAC {0:1} — the place associated with the media object, usually
   * where a picture was taken. Written by Ancestry.com Family Trees
   * under the OBJE record with the standard PLAC tag (the webtrees
   * per-vendor custom-tag registry, Ancestry.php:
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Ancestry.php);
   * not part of any GEDCOM version. Recognized on input (like the
   * standard DATE above) and written back as `_PLAC` in both versions.
   */
  place?: Text;
  /**
   * _PRIM Y {0:1} — marks the preferred media object, the record-level
   * twin of MultimediaLink.primary (same sources). Recognized on input
   * and written back as `_PRIM` in both versions.
   */
  primary?: boolean;
  /**
   * _SCBK Y {0:1} — marks the media object for inclusion in a
   * scrapbook, the record-level twin of MultimediaLink.scrapbook (same
   * sources). Recognized on input and written back as `_SCBK` in both
   * versions.
   */
  scrapbook?: boolean;
  /**
   * _SSHOW Y {0:1} — marks the media object for inclusion in a slide
   * show, the record-level twin of MultimediaLink.slideshow (same
   * sources). Recognized on input and written back as `_SSHOW` in both
   * versions.
   */
  slideshow?: boolean;
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
  /**
   * _CREA {0:1} — the date the media object was created (a free text
   * value; the wire format is undocumented, so it is kept verbatim).
   * Written by Ancestry.com Family Trees under the OBJE record (the
   * webtrees per-vendor custom-tag registry, Ancestry.php, "Creation":
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Ancestry.php);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_CREA` in both versions.
   */
  createdAt?: Text;
  /**
   * _KEYS {0:1} — keywords of the media object. Written by Family
   * Historian under the OBJE record (the Family Historian User Group
   * knowledge base, "GEDCOM Extension List", "Multimedia: _NOTE,
   * _FILE, _DATE, _KEYS":
   * https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/); not
   * part of any GEDCOM version. Recognized on input and written back
   * as `_KEYS` in both versions.
   */
  keywords?: Text;
  /**
   * _FILE {0:1} — the path of the media file. Written by Family
   * Historian under the OBJE record (same source as `keywords`; the
   * FHUG list documents the tag and its "path" meaning). Not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_FILE` in both versions.
   */
  filePath?: Text;
  /**
   * _NOTE {0:1} — a media note. Written by Family Historian under the
   * OBJE record (same source as `keywords`). Not part of any GEDCOM
   * version. Recognized on input and written back as `_NOTE` in both
   * versions.
   */
  mediaNote?: Text;
  /**
   * _OID {0:1} — the media object's identifier, a UUID. Written by
   * Ancestry.com Family Trees under the OBJE record (the wire format
   * is undocumented; the shape is taken from Ancestry's own exports,
   * e.g. the GEDCOM.NET test tree — see AncestryClone). Not part of
   * any GEDCOM version. Recognized on input and written back as `_OID`
   * in both versions.
   */
  objectId?: Text;
  /**
   * _USER {0:1} — the token of the Ancestry user who created the media
   * object (kept verbatim; a base64-looking opaque string). Written by
   * Ancestry.com Family Trees under the OBJE record (same source as
   * `objectId`), with the `_ENCR 1` substructure marking the token
   * encrypted. Not part of any GEDCOM version. Recognized on input and
   * written back as the `_USER`/`_ENCR` pair in both versions.
   */
  user?: Text;
  /**
   * _ENCR {0:1} — 1 when the `_USER` token of this record is
   * encrypted; the substructure of `_USER` (same source as `user`).
   * Only emitted together with `user`.
   */
  userEncrypted?: boolean;
  /**
   * _ORIG {0:1} — the origin of the media object: `acom`
   * (ancestry.com), `u` (user upload), `newspapers`, `fold3`, … (kept
   * verbatim). Written by Ancestry.com Family Trees under the OBJE
   * record (same source as `objectId`). Not part of any GEDCOM
   * version. Recognized on input and written back as `_ORIG` in both
   * versions.
   */
  origin?: Text;
  /**
   * _ATL {0:1} — the attachment flag (Y/N). Written by Ancestry.com
   * Family Trees under the OBJE record (same source as `objectId`).
   * Not part of any GEDCOM version. Recognized on input (Y/N) and
   * written back as `_ATL Y` in both versions when set.
   */
  attachment?: boolean;
  /**
   * _META {0:1} — the media metadata XML block
   * (`<metadataxml>…</metadataxml>`, kept verbatim; CONC continuations
   * are merged into the value). Written by Ancestry.com Family Trees
   * under the OBJE record (same source as `objectId`). Not part of any
   * GEDCOM version. Recognized on input and written back as `_META` in
   * both versions.
   */
  metadata?: Text;
  /**
   * _DSCR {0:1} — the description of the media object (free text;
   * Ancestry writes "(Ancestry media: Description)" as the placeholder
   * of an empty description). Written by Ancestry.com Family Trees
   * under the OBJE record (same source as `objectId`). Not part of any
   * GEDCOM version. Recognized on input and written back as `_DSCR`
   * in both versions.
   */
  description?: Text;
  /**
   * _MSER {0:1} — the record is the master (original) media object;
   * its clones (the `_CLON` blocks of other records) link back to it.
   * Written by Ancestry.com Family Trees under the OBJE record as the
   * bare tag with the `_LKID` link id beneath (same source as
   * `objectId`). Not part of any GEDCOM version. Recognized on input
   * (the bare tag marks the flag) and written back as `_MSER` with
   * its `_LKID` in both versions.
   */
  master?: boolean;
  /**
   * _LKID {0:1} — the link id tying the clones to this master record
   * (a UUID, the same value as the master's `_OID`); the substructure
   * of `_MSER` (same source as `master`). Only emitted together with
   * `master`.
   */
  masterLinkId?: Text;
  /**
   * `_CUTOUT Y` {0:1} — the photo is displayed cut out (its
   * background removed). Written by MyHeritage under the media link
   * (observed in the corpus file bs.ged); not part of any GEDCOM
   * version. Recognized on input and written back as `_CUTOUT Y` in
   * both versions.
   */
  cutout?: boolean;
  /**
   * `_PRIM_CUTOUT Y` {0:1} — the primary cutout mark of the photo
   * (same source as `cutout`). Recognized on input and written back
   * as `_PRIM_CUTOUT Y` in both versions.
   */
  primaryCutout?: boolean;
  /**
   * `_PARENTPHOTO Y` {0:1} — the media object is the parent's photo
   * (same source as `cutout`). Recognized on input and written back
   * as `_PARENTPHOTO Y` in both versions.
   */
  parentPhoto?: boolean;
  /**
   * `_PERSONALPHOTO Y` {0:1} — the media object is the person's own
   * photo (same source as `cutout`). Recognized on input and written
   * back as `_PERSONALPHOTO Y` in both versions.
   */
  personalPhoto?: boolean;
  /**
   * `_PARENTRIN {0:1}` — the parent's record id (`MH:P500006`, the
   * MyHeritage person id; same source as `cutout`). Kept verbatim.
   * Recognized on input and written back as `_PARENTRIN` in both
   * versions.
   */
  parentRecordId?: Text;
  /**
   * AUTH {0:1} — the author of the media object, written with the
   * standard AUTH tag under the OBJE record (the ged4web exports,
   * e.g. the corpus file GEDs_Gresham-187.ged). Neither standard has
   * the slot. Recognized on input and written back as `AUTH` in both
   * versions.
   */
  author?: Text;
  /**
   * _CLON {0:M} — the clones of this media object (the same object
   * linked from another tree or person); see AncestryClone.
   */
  clones?: AncestryClone[];
  /**
   * TITL {0:1} — the media object's title at the record level (the
   * ged4web exports; the FILE-level TITL is MediaFile.title). Neither
   * standard has the record-level slot. Recognized on input and
   * written back as `TITL` in both versions.
   */
  title?: Text;
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
  /**
   * _SUBM {0:M} — a pointer to the submitter record of this media
   * object. Written by GDO under every record (see
   * SourceRecord.submitters); not part of any GEDCOM version.
   * Recognized on input and written back as `_SUBM` in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
}

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:FILE: a reference to an external file.
 *
 * GEDCOM 5.5.1 §2 Record Structures (p.26), `MULTIMEDIA_RECORD` — the same
 * FILE {1:M} + FORM {1:1} + TITL {0:1}; in 5.5.1 the medium is classified
 * by FILE.FORM.TYPE (`SOURCE_MEDIA_TYPE`) instead of FILE.FORM.MEDI, and
 * TRAN is 7.0-only.
 */
/**
 * A `FILE` directly under a SOUR record (see SourceRecord.files): the
 * path of a media file attached to the source without a separate OBJE
 * record. Neither standard has the slot; the form is the bare path.
 */
export interface SourceFileStructure extends GedcomStructureBase {
  tag: 'FILE';
  /** The FILE payload, {1:1} FilePath — the media file path. */
  payload: FilePath;
}

export interface MediaFile extends GedcomStructureBase {  /** The FILE payload, {1:1} FilePath — the media file path. A bare FILE line (no payload) is tolerated as the empty path: Ancestry.com Family Trees writes it with FORM/TITL substructures and no file name; it is written back as the bare FILE line. */
  payload: FilePath;
  /** FORM {0:1}, g7:FORM — the media type of the file. Missing FORM is tolerated (the full-leniency container rule). */
  form?: MediaFormatStructure;
  /** TITL {0:1}, g7:TITL — a title of the file. */
  title?: Text;
  /**
   * `_TEXT`/TEXT {0:1} — the file's transcription text (the FTM
   * embedded-media shape writes it under the FILE line). Neither
   * standard has the slot. Recognized on input and written back as
   * `_TEXT` under the FILE line in both versions.
   */
  text?: Text;
  /**
   * `_DATE`/DATE {0:1} — the file's date (FTM writes the file
   * modification timestamp under the FILE line: `2 _DATE 5/20/2017
   * 1:51:01 PM`, kept verbatim). Neither standard has the slot.
   * Recognized on input and written back as `_DATE` under the FILE
   * line in both versions.
   */
  date?: Text;
  /**
   * _CTYP {0:1} — the content type of the picture (person, group,
   * place, signature, tombstone, document, heirloom). Written by
   * Ahnenblatt under OBJE.FILE (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input and written back as `_CTYP`
   * under the FILE line in both versions.
   */
  contentType?: Text;
  /**
   * _ALTPATH {0:1} — an alternative or relative file path, without
   * the file name ("alternativer bzw. relativer Dateipfad ohne
   * Dateinamen"). Written by Ahnenblatt under OBJE.FILE (same source
   * as `contentType`); not part of any GEDCOM version. Recognized on
   * input and written back as `_ALTPATH` under the FILE line in both
   * versions.
   */
  alternatePath?: Text;
  /**
   * `_FILESIZE {0:1}` — the size of the media file in bytes. Written
   * by Family Tree Builder under the OBJE record and by MyHeritage
   * under the inline OBJE (`2 _FILESIZE 406254`; the webtrees
   * per-vendor custom-tag registry, FamilyTreeBuilder.php, "File
   * size"). Not part of any GEDCOM version. Recognized on input and
   * written back as `_FILESIZE` in both versions.
   */
  fileSize?: Integer;
  /**
   * `_ALBUM {0:1}` — the XREF of the album the media file belongs to
   * (a `@A…@` identifier; real exports carry dangling references, so
   * the value is kept verbatim, unresolved). Written by Family Tree
   * Builder and MyHeritage under the OBJE (the webtrees per-vendor
   * custom-tag registry, FamilyTreeBuilder.php, "Album — XREF to an
   * album"). Not part of any GEDCOM version. Recognized on input and
   * written back as `_ALBUM` in both versions.
   */
  album?: Text;
  /**
   * `_PHOTO_RIN {0:1}` — the record id of the photo in the exporting
   * system (MyHeritage exports: `2 _PHOTO_RIN MH:P500064`; the
   * webtrees per-vendor custom-tag registry, FamilyTreeBuilder.php,
   * "Record ID number"). Not part of any GEDCOM version. Recognized
   * on input and written back as `_PHOTO_RIN` in both versions.
   */
  recordId?: Text;
  /** TRAN {0:M}, g7:FILE-TRAN — the same content in a different digital format. */
  translations?: MediaFileTranslation[];
}

/**
 * GEDCOM 7.0 §3.2.2 MULTIMEDIA_RECORD — g7:FORM: the media type of the file
 * referenced by the superstructure, with an optional medium.
 */
export interface MediaFormatStructure extends GedcomStructureBase {
  /**
   * The FORM payload, {1:1} MediaType. 7.0 files carry an RFC 2045
   * media type; a 5.x file carries one of the fixed
   * `MULTIMEDIA_FORMATS_551` extensions, or one of the 17 GEDCOM
   * 5.5.5 formats (5.5.5 §2 p.94–95). On 5.5.1 output only the seven
   * 5.5.1 formats can be named (plus the RFC 2045 types that map onto
   * them): a 5.5.5-only format (`PNG`, `PDF`, …) has no 5.5.1
   * spelling, so the whole FILE is dropped on 5.5.1 export (see
   * emitMediaFile). 7.0 output writes the payload verbatim.
   */
  payload: MediaType;
  /** MEDI {0:1}, g7:MEDI — Enum of g7:enumset-MEDI; the medium from which the file was derived. */
  medium?: MediaStructure;
  /**
   * _MTYPE {0:1} — the display kind of the media: `portrait`,
   * `document`, `headstone`, `story`, `place`, `newspaperarticle`,
   * `marriagecertificate`, `obituary`, … (free text, kept verbatim).
   * Written by Ancestry.com Family Trees under OBJE.FILE.FORM (the
   * wire format is undocumented; the shape is taken from Ancestry's
   * own exports — the GEDCOM.NET test tree:
   * https://github.com/JasonRawlins/Gedcom, GedcomNetTestTree.ged).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as `_MTYPE` under the FORM line in both versions.
   */
  kind?: Text;
  /**
   * _STYPE {0:1} — the stored encoding of the file: `jpeg`, `png`,
   * `pjpeg`, `x-inline` (the inline story text), `pdf`, `msword`, …
   * (free text, kept verbatim). Written by Ancestry.com Family Trees
   * under OBJE.FILE.FORM (same source as `kind`). Not part of any
   * GEDCOM version. Recognized on input and written back as `_STYPE`
   * under the FORM line in both versions.
   */
  storageType?: Text;
  /**
   * _SIZE {0:1} — the size of the media file in bytes. Written by
   * Ancestry.com Family Trees under OBJE.FILE.FORM (same source as
   * `kind`). Not part of any GEDCOM version. Recognized on input and
   * written back as `_SIZE` under the FORM line in both versions.
   */
  size?: Integer;
  /**
   * _WDTH {0:1} — the width of the picture in pixels. Written by
   * Ancestry.com Family Trees under OBJE.FILE.FORM (same source as
   * `kind`). Not part of any GEDCOM version. Recognized on input and
   * written back as `_WDTH` under the FORM line in both versions.
   */
  width?: Integer;
  /**
   * _HGHT {0:1} — the height of the picture in pixels. Written by
   * Ancestry.com Family Trees under OBJE.FILE.FORM (same source as
   * `kind`). Not part of any GEDCOM version. Recognized on input and
   * written back as `_HGHT` under the FORM line in both versions.
   */
  height?: Integer;
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
  /** PHON {0:M}, g7:PHON — in 7.0 the repository's phone numbers; in 5.5.1/5.5.5 the ADDRESS_STRUCTURE position (PHON {0:3} inside the address block, GEDCOM 5.5.1 §2 p.31). The 5.5.1 serializer writes them into the address block; with no address block there is no 5.5.1 slot and they are dropped. */
  phone?: Special[];
  /**
   * EMAIL {0:M}, g7:EMAIL — 7.0 position; 5.5.1/5.5.5 keep it in the
   * ADDRESS_STRUCTURE. Same serialization relocation as `phone`. The
   * Family Historian spelling `_EMAIL` under the record (up to V6.2 —
   * see the FHUG "GEDCOM Extension List":
   * https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/)
   * normalizes into this slot; with no address block the 5.5.1
   * serializer writes it back as `_EMAIL`.
   */
  email?: Special[];
  /** FAX {0:M}, g7:FAX — 7.0 position; 5.5.1/5.5.5 keep it in the ADDRESS_STRUCTURE. Same serialization relocation as `phone`; with no address block there is no 5.5.1 slot and it is dropped. */
  fax?: Special[];
  /**
   * WWW {0:M}, g7:WWW — 7.0 position; 5.5.1/5.5.5 keep it in the
   * ADDRESS_STRUCTURE. Same serialization relocation as `phone`. The
   * Family Historian spelling `_WEB` under the record (up to V6.2; same
   * source as `email`) normalizes into this slot; with no address
   * block the 5.5.1 serializer writes it back as `_WEB`.
   */
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
  /**
   * _SUBM {0:M} — a pointer to the submitter record of this
   * repository. Written by GDO under every record (see
   * SourceRecord.submitters); not part of any GEDCOM version.
   * Recognized on input and written back as `_SUBM` in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
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
  /**
   * _SUBM {0:M} — a pointer to the submitter record of this shared
   * note. Written by GDO under every record (see
   * SourceRecord.submitters); not part of any GEDCOM version.
   * Recognized on input and written back as `_SUBM` in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
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
  /** <<CREATION_DATE>> {0:1} — 7.0-only; written back as `_CRE` in 5.5.1. */
  creationDate?: CreationDate;
  /**
   * RIN {0:1} — a record identification number assigned by the source
   * system. GEDCOM 5.5.1 §2 (p.43). Removed in GEDCOM 7.0; dropped when
   * serializing to 7.0.
   */
  automatedRecordId?: Text;
  /**
   * `_GCID` {0:1} — the record's GEDitCOM id (see
   * IndividualRecord.geditcomId). Recognized on input and written
   * back as `_GCID` in both versions.
   */
  geditcomId?: Text;
  /**
   * _SUBM {0:M} — a pointer to the submitter record of this note.
   * Written by GDO under every record (see SourceRecord.submitters);
   * not part of any GEDCOM version. Recognized on input and written
   * back as `_SUBM` in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
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
  /**
   * TITL {0:1} — the pointer form of the title: a pointer to an
   * Ancestris `TITL` record (see TitleRecord). The kennedy sample in
   * the corpus writes `1 TITL @R5@` under the SOUR record, with the
   * bibliography carried by the title record. Recognized on input and
   * written back as the pointer TITL line in both versions.
   */
  titlRef?: Pointer<TitleRecord>;
  /**
   * DATE {0:1} — the date of the source record itself. Written by the
   * Canvas Roots exports (`1 DATE 1910` under `0 @S1@ SOUR`, the
   * gedcom-sample-medium-sources fixture in the corpus); no GEDCOM
   * version has a DATE slot under SOUR. Recognized on input and
   * written back as a DATE line in both versions.
   */
  date?: DateStructure;
  /**
   * PLAC {0:1} — the place of the source record itself (the same
   * Canvas Roots shape as SourceRecord.date). Recognized on input and
   * written back as a PLAC line in both versions.
   */
  place?: PlaceStructure;
  /** ABBR {0:1}, g7:ABBR — a short name used for sorting, filing, and retrieving records. */
  abbreviation?: Text;
  /**
   * Underscore extensions of the AUTH line, kept beside the field so
   * the original nesting survives the round trip (the leaf payload
   * fields have no standard substructures; see parsing/sources.ts).
   * Written back under AUTH in both versions.
   */
  authorExtensions?: ExtensionStructure[];
  /** Underscore extensions of the TITL line; same convention as `authorExtensions`. */
  titleExtensions?: ExtensionStructure[];
  /** Underscore extensions of the ABBR line; same convention as `authorExtensions`. */
  abbreviationExtensions?: ExtensionStructure[];
  /**
   * _SUBQ {0:1} — the format used for subsequent citations of the
   * source, written by RootsMagic under the SOUR record (the
   * record-level twin of SourceCitation.subsequentCitationFormat; the
   * webtrees per-vendor custom-tag registry, RootsMagic.php, labels it
   * "Abbreviation":
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/RootsMagic.php).
   * Not part of any GEDCOM version. Recognized on input and written
   * back as `_SUBQ` in both versions.
   */
  subsequentCitationFormat?: Text;
  /**
   * _BIBL {0:1} — the source's bibliography entry, written by
   * RootsMagic under the SOUR record (same source as
   * `subsequentCitationFormat`). Not part of any GEDCOM version.
   * Recognized on input and written back as `_BIBL` in both versions.
   */
  bibliography?: Text;
  /**
   * MEDI {0:1} — the media type of the source (the webtrees
   * per-vendor custom-tag registry, Legacy.php, "Media type":
   * https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Legacy.php;
   * written by Legacy Family Tree under the SOUR record with the
   * standard tag in a non-standard position — neither the 5.5.1 nor
   * the 7.0 SOURCE_RECORD has a MEDI slot, and 7.0 §1.5 requires
   * extension tags to be underscore-prefixed). The value is free text
   * (in practice the 7.0 enumset-MEDI vocabulary). Not part of any
   * GEDCOM version. Recognized in any file as `MEDI` and in both
   * versions as `_MEDI`; written back as `_MEDI` in both versions.
   */
  medium?: Text;
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
   * 5.5.1 (the 5.5.1 PUBL is a bare text payload with no
   * substructures, so the details have no 5.5.1 slot).
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
  /**
   * `_URL` {0:1} — the web address of the source. Written by the
   * Hutson family-tree data under the SOUR record (the writing
   * project's own data dictionary, in the file header: "_URL = web
   * address of the source", https://github.com/CuriousG102/family-tree);
   * the webtrees per-vendor custom-tag registry types the standard
   * `URL` under SOUR the same way (PhpGedView.php). Not part of any
   * GEDCOM version. Recognized on input and written back as `_URL` in
   * both versions.
   */
  url?: Text;
  /**
   * `_CONF` {0:1} — the confidence level of the source (the Hutson
   * convention, same source as `url`: Primary / Secondary / Tentative
   * / Provided). Not part of any GEDCOM version. Recognized on input
   * and written back as `_CONF` in both versions.
   */
  confidence?: Text;
  /**
   * `_ACC` {0:1} — the date the source was accessed (the Hutson
   * convention, same source as `url`; the values are ISO-style
   * `2026-07-11`, kept as free text). Not part of any GEDCOM version.
   * Recognized on input and written back as `_ACC` in both versions.
   */
  accessDate?: Text;
  /**
   * `_APID` {0:M} — Ancestry.com record references at the record
   * level, format `dbid::record` (in the wild often prefixed, e.g.
   * `1,1030::0`) — the same tag and value shape the citations carry
   * (see SourceCitation.ancestryPointers; written by Ancestry tree
   * downloads under the SOUR record too). Not part of any GEDCOM
   * version (documented by TMG to GEDCOM:
   * https://tmgtogedcom.com/en/apid.htm). Recognized on input and
   * written back as `_APID` in both versions.
   */
  ancestryPointers?: Text[];
  /**
   * `_FTSID` {0:1} — the source's id in the FamilySearch shared tree,
   * the UUID form written by the Swarm public-release family-tree
   * pack builder under the SOUR record (see
   * IndividualRecord.familyTreeSystemId). Not part of any GEDCOM
   * version. Recognized on input and written back as `_FTSID` in both
   * versions.
   */
  familyTreeSystemId?: Text;
  /**
   * `_WEBTAG {0:M}` — an external web link attached to the source
   * record: the NAME link text plus the URL address (the same
   * RootsMagic block the individuals carry, written under SOUR too;
   * see WebTagStructure). Not part of any GEDCOM version. Recognized
   * on input and written back as the `_WEBTAG` block in both
   * versions.
   */
  webTags?: WebTagStructure[];
  /**
   * FILE {0:M} — media files attached directly to the source record
   * (a file path without a separate OBJE record; the obsidian
   * charted-roots fixture writes the census images this way,
   * https://github.com/banisterious/obsidian-charted-roots). Neither
   * standard has a FILE slot under SOUR. Recognized on input and
   * written back as `FILE` under the SOUR record in both versions.
   */
  files?: SourceFileStructure[];
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
  /**
   * `_ITALIC Y` {0:1} — marks the source title for printing in italics
   * on reports. Written by Legacy Family Tree and Ancestral Quest (see
   * Legacy's "Custom GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm, and
   * the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input (an absent value, `Y`, or
   * `YES` marks the flag set; `N`/`NO` clears it) and written back as
   * `_ITALIC Y` in both versions.
   */
  titleItalic?: boolean;
  /**
   * `_PAREN` {0:1} — marks the publication facts of the source for
   * printing within parentheses on reports. Written by Legacy Family
   * Tree and Ancestral Quest (same sources as `titleItalic`); not part
   * of any GEDCOM version. Recognized on input with the same value
   * convention as `titleItalic` (the Legacy catalog documents the bare
   * tag) and written back as `_PAREN Y` in both versions.
   */
  publicationParenthesized?: boolean;
  /**
   * `_QUOTED Y` {0:1} — marks the source title for printing within
   * quotes on reports. Written by Legacy Family Tree and Ancestral
   * Quest (same sources as `titleItalic`); not part of any GEDCOM
   * version. Recognized on input with the same value convention as
   * `titleItalic` and written back as `_QUOTED Y` in both versions.
   */
  titleQuoted?: boolean;
  /**
   * `_TAG YES`/`_TAG NO` {0:1} — include or exclude the source
   * citation detail on reports. Written by Legacy Family Tree under a
   * SOUR record (its "Custom GEDCOM Tags" help documents the two
   * value spellings: "_TAG NO - When used under a SOUR record,
   * indicates to exclude the source citation detail on reports":
   * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm).
   * Not part of any GEDCOM version (the same tag names under an INDI
   * record are the tag marks of IndividualRecord.marks; under an
   * address or place they mark a "tagged" item, a meaning the catalog
   * does not document beyond the tag itself — a bare tag without a
   * value is likewise not typed and stays a generic extension).
   * Recognized on input with the value required (`Y`/`YES` includes,
   * `N`/`NO` excludes) and written back as `_TAG YES`/`_TAG NO` in
   * both versions.
   */
  citationDetailIncluded?: boolean;
  /**
   * `_TAG2 YES`/`_TAG2 NO` {0:1} — include or exclude the source
   * citation itself on reports. Written by Legacy Family Tree under a
   * SOUR record ("_TAG2 NO - … indicates to exclude the source
   * citation on reports"; same source and export rule as
   * `citationDetailIncluded`).
   */
  citationIncluded?: boolean;
  /**
   * `_TAG3 YES`/`_TAG3 NO` {0:1} — include or exclude the source
   * citation detail text on reports. Written by Legacy Family Tree
   * under a SOUR record ("_TAG3 YES - … indicates to include the
   * source citation detail text on reports"; same source and export
   * rule as `citationDetailIncluded`).
   */
  citationDetailTextIncluded?: boolean;
  /**
   * `_TAG4 YES`/`_TAG4 NO` {0:1} — include or exclude the source
   * citation detail notes on reports. Written by Legacy Family Tree
   * under a SOUR record ("_TAG4 YES - … indicates to include the
   * source citation detail notes on reports"; same source and export
   * rule as `citationDetailIncluded`).
   */
  citationDetailNotesIncluded?: boolean;
  /**
   * _TYPE {0:1} — the type of the source record (Census, Birth
   * Certificate, …), the Family Historian classification of a source.
   * Documented in the Family Historian User Group knowledge base,
   * "GEDCOM Extension List":
   * <https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/>.
   * Not part of any GEDCOM version (under an OBJE record the same tag
   * is the media object kind, MultimediaRecord.objectType). Recognized
   * on input and written back as `_TYPE` in both versions.
   */
  sourceType?: Text;
  /**
   * _MASTER {0:1} — the source is to appear in the Master listing of
   * the program. Written by Ancestral Quest under a SOUR record
   * ("indicates source is to appear in Master listing", the Legacy
   * "User-Defined GEDCOM Tags" help:
   * https://www.legacyfamilytree.se/WEB_US/user_defined_gedcom_tags.htm).
   * Not part of any GEDCOM version. Recognized on input (the
   * presence-style flag convention: an absent value or `Y` marks the
   * flag set, `N` clears it) and written back as `_MASTER Y` in both
   * versions.
   */
  masterListing?: boolean;
  /**
   * _QUAL {0:1} — the Mac Family Tree 7 quality assessment of the
   * source: the `_SOUR`/`_INFO`/`_EVID` children rate the source
   * itself, the information in it, and the evidence (see
   * MftSourceQuality). Not part of any GEDCOM version. Recognized on
   * input in both versions and written back as the `_QUAL` block in
   * both versions.
   */
  quality?: MftSourceQuality;
  /**
   * _URKU {0:1} — "evidence of the event is available"
   * ("Ereignisnachweis liegt vor"), a presence flag. Written by
   * PC-AHNEN under a SOUR record (see the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input (the presence-style flag
   * convention: an absent value or `Y` marks the flag set, `N` clears
   * it) and written back as `_URKU Y` in both versions.
   */
  evidenceAvailable?: boolean;
  /**
   * _JAG {0:1} — the volume year of the source ("Jahrgang einer
   * Quelle"), free text. Written by GenPlus under a SOUR record (same
   * source as `evidenceAvailable`); not part of any GEDCOM version.
   * Recognized on input and written back as `_JAG` in both versions.
   */
  volumeYear?: Text;
  /**
   * _SUBM {0:M} — a pointer to the submitter record of this source.
   * Written by GDO under every record ("Zeiger auf Einreicher-DS",
   * the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version (FAM and INDI carry the same fact in the standard
   * SUBM {0:M} slot). Recognized on input and written back as `_SUBM`
   * in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the cross-reference of this record in the file it
   * was imported from, with a PAGE child holding the id of the
   * imported file. Written by GDO at level 1 of every record ("XREF
   * for record of imported file with subtag PAGE: ID of record", same
   * source as `submitters`); not part of any GEDCOM version.
   * Recognized on input and written back as the `_IMPF` block in both
   * versions.
   */
  importReference?: ImportFileReference;
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
  /** <<PLACE_STRUCTURE>> {0:1}. The 5.5.1 spelling is the bare `SOURCE_JURISDICTION_PLACE` (GEDCOM 5.5.1 §2 p.27), so on 5.5.1 output only the payload is written and the 7.0 place substructures (FORM/MAP/NOTE/…) are dropped. */
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
  /** PHON {0:M}, g7:PHON — in 7.0 the submitter's phone numbers; in 5.5.1/5.5.5 the ADDRESS_STRUCTURE position (PHON {0:3} inside the address block, GEDCOM 5.5.1 §2 p.31). The 5.5.1 serializer writes them into the address block; with no address block there is no 5.5.1 slot and they are dropped. */
  phone?: Special[];
  /**
   * EMAIL {0:M}, g7:EMAIL — 7.0 position; 5.5.1/5.5.5 keep it in the
   * ADDRESS_STRUCTURE. Same serialization relocation as `phone`. The
   * Family Historian spelling `_EMAIL` under the record (up to V6.2 —
   * see the FHUG "GEDCOM Extension List":
   * https://www.fhug.org.uk/kb/kb-article/gedcom-extension-list/)
   * normalizes into this slot; with no address block the 5.5.1
   * serializer writes it back as `_EMAIL`.
   */
  email?: Special[];
  /** FAX {0:M}, g7:FAX — 7.0 position; 5.5.1/5.5.5 keep it in the ADDRESS_STRUCTURE. Same serialization relocation as `phone`; with no address block there is no 5.5.1 slot and it is dropped. */
  fax?: Special[];
  /**
   * WWW {0:M}, g7:WWW — 7.0 position; 5.5.1/5.5.5 keep it in the
   * ADDRESS_STRUCTURE. Same serialization relocation as `phone`. The
   * Family Historian spelling `_WEB` under the record (up to V6.2; same
   * source as `email`) normalizes into this slot; with no address
   * block the 5.5.1 serializer writes it back as `_WEB`.
   */
  www?: Special[];
  /**
   * `_SKYPEID` {0:1} — the submitter's Skype identifier. The official
   * FamilySearch GEDCOM 7.0 maximal sample declares the tag in its
   * SCHMA block as the FOAF `skypeID` property
   * (http://xmlns.com/foaf/0.1/skypeID, the FOAF Vocabulary
   * Specification: http://xmlns.com/foaf/spec/) and writes it under
   * the SUBM record. Not part of any GEDCOM version. Recognized on
   * input and written back as `_SKYPEID` in both versions.
   */
  skypeId?: Text;
  /**
   * `_JABBERID` {0:1} — the submitter's Jabber/XMPP identifier. The
   * official FamilySearch GEDCOM 7.0 maximal sample declares the tag
   * in its SCHMA block as the FOAF `jabberID` property
   * (http://xmlns.com/foaf/0.1/jabberID, same source as `skypeId`)
   * and writes it under the SUBM record. Not part of any GEDCOM
   * version. Recognized on input and written back as `_JABBERID` in
   * both versions.
   */
  jabberId?: Text;
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
  /**
   * `_GCID` {0:1} — the record's GEDitCOM id (see
   * IndividualRecord.geditcomId). Recognized on input and written
   * back as `_GCID` in both versions.
   */
  geditcomId?: Text;
  /**
   * _SUBM {0:M} — a pointer to another submitter record. Written by
   * GDO under every record (see SourceRecord.submitters); not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_SUBM` in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
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
  /**
   * _SUBM {0:M} — a pointer to the submitter record of this
   * submission. Written by GDO under every record (see
   * SourceRecord.submitters); not part of any GEDCOM version.
   * Recognized on input and written back as `_SUBM` in both versions.
   */
  submitters?: Pointer<SubmitterRecord>[];
  /**
   * _IMPF {0:1} — the GDO import-file reference (see
   * ImportFileReference): the record's cross-reference in the file it
   * was imported from. Recognized on input and written back as the
   * `_IMPF` block in both versions.
   */
  importReference?: ImportFileReference;
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
  | ExtensionRecord;
