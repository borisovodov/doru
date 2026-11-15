import type { Text } from '../primitives';
import type { DateStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { NoteStructure } from './common';
import type { PlaceStructure } from './names-places';
import type { SourceCitation } from './sources-media';

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
