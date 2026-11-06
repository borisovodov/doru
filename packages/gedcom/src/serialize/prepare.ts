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
 * The 7.0 projection needs only one piece of model-level work: the
 * vendor place cards are kept as extension records (see
 * `preservePlaceRecords70`). Everything else it cannot express is
 * dropped inline in the emitter.
 */

import type {
  GedcomDataset,
  GedcomRecord,
  IndividualRecord,
  PlaceRecord,
  SubmitterRecord,
} from '../structures';
import {
  isDuplicateCandidateRecord,
  isCensusRecord,
  isFamilyOrIndividual,
  isFamilyRecord,
  isIndividualRecord,
  isMultimediaRecord,
  isPlaceRecord,
} from '../structures';
import { collectPlaces } from '../places';
import type { PedigreeEnum } from '../enumerations';

/** The SOUR identifier written when exporting to 5.5.1 without one. */
export const DEFAULT_SYSTEM_ID_551 = 'DORU';

/** The name of the synthesized 5.5.1 submitter record. */
export const DEFAULT_SUBMITTER_NAME_551 = 'Unknown';

/** Returns a deep clone of the dataset (the model is plain data). */
function clone(dataset: GedcomDataset): GedcomDataset {
  // An iterative clone: `structuredClone` recurses, and a hand-made
  // file can nest thousands of extension levels (the vscode-gedcom
  // "numbered list" fixture nests 9000) — the same reason
  // parseExtension and emitExtension walk iteratively. The model is
  // plain data (objects, arrays, primitives — see model/), so the
  // generic clone covers it.
  const root = {} as Record<string, unknown>;
  const stack: Array<{ src: unknown; dst: unknown }> = [{ src: dataset, dst: root }];
  while (stack.length > 0) {
    const { src, dst } = stack.pop() as { src: unknown; dst: unknown };
    if (Array.isArray(src)) {
      const arr = dst as unknown[];
      for (const item of src) {
        if (item === null || typeof item !== 'object') {
          arr.push(item);
        } else {
          const child: unknown[] | Record<string, unknown> = Array.isArray(item) ? [] : {};
          arr.push(child);
          stack.push({ src: item, dst: child });
        }
      }
    } else {
      const obj = dst as Record<string, unknown>;
      const record = src as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        const item = record[key];
        if (item === null || typeof item !== 'object') {
          obj[key] = item;
        } else {
          const child: unknown[] | Record<string, unknown> = Array.isArray(item) ? [] : {};
          obj[key] = child;
          stack.push({ src: item, dst: child });
        }
      }
    }
  }
  return root as unknown as GedcomDataset;
}

/**
 * True when the record is a GEDCOM 5.5 embedded-multimedia record: an
 * OBJE record whose content is the record-level FORM/TITL/BLOB shape
 * with no FILE substructure (accepted in any file by
 * parsing/media.ts). Neither target version can spell it — both
 * require FILE {1:M}, and the FORM/TITL/BLOB extensions themselves are
 * dropped by the emitter's extension rule — so the projections drop
 * the whole record and strip the links to it.
 */
function isEmbeddedMediaRecord(record: GedcomRecord): boolean {
  return isMultimediaRecord(record) && record.files.length === 0;
}

