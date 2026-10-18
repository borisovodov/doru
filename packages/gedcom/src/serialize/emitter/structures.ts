/**
 * Serializer section: shared substructures: address, dates, ages, notes, citations, media links, extensions.
 *
 * Part of the serializer split; see serialize.ts for the public API.
 * These functions are projections: see the README's Serialization
 * section for what is translated and what is dropped.
 */

import type {
  TimeValue,
} from '../../primitives';
import type {
  AddressStructure,
  AgeStructure,
  AssociationStructure,
  DateExactStructure,
  DateStructure,
  EventDetail,
  ExtensionStructure,
  GedcomStructureBase,
  MultimediaLink,
  Note,
  NoteReference,
  NoteStructure,
  SourceCitation,
} from '../../structures';
import {
  formatAge551,
  formatAge70,
  formatDateExact,
  formatDateValue551,
  formatDateValue70,
  formatTime,
} from '../format';
import {
  ROLE_TO_RELA_551,
} from '../tables';
import type {
  Version,
} from '../writer';
import {
  Writer,
} from '../writer';
import {
  emitPlace,
} from './names-places';
import {
  ptr,
  restrictionList,
} from './values';

export function emitAddress(w: Writer, version: Version, level: number, address: AddressStructure): void {
  w.line(level, 'ADDR', { value: address.payload });
  if (address.line1 !== undefined) {
    w.line(level + 1, 'ADR1', { value: address.line1 });
  }
  if (address.line2 !== undefined) {
    w.line(level + 1, 'ADR2', { value: address.line2 });
  }
  if (address.line3 !== undefined) {
    w.line(level + 1, 'ADR3', { value: address.line3 });
  }
  if (address.city !== undefined) {
    w.line(level + 1, 'CITY', { value: address.city });
  }
  if (address.state !== undefined) {
    w.line(level + 1, 'STAE', { value: address.state });
  }
  if (address.postalCode !== undefined) {
    w.line(level + 1, 'POST', { value: address.postalCode });
  }
  if (address.country !== undefined) {
    w.line(level + 1, 'CTRY', { value: address.country });
  }
  if (version === '5.5.1') {
    for (const value of address.phone ?? []) {
      w.line(level + 1, 'PHON', { value });
    }
    for (const value of address.email ?? []) {
      w.line(level + 1, 'EMAIL', { value });
    }
    for (const value of address.fax ?? []) {
      w.line(level + 1, 'FAX', { value });
    }
    for (const value of address.www ?? []) {
      w.line(level + 1, 'WWW', { value });
    }
  }
  // For 7.0 the contacts live at the record/detail level; the parent
  // emitter relocates the 5.5.1-position values there.
}

/** The address as the target version wants it: 5.5.1 keeps the contact
 * fields inside ADDR, so record-level contacts are merged into it. */

export function mergedAddress(_w: Writer, version: Version, 
  address: AddressStructure | undefined,
  contacts: { phone?: string[]; email?: string[]; fax?: string[]; www?: string[] },
): AddressStructure | undefined {
  if (address === undefined || version === '7.0') {
    return address;
  }
  return {
    ...address,
    ...(address.phone === undefined && contacts.phone !== undefined ? { phone: contacts.phone } : {}),
    ...(address.email === undefined && contacts.email !== undefined ? { email: contacts.email } : {}),
    ...(address.fax === undefined && contacts.fax !== undefined ? { fax: contacts.fax } : {}),
    ...(address.www === undefined && contacts.www !== undefined ? { www: contacts.www } : {}),
  };
}

