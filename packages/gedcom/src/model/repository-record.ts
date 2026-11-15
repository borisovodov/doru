import type { Xref, Pointer, Special, Text } from '../primitives';
import type { AddressStructure } from './common';
import type { ChangeDate } from './common';
import type { CreationDate } from './common';
import type { TagLink } from './evidence-record';
import type { DateStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { IdentifierStructure } from './common';
import type { ImportFileReference } from './common';
import type { NoteStructure } from './common';
import type { SubmitterRecord } from './submitter-record';

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
  /**
   * `_TAG @xref@` {0:M} — the organizational tags applied to the
   * record (the glamberson gedcom-tags extension applies tags to any
   * record type, tag-extension.md; see TagLink). Written back in both
   * versions.
   */
  tagLinks?: TagLink[];
}
