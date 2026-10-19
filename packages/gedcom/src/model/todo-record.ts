/**
 * GEDCOM 7.0 §1.5 Extensions — the Legacy Family Tree to-do record,
 * modelled as an extension record.
 *
 * `0 _TODO` holds a research task with an optional category (`_CAT`),
 * closed date (`_CDATE`), locality (`_LOCL`) and reminder date
 * (`_RDATE`); the dates are free text (the vendor does not document a
 * format). Not part of any GEDCOM version (see the Legacy "Custom
 * GEDCOM Tags" help:
 * https://www.legacyfamilytree.se/WEB_US/custom_gedcom_tags.htm).
 * Recognized on input and written back as `_TODO` in both versions.
 */
import type { Text, Xref } from '../primitives';
import type { GedcomStructureBase } from './extensions';

export interface TodoRecord extends GedcomStructureBase {
  tag: '_TODO';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** The task description, {1:1} Text. */
  payload: Text;
  /** _CAT {0:1} — the category of the to-do item. */
  category?: Text;
  /** _CDATE {0:1} — the closed date of the to-do item (free text). */
  closedDate?: Text;
  /** _LOCL {0:1} — the locality of the to-do item. */
  locality?: Text;
  /** _RDATE {0:1} — the reminder date of the to-do item (free text). */
  reminderDate?: Text;
}
