import type { Xref, Language, MediaType, Pointer, Text } from '../primitives';
import type { ChangeDate } from './common';
import type { CreationDate } from './common';
import type { TagLink } from './evidence-record';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { ImportFileReference } from './common';
import type { NoteTranslation } from './common';
import type { SourceCitation } from './sources-media';
import type { SubmitterRecord } from './submitter-record';

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
  /**
   * `_TAG @xref@` {0:M} — the organizational tags applied to the
   * record (the glamberson gedcom-tags extension; see TagLink). The
   * 5.5.1 NOTE record projects onto SNOTE in 7.0 with its tag links.
   * Written back in both versions.
   */
  tagLinks?: TagLink[];
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
  /**
   * `_TAG @xref@` {0:M} — the organizational tags applied to the
   * record (the glamberson gedcom-tags extension applies tags to any
   * record type, tag-extension.md; see TagLink). Written back in both
   * versions.
   */
  tagLinks?: TagLink[];
}
