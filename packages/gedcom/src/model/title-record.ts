/**
 * The Ancestris `TITL` record — a source title kept as its own
 * record, linked from the SOUR record's TITL line.
 *
 * The Ancestris kennedy sample (the `gen-kennedy_kennedy.ged` test
 * fixture in the corpus) stores the source bibliography in separate
 * records tagged `TITL`: the SOUR record carries only `1 TITL @R5@`
 * — a pointer to the title record — and the title record carries the
 * payload (the actual title text) plus the description fields CHAN,
 * AUTH, PUBL, SERS, ABBR, REPO, NUMB and CALN. The AUTH line is a
 * pointer to the author's INDI record. The wire format is
 * undocumented; the shapes are taken from the corpus file. Not part
 * of any GEDCOM version. Recognized on input and written back as the
 * same records and links in both versions.
 */
import type { Pointer, Text, Xref } from '../primitives';
import type { ChangeDate } from './common';
import type { GedcomStructureBase } from './extensions';
import type { IndividualRecord, RepositoryRecord } from './records';

/** An Ancestris `TITL` record (see the module JSDoc). */
export interface TitleRecord extends GedcomStructureBase {
  tag: 'TITL';
  /** The record's cross-reference identifier (@…@). */
  xref?: Xref;
  /** The title text on the record line, {0:1} (absent on a bare record line). */
  payload?: Text;
  /** CHAN {0:1} — the change date of the title record. */
  changeDate?: ChangeDate;
  /** AUTH {0:1} — a pointer to the author's INDI record, or free text. */
  author?: Pointer<IndividualRecord> | Text;
  /** PUBL {0:1} — the publication details. */
  publisher?: Text;
  /** SERS {0:1} — the series the title belongs to. */
  series?: Text;
  /** ABBR {0:1} — the short citation spelling of the title. */
  abbreviation?: Text;
  /** REPO {0:1} — a pointer to the repository record. */
  repository?: Pointer<RepositoryRecord>;
  /** NUMB {0:1} — a running number of the title. */
  sequenceNumber?: Text;
  /** CALN {0:1} — the call number of the title. */
  callNumber?: Text;
}
