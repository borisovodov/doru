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
  emitEventDefinition,
  emitDuplicateCandidateRecord,
} from './records';
import {
  emitCensusRecord,
} from './census';
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
      emitExtensions(w, version, 2, h.schema);
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
  if (h.submitter !== undefined) {
    // Written in both versions: 7.0 HEAD.SUBM is {0:1} (the pointer is
    // kept verbatim, @VOID@ included); prepareFor551 fills a live
    // pointer for 5.5.1, where SUBM is required.
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
  if (h.schema53 !== undefined) {
    // The GEDCOM 5.3 user-tag declaration block (the Family Tree Maker
    // dialect; see Header.schema53). 5.5.1 writes the 5.3 spelling
    // SCHEMA; 7.0 has no SCHEMA structure, so the block is written as
    // the extension record `_SCHEMA` (its GEDCOM-L N5 spelling), which
    // the 7.0 extension mechanism preserves verbatim.
    w.line(1, version === '7.0' ? '_SCHEMA' : 'SCHEMA');
    for (const entry of h.schema53.entries) {
      let level = 2;
      for (const tag of entry.context) {
        w.line(level, tag);
        level += 1;
      }
      if (entry.label !== undefined) {
        w.line(level, 'LABL', { value: entry.label });
      }
      if (entry.definition !== undefined) {
        w.line(level, 'DEFN', { value: entry.definition });
      }
      if (entry.parent !== undefined) {
        w.line(level, 'ISA', { value: entry.parent });
      }
      emitExtensions(w, version, level, entry);
    }
    emitExtensions(w, version, 2, h.schema53);
  }
  w.line(1, 'GEDC');
  // GEDCOM 7.0 §3.2.1 g7:GEDC-VERS: "must include the major and minor
  // version... it may include the patch as well, but doing so is not
  // required". The serializer emits the base grammar it implements, so
  // a patch level of an imported file (e.g. "7.0.14") is not carried
  // over — the output always conforms to the 7.0 core specification.
  w.line(2, 'VERS', { value: version === '7.0' ? '7.0' : '5.5.1' });
  if (h.gedcom.addendum !== undefined) {
    // The GEDCOM-L addendum declaration under GEDC.VERS (see
    // Gedcom.addendum): written back in both versions; in 7.0 it
    // travels as an extension under the standard GEDC structure.
    w.line(3, '_ADDENDUM');
    if (h.gedcom.addendum.version !== undefined) {
      w.line(4, 'VERS', { value: h.gedcom.addendum.version });
    }
    if (h.gedcom.addendum.www !== undefined) {
      w.line(4, 'WWW', { value: h.gedcom.addendum.www });
    }
    emitExtensions(w, version, 4, h.gedcom.addendum);
  }
  if (version === '5.5.1') {
    w.line(2, 'FORM', { value: 'LINEAGE-LINKED' });
  }
  emitExtensions(w, version, 2, h.gedcom);
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
    emitExtensions(w, version, 2, h.place);
  }
  if (h.note !== undefined) {
    emitNoteStructure(w, version, 1, h.note);
  }
  if (h.startPerson !== undefined) {
    // Ages! / Ahnenblatt / GEDitCOM: the start person shown after
    // opening the file (see Header.startPerson); written back as
    // `_HOME` plus the Ahnenblatt `_NAVM` mode when set.
    ptr(w, version, 1, '_HOME', h.startPerson);
    if (h.startPersonMode !== undefined) {
      w.line(1, '_NAVM', { value: h.startPersonMode });
    }
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
    extensions?: ExtensionStructure[];
  };
  data?: {
    payload: string;
    date?: DateExactStructure;
    copyright?: string;
    extensions?: ExtensionStructure[];
  };
  extensions?: ExtensionStructure[];
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
    emitExtensions(w, version, 3, source.data);
  }
  emitExtensions(w, version, 2, source);
}

