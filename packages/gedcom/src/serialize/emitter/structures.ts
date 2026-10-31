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
  const payload = address.payload ?? '';
  if (payload === '') {
    // The GEDCOM 5.5.5 structured form has no ADDR line value (5.5.5
    // §2 p.104); the target grammars give ADDR a {1:1} payload, so it
    // is synthesized from the structured parts (the ADDR A2 fold of the
    // GEDCOM-L agreement ADDR A2).
    const parts = [
      address.line1,
      address.line2,
      address.line3,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter((part): part is string => part !== undefined && part !== '');
    w.line(level, 'ADDR', parts.length === 0 ? {} : { value: parts.join(', ') });
  } else {
    w.line(level, 'ADDR', { value: payload });
  }
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
  if (address.private === true) {
    w.line(level + 1, '_PRIV', { value: 'Y' });
  }
  if (address.name !== undefined) {
    w.line(level + 1, '_NAME', { value: address.name });
  }
  if (address.sortName !== undefined) {
    // Legacy: the report sort spelling (see AddressStructure.sortName).
    w.line(level + 1, '_SORT', { value: address.sortName });
  }
  if (address.newsletterList === true) {
    w.line(level + 1, '_LIST1', { value: 'YES' });
  }
  if (address.familyAssociationList === true) {
    w.line(level + 1, '_LIST2', { value: 'YES' });
  }
  if (address.birthdayList === true) {
    w.line(level + 1, '_LIST3', { value: 'YES' });
  }
  if (address.researchList === true) {
    w.line(level + 1, '_LIST4', { value: 'YES' });
  }
  if (address.christmasList === true) {
    w.line(level + 1, '_LIST5', { value: 'YES' });
  }
  if (address.holidayList === true) {
    w.line(level + 1, '_LIST6', { value: 'YES' });
  }
  if (version === '5.5.1') {
    // The 5.5.1 ADDRESS_STRUCTURE (GEDCOM 5.5.1 §2 p.31) puts the
    // contact substructures PHON/EMAIL/FAX/WWW {0:3} each at the
    // structure level — siblings of ADDR, not its children. The {0:3}
    // limit is enforced here on output: values beyond the third are
    // dropped (see the contact fields of AddressStructure).
    for (const value of (address.phone ?? []).slice(0, 3)) {
      w.line(level, 'PHON', { value });
    }
    for (const value of (address.email ?? []).slice(0, 3)) {
      w.line(level, 'EMAIL', { value });
    }
    for (const value of (address.fax ?? []).slice(0, 3)) {
      w.line(level, 'FAX', { value });
    }
    for (const value of (address.www ?? []).slice(0, 3)) {
      w.line(level, 'WWW', { value });
    }
  }
  // For 7.0 the contacts live at the record/detail level; the parent
  // emitter relocates the 5.5.1-position values there.
  emitExtensions(w, version, level + 1, address);
}

/** The address as the target version wants it: 5.5.1 keeps the contact
 * fields inside the ADDRESS_STRUCTURE (siblings of ADDR), so
 * record-level contacts are merged into it — emitAddress writes them
 * there. Contacts without an address block have no 5.5.1 slot at all
 * (the contact substructures only exist inside the ADDRESS_STRUCTURE,
 * GEDCOM 5.5.1 §2 p.31) and are dropped on 5.5.1 output. */
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