export function emitAssociation(w: Writer, version: Version, level: number, association: AssociationStructure): void {
  if (version === '5.5.1') {
    let relationship = association.relationship;
    if (relationship === undefined) {
      const role = association.role;
      if (role === undefined) {
        // Neither a RELA nor a ROLE: there is nothing to emit.
        return;
      }
      // The 7.0 ROLE enum is spelled out as the free-text RELA descriptor.
      relationship = role.payload === 'OTHER' ? role.phrase : ROLE_TO_RELA_551.get(role.payload);
      if (relationship === undefined) {
        // No descriptor exists for this role; the association is dropped.
        return;
      }
    }
    ptr(w, version, level, 'ASSO', association.individual);
    if (association.phrase !== undefined) {
      w.line(level + 1, 'PHRASE', { value: association.phrase });
    }
    w.line(level + 1, 'RELA', { value: relationship });
    for (const note of association.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
    for (const citation of association.citations ?? []) {
      emitSourceCitation(w, version, level + 1, citation);
    }
    return;
  }
  let role = association.role;
  if (role === undefined) {
    if (association.relationship === undefined) {
      // Neither a ROLE nor a RELA: there is nothing to emit.
      return;
    }
    // The 5.5.1 RELA descriptor becomes an OTHER role; the descriptor is
    // preserved in the PHRASE.
    role = { payload: 'OTHER', phrase: association.relationship };
  }
  ptr(w, version, level, 'ASSO', association.individual);
  if (association.phrase !== undefined) {
    w.line(level + 1, 'PHRASE', { value: association.phrase });
  }
  w.line(level + 1, 'ROLE', { value: role.payload });
  if (role.phrase !== undefined) {
    w.line(level + 2, 'PHRASE', { value: role.phrase });
  }
  for (const note of association.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const citation of association.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
}

export function emitDate(w: Writer, version: Version, level: number, tag: string, date: DateStructure): void {
  if (version === '7.0') {
    const raw = date.value === undefined ? '' : formatDateValue70(date.value);
    w.line(level, tag, { value: raw === '' ? undefined : raw });
    if (date.time !== undefined) {
      w.line(level + 1, 'TIME', { value: formatTime(date.time, '7.0') });
    }
    if (date.phrase !== undefined) {
      w.line(level + 1, 'PHRASE', { value: date.phrase });
    }
    return;
  }
  // 5.5.1: value + optional phrase. A phrase with a value becomes a NOTE
  // subordinate to the DATE (GEDCOM 5.5.1 §2 p.48); a phrase without a
  // value becomes the parenthesized form.
  if (date.value === undefined) {
    if (date.phrase !== undefined) {
      w.line(level, tag, { value: `(${date.phrase})` });
    } else {
      w.line(level, tag);
    }
    return;
  }
  const raw = formatDateValue551(date.value);
  w.line(level, tag, { value: raw === '' ? undefined : raw });
  if (date.phrase !== undefined) {
    w.line(level + 1, 'NOTE', { value: date.phrase });
  }
}

export function emitDateExact(w: Writer, version: Version, level: number, tag: string, date: DateExactStructure, time?: TimeValue): void {
  w.line(level, tag, { value: formatDateExact(date.value, version) });
  if (time !== undefined) {
    w.line(level + 1, 'TIME', { value: formatTime(time, version) });
  }
}

export function emitAge(w: Writer, version: Version, level: number, age: AgeStructure): void {
  let value: string;
  let phrase: string | undefined = age.phrase;
  if (version === '7.0') {
    if (age.payload.description !== undefined) {
      // The 5.5.1 keyword is projected onto the closest numeric bound;
      // the keyword itself is preserved in the PHRASE.
      const KEYWORD_TO_70: Record<string, string> = { CHILD: '< 8y', INFANT: '< 1y', STILLBORN: '0y' };
      value = KEYWORD_TO_70[age.payload.description] ?? '< 1y';
      phrase = phrase ?? age.payload.description;
    } else {
      value = formatAge70(age.payload);
    }
  } else {
    value = formatAge551(age.payload);
    if (value === '') {
      // The age was only weeks, which 5.5.1 cannot express; dropped.
      return;
    }
    // 5.5.1 has no PHRASE under AGE.
    phrase = undefined;
  }
  w.line(level, 'AGE', { value });
  if (phrase !== undefined) {
    w.line(level + 1, 'PHRASE', { value: phrase });
  }
}

export function emitEventDetail(w: Writer, version: Version, level: number, detail: EventDetail): void {
  if (detail.date !== undefined) {
    emitDate(w, version, level, 'DATE', detail.date);
  }
  if (detail.place !== undefined) {
    emitPlace(w, version, level, detail.place);
  }
  for (const additional of detail.additionalPlaces ?? []) {
    emitPlace(w, version, level, additional, '_PLAC');
  }
  const address = mergedAddress(w, version, detail.address, detail);
  if (address !== undefined) {
    emitAddress(w, version, level, address);
  }
  if (version === '7.0') {
    // The 5.5.1-position contacts inside ADDR are relocated here.
    for (const value of detail.phone ?? detail.address?.phone ?? []) {
      w.line(level, 'PHON', { value });
    }
    for (const value of detail.email ?? detail.address?.email ?? []) {
      w.line(level, 'EMAIL', { value });
    }
    for (const value of detail.fax ?? detail.address?.fax ?? []) {
      w.line(level, 'FAX', { value });
    }
    for (const value of detail.www ?? detail.address?.www ?? []) {
      w.line(level, 'WWW', { value });
    }
  }
  if (detail.agency !== undefined) {
    w.line(level, 'AGNC', { value: detail.agency });
  }
  if (detail.religiousAffiliation !== undefined) {
    w.line(level, 'RELI', { value: detail.religiousAffiliation });
  }
  if (detail.cause !== undefined) {
    w.line(level, 'CAUS', { value: detail.cause });
  }
  if (detail.restriction !== undefined) {
    w.line(level, 'RESN', { value: restrictionList(w, version, detail.restriction) });
  }
  if (detail.sortDate !== undefined) {
    let raw = '';
    if (detail.sortDate.value !== undefined) {
      raw = version === '7.0' ? formatDateValue70(detail.sortDate.value) : formatDateValue551(detail.sortDate.value);
    }
    if (version === '5.5.1' && raw === '' && detail.sortDate.phrase !== undefined) {
      // The vendor _SDATE takes a plain DATE-formatted value; a
      // phrase-only sort date is written parenthesized, like a 5.5.1 DATE.
      raw = `(${detail.sortDate.phrase})`;
    }
    // 5.5.1 spells SDATE as _SDATE (value only).
    w.line(level, version === '7.0' ? 'SDATE' : '_SDATE', { value: raw === '' ? undefined : raw });
    if (version === '7.0') {
      if (detail.sortDate.time !== undefined) {
        w.line(level + 1, 'TIME', { value: formatTime(detail.sortDate.time, '7.0') });
      }
      if (detail.sortDate.phrase !== undefined) {
        w.line(level + 1, 'PHRASE', { value: detail.sortDate.phrase });
      }
    }
  }
  if (version === '7.0') {
    for (const association of detail.associations ?? []) {
      emitAssociation(w, version, level, association);
    }
  } else {
    // 5.5.1 events have no ASSO; the _SHAR/_ROLE pair carries them.
    for (const association of detail.associations ?? []) {
      w.line(level, '_SHAR', { value: association.individual });
      if (association.role !== undefined) {
        const descriptor = association.role.payload === 'OTHER'
          ? association.role.phrase
          : ROLE_TO_RELA_551.get(association.role.payload);
        if (descriptor !== undefined) {
          w.line(level + 1, '_ROLE', { value: descriptor });
        }
      }
    }
  }
  for (const note of detail.notes ?? []) {
    emitNoteStructure(w, version, level, note);
  }
  for (const citation of detail.citations ?? []) {
    emitSourceCitation(w, version, level, citation);
  }
  for (const media of detail.media ?? []) {
    emitMultimediaLink(w, version, level, media);
  }
  if (version === '7.0') {
    for (const uid of detail.uniqueIds ?? []) {
      w.line(level, 'UID', { value: uid });
    }
  } else {
    for (const uid of detail.uniqueIds ?? []) {
      w.line(level, '_UID', { value: uid });
    }
  }
}

export function emitNoteStructure(w: Writer, version: Version, level: number, note: NoteStructure): void {
  if (note.tag === 'SNOTE') {
    // 5.5.1 spells the shared-note pointer NOTE.
    ptr(w, version, level, version === '7.0' ? 'SNOTE' : 'NOTE', note.note);
    return;
  }
  if (note.tag === 'NOTE' && 'note' in note) {
    // 7.0 spells the 5.5.1 note-record pointer SNOTE.
    ptr(w, version, level, version === '7.0' ? 'SNOTE' : 'NOTE', (note as NoteReference).note);
    return;
  }
  const inline = note as Note;
  w.line(level, 'NOTE', { value: inline.payload });
  if (version === '7.0') {
    if (inline.mediaType !== undefined) {
      w.line(level + 1, 'MIME', { value: inline.mediaType });
    }
    if (inline.language !== undefined) {
      w.line(level + 1, 'LANG', { value: inline.language });
    }
    for (const translation of inline.translations ?? []) {
      w.line(level + 1, 'TRAN', { value: translation.payload });
      if (translation.mediaType !== undefined) {
        w.line(level + 2, 'MIME', { value: translation.mediaType });
      }
      if (translation.language !== undefined) {
        w.line(level + 2, 'LANG', { value: translation.language });
      }
    }
  }
  // 5.5.1 notes have no MIME/LANG/TRAN; dropped.
  for (const citation of inline.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
}

export function emitSourceCitation(w: Writer, version: Version, level: number, citation: SourceCitation): void {
  if (version === '7.0') {
    // The 5.5.1 free-text description becomes the PAGE (see
    // emitCitationCommon); a void SOUR pointer is legal in 7.0.
    ptr(w, version, level, 'SOUR', citation.source);
    emitCitationCommon(w, version, level, citation);
    return;
  }
  if (citation.source === '@VOID@') {
    if (citation.description === undefined) {
      // A 5.5.1 void citation needs its free text; without it the
      // citation is dropped.
      return;
    }
    w.line(level, 'SOUR', { value: citation.description });
    for (const text of citation.data?.texts ?? []) {
      w.line(level + 1, 'TEXT', { value: text.payload });
    }
    for (const media of citation.media ?? []) {
      emitMultimediaLink(w, version, level + 1, media);
    }
    for (const note of citation.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
    if (citation.quality !== undefined) {
      w.line(level + 1, 'QUAY', { value: citation.quality });
    }
    return;
  }
  ptr(w, version, level, 'SOUR', citation.source);
  emitCitationCommon(w, version, level, citation);
}

export function emitCitationCommon(w: Writer, version: Version, level: number, citation: SourceCitation): void {
  const page = citation.page ?? (version === '7.0' ? citation.description : undefined);
  if (page !== undefined) {
    w.line(level + 1, 'PAGE', { value: page });
  }
  for (const pointer of citation.ancestryPointers ?? []) {
    // Ancestry record reference.
    w.line(level + 1, '_APID', { value: pointer });
  }
  if (citation.data !== undefined) {
    w.line(level + 1, 'DATA');
    if (citation.data.date !== undefined) {
      emitDate(w, version, level + 2, 'DATE', citation.data.date);
    }
    for (const text of citation.data.texts ?? []) {
      w.line(level + 2, 'TEXT', { value: text.payload });
      if (version === '7.0') {
        if (text.mediaType !== undefined) {
          w.line(level + 3, 'MIME', { value: text.mediaType });
        }
        if (text.language !== undefined) {
          w.line(level + 3, 'LANG', { value: text.language });
        }
      }
    }
  }
  if (citation.event !== undefined) {
    w.line(level + 1, 'EVEN', { value: citation.event.payload });
    if (citation.event.phrase !== undefined && version === '7.0') {
      w.line(level + 2, 'PHRASE', { value: citation.event.phrase });
    }
    if (citation.event.role !== undefined) {
      if (version === '7.0') {
        w.line(level + 2, 'ROLE', { value: citation.event.role.payload });
        if (citation.event.role.phrase !== undefined) {
          w.line(level + 3, 'PHRASE', { value: citation.event.role.phrase });
        }
      } else {
        const role = citation.event.role;
        const known = ['CHIL', 'HUSB', 'WIFE', 'MOTH', 'FATH', 'SPOU'];
        if (known.includes(role.payload)) {
          w.line(level + 2, 'ROLE', { value: role.payload });
        } else {
          const descriptor = role.payload === 'OTHER' ? role.phrase : ROLE_TO_RELA_551.get(role.payload);
          if (descriptor !== undefined) {
            w.line(level + 2, 'ROLE', { value: `(${descriptor})` });
          }
          // Without a descriptor the role cannot be spelled; dropped.
        }
      }
    }
  }
  for (const media of citation.media ?? []) {
    emitMultimediaLink(w, version, level + 1, media);
  }
  for (const note of citation.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  if (citation.quality !== undefined) {
    w.line(level + 1, 'QUAY', { value: citation.quality });
  }
}

export function emitMultimediaLink(w: Writer, version: Version, level: number, link: MultimediaLink): void {
  ptr(w, version, level, 'OBJE', link.object);
  if (link.primary === true) {
    w.line(level + 1, '_PRIM', { value: 'Y' });
  }
  if (version === '7.0') {
    if (link.crop !== undefined) {
      w.line(level + 1, 'CROP');
      if (link.crop.top !== undefined) {
        w.line(level + 2, 'TOP', { value: String(link.crop.top) });
      }
      if (link.crop.left !== undefined) {
        w.line(level + 2, 'LEFT', { value: String(link.crop.left) });
      }
      if (link.crop.height !== undefined) {
        w.line(level + 2, 'HEIGHT', { value: String(link.crop.height) });
      }
      if (link.crop.width !== undefined) {
        w.line(level + 2, 'WIDTH', { value: String(link.crop.width) });
      }
    }
    if (link.title !== undefined) {
      w.line(level + 1, 'TITL', { value: link.title });
    }
  }
  // 5.5.1 has no CROP/TITL under OBJE; dropped.
}

export function emitExtension(w: Writer, version: Version, level: number, ext: ExtensionStructure, xref: string | undefined): void {
  const payload = ext.payload === undefined ? undefined : ext.payload;
  w.line(level, ext.tag, { xref, value: payload });
  for (const child of ext.children) {
    emitExtension(w, version, level + 1, child, undefined);
  }
}

export function emitExtensions(w: Writer, version: Version, level: number, structure: GedcomStructureBase): void {
  for (const ext of structure.extensions ?? []) {
    emitExtension(w, version, level, ext, undefined);
  }
}

// -- Value spellings ---------------------------------------------------------