export function emitCorporation(w: Writer, version: Version, corp: {
  payload: string;
  address?: AddressStructure;
  phone?: string[];
  email?: string[];
  fax?: string[];
  www?: string[];
  extensions?: ExtensionStructure[];
}): void {
  w.line(2, 'CORP', { value: corp.payload });
  const address = mergedAddress(w, version, corp.address, corp);
  if (address !== undefined) {
    emitAddress(w, version, 3, address);
  }
  // 5.5.1 CORP carries only the ADDRESS_STRUCTURE (GEDCOM 5.5.1 §2
  // p.54): contacts with no address block have no 5.5.1 slot and are
  // dropped (see mergedAddress).
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
  emitExtensions(w, version, 3, corp);
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
    case '_EVENT_DEFN':
      emitEventDefinition(w, version, record as Parameters<typeof emitEventDefinition>[2]);
      return;
    case '_CENR':
      emitCensusRecord(w, version, record as Parameters<typeof emitCensusRecord>[2]);
      return;
    case '_ALIA':
      emitDuplicateCandidateRecord(w, version, record as Parameters<typeof emitDuplicateCandidateRecord>[2]);
      return;
    case '_PLAC':
      emitPlaceRecord(w, version, record as PlaceRecord);
      return;
    default:
      emitExtension(w, version, 0, record as ExtensionStructure);
      return;
  }
}

/** The GDO `_SUBM` pointers of records whose standard grammar has no
 *  SUBM slot: written as `_SUBM` (see SourceRecord.submitters). FAM and
 *  INDI write theirs as the standard SUBM {0:M} instead. */
export function emitGdoSubmitters(w: Writer, version: Version, level: number, submitters?: string[]): void {
  for (const submitter of submitters ?? []) {
    ptr(w, version, level, '_SUBM', submitter);
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
  submitters?: string[];
  importReference?: { record?: string; page?: string };
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
    if (rec.changeDate.user !== undefined) {
      // webtrees: the user who made the change (see ChangeDate.user).
      w.line(level + 1, '_WT_USER', { value: rec.changeDate.user });
    }
    emitExtensions(w, version, level + 1, rec.changeDate);
  }
  if (rec.creationDate !== undefined && version === '7.0') {
    w.line(level, 'CREA');
    emitDateExact(w, version, level + 1, 'DATE', rec.creationDate.date, rec.creationDate.date.time);
    emitExtensions(w, version, level + 1, rec.creationDate);
  }
  if (rec.automatedRecordId !== undefined && version === '5.5.1') {
    w.line(level, 'RIN', { value: rec.automatedRecordId });
  }
  // Note: the GDO `_SUBM` pointers (rec.submitters) are NOT written
  // here: FAM and INDI write their submitters as the standard SUBM
  // {0:M} slot, and the record emitters of the other record kinds
  // write the `_SUBM` spelling themselves before calling this
  // function (the standard grammars of those records have no SUBM
  // slot).
  if (rec.importReference !== undefined) {
    // GDO: the import-file reference (see ImportFileReference).
    w.line(level, '_IMPF', { value: rec.importReference.record });
    if (rec.importReference.page !== undefined) {
      w.line(level + 1, 'PAGE', { value: rec.importReference.page });
    }
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
  submitters?: string[];
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
  // 5.5.1 SUBM carries only the ADDRESS_STRUCTURE (GEDCOM 5.5.1 §2
  // p.28): PHON and FAX have no 5.5.1 slot without an address block and
  // are dropped, while the Family Historian spellings `_EMAIL`/`_WEB`
  // carry the record-level e-mail and web address (see
  // SubmitterRecord.email/www).
  if (version === '5.5.1' && address === undefined) {
    for (const value of rec.email ?? []) {
      w.line(1, '_EMAIL', { value });
    }
    for (const value of rec.www ?? []) {
      w.line(1, '_WEB', { value });
    }
  }
  // Note: the media links are written by commonRecordFields below — the
  // SUBM emitter must not write them twice.
  for (const languageId of (version === '5.5.1' ? (rec.languages ?? []).slice(0, 3) : (rec.languages ?? []))) {
    // The 5.5.1 SUBM LANG limit is {0:3} (GEDCOM 5.5.1 §2 p.28):
    // values beyond the third are dropped.
    const value = language(w, version, languageId);
    if (value !== undefined) {
      w.line(1, 'LANG', { value });
    }
  }
  if (rec.registeredRfn !== undefined && version === '5.5.1') {
    w.line(1, 'RFN', { value: rec.registeredRfn });
  }
  emitGdoSubmitters(w, version, 1, rec.submitters);
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
  submitters?: string[];
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
    if (rec.changeDate.user !== undefined) {
      // webtrees: the user who made the change (see ChangeDate.user).
      w.line(2, '_WT_USER', { value: rec.changeDate.user });
    }
  }
  if (rec.automatedRecordId !== undefined) {
    w.line(1, 'RIN', { value: rec.automatedRecordId });
  }
  emitGdoSubmitters(w, version, 1, rec.submitters);
  emitExtensions(w, version, 1, rec);
}

// -- Substructures -----------------------------------------------------------