export function emitAssociation(w: Writer, version: Version, level: number, association: AssociationStructure, tag: 'ASSO' | '_ASSO' = 'ASSO'): void {
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
    ptr(w, version, level, tag, association.individual);
    w.line(level + 1, 'RELA', { value: relationship });
    for (const note of association.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
    for (const citation of association.citations ?? []) {
      emitSourceCitation(w, version, level + 1, citation);
    }
    emitExtensions(w, version, level + 1, association);
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
  emitExtensions(w, version, level + 2, role);
  for (const note of association.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const citation of association.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
  emitExtensions(w, version, level + 1, association);
}

export function emitDate(w: Writer, version: Version, level: number, tag: string, date: DateStructure): void {
  if (version === '7.0') {
    const raw = date.value === undefined ? undefined : formatDateValue70(date.value);
    // A value the target cannot spell (the year-less 5.5.5 date form)
    // is dropped; TIME and PHRASE substructures still make the DATE
    // meaningful.
    if (raw !== undefined || date.time !== undefined || date.phrase !== undefined) {
      w.line(level, tag, { value: raw === '' ? undefined : raw });
    }
    if (date.time !== undefined) {
      w.line(level + 1, 'TIME', { value: formatTime(date.time, '7.0') });
    }
    if (date.phrase !== undefined) {
      w.line(level + 1, 'PHRASE', { value: date.phrase });
    }
    emitExtensions(w, version, level + 1, date);
    return;
  }
  // 5.5.1: value + optional phrase. A phrase-only date becomes the
  // parenthesized form `(phrase)`; a phrase alongside a plain date
  // becomes the `INT <date> (<phrase>)` form — both are
  // DATE_VALUE choices (GEDCOM 5.5.1 §2 p.47). For the other value
  // forms (ranges, periods, bounds, approximations) the 5.5.1 grammar
  // has no parenthesized form, so the phrase is written as a NOTE
  // subordinate to the DATE line — the alternative GEDCOM 5.5.1 §2
  // p.48 itself describes ("include the date phrase value as a NOTE
  // value subordinate to the DATE line tag").
  if (date.value === undefined) {
    if (date.phrase !== undefined) {
      w.line(level, tag, { value: `(${date.phrase})` });
    } else {
      w.line(level, tag);
    }
    emitExtensions(w, version, level + 1, date);
    return;
  }
  const raw = formatDateValue551(date.value);
  if (raw === undefined) {
    // The year-less 5.5.5 date form; 5.5.1 cannot spell it, so the
    // whole DATE (including its phrase NOTE) is dropped.
    return;
  }
  if (date.phrase !== undefined) {
    if (date.value.kind === 'date') {
      w.line(level, tag, { value: `INT ${raw} (${date.phrase})` });
    } else {
      w.line(level, tag, { value: raw === '' ? undefined : raw });
      w.line(level + 1, 'NOTE', { value: date.phrase });
    }
    emitExtensions(w, version, level + 1, date);
    return;
  }
  w.line(level, tag, { value: raw === '' ? undefined : raw });
  emitExtensions(w, version, level + 1, date);
}

export function emitDateExact(w: Writer, version: Version, level: number, tag: string, date: DateExactStructure, time?: TimeValue): void {
  w.line(level, tag, { value: formatDateExact(date.value, version) });
  if (time !== undefined) {
    w.line(level + 1, 'TIME', { value: formatTime(time, version) });
  }
  emitExtensions(w, version, level + 1, date);
}

export function emitAge(w: Writer, version: Version, level: number, age: AgeStructure): void {
  const payload = age.payload;
  if (payload === undefined) {
    // The empty age form (GEDCOM 7.0 §2.6): the AGE line has no
    // payload; a PHRASE may carry what the payload cannot.
    w.line(level, 'AGE');
    if (version === '7.0' && age.phrase !== undefined) {
      w.line(level + 1, 'PHRASE', { value: age.phrase });
    }
    if (age.ageRange !== undefined) {
      w.line(level + 1, '_AGER', { value: age.ageRange });
    }
    emitExtensions(w, version, level + 1, age);
    return;
  }
  let value: string;
  let phrase: string | undefined = age.phrase;
  if (version === '7.0') {
    if (payload.description !== undefined) {
      // The 5.5.1 keyword is projected onto the closest numeric bound;
      // the keyword itself is preserved in the PHRASE.
      const KEYWORD_TO_70: Record<string, string> = { CHILD: '< 8y', INFANT: '< 1y', STILLBORN: '0y' };
      value = KEYWORD_TO_70[payload.description] ?? '< 1y';
      phrase = phrase ?? payload.description;
    } else {
      value = formatAge70(payload);
    }
  } else {
    value = formatAge551(payload);
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
  if (age.ageRange !== undefined) {
    // The MagiKey age range (MagiKey_AGER.yaml), written back in both versions.
    w.line(level + 1, '_AGER', { value: age.ageRange });
  }
  emitExtensions(w, version, level + 1, age);
}

export function emitEventDetail(w: Writer, version: Version, level: number, detail: EventDetail): void {
  if (detail.date !== undefined) {
    emitDate(w, version, level, 'DATE', detail.date);
  }
  if (detail.endDate !== undefined) {
    emitDate(w, version, level, '_DATE2', detail.endDate);
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
  } else if (address === undefined) {
    // 5.5.1 carries the contacts only inside the ADDRESS_STRUCTURE
    // (GEDCOM 5.5.1 §2 p.32): with no address block, PHON and FAX have
    // no 5.5.1 slot and are dropped, while the Family Historian
    // spellings `_EMAIL`/`_WEB` carry the fact-level e-mail and web
    // address (the vendor convention the parser reads into
    // EventDetail.email/www).
    for (const value of detail.email ?? []) {
      w.line(level, '_EMAIL', { value });
    }
    for (const value of detail.www ?? []) {
      w.line(level, '_WEB', { value });
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
  if (detail.sentence !== undefined) {
    // RootsMagic: the event sentence (report wording).
    w.line(level, '_SENT', { value: detail.sentence });
  }
  if (detail.placePrefix !== undefined) {
    // RootsMagic: the place prefix (report wording).
    w.line(level, '_PPFX', { value: detail.placePrefix });
  }
  for (const godparent of detail.godparents ?? []) {
    w.line(level, '_GODP', { value: godparent });
  }
  for (const witness of detail.witnesses ?? []) {
    w.line(level, '_WITN', { value: witness });
  }
  if (detail.restriction !== undefined) {
    w.line(level, 'RESN', { value: restrictionList(w, version, detail.restriction) });
  }
  if (detail.sortDate !== undefined) {
    let raw: string | undefined = '';
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
    emitExtensions(w, version, level + 1, detail.sortDate);
  }
  if (version === '7.0') {
    for (const association of detail.associations ?? []) {
      emitAssociation(w, version, level, association);
    }
  } else {
    // 5.5.1 events have no ASSO; the _SHAR/_ROLE pair carries them.
    for (const association of detail.associations ?? []) {
      w.line(level, '_SHAR', { value: association.individual });
      if (association.primary === true) {
        // TMG: the "Primary Indicator Tag" under a shared event (see
        // AssociationStructure.primary); 7.0 has no slot for it.
        w.line(level + 1, '_PRIM', { value: 'Y' });
      }
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
  for (const link of detail.censusLinks ?? []) {
    ptr(w, version, level, '_CENR', link);
  }
  for (const apid of detail.ancestryPointers ?? []) {
    w.line(level, '_APID', { value: apid });
  }
  if (detail.primary === true) {
    // AGES!: the primary event flag (see EventDetail.primary).
    w.line(level, '_PRI');
  }
  if (detail.eventNumber !== undefined) {
    // BKW6+: the event number (see EventDetail.eventNumber).
    w.line(level, '_EVN', { value: detail.eventNumber });
  }
  if (version === '5.5.1') {
    // The USM6 event marks; 7.0 cannot spell the non-underscore tags.
    if (detail.posthumous !== undefined) {
      w.line(level, 'POTM', { value: detail.posthumous ? '1' : '0' });
    }
    if (detail.furtherResearch !== undefined) {
      w.line(level, 'SRCH', { value: detail.furtherResearch });
    }
    if (detail.notary !== undefined) {
      w.line(level, 'NOTRY', { value: detail.notary });
    }
  }
  if (detail.factFlags !== undefined && detail.factFlags.length > 0) {
    // FH: the fact flags (see EventDetail.factFlags), written as the
    // `_FLGS` block with the canonical flag names in both versions.
    w.line(level, '_FLGS');
    for (const flag of detail.factFlags) {
      w.line(level + 1, `__${flag}`, { value: FACT_FLAG_NAMES[flag] });
    }
  }
  emitExtensions(w, version, level, detail);
}

/** The canonical Family Historian fact-flag names (see FactFlag). */
const FACT_FLAG_NAMES: Readonly<Record<'PRIVATE' | 'PREFERRED' | 'TENTATIVE' | 'REJECTED', string>> = {
  PRIVATE: 'Private',
  PREFERRED: 'Preferred',
  TENTATIVE: 'Tentative',
  REJECTED: 'Rejected',
};

export function emitNoteStructure(w: Writer, version: Version, level: number, note: NoteStructure): void {
  if (note.tag === 'SNOTE') {
    // 5.5.1 spells the shared-note pointer NOTE.
    ptr(w, version, level, version === '7.0' ? 'SNOTE' : 'NOTE', note.note);
    return;
  }
  if (note.tag === 'NOTE' && 'note' in note) {
    // 7.0 spells the 5.5.1 note-record pointer SNOTE.
    ptr(w, version, level, version === '7.0' ? 'SNOTE' : 'NOTE', (note as NoteReference).note);
    if (version === '5.5.1') {
      // The 5.5.1 pointer form may carry bare SOUR pointers beneath it
      // (GEDCOM 5.5.1 §2 p.37); the 7.0 SNOTE pointer has no
      // substructure slot, so they are dropped there.
      for (const citation of (note as NoteReference).citations ?? []) {
        emitSourceCitation(w, version, level + 1, citation);
      }
    }
    return;
  }
  const inline = note as Note;
  w.line(level, 'NOTE', { value: inline.payload });
  if (inline.private === true) {
    // The note privacy flag (WinFamily's NOTP normalizes into this;
    // see Note.private). Written back as _PRIV in both versions.
    w.line(level + 1, '_PRIV', { value: 'Y' });
  }
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
      emitExtensions(w, version, level + 2, translation);
    }
  }
  // 5.5.1 notes have no MIME/LANG/TRAN; dropped.
  for (const citation of inline.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
  emitExtensions(w, version, level + 1, inline);
}

export function emitSourceCitation(w: Writer, version: Version, level: number, citation: SourceCitation): void {
  emitCitation(w, version, level, citation, 'SOUR');
}

/** A relocated citation under PAGE or under a SOUR record (registry:
 *  _SOUR.yaml): the same structure as SOUR, spelled `_SOUR`. */
export function emitRelocatedCitation(w: Writer, version: Version, level: number, citation: SourceCitation): void {
  emitCitation(w, version, level, citation, '_SOUR');
}

function emitCitation(w: Writer, version: Version, level: number, citation: SourceCitation, tag: 'SOUR' | '_SOUR'): void {
  if (version === '7.0') {
    // The 5.5.1 free-text description becomes the PAGE (see
    // emitCitationCommon); a void SOUR pointer is legal in 7.0.
    ptr(w, version, level, tag, citation.source);
    emitCitationCommon(w, version, level, citation);
    return;
  }
  if (citation.source === '@VOID@') {
    if (citation.description === undefined) {
      // A 5.5.1 void citation needs its free text; without it the
      // citation is dropped.
      return;
    }
    w.line(level, tag, { value: citation.description });
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
    if (citation.submitter !== undefined) {
      // GDO: a pointer to the submitter record of this citation (see
      // SourceCitation.submitter).
      ptr(w, version, level + 1, '_SUBM', citation.submitter);
    }
    return;
  }
  ptr(w, version, level, tag, citation.source);
  emitCitationCommon(w, version, level, citation);
}

export function emitCitationCommon(w: Writer, version: Version, level: number, citation: SourceCitation): void {
  const page = citation.page;
  const pageValue = page !== undefined ? page.payload : version === '7.0' ? citation.description : undefined;
  if (pageValue !== undefined) {
    w.line(level + 1, 'PAGE', { value: pageValue });
    if (page !== undefined) {
      // The relocated _SOUR citations (registry: _SOUR.yaml) and the
      // page's generic extensions stay under the PAGE they belong to.
      for (const relocated of page.citations ?? []) {
        emitRelocatedCitation(w, version, level + 2, relocated);
      }
      emitExtensions(w, version, level + 2, page);
    }
  }
  for (const pointer of citation.ancestryPointers ?? []) {
    // Ancestry record reference.
    w.line(level + 1, '_APID', { value: pointer });
  }
  if (citation.reference !== undefined) {
    w.line(level + 1, '_CREF', { value: citation.reference });
  }
  if (citation.subsequentCitationFormat !== undefined) {
    // RootsMagic: the subsequent-citation format (report wording).
    w.line(level + 1, '_SUBQ', { value: citation.subsequentCitationFormat });
  }
  if (citation.verified === true) {
    w.line(level + 1, '_VERI', { value: 'Y' });
  }
  if (citation.assessment !== undefined) {
    // FH7: the citation assessment options (see SourceCitation.assessment).
    w.line(level + 1, '_QUAY', { value: citation.assessment });
  }
  for (const metafield of citation.metafields ?? []) {
    // FH7: the source-template metafield (see SourceCitation.metafields).
    w.line(level + 1, '_FIELD', { value: metafield.name });
    if (metafield.text !== undefined) {
      w.line(level + 2, 'TEXT', { value: metafield.text });
    }
  }
  if (version === '5.5.1' && citation.foundBy !== undefined) {
    // USM6: who found the source information (see
    // SourceCitation.foundBy); 7.0 cannot spell the non-underscore tag.
    w.line(level + 1, 'RINI', { value: citation.foundBy });
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
  if (citation.event !== undefined && !(version === '7.0' && citation.event.payload === undefined)) {
    // 7.0: an EVEN carrying only a 5.5.1 user-defined descriptor has
    // nothing to write (the whole structure is dropped); 5.5.1 writes
    // the known tag or the user-defined value.
    w.line(level + 1, 'EVEN', { value: citation.event.payload ?? citation.event.userDefined });
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
  if (citation.submitter !== undefined) {
    // GDO: a pointer to the submitter record of this citation (see
    // SourceCitation.submitter).
    ptr(w, version, level + 1, '_SUBM', citation.submitter);
  }
  if (citation.template !== undefined) {
    // RootsMagic: the Evidence Explained source template under the
    // citation (see SourceCitation.template).
    w.line(level + 1, '_TMPLT');
    if (citation.template.templateId !== undefined) {
      w.line(level + 2, 'TID', { value: citation.template.templateId });
    }
    for (const field of citation.template.fields) {
      w.line(level + 2, 'FIELD');
      w.line(level + 3, 'NAME', { value: field.name });
      if (field.value !== undefined) {
        w.line(level + 3, 'VALUE', { value: field.value });
      }
    }
    emitExtensions(w, version, level + 2, citation.template);
  }
  // Generic extensions of the citation itself are written back beneath
  // the SOUR line: a documented extension tag may appear under any
  // structure (GEDCOM 7.0 §1.5).
  emitExtensions(w, version, level + 1, citation);
}

export function emitMultimediaLink(w: Writer, version: Version, level: number, link: MultimediaLink): void {
  ptr(w, version, level, 'OBJE', link.object);
  if (link.primary === true) {
    w.line(level + 1, '_PRIM', { value: 'Y' });
  }
  if (link.scrapbook === true) {
    w.line(level + 1, '_SCBK', { value: 'Y' });
  }
  if (link.slideshow === true) {
    w.line(level + 1, '_SSHOW', { value: 'Y' });
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
    if (link.crop !== undefined) {
      emitExtensions(w, version, level + 2, link.crop);
    }
  }
  // 5.5.1 has no CROP/TITL under OBJE; dropped.
  emitExtensions(w, version, level + 1, link);
}

export function emitExtension(w: Writer, version: Version, level: number, ext: ExtensionStructure, top = true): void {
  if (top && version === '7.0' && !ext.tag.startsWith('_')) {
    // GEDCOM 7.0 §1.5 extension tags must be underscore-prefixed
    // (extTag): a non-underscore vendor extension accepted from 5.x
    // input (see parsing/vendor-tags.ts) has no 7.0 spelling and is
    // dropped, like the other 5.5.1-only constructs. Nested children
    // are exempt: their meaning is defined by the containing extension,
    // which may use standard tags (GEDCOM 7.0 §1.5).
    return;
  }
  const payload = ext.payload === undefined ? undefined : ext.payload;
  // The cross-reference identifier is written at every level: GEDCOM
  // 7.0 §1.5 permits an xref on a tagged extension structure wherever
  // it occurs (see ExtensionStructure.xref).
  w.line(level, ext.tag, { xref: ext.xref, value: payload });
  for (const child of ext.children) {
    emitExtension(w, version, level + 1, child, false);
  }
}

export function emitExtensions(w: Writer, version: Version, level: number, structure: GedcomStructureBase): void {
  for (const ext of structure.extensions ?? []) {
    emitExtension(w, version, level, ext, undefined);
  }
}

// -- Value spellings ---------------------------------------------------------

