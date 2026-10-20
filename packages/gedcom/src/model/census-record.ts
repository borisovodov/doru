/**
 * GEDCOM 7.0 extension record `_CENR` — the MagiKey census record,
 * registered in the FamilySearch GEDCOM registry (the official 7.0
 * extension registry): manifest/extension/manifest-extensions-en-US.tsv
 * → structure/extension/MagiKey_record_CENR.yaml, and the MagiKey tag
 * pages under https://armidalesoftware.com/issue/tags/. A census record
 * that can be shared among multiple individuals: the census itself
 * (date, place, source) plus one INDI entry per recorded individual,
 * each with the person's recorded details and the father/mother
 * information.
 *
 * The registry declares `INDI {1:M}` and the nested tags (INDI, FATH,
 * MOTH, SEX) are nonconformant uses of standard tags; per 7.0 §1.5
 * they are extension-defined substructures of the `_CENR` extension
 * record. Recognized on input and written back as `_CENR` in both
 * versions.
 */

import type { Pointer, Text, Xref } from '../primitives';
import type {
  AgeStructure,
  ChangeDate,
  DateStructure,
  EventDetail,
} from './common';
import type { GedcomStructureBase } from './extensions';
import type { PersonalNameStructure } from './names-places';
import type { IndividualRecord, SourceRecord } from './records';

/**
 * GEDCOM 7.0 §1.5 / MagiKey_record_CENR.yaml — the `_CENR` census record.
 */
export interface CensusRecord extends GedcomStructureBase {
  tag: '_CENR';
  /** The record's cross-reference identifier (@…@); optional when nothing points to it. */
  xref?: Xref;
  /** _SCHD {0:1} — the census schedule type (MagiKey_SCHD.yaml), e.g. "population schedule". */
  schedule?: Text;
  /** SEX {0:M} — the sex of a set of individuals in a head-of-household census (MagiKey SEX.htm), each with an age. */
  sexes?: CensusSexStructure[];
  /** INDI {1:M} — the individuals recorded in the census (MagiKey_CENR_INDI.yaml). */
  entries: CensusIndividual[];
  /** DATE {1:1} — the census date (a DateValue; the 5.5.1 DATE_VALUE form in the registry). */
  date: DateStructure;
  /** PLAC {1:1} — the census place (a plain place name; the 5.5.1 PLACE_NAME form). */
  place: Text;
  /** SOUR {0:1} — the census source: a pointer to a SOUR record or a free-text description. */
  source?: CensusSourceReference;
  /** CHAN {0:1} — the change date. */
  changeDate?: ChangeDate;
}

/**
 * MagiKey SEX.htm — the sex of a set of individuals in a head-of-household
 * census: a SEX value (M, F, or U) with the age of the set.
 */
export interface CensusSexStructure extends GedcomStructureBase {
  tag: 'SEX';
  /** The SEX payload, {1:1} Text — M, F, or U. */
  payload: Text;
  /** AGE {1:1} — the age of the set. */
  age: AgeStructure;
  /** TYPE {0:1} — a classification of the entry. */
  type?: Text;
}

/**
 * MagiKey_CENR_INDI.yaml — one individual recorded in the census: a
 * pointer to the INDI record, with the person's details as recorded.
 */
export interface CensusIndividual extends GedcomStructureBase {
  tag: 'INDI';
  /** The INDI payload, {1:1} pointer to an INDI record. */
  individual: Pointer<IndividualRecord>;
  /** FATH {0:1} — information about the father (MagiKey_FATH.yaml). */
  father?: CensusRelative;
  /** MOTH {0:1} — information about the mother (MagiKey_MOTH.yaml). */
  mother?: CensusRelative;
  /** _MSTAT {0:1} — the marital status as recorded (MagiKey_MSTAT.yaml), e.g. S, M, Wd. */
  maritalStatus?: Text;
  /** AGE {0:1} — the age at the census. */
  age?: AgeStructure;
  /** BIRT {0:1} — birth information (a relocated event: optional Y assertion + event detail). */
  birth?: CensusRelocatedEvent;
  /** FACT {0:M} — facts (relocated attributes: Text payload + event detail). */
  facts?: CensusRelocatedAttribute[];
  /** NAME {0:1} — the name as recorded (the standard personal name payload). */
  name?: PersonalNameStructure;
  /** OCCU {0:1} — the occupation (a relocated attribute). */
  occupation?: CensusRelocatedAttribute;
  /** ROLE {0:1} — the role of the individual in the census, free text. */
  role?: Text;
  /** SEX {0:1} — the sex as recorded, free text. */
  sex?: Text;
}

/**
 * MagiKey_FATH.yaml / MagiKey_MOTH.yaml — information about a parent of
 * a census individual.
 */
export interface CensusRelative extends GedcomStructureBase {
  tag: 'FATH' | 'MOTH';
  /** AGE {0:1} — the parent's age. */
  age?: AgeStructure;
  /** BIRT {0:1} — birth information (relocated event: optional Y assertion + event detail). */
  birth?: CensusRelocatedEvent;
  /** FACT {0:1} — a fact (relocated attribute). */
  fact?: CensusRelocatedAttribute;
  /** MARR {0:1} — marriage information (relocated event: optional Y assertion + event detail). */
  marriage?: CensusRelocatedEvent;
  /** OCCU {0:1} — the occupation (relocated attribute). */
  occupation?: CensusRelocatedAttribute;
}

/**
 * A standard event relocated under the MagiKey census structures
 * (BIRT, MARR): an optional `Y` assertion payload plus the standard
 * event detail (7.0 §1.5 recommends relocated structures match the
 * standard type of their tag).
 */
export interface CensusRelocatedEvent extends GedcomStructureBase {
  tag: 'BIRT' | 'MARR';
  /** The `Y` payload asserting the event is known to have occurred. */
  payload?: true;
  /** <<EVENT_DETAIL>> {0:1}. */
  detail?: EventDetail;
}

/**
 * A standard attribute relocated under the MagiKey census structures
 * (FACT, OCCU): a Text payload plus the standard event detail.
 */
export interface CensusRelocatedAttribute extends GedcomStructureBase {
  tag: 'FACT' | 'OCCU';
  /** The Text payload. */
  payload?: Text;
  /** <<EVENT_DETAIL>> {0:1}. */
  detail?: EventDetail;
}

/**
 * MagiKey_record_CENR.yaml — the census SOUR: a pointer to a SOUR
 * record or a free-text source description (the two forms of the 5.5.1
 * SOURCE_CITATION).
 */
export interface CensusSourceReference extends GedcomStructureBase {
  /** The pointer form. */
  source?: Pointer<SourceRecord>;
  /** The free-text description form. */
  description?: Text;
}
