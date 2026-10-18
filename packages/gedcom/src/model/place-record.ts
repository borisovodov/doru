/**
 * GEDCOM 7.0 §1.5 Extensions — the vendor master-place record, modelled
 * as an extension record.
 *
 * Neither GEDCOM version has a place entity: a place is inline text in
 * every event's PLAC substructure. Several vendors keep a shared
 * "card-file" of places instead, so map coordinates, notes and media
 * for a place are stored once rather than per event. The wire dialects,
 * all normalized into this one type on 5.5.1 input:
 *
 * - `_PLAC <name>` (RootsMagic, The Master Genealogist) — the name is
 *   the record payload; records usually have no cross-reference.
 * - `@xref@ _PLAC <name>` (Family Historian) — same, with an xref that
 *   Family Historian itself does not use as a pointer (events link by
 *   name matching).
 * - `_PLAC_DEFN` with a `PLAC <name>` child (Legacy Family Tree) — the
 *   name is a required child substructure, plus an optional `ABBR`.
 * - `_LOC` with a `NAME <name>` child (GEDCOM 5.5EL) — the name is a
 *   required child substructure; `_LOC` records form a hierarchy via a
 *   `_LOC @parent@` child, and events link to them explicitly with
 *   `_LOC @xref@` under PLAC.
 *
 * The catalog source is John Cardinal's "Common GEDCOM Extensions":
 * https://jfcardinal.github.io/GEDCOM-5.5.2/extensions.html
 *
 * On input (both versions) every dialect is normalized to tag `_PLAC`
 * with the name as the payload, and events that name a place whose text
 * matches a record's payload get their `PlaceStructure.location` filled
 * (records without an xref receive a synthesized one, like the OBJE
 * synthesis). The records are read-side entities: on output — both
 * versions alike — they are projected onto the standard: their map and
 * notes are merged into each referencing place that lacks its own copy
 * (citations and media have no standard slot under PLAC and are
 * dropped), the location links are consumed, and the records are not
 * written. The card structure therefore flattens on a round trip;
 * event-level place data is never lost.
 */
import type { Pointer, Text, Xref } from '../primitives';
import type {
  ChangeDate,
  IdentifierStructure,
  NoteStructure,
} from './common';
import type { MapCoordinates } from './names-places';
import type { MultimediaLink, SourceCitation } from './sources-media';
import type { GedcomStructureBase } from './extensions';

export interface PlaceRecord extends GedcomStructureBase {
  tag: '_PLAC';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** The place name, {1:1} Text — the key events match by. */
  payload: Text;
  /** ABBR {0:1} — an abbreviation (Legacy `_PLAC_DEFN`). Dropped when serializing to 7.0. */
  abbreviation?: Text;
  /** MAP {0:1} — a representative point for the location. */
  map?: MapCoordinates;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
  /** <<MULTIMEDIA_LINK>> {0:M}. */
  media?: MultimediaLink[];
  /**
   * _LOC {0:1} — the parent place in the 5.5EL hierarchy. Dropped when
   * serializing to 7.0.
   */
  parent?: Pointer<PlaceRecord>;
  /** <<IDENTIFIER_STRUCTURE>> {0:M} — REFN and the vendor `_UID` are recognized. */
  identifiers?: IdentifierStructure[];
  /** <<CHANGE_DATE>> {0:1}. */
  changeDate?: ChangeDate;
}
