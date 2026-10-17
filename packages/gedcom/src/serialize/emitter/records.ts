/**
 * Serializer section: the record emitters (FAM, INDI, OBJE, REPO, notes, sources, citations).
 *
 * Part of the serializer split; see serialize.ts for the public API.
 * These functions are projections: see the README's Serialization
 * section for what is translated and what is dropped.
 */

import type {
  AddressStructure,
  AssociationStructure,
  CallNumberStructure,
  ChangeDate,
  CreationDate,
  DatePeriodStructure,
  ExtensionStructure,
  FamilyEventDetail,
  IndividualEventDetail,
  LdsOrdinanceDetail,
  MediaFile,
  MultimediaLink,
  NonEventStructure,
  NoteStructure,
  NoteTranslation,
  PersonalNameStructure,
  PlaceStructure,
  SourceCitation,
  SourceText,
} from '../../structures';
import {
  formatDateValue551,
  formatDateValue70,
} from '../format';
import type {
  Version,
} from '../writer';
import {
  Writer,
} from '../writer';
import {
  commonRecordFields,
} from './document';
import {
  emitFamilyDetail,
  emitFamilyEvent,
  emitIndividualDetail,
  emitIndividualEvent,
  emitLdsDetail,
} from './events';
import {
  emitMedia,
  emitMediaFile,
  emitPersonalName,
  emitPlace,
} from './names-places';
import {
  emitAddress,
  emitAssociation,
  emitNoteStructure,
  emitSourceCitation,
  mergedAddress,
} from './structures';
import {
  famcStat,
  pedigree,
  ptr,
  restrictionList,
  sex,
} from './values';

