/**
 * Serialization preparation: projects the model onto the target version.
 *
 * The serializers are projections, not judges: everything the target
 * version cannot express is dropped silently (the rules are documented
 * in the JSDoc of each affected model field), and everything with an
 * equivalent representation is translated. This module performs the
 * model-level part of that projection for GEDCOM 5.5.1:
 *
 * - the NO rule: all `NO` structures are dropped; records left empty by
 *   that are dropped too, and pointers to dropped records are removed
 *   (5.5.1 has no negation and no void pointers, so a dangling pointer
 *   would be invalid output);
 * - the required 5.5.1 header fields: a missing SOUR becomes the
 *   constant `DEFAULT_SYSTEM_ID_551` and a missing SUBM becomes a
 *   synthesized submitter record named "Unknown".
 *
 * The 7.0 projection needs no model-level cleanup: its serialization
 * drops 5.5.1-only constructs inline in the emitter.
 */

import type {
  GedcomDataset,
  GedcomRecord,
  FamilyRecord,
  IndividualRecord,
  SubmitterRecord,
} from '../structures';

/** The SOUR identifier written when exporting to 5.5.1 without one. */
export const DEFAULT_SYSTEM_ID_551 = 'DORU';

/** The name of the synthesized 5.5.1 submitter record. */
export const DEFAULT_SUBMITTER_NAME_551 = 'Unknown';

/** Returns a deep clone of the dataset (the model is plain data). */
function clone(dataset: GedcomDataset): GedcomDataset {
  return structuredClone(dataset);
}

/** The record kinds whose pointers must be checked after drops. */
interface LinkFields {
  submitters?: string[];
  associations?: Array<{ individual: string }>;
  aliases?: Array<{ individual: string }>;
  ancestorInterests?: string[];
  descendantInterests?: string[];
  spouseFamilies?: Array<{ family: string }>;
  childFamilies?: Array<{ family: string }>;
  husband?: { partner: string } | undefined;
  wife?: { partner: string } | undefined;
  children?: Array<{ child: string }>;
  notes?: Array<{ tag: string; note?: string; citations?: unknown }>;
  citations?: Array<{ source: string; repositoryCitations?: unknown }>;
  media?: Array<{ object: string }>;
  events?: Array<{ familyChild?: string; adoptionFamily?: { family: string } }>;
  ordinances?: Array<{ familyChild?: string }>;
}

/** A record with its pointers, as a mutable structural view. */
type LinkRecord = GedcomRecord & LinkFields;

/** True when the pointer is a live cross-reference identifier. */
function isLive(pointer: string, valid: Set<string>): boolean {
  return valid.has(pointer);
}

/** True when the record still carries content after the NO removal. */
function isEmpty(record: GedcomRecord): boolean {
  switch (record.tag) {
    case 'FAM': {
      const fam = record as unknown as FamilyRecord;
      return (
        (fam.events ?? []).length === 0 &&
        (fam.attributes ?? []).length === 0 &&
        (fam.nonEvents ?? []).length === 0 &&
        (fam.spouseSealings ?? []).length === 0 &&
        (fam.notes ?? []).length === 0 &&
        (fam.citations ?? []).length === 0 &&
        (fam.media ?? []).length === 0 &&
        (fam.identifiers ?? []).length === 0 &&
        (fam.associations ?? []).length === 0 &&
        (fam.restriction ?? []).length === 0 &&
        (fam.extensions ?? []).length === 0
      );
    }
    case 'INDI': {
      const indi = record as unknown as IndividualRecord;
      return (
        (indi.names ?? []).length === 0 &&
        indi.sex === undefined &&
        (indi.attributes ?? []).length === 0 &&
        (indi.events ?? []).length === 0 &&
        (indi.nonEvents ?? []).length === 0 &&
        (indi.ordinances ?? []).length === 0 &&
        (indi.notes ?? []).length === 0 &&
        (indi.citations ?? []).length === 0 &&
        (indi.media ?? []).length === 0 &&
        (indi.identifiers ?? []).length === 0 &&
        (indi.associations ?? []).length === 0 &&
        (indi.aliases ?? []).length === 0 &&
        (indi.ancestorInterests ?? []).length === 0 &&
        (indi.descendantInterests ?? []).length === 0 &&
        (indi.restriction ?? []).length === 0 &&
        (indi.extensions ?? []).length === 0
      );
    }
    default:
      // Only FAM and INDI records participate in the NO rule.
      return false;
  }
}

