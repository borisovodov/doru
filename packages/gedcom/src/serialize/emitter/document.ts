/**
 * Serializer section: header, dataset and record dispatch.
 *
 * Part of the serializer split; see serialize.ts for the public API.
 * These functions are projections: see the README's Serialization
 * section for what is translated and what is dropped.
 */

import type {
  AddressStructure,
  ChangeDate,
  CreationDate,
  DateExactStructure,
  ExtensionStructure,
  GedcomDataset,
  Header,
  MultimediaLink,
  NoteStructure,
  SourceCitation,
} from '../../structures';
import type {
  Version,
} from '../writer';
import {
  Writer,
} from '../writer';
import {
  emitFamily,
  emitIndividual,
  emitMultimedia,
  emitNoteRecord,
  emitNoteRecordAs70,
  emitRepository,
  emitSharedNote,
  emitSharedNoteAs551,
  emitSource,
  emitTodoRecord,
} from './records';
import type {
  PlaceRecord,
} from '../../structures';
import {
  emitPlaceRecord,
} from './names-places';
import {
  emitAddress,
  emitDateExact,
  emitExtension,
  emitExtensions,
  emitMultimediaLink,
  emitNoteStructure,
  emitSourceCitation,
  mergedAddress,
} from './structures';
import {
  language,
  ptr,
} from './values';

export function emitDataset(w: Writer, version: Version, dataset: GedcomDataset): void {
  emitHeader(w, version, dataset.header);
  if (version === '5.5.1' && dataset.submission !== undefined) {
    emitSubmission(w, version, dataset.submission);
  }
  for (const record of dataset.records) {
    emitRecord(w, version, record);
  }
  w.line(0, 'TRLR');
}

// -- Header ---------------------------------------------------------------

export function emitHeader(w: Writer, version: Version, header: Header): void {
  const h = header;
  w.line(0, 'HEAD');
  if (version === '7.0') {
    if (h.schema !== undefined) {
      w.line(1, 'SCHMA');
      for (const def of h.schema.tagDefinitions) {
        w.line(2, 'TAG', { value: `${def.payload.tag} ${def.payload.uri}` });
      }
    }
  }
  if (h.source !== undefined) {
    emitHeaderSource(w, version, h.source);
  }
  if (h.destination !== undefined) {
    w.line(1, 'DEST', { value: h.destination });
  }
  if (h.date !== undefined) {
    emitDateExact(w, version, 1, 'DATE', h.date, h.date.time);
  }
  if (version === '5.5.1' && h.submitter !== undefined) {
    ptr(w, version, 1, 'SUBM', h.submitter);
  }
  if (version === '5.5.1') {
    if (h.submission !== undefined) {
      ptr(w, version, 1, 'SUBN', h.submission);
    }
    if (h.fileName !== undefined) {
      w.line(1, 'FILE', { value: h.fileName });
    }
  }
  if (h.copyright !== undefined) {
    w.line(1, 'COPR', { value: h.copyright });
  }
  w.line(1, 'GEDC');
  w.line(2, 'VERS', { value: version === '7.0' ? '7.0' : '5.5.1' });
  if (version === '5.5.1') {
    w.line(2, 'FORM', { value: 'LINEAGE-LINKED' });
  }
  if (version === '5.5.1') {
    // Export is always UTF-8 (the model is post-decode).
    w.line(1, 'CHAR', { value: 'UTF-8' });
  }
  if (h.language !== undefined) {
    const value = language(w, version, h.language);
    if (value !== undefined) {
      w.line(1, 'LANG', { value });
    }
  }
  if (h.place !== undefined) {
    w.line(1, 'PLAC');
    w.line(2, 'FORM', { value: h.place.form.join(', ') });
  }
  if (h.note !== undefined) {
    emitNoteStructure(w, version, 1, h.note);
  }
  emitExtensions(w, version, 1, h);
}

