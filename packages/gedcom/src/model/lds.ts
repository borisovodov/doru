import type {
  OrdinanceStatusEnum,
} from '../enumerations';
import type {
  Pointer,
  Text,
} from '../primitives';

import type { DateExactStructure } from './common';
import type { DateStructure } from './common';
import type { FamilyRecord } from './records';
import type { GedcomStructureBase } from './extensions';
import type { NoteStructure } from './common';
import type { PlaceStructure } from './names-places';
import type { SourceCitation } from './sources-media';

// ---------------------------------------------------------------------------
// GEDCOM 7.0 §3.2.3 LDS ordinances / GEDCOM 7.0 §3.3.3
// ---------------------------------------------------------------------------

/**
 * GEDCOM 7.0 §3.2.3 LDS_ORDINANCE_DETAIL — substructures shared by the Latter-day
 * Saint ordinance structures.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.35), `LDS_INDIVIDUAL_ORDINANCE` /
 * (p.36) `LDS_SPOUSE_SEALING` — the same DATE, TEMP, PLAC, STAT, NOTE and
 * SOUR substructures; 5.5.1's STAT value sets are per-ordinance (see
 * `OrdinanceStatusEnum`).
 */
export interface LdsOrdinanceDetail extends GedcomStructureBase {
  /** <<DATE_VALUE>> {0:1} — should be in the GREGORIAN calendar and 1830 or later. */
  date?: DateStructure;
  /** TEMP {0:1}, g7:TEMP — the name of the temple. */
  temple?: Text;
  /** <<PLACE_STRUCTURE>> {0:1} — used only for ordinances performed by the recipient in life. */
  place?: PlaceStructure;
  /** STAT {0:1}, g7:ord-STAT — Enum of g7:enumset-ord-STAT. */
  status?: OrdinanceStatusStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** <<SOURCE_CITATION>> {0:M}. */
  citations?: SourceCitation[];
}

/**
 * GEDCOM 7.0 §3.2.3 LDS_ORDINANCE_DETAIL — g7:ord-STAT: an enumerated value
 * assessing the state or condition of an ordinance, with the date it was
 * assigned.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.35–36) — identical STAT + DATE {1:1}
 * shape; see `OrdinanceStatusEnum` for the 5.5.1 per-ordinance value sets.
 */
export interface OrdinanceStatusStructure extends GedcomStructureBase {
  /** The STAT payload, {1:1} Enum of g7:enumset-ord-STAT. */
  payload: OrdinanceStatusEnum;
  /** DATE {1:1}, g7:DATE-exact. */
  date: DateExactStructure;
}

/** Base of the LDS individual ordinance structures of GEDCOM 7.0 §3.2.3. */
interface LdsOrdinanceBase<Tag extends string> extends GedcomStructureBase {
  tag: Tag;
  /** <<LDS_ORDINANCE_DETAIL>> {0:1}. */
  detail?: LdsOrdinanceDetail;
}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:BAPL: baptism. GEDCOM 7.0 §3.3.3. */
export interface BaptismOrdinance extends LdsOrdinanceBase<'BAPL'> {}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:CONL: confirmation. GEDCOM 7.0 §3.3.3. */
export interface ConfirmationOrdinance extends LdsOrdinanceBase<'CONL'> {}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:ENDL: endowment. GEDCOM 7.0 §3.3.3. */
export interface EndowmentOrdinance extends LdsOrdinanceBase<'ENDL'> {}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:INIL: initiatory. GEDCOM 7.0 §3.3.3. */
export interface InitiatoryOrdinance extends LdsOrdinanceBase<'INIL'> {}

/**
 * GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — g7:SLGC: sealing of a child to
 * parents. GEDCOM 7.0 §3.3.3.
 */
export interface ChildSealingOrdinance extends LdsOrdinanceBase<'SLGC'> {
  /** FAMC {1:1}, g7:FAMC — the family the child was sealed to. */
  family: Pointer<FamilyRecord>;
}

/** GEDCOM 7.0 §3.2.3 LDS_INDIVIDUAL_ORDINANCE — the union of individual ordinances. */
export type LdsIndividualOrdinance =
  | BaptismOrdinance
  | ConfirmationOrdinance
  | EndowmentOrdinance
  | InitiatoryOrdinance
  | ChildSealingOrdinance;

/**
 * GEDCOM 7.0 §3.2.3 LDS_SPOUSE_SEALING — g7:SLGS: sealing of spouses. GEDCOM 7.0 §3.3.3.
 *
 * GEDCOM 5.5.1 §2 Substructures (p.36), `LDS_SPOUSE_SEALING` — identical.
 */
export interface SpouseSealingOrdinance extends GedcomStructureBase {
  tag: 'SLGS';
  /** <<LDS_ORDINANCE_DETAIL>> {0:1}. */
  detail?: LdsOrdinanceDetail;
}
