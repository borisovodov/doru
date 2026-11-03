/**
 * GEDCOM 7.0 §1.5 Extensions — the GEDKeeper group record, modelled
 * as an extension record.
 *
 * `0 @G1@ _GRP` holds a GEDKeeper research group: a named set of
 * individuals the user groups for research purposes, with the group
 * name as the NAME child and free-text NOTE children (observed in
 * the GEDKeeper test resources, e.g.
 * `projects/GKv2/GKTests/Resources/test_genney.ged` in
 * https://github.com/Serg-Norseman/GEDKeeper). Not part of any
 * GEDCOM version. Recognized on input and written back as `_GRP` in
 * both versions.
 */
import type { Text, Xref } from '../primitives';
import type { NoteStructure } from './common';
import type { GedcomStructureBase } from './extensions';

export interface GroupRecord extends GedcomStructureBase {
  tag: '_GRP';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** NAME {0:1} — the group's name. */
  name?: Text;
  /** <<NOTE_STRUCTURE>> {0:M} — notes describing the group. */
  notes?: NoteStructure[];
}
