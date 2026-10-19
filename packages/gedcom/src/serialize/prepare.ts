/**
 * Serialization preparation: projects the model onto the target version.
 *
 * The serializers are projections, not judges: everything the target
 * version cannot express is dropped silently (the rules are documented
 * in the JSDoc of each affected model field), and everything with an
 * equivalent representation is translated. This module performs the
 * model-level part of that projection for GEDCOM 5.5.1:
 *
 * - the NO rule: the `NO` structures are dropped; records left empty by
 *   that are dropped too, and pointers to dropped records are removed
 *   (5.5.1 has no negation and no void pointers, so a dangling pointer
 *   would be invalid output). Exception: a bare NO MARR or NO DEAT on
 *   an INDI survives and is written back as the vendor negatives
 *   `_NMAR`/`_NLIV`;
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
import { collectPlaces } from '../parsing/places';
import type { PlaceRecord } from '../structures';
import type { PedigreeEnum } from '../enumerations';

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
/** Whether the card carries the GEDCOM-L fields that force the 5.5.1 write-back. */
function hasGermanPlaceFields(card: PlaceRecord): boolean {
  return card.govId !== undefined
    || card.maidenhead !== undefined
    || card.types !== undefined
    || card.postalCodes !== undefined
    || card.administrativeIds !== undefined
    || card.demographicData !== undefined
    || card.denomination !== undefined
    || card.events !== undefined
    || card.parents !== undefined
    || (card.names ?? []).some(
      (name) => name.date !== undefined || name.abbreviation !== undefined || name.language !== undefined || name.citations !== undefined,
    )
    || (card.names ?? []).length > 1;
}

/**
 * Projects the vendor place records onto the standard: each card's map
 * and notes are merged into every referencing place that lacks its own
 * copy (citations and media have no standard slot under PLAC and are
 * dropped), the location links are consumed, and the records are
 * removed. The exception: a GEDCOM-L card carrying the German fields
 * survives as a `_LOC` record (in both versions — GEDCOM 7.0 allows
 * extension records) and its referencing places keep the pointer. See
 * the PlaceRecord JSDoc.
 */
function flattenPlaceRecords(dataset: GedcomDataset, version: '7.0' | '5.5.1'): void {
  void version;
  const places = collectPlaces(dataset.records);
  const survivors = new Set<string>();
  for (const record of dataset.records) {
    if (record.tag !== '_PLAC') {
      continue;
    }
    const card = record as unknown as PlaceRecord;
    if (card.xref === undefined) {
      continue;
    }
    if (hasGermanPlaceFields(card)) {
      survivors.add(card.xref);
      continue;
    }
    for (const place of places) {
      if (place.location !== card.xref) {
        continue;
      }
      if (place.map === undefined && card.map !== undefined) {
        place.map = card.map;
      }
      if (place.notes === undefined && card.notes !== undefined) {
        place.notes = card.notes;
      }
    }
  }
  // The hierarchy closes over the survivors: a card referenced as a
  // parent by a surviving card must survive too, even when it carries
  // no German fields of its own (a fixpoint over the parent links).
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of dataset.records) {
      if (record.tag !== '_PLAC') {
        continue;
      }
      const card = record as unknown as PlaceRecord;
      if (card.xref === undefined || !survivors.has(card.xref)) {
        continue;
      }
      for (const parent of card.parents ?? []) {
        if (parent.parent !== '@VOID@' && !survivors.has(parent.parent)) {
          survivors.add(parent.parent);
          changed = true;
        }
      }
    }
  }
  for (const place of places) {
    if (place.location !== undefined && !survivors.has(place.location)) {
      delete (place as { location?: unknown }).location;
    }
  }
  dataset.records = dataset.records.filter(
    (record) => record.tag !== '_PLAC' || survivors.has((record as unknown as PlaceRecord).xref as string),
  );
}

export function prepareFor551(dataset: GedcomDataset): GedcomDataset {
  const out = clone(dataset);
  flattenPlaceRecords(out, '5.5.1');

  // 1. Drop the NO structures; remember which records carried one, so
  //    the empty-record rule below only applies to them. Exception: a
  //    bare NO MARR or NO DEAT on an INDI survives — it is written back
  //    as the vendor negatives _NMAR/_NLIV (see the emitter).
  const emptied = new Set<string>();
  for (const record of out.records) {
    if (record.tag === 'FAM' || record.tag === 'INDI') {
      const rec = record as unknown as {
        nonEvents?: Array<{ payload?: string; date?: unknown; notes?: unknown; citations?: unknown }>;
        xref?: string;
      };
      if (rec.nonEvents !== undefined) {
        const kept = record.tag === 'INDI'
          ? rec.nonEvents.filter(
              (nonEvent) => nonEvent.payload === 'MARR' || nonEvent.payload === 'DEAT'
                ? nonEvent.date === undefined && nonEvent.notes === undefined && nonEvent.citations === undefined
                : false,
            )
          : [];
        const droppedAny = kept.length < rec.nonEvents.length;
        if (droppedAny && record.xref !== undefined) {
          emptied.add(record.xref);
        }
        if (kept.length === 0) {
          delete rec.nonEvents;
        } else {
          rec.nonEvents = kept;
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
 * GEDCOM 7.0 §3.4 g7:enumset-PEDI values matching the common
 * `_FREL`/`_MREL` relationship keywords (case-insensitive), mirroring
 * the mapping documented on FamilyChildLink.
 */
const PEDI_BY_RELATION: ReadonlyMap<string, PedigreeEnum> = new Map([
  ['natural', 'BIRTH'],
  ['adopted', 'ADOPTED'],
  ['foster', 'FOSTER'],
  ['sealing', 'SEALING'],
]);

/**
 * The 7.0 projection: `_FREL`/`_MREL` live under FAM.CHIL in 5.5.1;
 * 7.0 keeps the same information in INDI.FAMC.PEDI. When both relations
 * name the same known relationship, the matching FAMC link gets its
 * PEDI filled; otherwise the relations are dropped (the 7.0 emitter
 * never writes them).
 */
export function prepareFor70(dataset: GedcomDataset): GedcomDataset {
  const out = clone(dataset);
  flattenPlaceRecords(out, '7.0');
  const individuals = new Map<string, IndividualRecord>();
  for (const record of out.records) {
    if (record.tag === 'INDI' && record.xref !== undefined) {
      individuals.set(record.xref, record);
    }
  }
  for (const record of out.records) {
    if (record.tag !== 'FAM') {
      continue;
    }
    const fam = record as unknown as FamilyRecord;
    for (const link of fam.children ?? []) {
      if (link.fatherRelation === undefined && link.motherRelation === undefined) {
        continue;
      }
      const father = link.fatherRelation?.trim().toLowerCase();
      const mother = link.motherRelation?.trim().toLowerCase();
      if (father === undefined || mother === undefined || father !== mother) {
        continue;
      }
      const payload = PEDI_BY_RELATION.get(father);
      if (payload === undefined) {
        continue;
      }
      const individual = individuals.get(link.child);
      const famc = individual?.childFamilies?.find((entry) => entry.family === fam.xref);
      if (famc !== undefined && famc.pedigree === undefined) {
        famc.pedigree = { payload };
      }
    }
  }
  return out;
}
