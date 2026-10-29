/**
 * GEDCOM 7.0 extension record `_ALIA` — the GDO duplicate-candidate
 * record: a record for a possible duplicate of an individual
 * ("Datensatz für mögliche Dublette"). Written by GDO at level 0; the
 * GenWiki "GEDCOM/_Nutzerdef-Tag" table documents the substructures
 * `_CPT`, `_INDI`, `_QUAY`, `_STAT`, NOTE and SOUR:
 * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag. Not part of any
 * GEDCOM version; recognized on input and written back as the `_ALIA`
 * record in both versions (GEDCOM 7.0 §1.5 allows extension records).
 *
 * Note the tag collision: under INDI.NAME the same tag is PRO-GEN's
 * alias text field (see PersonalNameStructure.alias) — the record
 * level and the NAME level are distinct positions.
 */

import type { Pointer, Text, Xref } from '../primitives';
import type { GedcomStructureBase } from './extensions';
import type { NoteStructure } from './common';
import type { SourceCitation } from './sources-media';
import type { IndividualRecord } from './records';

/**
 * The GDO `_ALIA` duplicate-candidate record.
 */
export interface DuplicateCandidateRecord extends GedcomStructureBase {
  tag: '_ALIA';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** _CPT {0:1} — a caption/description of the candidate. */
  caption?: Text;
  /** _INDI {0:1} — a pointer to the individual the candidate may duplicate. */
  individual?: Pointer<IndividualRecord>;
  /** _QUAY {0:1} — the assessment of the match, kept verbatim (the value set is undocumented). */
  assessment?: Text;
  /** _STAT {0:1} — the status of the candidate, kept verbatim (the value set is undocumented). */
  status?: Text;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}
