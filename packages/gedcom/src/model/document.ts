import type {
  Language,
  ListText,
  Pointer,
  Special,
  TagDefinitionValue,
  Text,
} from '../primitives';

import type { AddressStructure } from './common';
import type { DateExactStructure } from './common';
import type { GedcomRecord } from './records';
import type { GedcomStructureBase } from './extensions';
import type { IndividualRecord } from './records';
import type { NoteStructure } from './common';
import type { SubmissionRecord } from './records';
import type { SubmitterRecord } from './records';

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
 * carries SUBN, FILE, CHAR (required) and GEDC.FORM (required). CHAR is
 * validated strictly on input and used to select the decoder, but is not
 * stored in the model (which is post-decode and always UTF-8).
 */
export interface Header extends GedcomStructureBase {
  tag: 'HEAD';
  /** GEDC {1:1}, g7:GEDC — identifies the specification this document conforms to. GEDCOM 7.0 §3.2.1. */
  gedcom: Gedcom;
  /** SCHMA {0:1}, g7:SCHMA — the meaning of the extension tags used in the document. GEDCOM 7.0 §3.2.1, §1.5. Dropped when serializing to 5.5.1. */
  schema?: Schema;
  /**
   * SCHEMA {0:1} — the user-tag declaration block of GEDCOM 5.3
   * (dropped in 5.4, still written by Family Tree Maker in 5.5.1
   * files; the vendor spelling `_SCHEMA` normalizes to this). The
   * GEDCOM-L working group's N5 header declarations — a `_SCHEMA`
   * block whose leaves are `_DEFN <definition>` lines (the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" article documents the form:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag) — parse into
   * the same block (the `_DEFN` spelling normalizes to the DEFN
   * leaf). Kept as opaque metadata: the context chains and their
   * LABL/DEFN/ISA leaves have no genealogical meaning. Recognized in
   * any file and written back as `SCHEMA` in 5.5.1 and as `_SCHEMA`
   * in 7.0 (7.0's own SCHMA carries URIs, which this block lacks, so
   * it travels as an extension record there). Sources: the GEDCOM 5.3
   * draft (`USER_TAG_SCHEMA`, p.25–26 of the Tamura Jones PDF) and
   * Tamura Jones "GEDCOM Tags":
   * https://www.tamurajones.net/GEDCOMTags.xhtml
   */
  schema53?: FtmSchemaBlock;
  /** SOUR {0:1}, g7:HEAD-SOUR — the product producing this dataset. GEDCOM 7.0 §3.2.1; required {1:1} in 5.5.1. */
  source?: HeaderSource;
  /** DEST {0:1}, g7:DEST — an identifier for the system expected to receive this document. GEDCOM 7.0 §3.2.1. */
  destination?: Special;
  /** DATE {0:1}, g7:HEAD-DATE — the DateExact this document was created. GEDCOM 7.0 §3.2.1. */
  date?: DateExactStructure;
  /** SUBM {0:1}, g7:SUBM — the submitter of the dataset. GEDCOM 7.0 §3.2.1; required {1:1} in 5.5.1. Written in both versions; when serializing to 5.5.1 a missing or void pointer is filled from an existing SUBM record or a synthesized one named "Unknown". */
  submitter?: Pointer<SubmitterRecord>;
  /**
   * NAME {0:1} — a name under the HEAD.SUBM pointer line. The Family
   * Echo exports write `1 SUBM @I1@` / `2 NAME rclark3@stevens.edu`
   * — the submitter's contact carried as the NAME child of the
   * pointer (no GEDCOM version has a NAME slot there). Recognized on
   * input and written back as the NAME line under the SUBM line in
   * both versions.
   */
  submitterName?: Text;
  /**
   * SUBN {0:1} — a pointer to the submission record.
   * GEDCOM 5.5.1 §2 Record Structures (p.23). Removed in GEDCOM 7.0;
   * dropped when serializing to 7.0.
   */
  submission?: Pointer<SubmissionRecord>;
  /**
   * FILE {0:1} — the name of the GEDCOM transmission file.
   * GEDCOM 5.5.1 §2 Record Structures (p.23). Removed in GEDCOM 7.0;
   * dropped when serializing to 7.0.
   */
  fileName?: Text;
  /** COPR {0:1}, g7:COPR — a copyright statement. GEDCOM 7.0 §3.2.1. */
  copyright?: Text;
  /** LANG {0:1}, g7:HEAD-LANG — a default language for the document. GEDCOM 7.0 §3.2.1. */
  language?: Language;
  /** PLAC {0:1}, g7:HEAD-PLAC — the default PLAC.FORM; must not have a payload. GEDCOM 7.0 §3.2.1. */
  place?: HeaderPlace;
  /** <<NOTE_STRUCTURE>> {0:1} — should describe the contents of the document. GEDCOM 7.0 §3.2.1. */
  note?: NoteStructure;
  /**
   * `_HOME` {0:1} — the start person shown after opening the GEDCOM
   * file, a value in the style of a person reference (`@I123@`).
   * Written by Ages! and Ahnenblatt under HEAD; GEDitCOM writes the
   * same fact as `_HME`. The Ahnenblatt pair `_NAVI`/`_NAVM` names the
   * start person of the Navigator view and the mode choosing it
   * (0 = program automatic, 1 = the person active when the file was
   * closed, 2 = a fixed person; for 1 and 2 the `_NAVI` tag holds the
   * person). Source: the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag. Not part of any
   * GEDCOM version. All three spellings are recognized on input and
   * normalize into this field (with `startPersonMode`); written back
   * as `_HOME` (plus `_NAVM <mode>` when set) in both versions.
   */
  startPerson?: Pointer<IndividualRecord>;
  /**
   * `_NAVM` {0:1} — the mode choosing the Navigator start person: 0 =
   * program automatic, 1 = the person active when the file was closed,
   * 2 = a fixed person (see `startPerson` for the source). Not part of
   * any GEDCOM version. Recognized on input and written back as
   * `_NAVM` in both versions.
   */
  startPersonMode?: '0' | '1' | '2';
  /**
   * `_PROJECT_GUID` {0:1} — the MyHeritage project identifier of the
   * tree. Written under HEAD by MyHeritage exports (observed in real
   * files: `1 _PROJECT_GUID ICAP1527-…`); not part of any GEDCOM
   * version. Recognized on input and written back as `_PROJECT_GUID`
   * in both versions.
   */
  projectGuid?: Text;
  /**
   * `_EXPORTED_FROM_SITE_ID` {0:1} — the MyHeritage site the tree was
   * exported from (a numeric id). Written under HEAD by MyHeritage
   * exports (`1 _EXPORTED_FROM_SITE_ID 246677391`); not part of any
   * GEDCOM version. Recognized on input and written back as
   * `_EXPORTED_FROM_SITE_ID` in both versions.
   */
  exportedFromSiteId?: Text;
  /**
   * `_RINS` {0:1} — the record counts of the exported tree, a
   * comma-separated list keyed by record letter (MyHeritage exports:
   * `I224,F94,N0,M0,R0,S0,U2,L0,P0,Q0,IF480,FF69`). Kept verbatim —
   * the vendor documents no key semantics. Not part of any GEDCOM
   * version. Recognized on input and written back as `_RINS` in both
   * versions.
   */
  recordCounts?: Text;
  /**
   * `_TIMEZONE` {0:1} — the timezone of the export date, written by
   * MyHeritage under HEAD.DATE (`2 _TIMEZONE GMT+-0`). Kept verbatim
   * (the observed value is free text). Not part of any GEDCOM version.
   * Recognized on input and written back as `_TIMEZONE` under the
   * header DATE in both versions.
   */
  timezone?: Text;
  /**
   * `_DESCRIPTION_AWARE Y` {0:1} — the exported data includes the
   * description field (a presence flag). Written by MyHeritage under
   * HEAD; not part of any GEDCOM version. Recognized on input (an
   * absent value or `Y` marks the flag set, `N` clears it) and written
   * back as `_DESCRIPTION_AWARE Y` in both versions.
   */
  descriptionAware?: boolean;
  /**
   * `_ORGSOUR` {0:1} — the product that originally wrote the data, as
   * opposed to the product writing this file: when a program re-saves
   * a GEDCOM file written by another program, the foreign file's SOUR,
   * SOUR.NAME and SOUR.VERS are preserved under `_ORGSOUR`, with NAME
   * and VERS children. Documented in the GenWiki
   * "GEDCOM/_Nutzerdef-Tag" table ("Ursprungsprogramm, wenn vormals
   * schon als GEDCOM gespeichert war": the SOUR, SOUR.NAME and
   * SOUR.VERS of a foreign GEDCOM file remain as `_ORGSOUR`,
   * `_ORGSOUR.NAME` and `_ORGSOUR.VERS`,
   * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag); not part of any
   * GEDCOM version. Recognized on input and written back as the
   * `_ORGSOUR` block in both versions.
   */
  originalSource?: OriginalSourceStructure;
  /**
   * `_TITL` {0:1} — the title of the tree. Written under HEAD by My
   * Family Tree (Chronoplex Software) exports (observed in real
   * files, e.g. `1 _TITL The English and British Kings and Queens`);
   * not part of any GEDCOM version (neither standard has a title
   * slot in the header). Recognized on input and written back as
   * `_TITL` in both versions.
   */
  title?: Text;
  /**
   * `_STS` {0:1} — the dataset statistics block of My Family Tree
   * exports: one count line per record type under HEAD (`2 INDI 179`,
   * `2 FAM 85`, `2 REPO 1`, `2 SOUR 3`, `2 NOTE 10`, `2 SUBM 1`,
   * `2 OBJE 0`) plus the task count (`2 _TASK 1`). Program-generated
   * metadata, kept verbatim as free text per count. Not part of any
   * GEDCOM version. Recognized on input and written back as the
   * `_STS` block in both versions.
   */
  statistics?: DatasetStatistics;
  /**
   * WWW {0:M} — the web address(es) of the dataset, written directly
   * under the header (a widespread convention in the wild; neither
   * standard has a WWW slot in the header). Recognized on input and
   * written back as `WWW` in both versions.
   */
  www?: Text[];
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
   * (`LINEAGE-LINKED`). GEDCOM 5.5.1 §2 (p.50). Removed in GEDCOM 7.0;
   * dropped when serializing to 7.0 (5.5.1 emits it unconditionally).
   */
  form?: Text;
  /**
   * `_ADDENDUM` {0:M} — declarations that the document follows the
   * GEDCOM-L addendum ("GEDCOM 5.5.1 Specification GEDCOM-L Addendum",
   * §7.3, 2nd release 2020-12-01, eds. A. Emmerich & D. Hesmer, of the
   * German GEDCOM-L working group). Each declaration names the
   * addendum in its payload (`3 _ADDENDUM GEDCOM-L Addendum`), the
   * spec's form is `n _ADDENDUM <ADDENDUM_NAME> {1:80}` with the
   * optional VERS and WWW children; a file may carry several
   * declarations ({0:M}, e.g. one per extension agreement it
   * follows). Recognized on input in both versions and written back
   * as `_ADDENDUM` under GEDC.VERS in both versions.
   */
  addenda?: GedcomAddendum[];
}

