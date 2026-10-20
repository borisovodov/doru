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
   * files; the vendor spelling `_SCHEMA` normalizes to this). Kept as
   * opaque metadata: the context chains and their LABL/DEFN/ISA
   * leaves have no genealogical meaning. Recognized on 5.x input and
   * written back as `SCHEMA` in 5.5.1; dropped when serializing to 7.0
   * (7.0's own SCHMA carries URIs, which this block lacks). Sources:
   * the GEDCOM 5.3 draft (`USER_TAG_SCHEMA`, p.25–26 of the Tamura
   * Jones PDF) and Tamura Jones "GEDCOM Tags":
   * https://www.tamurajones.net/GEDCOMTags.xhtml
   */
  schema53?: FtmSchemaBlock;
  /** SOUR {0:1}, g7:HEAD-SOUR — the product producing this dataset. GEDCOM 7.0 §3.2.1; required {1:1} in 5.5.1. */
  source?: HeaderSource;
  /** DEST {0:1}, g7:DEST — an identifier for the system expected to receive this document. GEDCOM 7.0 §3.2.1. */
  destination?: Special;
  /** DATE {0:1}, g7:HEAD-DATE — the DateExact this document was created. GEDCOM 7.0 §3.2.1. */
  date?: DateExactStructure;
  /** SUBM {0:1}, g7:SUBM — the submitter of the dataset. GEDCOM 7.0 §3.2.1; required {1:1} in 5.5.1. Dropped when serializing to 7.0; when serializing to 5.5.1 a missing or void pointer is filled from an existing SUBM record or a synthesized one named "Unknown". */
  submitter?: Pointer<SubmitterRecord>;
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
  form: ListText;
}

/**
 * GEDCOM 5.3 `SCHEMA` block — the user-tag declaration mechanism of the
 * GEDCOM 5.3 draft: a set of context chains, each a path of standard
 * tags (e.g. `INDI` → `BIRT`) ending in the declared user-defined tag
 * (e.g. `_HOSP`), with the declaration leaves LABL/DEFN/ISA beneath.
 * Dropped in GEDCOM 5.4 but still written by Family Tree Maker in
 * 5.5.1 files; see Header.schema53.
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