/** True when the record still carries content after the NO removal. */
function isEmpty(record: GedcomRecord): boolean {
  if (isFamilyRecord(record)) {
    return (
      (record.events ?? []).length === 0 &&
      (record.attributes ?? []).length === 0 &&
      (record.nonEvents ?? []).length === 0 &&
      (record.spouseSealings ?? []).length === 0 &&
      (record.notes ?? []).length === 0 &&
      (record.citations ?? []).length === 0 &&
      (record.media ?? []).length === 0 &&
      (record.identifiers ?? []).length === 0 &&
      (record.associations ?? []).length === 0 &&
      (record.todos ?? []).length === 0 &&
      (record.marriageStatuses ?? []).length === 0 &&
      (record.witnesses ?? []).length === 0 &&
      (record.restriction ?? []).length === 0 &&
      (record.extensions ?? []).length === 0
    );
  }
  if (isIndividualRecord(record)) {
    return (
      (record.names ?? []).length === 0 &&
      record.sex === undefined &&
      (record.attributes ?? []).length === 0 &&
      (record.events ?? []).length === 0 &&
      (record.nonEvents ?? []).length === 0 &&
      (record.ordinances ?? []).length === 0 &&
      (record.notes ?? []).length === 0 &&
      (record.citations ?? []).length === 0 &&
      (record.media ?? []).length === 0 &&
      (record.identifiers ?? []).length === 0 &&
      (record.associations ?? []).length === 0 &&
      (record.aliases ?? []).length === 0 &&
      (record.ancestorInterests ?? []).length === 0 &&
      (record.descendantInterests ?? []).length === 0 &&
      (record.todos ?? []).length === 0 &&
      (record.restriction ?? []).length === 0 &&
      (record.extensions ?? []).length === 0
    );
  }
  // Only FAM and INDI records participate in the NO rule.
  return false;
}

/** Strips dangling and void pointers from one record. */
function stripPointers(record: GedcomRecord, valid: Set<string>): void {
  // Media links live on almost every record kind; a dropped multimedia
  // record would leave them dangling. The `in` narrowing keeps exactly
  // the union members that carry the slot.
  if ('media' in record) {
    const kept = (record.media ?? []).filter((link) => valid.has(link.object));
    if (kept.length === 0) {
      delete record.media;
    } else {
      record.media = kept;
    }
  }
  if (isCensusRecord(record)) {
    // The census entries point at INDI records, which the NO rule can
    // drop; a dangling census pointer would be invalid output.
    record.entries = (record.entries ?? []).filter(
      (entry) => entry.individual === undefined || valid.has(entry.individual),
    );
    return;
  }
  if (isDuplicateCandidateRecord(record)) {
    // The GDO duplicate-candidate record points at an INDI record,
    // which the NO rule can drop; a dangling _INDI pointer would be
    // invalid output.
    if (record.individual !== undefined && !valid.has(record.individual)) {
      delete record.individual;
    }
    return;
  }
  // Only FAM and INDI records participate in the NO rule (see
  // isEmpty), so only their pointers can dangle. Extension records in
  // particular carry an opaque `children` array that must never be
  // touched here.
  if (!isFamilyOrIndividual(record)) {
    return;
  }
  const rec = record;
  rec.submitters = (rec.submitters ?? []).filter((pointer) => valid.has(pointer));
  rec.associations = (rec.associations ?? []).filter((link) => valid.has(link.individual));
  rec.notes = (rec.notes ?? []).filter((note) => {
    if (note.tag !== 'NOTE' && note.tag !== 'SNOTE') {
      return true;
    }
    if (!('note' in note)) {
      // An inline note carries its text directly; nothing dangles.
      return true;
    }
    return note.note !== undefined && valid.has(note.note);
  });
  rec.citations = (rec.citations ?? []).filter((citation) => {
    if (citation.source === '@VOID@') {
      return true;
    }
    return valid.has(citation.source);
  });
  if (isIndividualRecord(rec)) {
    rec.aliases = (rec.aliases ?? []).filter((link) => valid.has(link.individual));
    rec.ancestorInterests = (rec.ancestorInterests ?? []).filter((pointer) => valid.has(pointer));
    rec.descendantInterests = (rec.descendantInterests ?? []).filter((pointer) => valid.has(pointer));
    rec.spouseFamilies = (rec.spouseFamilies ?? []).filter((link) => valid.has(link.family));
    rec.childFamilies = (rec.childFamilies ?? []).filter((link) => valid.has(link.family));
  }
  if (isFamilyRecord(rec)) {
    if (rec.husband !== undefined && !valid.has(rec.husband.partner)) {
      delete rec.husband;
    }
    if (rec.wife !== undefined && !valid.has(rec.wife.partner)) {
      delete rec.wife;
    }
    rec.children = (rec.children ?? []).filter((link) => valid.has(link.child));
  }
  // The events' family links: FamilyEventStructure and
  // IndividualEventStructure spell them as optional fields on their
  // members; the structural view keeps the loop over the shared shape.
  const events: Array<{ tag: string; familyChild?: string; adoptionFamily?: { family: string } }> = rec.events ?? [];
  for (const event of events) {
    if (event.familyChild !== undefined && !valid.has(event.familyChild)) {
      delete event.familyChild;
    }
    if (event.adoptionFamily !== undefined && !valid.has(event.adoptionFamily.family)) {
      delete event.adoptionFamily;
    }
  }
  if (isIndividualRecord(rec)) {
    for (const ordinance of rec.ordinances ?? []) {
      if (ordinance.tag === 'SLGC' && ordinance.familyChild !== undefined && !valid.has(ordinance.familyChild)) {
        delete ordinance.familyChild;
      }
    }
  }
  const cleanup = ['submitters', 'associations', 'notes', 'citations', 'media'] as const;
  for (const key of cleanup) {
    const value = rec[key];
    if (Array.isArray(value) && value.length === 0) {
      delete rec[key];
    }
  }
  if (isIndividualRecord(rec)) {
    const indiKeys = ['aliases', 'ancestorInterests', 'descendantInterests', 'spouseFamilies', 'childFamilies'] as const;
    for (const key of indiKeys) {
      const value = rec[key];
      if (Array.isArray(value) && value.length === 0) {
        delete rec[key];
      }
    }
  }
  if (isFamilyRecord(rec)) {
    const children = rec.children;
    if (Array.isArray(children) && children.length === 0) {
      delete rec.children;
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
 * Collects every cross-reference identifier used by an extension
 * pointer payload (see ExtensionStructure.payloadKind) anywhere in the
 * model — the model is a plain object graph, so the walk is structural
 * (the same pattern as collectPlaces, see places.ts). A record a
 * marked payload points at is kept alive by the projections below:
 * the 5.5.1 NO rule and the place-card projections must not drop a
 * record an extension payload references (a dangling pointer would be
 * invalid output, and 5.5.1 has no void pointer to replace it with).
 */
function collectExtensionPointerTargets(root: unknown): Set<string> {
  const out = new Set<string>();
  // An iterative structural walk: the model is a plain object graph,
  // and a hand-made file can nest thousands of extension levels (the
  // same reason parseExtension, emitExtension and the clone above
  // walk iteratively).
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push(item);
      }
      continue;
    }
    if (value === null || typeof value !== 'object') {
      continue;
    }
    const obj = value as Record<string, unknown>;
    if (obj['payloadKind'] === 'pointer' && typeof obj['payload'] === 'string') {
      out.add(obj['payload'] as string);
    }
    for (const key of Object.keys(obj)) {
      stack.push(obj[key]);
    }
  }
  return out;
}

