import type { Xref, Integer, Language, Pointer, Special, Text } from '../primitives';
import type { AddressStructure } from './common';
import type { ChangeDate } from './common';
import type { CreationDate } from './common';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { ImportFileReference } from './common';
import type { MultimediaLink } from './sources-media';
import type { NoteStructure } from './common';

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