/**
 * GEDCOM-L Addendum §7.3 — `_ADDENDUM`: the declaration under
 * GEDC.VERS that the document follows the addendum ("GEDCOM 5.5.1
 * Specification GEDCOM-L Addendum", 2nd release 2020-12-01, eds.
 * A. Emmerich & D. Hesmer). The payload names the addendum; VERS and
 * WWW carry its version and web address. Not part of any GEDCOM
 * version.
 */
export interface GedcomAddendum extends GedcomStructureBase {
  tag: '_ADDENDUM';
  /** The _ADDENDUM payload, {0:1} — the addendum's name (<ADDENDUM_NAME> {1:80} in the spec). */
  payload?: Text;
  /** VERS {0:1} — the addendum version the document follows. */
  version?: Text;
  /** WWW {0:1} — where the addendum is published. */
  www?: Text;
}

/**
 * The My Family Tree `_STS` statistics block under HEAD (see
 * Header.statistics): one count per record type, as written by the
 * vendor (`2 INDI 179`, `2 _TASK 1`, …). The counts are free text —
 * the vendor documents no value format beyond decimal numbers.
 */
export interface DatasetStatistics extends GedcomStructureBase {
  tag: '_STS';
  /** INDI {0:1} — the number of individual records. */
  individuals?: Text;
  /** FAM {0:1} — the number of family records. */
  families?: Text;
  /** REPO {0:1} — the number of repository records. */
  repositories?: Text;
  /** SOUR {0:1} — the number of source records. */
  sources?: Text;
  /** NOTE {0:1} — the number of note records. */
  notes?: Text;
  /** SUBM {0:1} — the number of submitter records. */
  submitters?: Text;
  /** OBJE {0:1} — the number of multimedia records. */
  media?: Text;
  /** _TASK {0:1} — the number of task (to-do) records. */
  tasks?: Text;
}

