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
  TagLink,
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
  emitPublishedSiteRecord,
  emitGroupRecord,
  emitOccurrenceRecord,
  emitTreeCategoryRecord,
  emitTreeTagRecord,
  emitGenoProRecord,
  emitTitleRecord,
} from './records';
import {
  emitCensusRecord,
} from './census';
import {
  emitEvidenceRecord,
  emitResearchActivityRecord,
  emitResearchDocumentRecord,
  emitTagLink,
  emitTagRecord,
} from './evidence';
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
  if (h.schema !== undefined && ((h.schema.prefixes?.length ?? 0) > 0 || (h.schema.elfDefinitions?.length ?? 0) > 0)) {
    // The ELF declarations live in the SCHMA block of the ELF
    // serialization (https://fhiso.org/TR/elf) whatever the declared
    // version; 5.5.1 files carry them the same way (the ELF test
    // files declare 5.5.1), so they are written back in both
    // versions — 7.0 reopens its own SCHMA line for them.
    if (version === '5.5.1') {
      w.line(1, 'SCHMA');
    }
    for (const prefix of h.schema.prefixes ?? []) {
      // The ELF prefix declaration (see Schema.prefixes).
      w.line(2, 'PRFX', { value: `${prefix.prefix} ${prefix.uri}` });
      emitExtensions(w, version, 3, prefix);
    }
    for (const definition of h.schema.elfDefinitions ?? []) {
      // The ELF tag declaration (see Schema.elfDefinitions).
      w.line(2, 'IRI', { value: definition.iri });
      for (const tagValue of definition.tagValues ?? []) {
        w.line(3, 'TAG', { value: tagValue });
      }
      for (const parent of definition.parents ?? []) {
        w.line(3, 'ISA', { value: parent });
      }
      if (definition.language !== undefined) {
        w.line(3, 'LANG', { value: definition.language });
      }
      emitExtensions(w, version, 3, definition);
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
    if (h.timezone !== undefined) {
      // MyHeritage: the timezone of the export date (see
      // Header.timezone), written back under the header DATE.
      w.line(2, '_TIMEZONE', { value: h.timezone });
    }
  }
  if (h.submitter !== undefined) {
    // Written in both versions: 7.0 HEAD.SUBM is {0:1} (the pointer is
    // kept verbatim, @VOID@ included); prepareFor551 fills a live
    // pointer for 5.5.1, where SUBM is required.
    ptr(w, version, 1, 'SUBM', h.submitter);
    if (h.submitterName !== undefined) {
      // The Family Echo submitter contact under the SUBM pointer (see
      // Header.submitterName).
      w.line(2, 'NAME', { value: h.submitterName });
    }
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
  for (const addendum of h.gedcom.addenda ?? []) {
    // The GEDCOM-L addendum declarations under GEDC.VERS (see
    // Gedcom.addenda): written back in both versions; in 7.0 they
    // travel as extensions under the standard GEDC structure.
    w.line(3, '_ADDENDUM', addendum.payload === undefined ? {} : { value: addendum.payload });
    if (addendum.version !== undefined) {
      w.line(4, 'VERS', { value: addendum.version });
    }
    if (addendum.www !== undefined) {
      w.line(4, 'WWW', { value: addendum.www });
    }
    emitExtensions(w, version, 4, addendum);
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
    if (h.place.form !== undefined) {
      w.line(2, 'FORM', { value: h.place.form.join(', ') });
    }
    emitExtensions(w, version, 2, h.place);
  }
  if (h.note !== undefined) {
    emitNoteStructure(w, version, 1, h.note);
  }
  if (h.originalSource !== undefined) {
    // The product that originally wrote the data (see
    // Header.originalSource): written back as the `_ORGSOUR` block
    // with its NAME/VERS children in both versions.
    w.line(1, '_ORGSOUR');
    if (h.originalSource.name !== undefined) {
      w.line(2, 'NAME', { value: h.originalSource.name });
    }
    if (h.originalSource.version !== undefined) {
      w.line(2, 'VERS', { value: h.originalSource.version });
    }
    emitExtensions(w, version, 2, h.originalSource);
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
  if (h.projectGuid !== undefined) {
    // MyHeritage: the project identifier (see Header.projectGuid).
    w.line(1, '_PROJECT_GUID', { value: h.projectGuid });
  }
  if (h.exportedFromSiteId !== undefined) {
    // MyHeritage: the exported-from site id (see
    // Header.exportedFromSiteId).
    w.line(1, '_EXPORTED_FROM_SITE_ID', { value: h.exportedFromSiteId });
  }
  if (h.recordCounts !== undefined) {
    // MyHeritage: the record counts (see Header.recordCounts).
    w.line(1, '_RINS', { value: h.recordCounts });
  }
  if (h.descriptionAware === true) {
    // MyHeritage: the export includes descriptions (see
    // Header.descriptionAware).
    w.line(1, '_DESCRIPTION_AWARE', { value: 'Y' });
  }
  if (h.title !== undefined) {
    // My Family Tree: the title of the tree (see Header.title).
    w.line(1, '_TITL', { value: h.title });
  }
  if (h.uid !== undefined) {
    // MyHeritage / Family Historian: the dataset's unique identifier
    // (see Header.uid).
    w.line(1, '_UID', { value: h.uid });
  }
  if (h.statistics !== undefined) {
    // My Family Tree: the dataset statistics block (see
    // Header.statistics).
    w.line(1, '_STS');
    for (const [tag, value] of [
      ['INDI', h.statistics.individuals],
      ['FAM', h.statistics.families],
      ['REPO', h.statistics.repositories],
      ['SOUR', h.statistics.sources],
      ['NOTE', h.statistics.notes],
      ['SUBM', h.statistics.submitters],
      ['OBJE', h.statistics.media],
      ['_TASK', h.statistics.tasks],
    ] as ReadonlyArray<readonly [string, string | undefined]>) {
      if (value !== undefined) {
        w.line(2, tag, { value });
      }
    }
    emitExtensions(w, version, 2, h.statistics);
  }
  for (const www of h.www ?? []) {
    // The web address(es) of the dataset (see Header.www).
    w.line(1, 'WWW', { value: www });
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
  rtlSave?: string;
  www?: string;
  tree?: {
    tag: '_TREE';
    id?: string;
    note?: string;
    rin?: string;
    environment?: string;
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
  if (source.rtlSave !== undefined) {
    // MyHeritage: the right-to-left save mode (see HeaderSource.rtlSave).
    w.line(2, '_RTLSAVE', { value: source.rtlSave });
  }
  if (source.www !== undefined) {
    // Family Echo and other exporters: the web address of the source
    // product (see HeaderSource.www).
    w.line(2, 'WWW', { value: source.www });
  }
  if (source.tree !== undefined) {
    // Ancestry.com: the tree the export came from (see
    // HeaderSource.tree).
    w.line(2, '_TREE', source.tree.id === undefined ? {} : { value: source.tree.id });
    if (source.tree.note !== undefined) {
      w.line(3, 'NOTE', { value: source.tree.note });
    }
    if (source.tree.rin !== undefined) {
      w.line(3, 'RIN', { value: source.tree.rin });
    }
    if (source.tree.environment !== undefined) {
      // The Ancestry environment the export came from (see
      // AncestryTreeStructure.environment).
      w.line(3, '_ENV', { value: source.tree.environment });
    }
    emitExtensions(w, version, 3, source.tree);
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
    case '_PUBLISH':
      emitPublishedSiteRecord(w, version, record as Parameters<typeof emitPublishedSiteRecord>[2]);
      return;
    case '_GRP':
      emitGroupRecord(w, version, record as Parameters<typeof emitGroupRecord>[2]);
      return;
    case '_OCUR':
      emitOccurrenceRecord(w, version, record as Parameters<typeof emitOccurrenceRecord>[2]);
      return;
    case '_EVID':
      emitEvidenceRecord(w, version, record as Parameters<typeof emitEvidenceRecord>[2]);
      return;
    case '_RDOC':
      emitResearchDocumentRecord(w, version, record as Parameters<typeof emitResearchDocumentRecord>[2]);
      return;
    case '_RACT':
      emitResearchActivityRecord(w, version, record as Parameters<typeof emitResearchActivityRecord>[2]);
      return;
    case '_TAG':
      emitTagRecord(w, version, record as Parameters<typeof emitTagRecord>[2]);
      return;
    case '_MTTAG':
      emitTreeTagRecord(w, version, record as Parameters<typeof emitTreeTagRecord>[2]);
      return;
    case '_MTCAT':
      emitTreeCategoryRecord(w, version, record as Parameters<typeof emitTreeCategoryRecord>[2]);
      return;
    case 'Occupation':
    case 'Education':
    case 'Contact':
    case 'Marriage':
    case 'Twin':
      emitGenoProRecord(w, version, record as Parameters<typeof emitGenoProRecord>[2]);
      return;
    case 'TITL':
      emitTitleRecord(w, version, record as Parameters<typeof emitTitleRecord>[2]);
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
  tagLinks?: TagLink[];
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
  for (const tagLink of rec.tagLinks ?? []) {
    // The gedcom-tags applications (see TagLink).
    emitTagLink(w, version, level, tagLink);
  }
  if (rec.changeDate !== undefined) {
    w.line(level, 'CHAN');
    emitDateExact(w, version, level + 1, 'DATE', rec.changeDate.date, rec.changeDate.date.time);
    for (const note of rec.changeDate.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
    for (const citation of rec.changeDate.citations ?? []) {
      // Citations under the CHAN block (see ChangeDate.citations).
      emitSourceCitation(w, version, level + 1, citation);
    }
    if (rec.changeDate.user !== undefined) {
      // webtrees: the user who made the change (see ChangeDate.user).
      w.line(level + 1, '_WT_USER', { value: rec.changeDate.user });
    }
    emitExtensions(w, version, level + 1, rec.changeDate);
  }
  if (rec.creationDate !== undefined) {
    // 7.0 writes the standard CREA; 5.5.1 has no CREA slot and keeps
    // the MFT7 `_CRE` spelling the parser accepts in both versions.
    w.line(level, version === '7.0' ? 'CREA' : '_CRE');
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
  skypeId?: string;
  jabberId?: string;
  media?: MultimediaLink[];
  languages?: string[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  registeredRfn?: string;
  automatedRecordId?: string;
  geditcomId?: string;
  submitters?: string[];
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SUBM', { xref: rec.xref });
  w.line(1, 'NAME', { value: rec.name });
  if (rec.geditcomId !== undefined) {
    // GEDitCOM II: the record's id (see
    // IndividualRecord.geditcomId).
    w.line(1, '_GCID', { value: rec.geditcomId });
  }
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
  if (rec.skypeId !== undefined) {
    // The FOAF Skype id (see SubmitterRecord.skypeId).
    w.line(1, '_SKYPEID', { value: rec.skypeId });
  }
  if (rec.jabberId !== undefined) {
    // The FOAF Jabber id (see SubmitterRecord.jabberId).
    w.line(1, '_JABBERID', { value: rec.jabberId });
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
  importReference?: { record?: string; page?: string };
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
    for (const citation of rec.changeDate.citations ?? []) {
      // Citations under the CHAN block (see ChangeDate.citations).
      emitSourceCitation(w, version, 2, citation);
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
  if (rec.importReference !== undefined) {
    // GDO: the import-file reference (see ImportFileReference), level 1
    // of every record — the SUBN emitter writes its own copy because it
    // does not go through commonRecordFields.
    w.line(1, '_IMPF', rec.importReference.record === undefined ? {} : { value: rec.importReference.record });
    if (rec.importReference.page !== undefined) {
      w.line(2, 'PAGE', { value: rec.importReference.page });
    }
  }
  emitExtensions(w, version, 1, rec);
}

// -- Substructures -----------------------------------------------------------

