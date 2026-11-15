import type { RestrictionEnum } from '../enumerations';
import type { Xref, Integer, ListEnum, Pointer, Text } from '../primitives';
import type { AssociationStructure } from './common';
import type { ChangeDate } from './common';
import type { CreationDate } from './common';
import type { EvidenceReference, OccurrenceReference, TagLink } from './evidence-record';
import type { FamilyAttributeStructure } from './family-structures';
import type { FamilyEventStructure } from './family-structures';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { ImportFileReference } from './common';
import type { MultimediaLink } from './sources-media';
import type { NonEventStructure } from './common';
import type { NoteStructure } from './common';
import type { PersonalNameStructure } from './names-places';
import type { SourceCitation } from './sources-media';
import type { SpouseSealingOrdinance, ChildSealingOrdinance } from './lds';
import type { TodoStructure } from './todo-record';
import type { UsmUnionKind, MarriageStatusStructure } from './vendor-structures';
import type { IndividualRecord } from './individual-record';
import type { PedigreeStructure } from './individual-links';
import type { SubmitterRecord } from './submitter-record';

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
  /**
   * `_OCREF @xref@` {0:M} — the family's references to shared
   * occurrence records (the gedcom-occurrences extension lists FAM as
   * an `_OCREF` superstructure; see IndividualRecord.occurrences).
   * Written back as `_OCREF` in both versions.
   */
  occurrences?: OccurrenceReference[];
  /**
   * `_EVREF @xref@` {0:M} — the references to floating evidence
   * records (the gedcom-evidence `_EVREF.yaml` lists FAM as a
   * superstructure; the v1 `_EVID` link spelling normalizes into the
   * same slot). Written back as `_EVREF` in both versions.
   */
  evidence?: EvidenceReference[];
  /**
   * `_TAG @xref@` {0:M} — the organizational tags applied to the
   * record (the gedcom-tags extension; see TagLink). Written back in
   * both versions.
   */
  tagLinks?: TagLink[];
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
  /**
   * PEDI {0:M} — the pedigree kind of the child link, written under
   * FAM.CHIL — a position neither standard defines (both keep PEDI on
   * the INDI.FAMC link). Observed in the MacFamilyTree exports (a
   * single lowercase `2 PEDI birth`, the bechbd gedcomimport samples
   * and the Synium MobileFamilyTree fixtures) and in the per-parent
   * spelling of the slaktforskning swedish-royal examples: one PEDI
   * per parent, each with a `3 _PARENT @I…@` pointer naming the parent
   * it describes. Recognized on input; both exports project an
   * agreeing value onto the child's INDI.FAMC.PEDI when that link's
   * PEDI is still empty (the `_FREL`/`_MREL` rule), and drop
   * non-agreeing entries and the per-parent `_PARENT` distinction —
   * neither target grammar defines PEDI under CHIL (see
   * FamilyChildPedigree).
   */
  pedigrees?: FamilyChildPedigree[];
}

/**
 * One PEDI entry under FAM.CHIL (see FamilyChildLink.pedigrees): the
 * pedigree structure with the optional `_PARENT` pointer to the parent
 * the entry describes (the slaktforskning swedish-royal examples; the
 * MacFamilyTree exports write a single entry without the pointer). Not
 * part of any GEDCOM version. The FAM.CHIL-position lines are never
 * written: both exports project an agreeing value onto the child's
 * INDI.FAMC.PEDI and drop the `_PARENT` distinction (see
 * projectChildPedigrees in serialize/prepare.ts).
 */
export interface FamilyChildPedigree extends GedcomStructureBase {
  tag: 'PEDI';
  /** The PEDI payload and PHRASE — the same grammar the FAMC-link PEDI uses. */
  pedigree: PedigreeStructure;
  /** `_PARENT` {0:1} — the parent this pedigree entry refers to. */
  parent?: Pointer<IndividualRecord>;
}