/**
 * `_ORGSOUR` under HEAD — the product that originally wrote the data
 * (see Header.originalSource): the foreign file's SOUR.NAME and
 * SOUR.VERS kept as NAME/VERS children. Documented in the GenWiki
 * "GEDCOM/_Nutzerdef-Tag" table; not part of any GEDCOM version.
 */
export interface OriginalSourceStructure extends GedcomStructureBase {  tag: '_ORGSOUR';
  /** NAME {0:1} — the original product's name (the foreign SOUR.NAME). */
  name?: Text;
  /** VERS {0:1} — the original product's version (the foreign SOUR.VERS). */
  version?: Text;
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
  /**
   * PRFX {0:M} — an ELF prefix declaration: a `PRFX <tag> <uri>` line
   * binding an IRI prefix (`2 PRFX elf https://terms.fhiso.org/elf/`).
   * The Extended Legacy Format (ELF), the FHISO serialization of the
   * GEDCOM data model, declares its extensions inside the SCHMA block
   * this way (the ELF specification: https://fhiso.org/TR/elf, with
   * its test files in https://github.com/fhiso/legacy-format). Not
   * part of the GEDCOM grammar. Recognized on input and written back
   * as the PRFX lines in both versions.
   */
  prefixes?: SchemaPrefix[];
  /**
   * IRI {0:M} — an ELF tag declaration: an `IRI <curie>` line with
   * the `TAG` (the tag and its supertype IRIs), `ISA` (the supertype
   * IRI) and `LANG` children (same source as `prefixes`). Not part of
   * the GEDCOM grammar. Recognized on input and written back as the
   * IRI lines with their children in both versions.
   */
  elfDefinitions?: ElfDefinition[];
}

