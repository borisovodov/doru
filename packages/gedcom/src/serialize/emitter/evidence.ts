/**
 * Emitters of the glamberson extension family: the gedcom-evidence
 * records and links, the gedcom-tags records and links, the occurrence
 * references and the shared `_ATTR`/`_VALUE` blocks (see
 * model/evidence-record.ts for the sources). Extension records and
 * underscore tags are valid wire spellings in both target versions, so
 * every construct here writes back the same in 5.5.1 and 7.0.
 */

import type {
  ChangeDate,
  EvidenceEvent,
  EvidenceFinding,
  EvidenceRecord,
  EvidenceReference,
  OccurrenceReference,
  ResearchActivityRecord,
  ResearchDocumentRecord,
  TagLink,
  TagRecord,
  VendorAttribute,
} from '../../structures';
import type { Writer } from '../writer';
import type { Version } from '../writer';
import { emitAge, emitDate, emitDateExact, emitExtensions, emitNoteStructure, emitSourceCitation } from './structures';
import { emitPlace } from './names-places';
import { ptr } from './values';

/** Emits a CHAN block (the same spelling the record emitters use). */
export function emitChangeBlock(w: Writer, version: Version, level: number, change: ChangeDate): void {
  w.line(level, 'CHAN');
  emitDateExact(w, version, level + 1, 'DATE', change.date, change.date.time);
  for (const note of change.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const citation of change.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
  if (change.user !== undefined) {
    w.line(level + 1, '_WT_USER', { value: change.user });
  }
  emitExtensions(w, version, level + 1, change);
}

/** Emits one `_ATTR` name/value block. */
export function emitVendorAttribute(w: Writer, version: Version, level: number, attr: VendorAttribute): void {
  w.line(level, '_ATTR', { value: attr.payload });
  if (attr.value !== undefined) {
    w.line(level + 1, '_VALUE', { value: attr.value });
  }
  for (const note of attr.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  emitExtensions(w, version, level + 1, attr);
}

/** Emits one `_FIND` finding. */
export function emitEvidenceFinding(w: Writer, version: Version, level: number, finding: EvidenceFinding): void {
  w.line(level, '_FIND', { value: finding.payload });
  if (finding.type !== undefined) {
    w.line(level + 1, 'TYPE', { value: finding.type });
  }
  if (finding.date !== undefined) {
    emitDate(w, version, level + 1, 'DATE', finding.date);
  }
  if (finding.place !== undefined) {
    emitPlace(w, version, level + 1, finding.place);
  }
  if (finding.age !== undefined) {
    emitAge(w, version, level + 1, finding.age);
  }
  for (const note of finding.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const evidence of finding.evidence ?? []) {
    ptr(w, version, level + 1, '_EVID', evidence);
  }
  emitExtensions(w, version, level + 1, finding);
}

/** Emits one person/family-side `_EVREF` evidence reference. */
export function emitEvidenceReference(w: Writer, version: Version, level: number, ref: EvidenceReference): void {
  if (version !== '7.0' && ref.evidence === '@VOID@') {
    // 5.5.1 has no void pointer and the reference has no payload-free
    // spelling; the whole block is dropped (the void-citation rule).
    return;
  }
  ptr(w, version, level, '_EVREF', ref.evidence);
  if (ref.confidence !== undefined) {
    w.line(level + 1, '_CONF', { value: ref.confidence });
  }
  if (ref.used !== undefined) {
    w.line(level + 1, '_USED', { value: ref.used });
  }
  if (ref.quality !== undefined) {
    w.line(level + 1, 'QUAY', { value: ref.quality });
  }
  for (const document of ref.documents ?? []) {
    ptr(w, version, level + 1, '_RDOC', document);
  }
  for (const note of ref.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  emitExtensions(w, version, level + 1, ref);
}

/** Emits one `_EVEN_EVID` attached-evidence event. */
export function emitEvidenceEvent(w: Writer, version: Version, level: number, event: EvidenceEvent): void {
  w.line(level, '_EVEN_EVID');
  if (event.type !== undefined) {
    w.line(level + 1, 'TYPE', { value: event.type });
  }
  if (event.date !== undefined) {
    emitDate(w, version, level + 1, 'DATE', event.date);
  }
  for (const citation of event.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
  for (const finding of event.findings ?? []) {
    emitEvidenceFinding(w, version, level + 1, finding);
  }
  if (event.confidence !== undefined) {
    w.line(level + 1, '_CONF', { value: event.confidence });
  }
  for (const note of event.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  emitExtensions(w, version, level + 1, event);
}

/** Emits one `_OCREF` occurrence reference. */
export function emitOccurrenceReference(w: Writer, version: Version, level: number, ref: OccurrenceReference): void {
  if (version !== '7.0' && ref.occurrence === '@VOID@') {
    // 5.5.1 has no void pointer and the reference has no payload-free
    // spelling; the whole block is dropped (the void-citation rule).
    return;
  }
  ptr(w, version, level, '_OCREF', ref.occurrence);
  if (ref.role !== undefined) {
    w.line(level + 1, 'ROLE', { value: ref.role });
  }
  if (ref.age !== undefined) {
    emitAge(w, version, level + 1, ref.age);
  }
  for (const note of ref.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const citation of ref.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
  for (const attr of ref.attributes ?? []) {
    emitVendorAttribute(w, version, level + 1, attr);
  }
  emitExtensions(w, version, level + 1, ref);
}

/** Emits one `_TAG @xref@` application link. */
export function emitTagLink(w: Writer, version: Version, level: number, link: TagLink): void {
  if (version !== '7.0' && link.target === '@VOID@') {
    // 5.5.1 has no void pointer and the link has no payload-free
    // spelling; the whole block is dropped (the void-citation rule).
    return;
  }
  ptr(w, version, level, '_TAG', link.target);
  if (link.date !== undefined) {
    emitDate(w, version, level + 1, 'DATE', link.date);
  }
  for (const note of link.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  emitExtensions(w, version, level + 1, link);
}

/** Emits a `_EVID` record. */
export function emitEvidenceRecord(w: Writer, version: Version, rec: EvidenceRecord): void {
  w.line(0, '_EVID', { xref: rec.xref });
  if (rec.type !== undefined) {
    w.line(1, '_TYPE', { value: rec.type });
  }
  if (rec.documentType !== undefined) {
    w.line(1, '_DTYPE', { value: rec.documentType });
  }
  for (const identifier of rec.identifiers ?? []) {
    w.line(1, '_ID', { value: identifier });
  }
  if (rec.date !== undefined) {
    emitDate(w, version, 1, 'DATE', rec.date);
  }
  for (const citation of rec.citations ?? []) {
    emitSourceCitation(w, version, 1, citation);
  }
  for (const finding of rec.findings ?? []) {
    emitEvidenceFinding(w, version, 1, finding);
  }
  for (const analysis of rec.analysis ?? []) {
    w.line(1, '_ANAL', { value: analysis });
  }
  for (const uid of rec.uids ?? []) {
    w.line(1, 'UID', { value: uid });
  }
  for (const document of rec.documents ?? []) {
    ptr(w, version, 1, '_RDOC', document);
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, 1, note);
  }
  if (rec.changeDate !== undefined) {
    emitChangeBlock(w, version, 1, rec.changeDate);
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits a `_RDOC` research-documentation record. */
export function emitResearchDocumentRecord(w: Writer, version: Version, rec: ResearchDocumentRecord): void {
  w.line(0, '_RDOC', { xref: rec.xref });
  if (rec.title !== undefined) {
    w.line(1, '_TITL', { value: rec.title });
  }
  if (rec.text !== undefined) {
    w.line(1, '_TEXT', { value: rec.text });
  }
  for (const subject of rec.subjects ?? []) {
    ptr(w, version, 1, '_SUBJ', subject);
  }
  for (const evidence of rec.evidence ?? []) {
    ptr(w, version, 1, '_EVID', evidence);
  }
  for (const conclusion of rec.conclusions ?? []) {
    w.line(1, '_CONC');
    if (conclusion.subject !== undefined) {
      ptr(w, version, 2, '_SUBJ', conclusion.subject);
    }
    if (conclusion.text !== undefined) {
      w.line(2, '_TEXT', { value: conclusion.text });
    }
    emitExtensions(w, version, 2, conclusion);
  }
  if (rec.author !== undefined) {
    w.line(1, 'AUTH', { value: rec.author });
  }
  if (rec.date !== undefined) {
    emitDate(w, version, 1, 'DATE', rec.date);
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, 1, note);
  }
  if (rec.changeDate !== undefined) {
    emitChangeBlock(w, version, 1, rec.changeDate);
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits a `_RACT` research-activity record. */
export function emitResearchActivityRecord(w: Writer, version: Version, rec: ResearchActivityRecord): void {
  w.line(0, '_RACT', { xref: rec.xref });
  if (rec.type !== undefined) {
    w.line(1, '_TYPE', { value: rec.type });
  }
  if (rec.purpose !== undefined) {
    w.line(1, '_PURP', { value: rec.purpose });
  }
  if (rec.target !== undefined) {
    w.line(1, '_TARG', { value: rec.target });
  }
  if (rec.venue !== undefined) {
    w.line(1, '_VENU', { value: rec.venue });
  }
  if (rec.result !== undefined) {
    w.line(1, '_RSLT', { value: rec.result });
  }
  for (const finding of rec.findings ?? []) {
    emitEvidenceFinding(w, version, 1, finding);
  }
  if (rec.date !== undefined) {
    emitDate(w, version, 1, 'DATE', rec.date);
  }
  if (rec.researcher !== undefined) {
    w.line(1, '_RSRCH', { value: rec.researcher });
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, 1, note);
  }
  if (rec.changeDate !== undefined) {
    emitChangeBlock(w, version, 1, rec.changeDate);
  }
  emitExtensions(w, version, 1, rec);
}

/** Emits a `_TAG` organizational-tag record. */
export function emitTagRecord(w: Writer, version: Version, rec: TagRecord): void {
  w.line(0, '_TAG', { xref: rec.xref });
  if (rec.name !== undefined) {
    w.line(1, 'NAME', { value: rec.name });
  }
  if (rec.color !== undefined) {
    w.line(1, '_COLOR', { value: rec.color });
  }
  for (const attr of rec.attributes ?? []) {
    emitVendorAttribute(w, version, 1, attr);
  }
  emitExtensions(w, version, 1, rec);
}
