import type { FamilyChildStatusEnum, PedigreeEnum } from '../enumerations';
import type { Pointer, Text } from '../primitives';
import type { DateStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { NoteStructure } from './common';
import type { SourceCitation } from './sources-media';
import type { UsmParentalRelationKind } from './vendor-structures';
import type { FamilyRecord } from './family-record';
import type { IndividualRecord } from './individual-record';

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
