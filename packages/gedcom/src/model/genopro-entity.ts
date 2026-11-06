/**
 * GEDCOM 7.0 §1.5 Extensions — the GenoPro entity records, modelled
 * as extension records.
 *
 * The GenoPro exports (the linguatree family tree and the Harry
 * Potter trees, HEAD.SOUR "GenoPro") store the person's facts as
 * separate records linked from the INDI: `Occupation`, `Education`,
 * `Contact` and `Marriage` carry the real data (company, industry,
 * institution, dates, places with the `_XREF` place-card links,
 * notes, sources), `Twin` carries the twinning link. The display
 * entities (`Label`, `SocialEntity`, `Picture`, `GLOBAL`, the
 * relationship records) are layout/schema and stay generic. The
 * wire format is undocumented; the shapes are taken from the corpus
 * files. Not part of any GEDCOM version. Recognized on input and
 * written back as the same records and links in both versions.
 */
import type { Pointer, Text, Xref } from '../primitives';
import type { DateStructure, NoteStructure } from './common';
import type { GedcomStructureBase } from './extensions';
import type { PlaceStructure } from './names-places';
import type { SourceCitation } from './sources-media';
import type { FamilyRecord } from './records';

/** The fields shared by the GenoPro entity records. */
export interface GenoProEntity extends GedcomStructureBase {
  /** The record's cross-reference identifier (@…@). */
  xref?: Xref;
  /** <<PLACE_STRUCTURE>> {0:1} — the place, with the `_XREF` card link. */
  place?: PlaceStructure;
  /** DATESTART {0:1} — the start date of the fact. */
  dateStart?: DateStructure;
  /** DATEEND {0:1} — the end date of the fact. */
  dateEnd?: DateStructure;
  /** <<NOTE_STRUCTURE>> {0:M}. */
  notes?: NoteStructure[];
  /** SOURCE {0:M} — the citations backing the fact. */
  citations?: SourceCitation[];
}

/** A GenoPro `Occupation` record: the person's employment. */
export interface OccupationRecord extends GenoProEntity {
  tag: 'Occupation';
  /** COMPANY {0:1} — the employer. */
  company?: Text;
  /** INDUSTRY {0:1} — the industry. */
  industry?: Text;
  /** TITL {0:1} — the job title. */
  title?: Text;
  /** DURATION {0:1} — the duration of the employment (kept verbatim). */
  duration?: Text;
}

/** A GenoPro `Education` record: the person's education. */
export interface EducationRecord extends GenoProEntity {
  tag: 'Education';
  /** INSTITUTION {0:1} — the institution. */
  institution?: Text;
}

/** A GenoPro `Contact` record: the person's contact/address entry. */
export interface ContactRecord extends GenoProEntity {
  tag: 'Contact';
}

/** A GenoPro `Marriage` record: a marriage event of the person. */
export interface MarriageRecord extends GenoProEntity {
  tag: 'Marriage';
  /** TYPE {0:1} — the kind of the union (Civil, …). */
  type?: Text;
  /** DATE {0:1} — the marriage date. */
  date?: DateStructure;
}

/** A GenoPro `Twin` record: the person's twinning link. */
export interface TwinRecord extends GedcomStructureBase {
  tag: 'Twin';
  /** The record's cross-reference identifier (@…@). */
  xref?: Xref;
  /** TWINLINK {0:1} — the twinning kind (Fraternal, Identical, …). */
  kind?: Text;
  /** FAMILY {0:1} — a pointer to the family record of the twins (kept verbatim, unresolved). */
  family?: Pointer<FamilyRecord>;
}
