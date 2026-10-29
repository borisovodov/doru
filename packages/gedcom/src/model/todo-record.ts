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
import type { Pointer, Special, Text, Xref } from '../primitives';
import type { DateStructure, NoteStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { RepositoryRecord } from './records';

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

/**
 * GEDCOM 7.0 §1.5 Extensions — the to-do substructure under INDI and FAM.
 *
 * Several programs keep research tasks attached to a person or family
 * instead of as separate records. The GenWiki "GEDCOM/_Nutzerdef-Tag"
 * catalog of the GEDCOM-L working group
 * (https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag) lists `_TODO` under
 * INDI and FAM (GDO, GES2000, Family Origins, Legacy, Brother's Keeper,
 * webtrees "with its own structure") and describes the GenoPro /
 * RootsMagic / Ahnenblatt form as "a structure with sub-tags such as
 * DESC, PRTY, STAT, DATE, NOTE". The payload carries the task text; the
 * sub-tags are kept as free text (the catalog does not define their
 * value formats beyond the tag names). The GEDCOM-L agreement "TODO" E1
 * (https://wiki.genealogy.net/GEDCOM/TODO-Tag) specifies the fuller
 * structure with the sub-tags DESC, _CAT, _PRTY, TYPE, DATE, NOTE, DATA,
 * STAT, _CDATE, _RDATE, REPO and _UID — the fields below cover both
 * forms (PRTY and _PRTY share one slot, like the two spellings in the
 * wild). The Legacy record form is the separate `TodoRecord`. Recognized
 * on input and written back as `_TODO` in both versions (no standard
 * equivalent in either).
 */
export interface TodoStructure extends GedcomStructureBase {
  tag: '_TODO';
  /** The _TODO payload, {0:1} Text — the task text. */
  payload?: Text;
  /** DESC {0:1} — the task description. */
  description?: Text;
  /** _CAT {0:1} — the category of the task (GEDCOM-L E1). */
  category?: Text;
  /** PRTY {0:1} — the priority (the Legacy/GenoPro spelling; the GEDCOM-L E1 `_PRTY` normalizes into the same slot). */
  priority?: Text;
  /** TYPE {0:1} — the type of the task (GEDCOM-L E1: 0 = research, 1 = correspondence, 2 = other). */
  type?: Text;
  /** STAT {0:1} — the status (open, done, …). */
  status?: Text;
  /** DATE {0:1} — the task's date. */
  date?: DateStructure;
  /** DATA {0:1} — the details of the solution (GEDCOM-L E1). */
  data?: Text;
  /** _CDATE {0:1} — the date of completing the task (GEDCOM-L E1). */
  closedDate?: DateStructure;
  /** _RDATE {0:1} — the reminder date (GEDCOM-L E1). */
  reminderDate?: DateStructure;
  /** REPO {0:1} — a pointer to a repository record (GEDCOM-L E1). */
  repository?: Pointer<RepositoryRecord>;
  /** _UID {0:M} — unique identifiers of the task (GEDCOM-L E1). */
  uids?: Special[];
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
}
