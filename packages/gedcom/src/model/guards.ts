/**
 * Type guards for the record union (GEDCOM 7.0 §3.2.1 RECORD, see
 * GedcomRecord in records.ts).
 *
 * `ExtensionRecord.tag` is the open `_${string}` set (GEDCOM 7.0 §1.5),
 * so for the underscore tags (`_PLAC`, `_CENR`, `_ALIA`, `_TODO`, …) a
 * bare tag comparison leaves the extension record in the union. The
 * guards name the typed record the parsers produce for a tag; both the
 * parser and the serializer layers use them to narrow without casts.
 * The standard tags cannot collide with extension tags (GEDCOM 7.0
 * §1.5 requires the underscore prefix), so their guards are the tag
 * comparison itself.
 */

import type { CensusRecord } from './census-record';
import type { DuplicateCandidateRecord } from './duplicate-record';
import type { EvidenceRecord, ResearchDocumentRecord } from './evidence-record';
import type { GroupRecord } from './group-record';
import type { OccurrenceRecord } from './occurrence-record';
import type { PlaceRecord } from './place-record';
import type {
  FamilyRecord,
  GedcomRecord,
  IndividualRecord,
  MultimediaRecord,
} from './records';

/** True when the record is the typed `FAM` family record. */
export function isFamilyRecord(record: GedcomRecord): record is FamilyRecord {
  return record.tag === 'FAM';
}

/** True when the record is the typed `INDI` individual record. */
export function isIndividualRecord(record: GedcomRecord): record is IndividualRecord {
  return record.tag === 'INDI';
}

/** True when the record is a `FAM` or `INDI` record (the kinds the NO
 *  rule can leave empty, see serialize/prepare.ts). */
export function isFamilyOrIndividual(record: GedcomRecord): record is FamilyRecord | IndividualRecord {
  return record.tag === 'FAM' || record.tag === 'INDI';
}

/** True when the record is the typed `OBJE` multimedia record. */
export function isMultimediaRecord(record: GedcomRecord): record is MultimediaRecord {
  return record.tag === 'OBJE';
}

/** True when the record is the typed `_CENR` census record (the
 *  MagiKey extension, see CensusRecord). The parsers never produce a
 *  generic ExtensionRecord for a `_CENR` tag. */
export function isCensusRecord(record: GedcomRecord): record is CensusRecord {
  return record.tag === '_CENR';
}

/** True when the record is the typed `_ALIA` duplicate-candidate
 *  record (the GDO extension, see DuplicateCandidateRecord). */
export function isDuplicateCandidateRecord(record: GedcomRecord): record is DuplicateCandidateRecord {
  return record.tag === '_ALIA';
}

/** True when the record is a typed vendor place card (`_PLAC` /
 *  `_LOC` / `_PLAC_DEFN` / `_PLC` input, see PlaceRecord). */
export function isPlaceRecord(record: GedcomRecord): record is PlaceRecord {
  return record.tag === '_PLAC';
}

/** True when the record is the typed GEDKeeper `_GRP` group record
 *  (see GroupRecord). The parsers never produce a generic
 *  ExtensionRecord for a `_GRP` tag. */
export function isGroupRecord(record: GedcomRecord): record is GroupRecord {
  return record.tag === '_GRP';
}

/** True when the record is the typed `_OCUR` occurrence record (the
 *  glamberson gedcom-occurrences extension, see OccurrenceRecord).
 *  The parsers never produce a generic ExtensionRecord for an `_OCUR`
 *  tag. */
export function isOccurrenceRecord(record: GedcomRecord): record is OccurrenceRecord {
  return record.tag === '_OCUR';
}

/** True when the record is the typed `_EVID` evidence record (the
 *  glamberson gedcom-evidence extension, see EvidenceRecord). The
 *  parsers never produce a generic ExtensionRecord for an `_EVID`
 *  record tag. */
export function isEvidenceRecord(record: GedcomRecord): record is EvidenceRecord {
  return record.tag === '_EVID';
}

/** True when the record is the typed `_RDOC` research-documentation
 *  record (the glamberson gedcom-evidence extension, see
 *  ResearchDocumentRecord). The parsers never produce a generic
 *  ExtensionRecord for an `_RDOC` tag. */
export function isResearchDocumentRecord(record: GedcomRecord): record is ResearchDocumentRecord {
  return record.tag === '_RDOC';
}
