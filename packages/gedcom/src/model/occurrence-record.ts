/**
 * GEDCOM 7.0 §1.5 Extensions — the occurrence record of the
 * glamberson "gedcom-occurrences" extension, modelled as an extension
 * record.
 *
 * `0 @O1@ _OCUR` describes one documented occurrence of people in a
 * source (a marriage, a burial, a census entry, …): the occurrence
 * kind as the TYPE child, the DATE and PLAC, the participants as
 * `_PART @xref@` pointers with their ROLE, AGE and NOTE, and the
 * usual SOUR citations and notes. Individual (and family) records
 * link to the occurrences they appear in with `_OCREF @xref@` (see
 * IndividualRecord.occurrences). The extension and its example files
 * live at https://github.com/glamberson/gedcom-occurrences. Not part
 * of any GEDCOM version. Recognized on input and written back as
 * `_OCUR` in both versions.
 */
import type { Pointer, Special, Text, Xref } from '../primitives';
import type { AgeStructure, DateStructure, NoteStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { IndividualRecord } from './records';
import type { PlaceStructure } from './names-places';
import type { SourceCitation } from './sources-media';

export interface OccurrenceRecord extends GedcomStructureBase {
  tag: '_OCUR';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** TYPE {0:1} — the kind of occurrence (e.g. `Marriage`, `Burial`). */
  type?: Text;
  /** <<DATE_VALUE>> {0:1} — when the occurrence happened. */
  date?: DateStructure;
  /** <<PLACE_STRUCTURE>> {0:1} — where it happened. */
  place?: PlaceStructure;
  /** CAUS {0:1} — the cause (for deaths etc.; occurrence-extension.md). */
  cause?: Text;
  /** AGNC {0:1} — the responsible agency (for official occurrences). */
  agency?: Text;
  /** RELI {0:1} — the religion (for religious occurrences). */
  religion?: Text;
  /** `_PART @xref@` {0:M} — one participant of the occurrence. */
  participants?: OccurrenceParticipant[];
  /** `_ATTR` {0:M} — custom attributes (name + `_VALUE`; occurrence-extension.md). */
  attributes?: import('./evidence-record').VendorAttribute[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<MULTIMEDIA_LINK>> {0:M} — media for the occurrence (occurrence-extension.md). */
  media?: import('./sources-media').MultimediaLink[];
  /** UID {0:M} — unique identifiers of the occurrence (the GRAMPS event handles). */
  uids?: Special[];
  /** CHAN {0:1}. */
  changeDate?: import('./common').ChangeDate;
}

/**
 * One `_PART` under an `_OCUR` record: a participant of the
 * occurrence, given as a pointer with the role they played, their age
 * at the time, optional notes and the sources for this participation
 * (same source as OccurrenceRecord). The v0.2.0 spec allows the
 * payload to point at an INDI or at a FAM record; the pointer is kept
 * verbatim (the target's kind is the writer's choice, like the
 * `_RDOC` link of the evidence records).
 */
export interface OccurrenceParticipant extends GedcomStructureBase {
  tag: '_PART';
  /** The _PART payload, {1:1} — the pointer to the participant (an INDI or FAM record). */
  individual: Pointer<IndividualRecord>;
  /** ROLE {0:1} — the role the person played (Groom, Bride, Witness, Officiator, …). */
  role?: Text;
  /** <<AGE_AT_EVENT>> {0:1} — the participant's age at the occurrence. */
  age?: AgeStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M} — the sources for this participation. */
  citations?: SourceCitation[];
}