/** Strips dangling and void pointers from one record. */
function stripPointers(record: LinkRecord, valid: Set<string>): void {
  record.submitters = (record.submitters ?? []).filter((pointer) => isLive(pointer, valid));
  record.associations = (record.associations ?? []).filter((link) => isLive(link.individual, valid));
  record.aliases = (record.aliases ?? []).filter((link) => isLive(link.individual, valid));
  record.ancestorInterests = (record.ancestorInterests ?? []).filter((pointer) => isLive(pointer, valid));
  record.descendantInterests = (record.descendantInterests ?? []).filter((pointer) => isLive(pointer, valid));
  record.spouseFamilies = (record.spouseFamilies ?? []).filter((link) => isLive(link.family, valid));
  record.childFamilies = (record.childFamilies ?? []).filter((link) => isLive(link.family, valid));
  if (record.husband !== undefined && !isLive(record.husband.partner, valid)) {
    record.husband = undefined;
  }
  if (record.wife !== undefined && !isLive(record.wife.partner, valid)) {
    record.wife = undefined;
  }
  record.children = (record.children ?? []).filter((link) => isLive(link.child, valid));
  for (const event of record.events ?? []) {
    if (event.familyChild !== undefined && !isLive(event.familyChild, valid)) {
      delete event.familyChild;
    }
    if (event.adoptionFamily !== undefined && !isLive(event.adoptionFamily.family, valid)) {
      delete event.adoptionFamily;
    }
  }
  for (const ordinance of record.ordinances ?? []) {
    if (ordinance.familyChild !== undefined && !isLive(ordinance.familyChild, valid)) {
      delete ordinance.familyChild;
    }
  }
  record.notes = (record.notes ?? []).filter((note) => {
    if (note.tag !== 'NOTE' && note.tag !== 'SNOTE') {
      return true;
    }
    return note.note !== undefined && isLive(note.note, valid);
  });
  record.citations = (record.citations ?? []).filter((citation) => {
    if (citation.source === '@VOID@') {
      return true;
    }
    return isLive(citation.source, valid);
  });
  record.media = (record.media ?? []).filter((link) => isLive(link.object, valid));
  const cleanup: Array<keyof LinkFields> = [
    'submitters', 'associations', 'aliases', 'ancestorInterests', 'descendantInterests',
    'spouseFamilies', 'childFamilies', 'children', 'notes', 'citations', 'media',
  ];
  for (const key of cleanup) {
    const value = record[key];
    if (Array.isArray(value) && value.length === 0) {
      delete record[key];
    }
  }
}

/** Ensures the required 5.5.1 SOUR and SUBM header fields exist. */
function fill551Header(dataset: GedcomDataset): void {
  const header = dataset.header;
  if (header.source === undefined) {
    header.source = { payload: DEFAULT_SYSTEM_ID_551 };
  }
  const live = new Set(
    dataset.records.map((record) => record.xref).filter((x): x is string => x !== undefined),
  );
  if (header.submitter === undefined || header.submitter === '@VOID@' || !live.has(header.submitter)) {
    const existing = dataset.records.find((record) => record.tag === 'SUBM' && record.xref !== undefined);
    if (existing !== undefined) {
      header.submitter = existing.xref as string;
    } else {
      let xref: string;
      let index = 1;
      do {
        xref = `@_SYNSUB${index}@`;
        index++;
      } while (live.has(xref));
      const submitter: SubmitterRecord = { tag: 'SUBM', xref, name: DEFAULT_SUBMITTER_NAME_551 };
      dataset.records.push(submitter);
      header.submitter = xref;
    }
  }
}

/**
 * Applies the NO rule and the required-field defaults, returning a new
 * dataset safe to serialize as GEDCOM 5.5.1. The input is not mutated.
 */
export function prepareFor551(dataset: GedcomDataset): GedcomDataset {
  const out = clone(dataset);

  // 1. Drop every NO structure; remember which records carried one, so
  //    the empty-record rule below only applies to them.
  const emptied = new Set<string>();
  for (const record of out.records) {
    if (record.tag === 'FAM' || record.tag === 'INDI') {
      const rec = record as unknown as { nonEvents?: unknown; xref?: string };
      if (rec.nonEvents !== undefined) {
        delete rec.nonEvents;
        if (rec.xref !== undefined) {
          emptied.add(rec.xref);
        }
      }
    }
  }

  // 2. Iterate to a fixpoint: strip dangling pointers, drop records that
  //    carried a NO and were left empty by its removal, repeat (dropping
  //    records may orphan more pointers and empty more records).
  for (let round = 0; round < 100; round++) {
    const valid = new Set(
      out.records.map((record) => record.xref).filter((x): x is string => x !== undefined),
    );
    for (const record of out.records) {
      stripPointers(record as LinkRecord, valid);
    }
    const kept = out.records.filter(
      (record) => record.xref === undefined || !emptied.has(record.xref) || !isEmpty(record),
    );
    if (kept.length === out.records.length) {
      break;
    }
    out.records = kept;
  }

  // 3. A void or dangling SUBM pointer in the submission record cannot be
  //    written (5.5.1 has no void pointer).
  if (out.submission !== undefined && out.submission.submitter === '@VOID@') {
    delete out.submission.submitter;
  }

  fill551Header(out);
  return out;
}

/**
 * Returns the dataset unchanged; the 7.0 projection is performed inline
 * by the emitter. Kept for a symmetric API.
 */
export function prepareFor70(dataset: GedcomDataset): GedcomDataset {
  return dataset;
}