/**
 * The ELF `PRFX` declaration under SCHMA (see Schema.prefixes): the
 * prefix tag with the IRI it abbreviates.
 */
export interface SchemaPrefix extends GedcomStructureBase {
  tag: 'PRFX';
  /** The PRFX payload, {1:1} — the prefix tag (e.g. `elf`). */
  prefix: Text;
  /** The PRFX value, {1:1} — the IRI the prefix abbreviates. */
  uri: Text;
}

/**
 * The ELF `IRI` declaration under SCHMA (see Schema.elfDefinitions):
 * one extension tag declared as the IRI's legacy spelling.
 */
export interface ElfDefinition extends GedcomStructureBase {
  tag: 'IRI';
  /** The IRI payload, {1:1} — the declared IRI (as a CURIE, e.g. `elf:ADDRESS`). */
  iri: Text;
  /** TAG {0:M} — the tags this IRI spells, followed by the IRIs it occurs under; each kept verbatim. */
  tagValues?: Text[];
  /** ISA {0:M} — the IRIs of the supertypes. */
  parents?: Text[];
  /** LANG {0:1} — the language of the declaration. */
  language?: Text;
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
  /**
   * The SOUR payload, {1:1} — the product identifier. GEDCOM 7.0 §3.2.1
   * HEADER rule (`Special`); GEDCOM 5.5.1 §2 Primitive Elements (p.42),
   * `APPROVED_SYSTEM_ID` — the registered identifier, whose spaces must
   * be underscores.
   */
  payload: Special;
  /** VERS {0:1}, g7:VERS — the version level of the product. GEDCOM 7.0 §3.2.1. */
  version?: Special;
  /** NAME {0:1}, g7:NAME — the name of the product. GEDCOM 7.0 §3.2.1. */
  name?: Text;
  /** CORP {0:1}, g7:CORP — the corporation creating the product. GEDCOM 7.0 §3.2.1. */
  corporation?: Corporation;
  /** DATA {0:1}, g7:HEAD-SOUR-DATA — the larger database this data is extracted from (deprecated; use NAME instead). GEDCOM 7.0 §3.2.1. */
  data?: HeaderSourceData;
  /**
   * `_RTLSAVE` {0:1} — the right-to-left save mode of the exporting
   * program (MyHeritage exports: `2 _RTLSAVE RTL` under HEAD.SOUR).
   * Kept verbatim. Not part of any GEDCOM version. Recognized on input
   * and written back as `_RTLSAVE` in both versions.
   */
  rtlSave?: Text;
  /**
   * WWW {0:1} — the web address of the source product, written under
   * HEAD.SOUR (Family Echo exports: `2 WWW http://www.familyecho.com/`).
   * Neither standard has the slot. Recognized on input and written
   * back as `WWW` under the SOUR line in both versions.
   */
  www?: Text;
  /**
   * `_TREE` {0:1} — the Ancestry.com tree the dataset was exported
   * from, as the numeric tree id under HEAD.SOUR (the webtrees
   * per-vendor custom-tag registry, Ancestry.php: `HEAD:SOUR:_TREE`
   * — https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Ancestry.php),
   * with the NOTE and RIN children the same registry documents. Not
   * part of any GEDCOM version. Recognized on input and written back
   * as the `_TREE` block in both versions.
   */
  tree?: AncestryTreeStructure;
}