export function emitHeaderSource(w: Writer, version: Version, source: {
  payload: string;
  version?: string;
  name?: string;
  corporation?: {
    payload: string;
    address?: AddressStructure;
    phone?: string[];
    email?: string[];
    fax?: string[];
    www?: string[];
  };
  data?: {
    payload: string;
    date?: DateExactStructure;
    copyright?: string;
  };
}): void {
  w.line(1, 'SOUR', { value: source.payload });
  if (source.version !== undefined) {
    w.line(2, 'VERS', { value: source.version });
  }
  if (source.name !== undefined) {
    w.line(2, 'NAME', { value: source.name });
  }
  if (source.corporation !== undefined) {
    emitCorporation(w, version, source.corporation);
  }
  if (source.data !== undefined) {
    w.line(2, 'DATA', { value: source.data.payload });
    if (source.data.date !== undefined) {
      emitDateExact(w, version, 3, 'DATE', source.data.date, source.data.date.time);
    }
    if (source.data.copyright !== undefined) {
      w.line(3, 'COPR', { value: source.data.copyright });
    }
  }
}

export function emitCorporation(w: Writer, version: Version, corp: {
  payload: string;
  address?: AddressStructure;
  phone?: string[];
  email?: string[];
  fax?: string[];
  www?: string[];
}): void {
  w.line(2, 'CORP', { value: corp.payload });
  const address = mergedAddress(w, version, corp.address, corp);
  if (address !== undefined) {
    emitAddress(w, version, 3, address);
  }
  if (version === '7.0') {
    // The 5.5.1-position contacts inside ADDR are relocated here.
    for (const value of corp.phone ?? corp.address?.phone ?? []) {
      w.line(3, 'PHON', { value });
    }
    for (const value of corp.email ?? corp.address?.email ?? []) {
      w.line(3, 'EMAIL', { value });
    }
    for (const value of corp.fax ?? corp.address?.fax ?? []) {
      w.line(3, 'FAX', { value });
    }
    for (const value of corp.www ?? corp.address?.www ?? []) {
      w.line(3, 'WWW', { value });
    }
  }
}

// -- Records ----------------------------------------------------------------

export function emitRecord(w: Writer, version: Version, record: GedcomDataset['records'][number]): void {
  switch (record.tag) {
    case 'FAM':
      emitFamily(w, version, record);
      return;
    case 'INDI':
      emitIndividual(w, version, record);
      return;
    case 'OBJE':
      emitMultimedia(w, version, record);
      return;
    case 'REPO':
      emitRepository(w, version, record);
      return;
    case 'SNOTE':
      if (version === '7.0') {
        emitSharedNote(w, version, record);
      } else {
        emitSharedNoteAs551(w, version, record);
      }
      return;
    case 'NOTE':
      if (version === '5.5.1') {
        emitNoteRecord(w, version, record);
      } else {
        emitNoteRecordAs70(w, version, record);
      }
      return;
    case 'SOUR':
      emitSource(w, version, record);
      return;
    case 'SUBM':
      emitSubmitter(w, version, record);
      return;
    case 'SUBN':
      // A stray SUBN in the records list is dropped.
      return;
    case '_TODO':
      emitTodoRecord(w, version, record as Parameters<typeof emitTodoRecord>[2]);
      return;
    case '_PLAC':
      if (version === '5.5.1') {
        emitPlaceRecord(w, version, record as PlaceRecord);
      }
      // 7.0 never carries place records (prepareFor70 flattened them).
      return;
    default:
      emitExtension(w, version, 0, record as ExtensionStructure, (record as { xref?: string }).xref);
      return;
  }
}