export function emitFamily(w: Writer, version: Version, rec: {
  tag: 'FAM';
  restriction?: Array<string | `_${string}`>;
  attributes?: Array<{ tag: string; payload?: string | number; type?: string; detail?: FamilyEventDetail }>;
  events?: Array<{ tag: string; payload?: true | string; type?: string; detail?: FamilyEventDetail }>;
  nonEvents?: NonEventStructure[];
  husband?: { partner: string; phrase?: string };
  wife?: { partner: string; phrase?: string };
  children?: Array<{ child: string; phrase?: string; fatherRelation?: string; motherRelation?: string }>;
  associations?: AssociationStructure[];
  submitters?: string[];
  spouseSealings?: Array<{ tag: 'SLGS'; detail?: LdsOrdinanceDetail }>;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  media?: MultimediaLink[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'FAM', { xref: rec.xref });
  if (rec.restriction !== undefined) {
    w.line(1, 'RESN', { value: restrictionList(w, version, rec.restriction) });
  }
  for (const attribute of rec.attributes ?? []) {
    if (attribute.tag === 'NCHI') {
      w.line(1, 'NCHI', { value: String(attribute.payload) });
      emitFamilyDetail(w, version, 2, attribute.detail, attribute.type);
      continue;
    }
    if (attribute.tag === 'RESI') {
      if (version === '7.0') {
        w.line(1, 'RESI', { value: (attribute.payload as string) ?? '' });
        emitFamilyDetail(w, version, 2, attribute.detail, attribute.type);
      } else {
        w.line(1, 'RESI');
        emitFamilyDetail(w, version, 2, attribute.detail, attribute.type);
      }
      continue;
    }
    // FAM.FACT is 7.0-only; dropped.
    if (version !== '7.0') {
      continue;
    }
    w.line(1, 'FACT', { value: (attribute.payload as string) ?? '' });
    if (attribute.type !== undefined) {
      w.line(2, 'TYPE', { value: attribute.type });
    }
    emitFamilyDetail(w, version, 2, attribute.detail, undefined);
  }
  for (const event of rec.events ?? []) {
    emitFamilyEvent(w, version, event);
  }
  if (version === '7.0') {
    for (const nonEvent of rec.nonEvents ?? []) {
      w.line(1, 'NO', { value: nonEvent.payload });
      if (nonEvent.date !== undefined) {
        w.line(2, 'DATE', { value: formatDateValue70(nonEvent.date.value ?? { kind: 'period' }) });
        if (nonEvent.date.phrase !== undefined) {
          w.line(3, 'PHRASE', { value: nonEvent.date.phrase });
        }
      }
      for (const note of nonEvent.notes ?? []) {
        emitNoteStructure(w, version, 2, note);
      }
      for (const citation of nonEvent.citations ?? []) {
        emitSourceCitation(w, version, 2, citation);
      }
    }
  }
  if (rec.husband !== undefined) {
    ptr(w, version, 1, 'HUSB', rec.husband.partner);
    if (rec.husband.phrase !== undefined) {
      w.line(2, 'PHRASE', { value: rec.husband.phrase });
    }
  }
  if (rec.wife !== undefined) {
    ptr(w, version, 1, 'WIFE', rec.wife.partner);
    if (rec.wife.phrase !== undefined) {
      w.line(2, 'PHRASE', { value: rec.wife.phrase });
    }
  }
  for (const child of rec.children ?? []) {
    ptr(w, version, 1, 'CHIL', child.child);
    if (child.phrase !== undefined) {
      w.line(2, 'PHRASE', { value: child.phrase });
    }
    if (version === '5.5.1') {
      // The FTM vendor extensions; see docs/vendor-extensions.md. The
      // 7.0 side of the pair (INDI.FAMC.PEDI) is filled by prepareFor70.
      if (child.fatherRelation !== undefined) {
        w.line(2, '_FREL', { value: child.fatherRelation });
      }
      if (child.motherRelation !== undefined) {
        w.line(2, '_MREL', { value: child.motherRelation });
      }
    }
  }
  for (const association of rec.associations ?? []) {
    // 5.5.1 FAM has no ASSO; dropped.
    if (version === '7.0') {
      emitAssociation(w, version, 1, association);
    }
  }
  for (const submitter of rec.submitters ?? []) {
    ptr(w, version, 1, 'SUBM', submitter);
  }
  for (const sealing of rec.spouseSealings ?? []) {
    w.line(1, 'SLGS');
    emitLdsDetail(w, version, 2, sealing.detail, 'SLGS');
  }
  commonRecordFields(w, version, rec, 1);
}

export function emitIndividual(w: Writer, version: Version, rec: {
  tag: 'INDI';
  restriction?: Array<string | `_${string}`>;
  names?: PersonalNameStructure[];
  sex?: string;
  attributes?: Array<{ tag: string; payload: string | number; type?: string; detail?: IndividualEventDetail }>;
  events?: Array<{ tag: string; payload?: true | string; type?: string; detail?: IndividualEventDetail; familyChild?: string; adoptionFamily?: { family: string; adoption?: { payload: string; phrase?: string } } }>;
  nonEvents?: NonEventStructure[];
  ordinances?: Array<{ tag: string; detail?: LdsOrdinanceDetail; familyChild?: string }>;
  childFamilies?: Array<{ family: string; pedigree?: { payload: string; phrase?: string }; status?: { payload: string; phrase?: string }; notes?: NoteStructure[] }>;
  spouseFamilies?: Array<{ family: string; notes?: NoteStructure[] }>;
  submitters?: string[];
  associations?: AssociationStructure[];
  aliases?: Array<{ individual: string; phrase?: string }>;
  ancestorInterests?: string[];
  descendantInterests?: string[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  media?: MultimediaLink[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  recordFileNumber?: string;
  ancestralFileNumber?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'INDI', { xref: rec.xref });
  if (rec.restriction !== undefined) {
    w.line(1, 'RESN', { value: restrictionList(w, version, rec.restriction) });
  }
  for (const name of rec.names ?? []) {
    emitPersonalName(w, version, 1, name);
  }
  if (rec.sex !== undefined) {
    const value = sex(w, version, rec.sex);
    if (value !== undefined) {
      w.line(1, 'SEX', { value });
    }
  }
  for (const attribute of rec.attributes ?? []) {
    if (version === '5.5.1' && attribute.type !== undefined && attribute.tag !== 'IDNO' && attribute.tag !== 'FACT') {
      // 5.5.1 keeps TYPE inside the event detail; the emission is the
      // same level, so it is fine to emit it.
    }
    w.line(1, attribute.tag, { value: String(attribute.payload) });
    emitIndividualDetail(w, version, 2, attribute.detail, attribute.type);
  }
  for (const event of rec.events ?? []) {
    emitIndividualEvent(w, version, event);
  }
  if (version === '7.0') {
    for (const nonEvent of rec.nonEvents ?? []) {
      w.line(1, 'NO', { value: nonEvent.payload });
      if (nonEvent.date !== undefined) {
        w.line(2, 'DATE', { value: formatDateValue70(nonEvent.date.value ?? { kind: 'period' }) });
        if (nonEvent.date.phrase !== undefined) {
          w.line(3, 'PHRASE', { value: nonEvent.date.phrase });
        }
      }
      for (const note of nonEvent.notes ?? []) {
        emitNoteStructure(w, version, 2, note);
      }
      for (const citation of nonEvent.citations ?? []) {
        emitSourceCitation(w, version, 2, citation);
      }
    }
  }
  for (const ordinance of rec.ordinances ?? []) {
    w.line(1, ordinance.tag);
    emitLdsDetail(w, version, 2, ordinance.detail, ordinance.tag);
    if (ordinance.familyChild !== undefined) {
      ptr(w, version, 2, 'FAMC', ordinance.familyChild);
    }
  }
  for (const link of rec.childFamilies ?? []) {
    ptr(w, version, 1, 'FAMC', link.family);
    if (link.pedigree !== undefined) {
      const value = pedigree(w, version, link.pedigree.payload);
      if (value !== undefined) {
        w.line(2, 'PEDI', { value });
        if (link.pedigree.phrase !== undefined) {
          w.line(3, 'PHRASE', { value: link.pedigree.phrase });
        }
      }
    }
    if (link.status !== undefined) {
      w.line(2, 'STAT', { value: famcStat(w, version, link.status.payload) });
      if (link.status.phrase !== undefined) {
        w.line(3, 'PHRASE', { value: link.status.phrase });
      }
    }
    for (const note of link.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
  }
  for (const link of rec.spouseFamilies ?? []) {
    ptr(w, version, 1, 'FAMS', link.family);
    for (const note of link.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
  }
  for (const submitter of rec.submitters ?? []) {
    ptr(w, version, 1, 'SUBM', submitter);
  }
  for (const association of rec.associations ?? []) {
    emitAssociation(w, version, 1, association);
  }
  for (const alias of rec.aliases ?? []) {
    ptr(w, version, 1, 'ALIA', alias.individual);
    if (alias.phrase !== undefined) {
      w.line(2, 'PHRASE', { value: alias.phrase });
    }
  }
  for (const submitter of rec.ancestorInterests ?? []) {
    ptr(w, version, 1, 'ANCI', submitter);
  }
  for (const submitter of rec.descendantInterests ?? []) {
    ptr(w, version, 1, 'DESI', submitter);
  }
  if (rec.recordFileNumber !== undefined && version === '5.5.1') {
    w.line(1, 'RFN', { value: rec.recordFileNumber });
  }
  if (rec.ancestralFileNumber !== undefined && version === '5.5.1') {
    w.line(1, 'AFN', { value: rec.ancestralFileNumber });
  }
  commonRecordFields(w, version, rec, 1);
}

export function emitMultimedia(w: Writer, version: Version, rec: {
  tag: 'OBJE';
  restriction?: Array<string | `_${string}`>;
  files: MediaFile[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  citations?: SourceCitation[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'OBJE', { xref: rec.xref });
  if (rec.restriction !== undefined && version === '7.0') {
    w.line(1, 'RESN', { value: restrictionList(w, version, rec.restriction) });
  }
  for (const file of rec.files) {
    emitMediaFile(w, version, 1, file);
  }
  commonRecordFields(w, version, rec, 1);
}

export function emitRepository(w: Writer, version: Version, rec: {
  tag: 'REPO';
  name: string;
  address?: AddressStructure;
  phone?: string[];
  email?: string[];
  fax?: string[];
  www?: string[];
  notes?: NoteStructure[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'REPO', { xref: rec.xref });
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
  commonRecordFields(w, version, rec, 1);
}

export function emitSharedNote(w: Writer, version: Version, rec: {
  tag: 'SNOTE';
  payload: string;
  mediaType?: string;
  language?: string;
  translations?: NoteTranslation[];
  citations?: SourceCitation[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SNOTE', { xref: rec.xref, value: rec.payload });
  if (rec.mediaType !== undefined) {
    w.line(1, 'MIME', { value: rec.mediaType });
  }
  if (rec.language !== undefined) {
    w.line(1, 'LANG', { value: rec.language });
  }
  for (const translation of rec.translations ?? []) {
    w.line(1, 'TRAN', { value: translation.payload });
    if (translation.mediaType !== undefined) {
      w.line(2, 'MIME', { value: translation.mediaType });
    }
    if (translation.language !== undefined) {
      w.line(2, 'LANG', { value: translation.language });
    }
  }
  commonRecordFields(w, version, rec, 1);
}

export function emitNoteRecord(w: Writer, version: Version, rec: {
  tag: 'NOTE';
  payload: string;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  citations?: SourceCitation[];
  changeDate?: ChangeDate;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'NOTE', { xref: rec.xref, value: rec.payload });
  commonRecordFields(w, version, rec, 1);
}

/** A SNOTE record projected onto 5.5.1: a NOTE record (MIME/LANG/TRAN, UID, EXID and CREA are dropped). */

export function emitSharedNoteAs551(w: Writer, version: Version, rec: {
  tag: 'SNOTE';
  payload: string;
  citations?: SourceCitation[];
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  changeDate?: ChangeDate;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'NOTE', { xref: rec.xref, value: rec.payload });
  commonRecordFields(w, version, rec, 1);
}

/** A 5.5.1 NOTE record projected onto 7.0: a SNOTE record (RIN is dropped). */

export function emitNoteRecordAs70(w: Writer, version: Version, rec: {
  tag: 'NOTE';
  payload: string;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  citations?: SourceCitation[];
  changeDate?: ChangeDate;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SNOTE', { xref: rec.xref, value: rec.payload });
  commonRecordFields(w, version, rec, 1);
}

export function emitSource(w: Writer, version: Version, rec: {
  tag: 'SOUR';
  data?: {
    events?: Array<{ payload: Array<string | `_${string}`>; date?: DatePeriodStructure; place?: PlaceStructure }>;
    agency?: string;
    notes?: NoteStructure[];
  };
  author?: string;
  title?: string;
  abbreviation?: string;
  publication?: string;
  text?: SourceText;
  repositoryCitations?: Array<{ repository: string; notes?: NoteStructure[]; callNumbers?: CallNumberStructure[] }>;
  identifiers?: Array<{ tag: string; payload: string; type?: string }>;
  notes?: NoteStructure[];
  media?: MultimediaLink[];
  changeDate?: ChangeDate;
  creationDate?: CreationDate;
  automatedRecordId?: string;
  extensions?: ExtensionStructure[];
  xref?: string;
}): void {
  w.line(0, 'SOUR', { xref: rec.xref });
  if (rec.data !== undefined) {
    w.line(1, 'DATA');
    for (const event of rec.data.events ?? []) {
      w.line(2, 'EVEN', { value: event.payload.join(', ') });
      if (event.date !== undefined) {
        w.line(3, 'DATE', {
          value: version === '7.0' ? formatDateValue70(event.date.value ?? { kind: 'period' }) : formatDateValue551(event.date.value ?? { kind: 'period' }),
        });
        if (event.date.phrase !== undefined) {
          w.line(4, 'PHRASE', { value: event.date.phrase });
        }
      }
      if (event.place !== undefined) {
        emitPlace(w, version, 3, event.place);
      }
    }
    if (rec.data.agency !== undefined) {
      w.line(2, 'AGNC', { value: rec.data.agency });
    }
    for (const note of rec.data.notes ?? []) {
      emitNoteStructure(w, version, 2, note);
    }
  }
  if (rec.author !== undefined) {
    w.line(1, 'AUTH', { value: rec.author });
  }
  if (rec.title !== undefined) {
    w.line(1, 'TITL', { value: rec.title });
  }
  if (rec.abbreviation !== undefined) {
    w.line(1, 'ABBR', { value: rec.abbreviation });
  }
  if (rec.publication !== undefined) {
    w.line(1, 'PUBL', { value: rec.publication });
  }
  if (rec.text !== undefined) {
    w.line(1, 'TEXT', { value: rec.text.payload });
    if (version === '7.0') {
      if (rec.text.mediaType !== undefined) {
        w.line(2, 'MIME', { value: rec.text.mediaType });
      }
      if (rec.text.language !== undefined) {
        w.line(2, 'LANG', { value: rec.text.language });
      }
    }
  }
  for (const citation of rec.repositoryCitations ?? []) {
    emitRepositoryCitation(w, version, 1, citation);
  }
  commonRecordFields(w, version, rec, 1);
}

export function emitRepositoryCitation(w: Writer, version: Version, level: number, citation: {
  repository: string;
  notes?: NoteStructure[];
  callNumbers?: CallNumberStructure[];
}): void {
  if (version === '7.0') {
    ptr(w, version, level, 'REPO', citation.repository);
  } else if (citation.repository === '@VOID@') {
    w.line(level, 'REPO');
  } else {
    ptr(w, version, level, 'REPO', citation.repository);
  }
  for (const note of citation.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const callNumber of citation.callNumbers ?? []) {
    w.line(level + 1, 'CALN', { value: callNumber.payload });
    if (callNumber.medium !== undefined) {
      emitMedia(w, version, level + 2, callNumber.medium);
    }
  }
}