/**
 * Whether the card carries fields without a standard spelling — the
 * GEDCOM-L set plus the Legacy `_PREP` preposition and the GEDCOM 5.5EL
 * coordinate MAP entries — that force the write-back as a `_LOC`
 * record.
 */
function hasGermanPlaceFields(card: PlaceRecord): boolean {
  return card.govId !== undefined
    || card.maidenhead !== undefined
    || card.preposition !== undefined
    || card.elMaps !== undefined
    || card.types !== undefined
    || card.postalCodes !== undefined
    || card.administrativeIds !== undefined
    || card.demographicData !== undefined
    || card.denomination !== undefined
    || card.events !== undefined
    || card.parents !== undefined
    || (card.names ?? []).some(
      (name) =>
        name.date !== undefined
        || (name.abbreviations ?? []).length > 0
        || name.language !== undefined
        || name.citations !== undefined
        || name.addition !== undefined
    )
    || (card.names ?? []).length > 1;
}

/**
 * Projects the vendor place records onto the standard for 5.5.1: each
 * card's map and notes are merged into every referencing place that
 * lacks its own copy (citations and media have no standard slot under
 * PLAC and are dropped), the location links are consumed, and the
 * records are removed. The exception: a GEDCOM-L card carrying the
 * German fields survives as a `_LOC` record and its referencing places
 * keep the pointer — as does a card an extension pointer payload
 * references (a dangling payload would be invalid output; see
 * collectExtensionPointerTargets). See the PlaceRecord JSDoc.
 */