/**
 * The Ancestry.com `_TREE` block under HEAD.SOUR (see
 * HeaderSource.tree): the tree the dataset was exported from, with
 * its id as the payload.
 */
export interface AncestryTreeStructure extends GedcomStructureBase {
  tag: '_TREE';
  /** The _TREE payload, {0:1} — the numeric tree id. */
  id?: Text;
  /** NOTE {0:1} — a note about the tree. */
  note?: Text;
  /** RIN {0:1} — the record id number of the tree. */
  rin?: Text;
  /**
   * `_ENV` {0:1} — the Ancestry environment the export came from
   * (`prd` for production in the 2025 exports; observed in real
   * Ancestry.com Family Trees exports). Recognized on input and
   * written back as `_ENV` under the `_TREE` block in both versions.
   */
  environment?: Text;
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
  /** FORM {0:1}, g7:HEAD-PLAC-FORM — any PLAC with no FORM shall be treated as if it has this FORM. Missing FORM is tolerated (the full-leniency container rule). */
  form?: ListText;
}

/**
 * GEDCOM 5.3 `SCHEMA` block — the user-tag declaration mechanism of the
 * GEDCOM 5.3 draft: a set of context chains, each a path of standard
 * tags (e.g. `INDI` → `BIRT`) ending in the declared user-defined tag
 * (e.g. `_HOSP`), with the declaration leaves LABL/DEFN/ISA beneath.
 * Dropped in GEDCOM 5.4 but still written by Family Tree Maker in
 * 5.5.1 files; see Header.schema53. The GEDCOM-L convention (agreement
 * Nutzerdef.N5; see the GenWiki "GEDCOM/_Nutzerdef-Tag" article:
 * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag) spells the same
 * block `_SCHEMA` with `_DEFN` definition leaves — both normalizations
 * parse into this structure.
 */
export interface FtmSchemaBlock extends GedcomStructureBase {
  tag: 'SCHEMA';
  /** GEDCOM 5.3 `USER_TAG_SCHEMA {1:M}` — the declared tags, each with its context chain. */
  entries: FtmSchemaEntry[];
}

/**
 * GEDCOM 5.3 `USER_TAG_SCHEMA` — one declared user-defined tag: its
 * context chain (outermost record tag first, the declared tag last)
 * plus the LABL/DEFN/ISA leaves (GEDCOM 5.3 §2 p.25–26 marks all three
 * {1:1}; real Family Tree Maker files omit some, so they are optional
 * here).
 */
export interface FtmSchemaEntry extends GedcomStructureBase {
  /** The chain of context tags, from the record down to the declared user tag. */
  context: Text[];
  /** LABL — the full tag name used as a field label. */
  label?: Text;
  /** DEFN — the user tag definition. */
  definition?: Text;
  /** ISA — the standard tag this user tag "is a kind of". */
  parent?: Text;
}
