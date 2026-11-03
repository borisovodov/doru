/**
 * GEDCOM 7.0 §1.5 Extensions — the MyHeritage tree-tag records,
 * modelled as extension records.
 *
 * `0 @T10@ _MTTAG` holds one tree tag — a user-defined label of the
 * MyHeritage tree (observed names: "DNA Match", "Common DNA
 * Ancestor"): NAME names it, RIN carries its record id, `_VISI 1`
 * marks it visible, and `_MTCAT @C2@` links its category. The
 * individuals the tag applies to link it with `1 _MTTAG @T10@` (see
 * IndividualRecord.treeTags). `0 @C2@ _MTCAT` holds one category:
 * NAME and RIN. Observed in MyHeritage exports (the corpus files
 * "Natasha Taylor Family Tree.ged", "DiGiustino Bio_2023.ged", …).
 * The wire format is undocumented by the vendor. Not part of any
 * GEDCOM version. Recognized on input and written back as
 * `_MTTAG`/`_MTCAT` in both versions.
 */
import type { Pointer, Text, Xref } from '../primitives';
import type { GedcomStructureBase } from './extensions';

export interface TreeTagRecord extends GedcomStructureBase {
  tag: '_MTTAG';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** NAME {0:1} — the tag's name ("DNA Match", …). */
  name?: Text;
  /** RIN {0:1} — the tag's record id number. */
  automatedRecordId?: Text;
  /** _VISI {0:1} — 1 when the tag is visible, 0 when hidden. */
  visible?: boolean;
  /** _MTCAT {0:1} — a pointer to the tag's category record. */
  category?: Pointer<TreeCategoryRecord>;
}

export interface TreeCategoryRecord extends GedcomStructureBase {
  tag: '_MTCAT';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** NAME {0:1} — the category's name. */
  name?: Text;
  /** RIN {0:1} — the category's record id number. */
  automatedRecordId?: Text;
}