function flattenPlaceRecords(dataset: GedcomDataset, pinned: ReadonlySet<string>): void {
  const places = collectPlaces(dataset.records);
  const survivors = new Set<string>();
  for (const record of dataset.records) {
    if (!isPlaceRecord(record) || record.xref === undefined) {
      continue;
    }
    if (hasGermanPlaceFields(record) || pinned.has(record.xref)) {
      survivors.add(record.xref);
      continue;
    }
    for (const place of places) {
      if (place.location !== record.xref) {
        continue;
      }
      if (place.map === undefined && record.map !== undefined) {
        place.map = record.map;
      }
      if (place.notes === undefined && record.notes !== undefined) {
        place.notes = record.notes;
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
      if (!isPlaceRecord(record)) {
        continue;
      }
      if (record.xref === undefined || !survivors.has(record.xref)) {
        continue;
      }
      for (const parent of record.parents ?? []) {
        if (parent.parent !== '@VOID@' && !survivors.has(parent.parent)) {
          survivors.add(parent.parent);
          changed = true;
        }
      }
    }
  }
  for (const place of places) {
    if (place.location !== undefined && !survivors.has(place.location)) {
      delete place.location;
    }
  }
  dataset.records = dataset.records.filter(
    (record) => !isPlaceRecord(record) || (record.xref !== undefined && survivors.has(record.xref)),
  );
}

/**
 * The 7.0 place projection: GEDCOM 7.0 §1.5 allows extension records,
 * so nothing needs flattening. Every vendor place card is written back
 * as a `_LOC` extension record with its full contents (citations,
 * media, the hierarchy — all of which the 5.5.1 flattening drops), and
 * the referencing places keep their `_LOC` pointers. Only the links
 * that would dangle are removed (a dangling pointer would be invalid
 * output): a place's `location` whose card is gone, a card's parent
 * whose card is gone, and a card with no name to write.
 */
function preservePlaceRecords70(dataset: GedcomDataset, pinned: ReadonlySet<string>): void {
  const cards = new Set<string>();
  for (const record of dataset.records) {
    if (isPlaceRecord(record) && record.xref !== undefined) {
      cards.add(record.xref);
    }
  }
  for (const record of dataset.records) {
    if (!isPlaceRecord(record)) {
      continue;
    }
    if (record.parents !== undefined) {
      const kept = record.parents.filter((parent) => parent.parent === '@VOID@' || cards.has(parent.parent));
      if (kept.length === 0) {
        delete record.parents;
      } else {
        record.parents = kept;
      }
    }
  }
  for (const place of collectPlaces(dataset.records)) {
    if (place.location !== undefined && !cards.has(place.location)) {
      delete place.location;
    }
  }
  dataset.records = dataset.records.filter((record) => {
    if (!isPlaceRecord(record)) {
      return true;
    }
    return (
      record.payload !== ''
      || (record.names?.length ?? 0) > 0
      || (record.xref !== undefined && pinned.has(record.xref))
    );
  });
}

/**
 * Applies the NO rule and the required-field defaults, returning a new
 * dataset safe to serialize as GEDCOM 5.5.1. The input is not mutated.
 */
export function prepareFor551(dataset: GedcomDataset): GedcomDataset {
  const out = clone(dataset);
  // Records referenced by extension pointer payloads must survive every
  // projection (see collectExtensionPointerTargets).
  const pinned = collectExtensionPointerTargets(out);
  flattenPlaceRecords(out, pinned);

  // 1. Drop the NO structures; remember which records carried one, so
  //    the empty-record rule below only applies to them. Exceptions: a
  //    bare NO MARR or NO DEAT on an INDI survives — it is written back
  //    as the vendor negatives _NMAR/_NLIV (see the emitter) — and a
  //    bare NO MARR on a FAM survives as the Ahnenblatt `_MARR N`.
  const emptied = new Set<string>();
  for (const record of out.records) {
    if (!isFamilyOrIndividual(record)) {
      continue;
    }
    const rec = record;
    if (rec.nonEvents !== undefined) {
      const kept = rec.nonEvents.filter(
        (nonEvent) => nonEvent.date === undefined && nonEvent.notes === undefined && nonEvent.citations === undefined
          && (nonEvent.payload === 'MARR' || (isIndividualRecord(rec) && nonEvent.payload === 'DEAT')),
      );
      const droppedAny = kept.length < rec.nonEvents.length;
      if (droppedAny && rec.xref !== undefined) {
        emptied.add(rec.xref);
      }
      if (kept.length === 0) {
        delete rec.nonEvents;
      } else {
        rec.nonEvents = kept;
      }
    }
  }

  // 2. Iterate to a fixpoint: strip dangling pointers, drop records that
  //    carried a NO and were left empty by its removal, repeat (dropping
  //    records may orphan more pointers and empty more records). Records
  //    referenced by an extension pointer payload are never dropped —
  //    their target must stay valid output.
  for (let round = 0; round < 100; round++) {
    const valid = new Set(
      out.records.map((record) => record.xref).filter((x): x is string => x !== undefined),
    );
    for (const record of out.records) {
      stripPointers(record, valid);
    }
    const kept = out.records.filter((record) => {
      if (isEmbeddedMediaRecord(record)) {
        // No 5.5.1 spelling exists for the 5.5 embedded shape: the
        // FORM/TITL/BLOB extensions are dropped by the emitter and the
        // record is left without its required FILE {1:M}. Dropped even
        // when pinned — an extension pointer payload to such a record
        // cannot be kept valid anyway.
        return false;
      }
      return record.xref === undefined || pinned.has(record.xref) || !emptied.has(record.xref) || !isEmpty(record);
    });
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
  // Records referenced by extension pointer payloads must survive the
  // place-card projection (see collectExtensionPointerTargets).
  const pinned = collectExtensionPointerTargets(out);
  preservePlaceRecords70(out, pinned);
  // The GEDCOM 5.5 embedded-multimedia record shape (no FILE
  // substructure) has no 7.0 spelling either — 7.0 requires FILE {1:M}
  // and the FORM/TITL/BLOB extensions are dropped by the emitter — so
  // such records are dropped here and the links to them stripped,
  // like the 5.5.1 projection does. Only media links can point at an
  // OBJE record, so one pass over the media links suffices (7.0 keeps
  // void pointers, unlike the 5.5.1 stripPointers rule).
  const embedded = out.records.filter(isEmbeddedMediaRecord);
  if (embedded.length > 0) {
    const valid = new Set(
      out.records
        .filter((record) => !isEmbeddedMediaRecord(record))
        .map((record) => record.xref)
        .filter((x): x is string => x !== undefined),
    );
    out.records = out.records.filter((record) => !isEmbeddedMediaRecord(record));
    for (const record of out.records) {
      if ('media' in record) {
        const kept = (record.media ?? []).filter((link) => valid.has(link.object));
        if (kept.length === 0) {
          delete record.media;
        } else {
          record.media = kept;
        }
      }
    }
  }
  const individuals = new Map<string, IndividualRecord>();
  for (const record of out.records) {
    if (isIndividualRecord(record) && record.xref !== undefined) {
      individuals.set(record.xref, record);
    }
  }
  for (const record of out.records) {
    if (!isFamilyRecord(record)) {
      continue;
    }
    const fam = record;
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
  // The AGES! position of the relation tags (under INDI.FAMC): an
  // agreeing pair is projected onto the same link's PEDI; the 7.0
  // emitter never writes the tags themselves (5.5.1 keeps them).
  for (const record of out.records) {
    if (!isIndividualRecord(record)) {
      continue;
    }
    const indi = record;
    for (const link of indi.childFamilies ?? []) {
      if (link.fatherRelation === undefined && link.motherRelation === undefined) {
        continue;
      }
      const father = link.fatherRelation?.trim().toLowerCase();
      const mother = link.motherRelation?.trim().toLowerCase();
      if (father === undefined || mother === undefined || father !== mother) {
        continue;
      }
      const payload = PEDI_BY_RELATION.get(father);
      if (payload !== undefined && link.pedigree === undefined) {
        link.pedigree = { payload };
      }
    }
  }
  return out;
}