export function commonRecordFields(w: Writer, version: Version, rec: {
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  media?: MultimediaLink[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
}, level: number): void {
  for (const identifier of rec.identifiers ?? []) {
    if (identifier.tag === 'EXID' && version !== '7.0') {
      // 5.5.1 has no EXID; dropped.
      continue;
    }
    if (identifier.tag === 'UID' && version !== '7.0') {
      w.line(level, '_UID', { value: identifier.payload });
      continue;
    }
    w.line(level, identifier.tag, { value: identifier.payload });
    if (identifier.type !== undefined) {
      w.line(level + 1, 'TYPE', { value: identifier.type });
    }
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, level, note);
  }
  for (const citation of rec.citations ?? []) {
    emitSourceCitation(w, version, level, citation);
  }
  for (const media of rec.media ?? []) {
    emitMultimediaLink(w, version, level, media);
  }
  if (rec.changeDate !== undefined) {
    w.line(level, 'CHAN');
    emitDateExact(w, version, level + 1, 'DATE', rec.changeDate.date, rec.changeDate.date.time);
    for (const note of rec.changeDate.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
  }
  if (rec.creationDate !== undefined && version === '7.0') {
    w.line(level, 'CREA');
    emitDateExact(w, version, level + 1, 'DATE', rec.creationDate.date, rec.creationDate.date.time);
  }
  if (rec.automatedRecordId !== undefined && version === '5.5.1') {
    w.line(level, 'RIN', { value: rec.automatedRecordId });
  }
  emitExtensions(w, version, level, rec);
}

export function emitSubmitter(w: Writer, version: Version, rec: {
  tag: 'SUBM';
  name: string;
  address?: AddressStructure;
  phone?: string[];
  email?: string[];
  fax?: string[];
  www?: string[];
  media?: MultimediaLink[];
  languages?: string[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  registeredRfn?: string;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SUBM', { xref: rec.xref });
  w.line(1, 'NAME', { value: rec.name });
  const address = mergedAddress(w, version, rec.address, rec);
  if (address !== undefined) {
    emitAddress(w, version, 1, address);
  }
  if (version === '7.0') {
    // The 5.5.1-position contacts inside ADDR are relocated here.
    for (const value of rec.phone ?? rec.address?.phone ?? []) {
      w.line(1, 'PHON', { value });
    }
    for (const value of rec.email ?? rec.address?.email ?? []) {
      w.line(1, 'EMAIL', { value });
    }
    for (const value of rec.fax ?? rec.address?.fax ?? []) {
      w.line(1, 'FAX', { value });
    }
    for (const value of rec.www ?? rec.address?.www ?? []) {
      w.line(1, 'WWW', { value });
    }
  }
  for (const media of rec.media ?? []) {
    emitMultimediaLink(w, version, 1, media);
  }
  for (const languageId of rec.languages ?? []) {
    const value = language(w, version, languageId);
    if (value !== undefined) {
      w.line(1, 'LANG', { value });
    }
  }
  if (rec.registeredRfn !== undefined && version === '5.5.1') {
    w.line(1, 'RFN', { value: rec.registeredRfn });
  }
  commonRecordFields(w, version, rec, 1);
}

export function emitSubmission(w: Writer, version: Version, rec: {
  tag: 'SUBN';
  submitter?: string;
  familyFile?: string;
  temple?: string;
  generationsOfAncestors?: number;
  generationsOfDescendants?: number;
  ordinanceProcessFlag?: 'yes' | 'no';
  notes?: NoteStructure[];
  changeDate?: ChangeDate;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SUBN', { xref: rec.xref });
  if (rec.submitter !== undefined) {
    ptr(w, version, 1, 'SUBM', rec.submitter);
  }
  if (rec.familyFile !== undefined) {
    w.line(1, 'FAMF', { value: rec.familyFile });
  }
  if (rec.temple !== undefined) {
    w.line(1, 'TEMP', { value: rec.temple });
  }
  if (rec.generationsOfAncestors !== undefined) {
    w.line(1, 'ANCE', { value: String(rec.generationsOfAncestors) });
  }
  if (rec.generationsOfDescendants !== undefined) {
    w.line(1, 'DESC', { value: String(rec.generationsOfDescendants) });
  }
  if (rec.ordinanceProcessFlag !== undefined) {
    w.line(1, 'ORDI', { value: rec.ordinanceProcessFlag });
  }
  for (const note of rec.notes ?? []) {
    emitNoteStructure(w, version, 1, note);
  }
  if (rec.changeDate !== undefined) {
    w.line(1, 'CHAN');
    emitDateExact(w, version, 2, 'DATE', rec.changeDate.date, rec.changeDate.date.time);
    for (const note of rec.changeDate.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
  }
  if (rec.automatedRecordId !== undefined) {
    w.line(1, 'RIN', { value: rec.automatedRecordId });
  }
  emitExtensions(w, version, 1, rec);
}

// -- Substructures -----------------------------------------------------------

