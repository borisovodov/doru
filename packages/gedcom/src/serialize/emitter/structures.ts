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
  AGE_KEYWORD_TO_70,
  ROLE_TO_RELA_551,
} from '../tables';
import type {
  Version,
} from '../writer';
import {
  Writer,
} from '../writer';
import {
  emitOccurrenceReference,
} from './evidence';
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
  for (const note of address.notes ?? []) {
    // The standard 5.5.1 ADDRESS_STRUCTURE note slot (see
    // AddressStructure.notes); accepted and written in both versions.
    emitNoteStructure(w, version, level + 1, note);
  }
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
    emitAssoExtensionFields(w, version, level + 1, association);
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
  emitAssoExtensionFields(w, version, level + 1, association);
  for (const note of association.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const citation of association.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
  emitExtensions(w, version, level + 1, association);
}

/**
 * The gedcom-extended-ASSO fields (see AssociationStructure): the
 * underscore tags are valid extension spellings in both versions and
 * are written back the same in each.
 */
function emitAssoExtensionFields(w: Writer, version: Version, level: number, association: AssociationStructure): void {
  if (association.specificType !== undefined) {
    w.line(level, '_TYPE', { value: association.specificType });
  }
  if (association.period !== undefined) {
    w.line(level, '_PERIOD');
    if (association.period.start !== undefined) {
      emitDate(w, version, level + 1, '_START', association.period.start);
    }
    if (association.period.end !== undefined) {
      emitDate(w, version, level + 1, '_END', association.period.end);
    }
    emitExtensions(w, version, level + 1, association.period);
  }
  if (association.confidence !== undefined) {
    w.line(level, '_CONF', { value: association.confidence });
  }
  if (association.private === true) {
    w.line(level, '_PRIV', { value: 'Y' });
  }
}

export function emitDate(w: Writer, version: Version, level: number, tag: string, date: DateStructure): void {
  const emitTrailer = (): void => {
    // TMG: citations attached to the DATE line (see
    // DateStructure.citations) — SOUR lines subordinate to the DATE.
    for (const citation of date.citations ?? []) {
      emitSourceCitation(w, version, level + 1, citation);
    }
    emitExtensions(w, version, level + 1, date);
  };
  if (version === '7.0') {
    const raw = date.value === undefined ? undefined : formatDateValue70(date.value);
    // A value the target cannot spell (the year-less 5.5.5 date form)
    // is dropped; TIME and PHRASE substructures still make the DATE
    // meaningful. An empty payload with no substructures at all has
    // nothing to carry and is dropped too (GEDCOM 7.0 §1.2: a
    // structure must have a non-empty payload or a substructure).
    if ((raw !== undefined && raw !== '') || date.time !== undefined || date.phrase !== undefined) {
      w.line(level, tag, { value: raw === '' ? undefined : raw });
    }
    if (date.time !== undefined) {
      w.line(level + 1, 'TIME', { value: formatTime(date.time, '7.0') });
    }
    if (date.phrase !== undefined) {
      w.line(level + 1, 'PHRASE', { value: date.phrase });
    }
    emitTrailer();
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
  // value subordinate to the DATE line tag"). The 5.5.1 date structure
  // also carries the optional TIME child (`n DATE <DATE_VALUE>` +
  // `+1 TIME <TIME_VALUE>`), written right after the DATE line.
  const writeDateLine = (value: string | undefined): void => {
    w.line(level, tag, value === undefined ? {} : { value });
    if (date.time !== undefined) {
      w.line(level + 1, 'TIME', { value: formatTime(date.time, '5.5.1') });
    }
  };
  if (date.value === undefined) {
    if (date.phrase !== undefined) {
      writeDateLine(`(${date.phrase})`);
      emitTrailer();
    }
    // An empty date with no phrase has no 5.5.1 spelling (the 5.5.1
    // DATE_VALUE grammar has no empty production); the whole DATE —
    // including its TIME — is dropped.
    return;
  }
  const raw = formatDateValue551(date.value);
  if (raw === undefined) {
    // A value the 5.5.1 grammar cannot spell directly (a BCE epoch on
    // a month-bearing date; the year-less 5.5.5 form). When the 7.0
    // spelling exists it is kept as the parenthesized 5.5.1 date
    // phrase, which is lossless as text; the year-less form has no 7.0
    // spelling either and is dropped.
    const phraseSpelling = formatDateValue70(date.value);
    if (phraseSpelling !== undefined && phraseSpelling !== '') {
      writeDateLine(`(${phraseSpelling})`);
      if (date.phrase !== undefined) {
        w.line(level + 1, 'NOTE', { value: date.phrase });
      }
      emitTrailer();
    }
    return;
  }
  if (raw === '') {
    // The empty payload form (GEDCOM 7.0 §2.4): nothing to write on a
    // 5.5.1 DATE line; a phrase still gives the DATE a body.
    if (date.phrase !== undefined) {
      writeDateLine(`(${date.phrase})`);
    }
    emitTrailer();
    return;
  }
  if (date.phrase !== undefined) {
    if (date.value.kind === 'date') {
      writeDateLine(`INT ${raw} (${date.phrase})`);
    } else {
      writeDateLine(raw);
      w.line(level + 1, 'NOTE', { value: date.phrase });
    }
    emitTrailer();
    return;
  }
  writeDateLine(raw);
  emitTrailer();
}

export function emitDateExact(w: Writer, version: Version, level: number, tag: string, date: DateExactStructure, time?: TimeValue): void {
  const raw = formatDateExact(date.value, version);
  if (raw === undefined) {
    // A partial (year-only) or BCE-epoch DateExact: kept lossless as
    // the parenthesized date text.
    const parts = [date.value.day, date.value.month, date.value.year].filter((part) => part !== undefined);
    const epoch = date.value.epoch === undefined ? '' : date.value.epoch === 'BCE' ? ' B.C.' : ` ${date.value.epoch}`;
    w.line(level, tag, { value: `(${parts.join(' ')}${epoch})` });
    emitExtensions(w, version, level + 1, date);
    return;
  }
  w.line(level, tag, { value: raw });
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
      value = AGE_KEYWORD_TO_70[payload.description] ?? '< 1y';
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
  if (version === '5.5.1' && detail.quality !== undefined) {
    // The event's own reliability assessment (see EventDetail.quality);
    // 7.0 has no QUAY anywhere.
    w.line(level, 'QUAY', { value: detail.quality });
  }
  if (detail.map !== undefined) {
    // MFT7: the event's coordinates (see EventDetail.map), written
    // back as the standard MAP/LATI/LONG.
    w.line(level, 'MAP');
    w.line(level + 1, 'LATI', { value: `${detail.map.latitude.direction}${detail.map.latitude.degrees}` });
    w.line(level + 1, 'LONG', { value: `${detail.map.longitude.direction}${detail.map.longitude.degrees}` });
  }
  if (detail.changeDate !== undefined) {
    // The change date attached to the event (see
    // EventDetail.changeDate).
    w.line(level, 'CHAN');
    emitDateExact(w, version, level + 1, 'DATE', detail.changeDate.date, detail.changeDate.date.time);
    for (const note of detail.changeDate.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
    for (const citation of detail.changeDate.citations ?? []) {
      // Citations under the CHAN block (see ChangeDate.citations).
      emitSourceCitation(w, version, level + 1, citation);
    }
    if (detail.changeDate.user !== undefined) {
      w.line(level + 1, '_WT_USER', { value: detail.changeDate.user });
    }
    emitExtensions(w, version, level + 1, detail.changeDate);
  }
  if (detail.creationDate !== undefined && version === '7.0') {
    // The creation date attached to the event (see
    // EventDetail.creationDate); 5.5.1 drops it (like the
    // record-level CREA).
    w.line(level, 'CREA');
    emitDateExact(w, version, level + 1, 'DATE', detail.creationDate.date, detail.creationDate.date.time);
    emitExtensions(w, version, level + 1, detail.creationDate);
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
      w.line(level, '_SHAR', { value: association.individual, pointer: true });
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
  for (const occurrence of detail.occurrences ?? []) {
    // The gedcom-occurrences backward-compatibility position: the
    // reference under the event itself (see EventDetail.occurrences).
    emitOccurrenceReference(w, version, level, occurrence);
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
  if (detail.birthLength !== undefined) {
    // Aldfaer: the length at birth (see EventDetail.birthLength).
    w.line(level, '_LENGTH', { value: detail.birthLength });
  }
  if (detail.birthWeight !== undefined) {
    // Aldfaer: the weight at birth (see EventDetail.birthWeight).
    w.line(level, '_WEIGHT', { value: detail.birthWeight });
  }
  if (detail.cemetery !== undefined) {
    // phpGedView: the cemetery of the burial (see EventDetail.cemetery);
    // written back as the underscore spelling `_CEME`.
    w.line(level, '_CEME', { value: detail.cemetery });
  }
  if (detail.createdAt !== undefined) {
    // Heredis/MFT7/GenPlus: the event creation date (see
    // EventDetail.createdAt).
    w.line(level, '_CREAT', { value: detail.createdAt });
  }
  if (detail.fna !== undefined) {
    // Heredis: the event flag (see EventDetail.fna).
    w.line(level, '_FNA', { value: detail.fna ? 'Y' : 'N' });
  }
  if (detail.descriptionAware !== undefined) {
    // MyHeritage: the event's description-aware flag (see
    // EventDetail.descriptionAware).
    w.line(level, '_DESCRIPTION', { value: detail.descriptionAware ? 'Y' : 'N' });
  }
  if (version === '5.5.1') {
    // The USM6 event marks; 7.0 cannot spell the tags. The 5.5.1
    // output uses the underscore spellings `_POTM`/`_SRCH`/`_NOTRY` —
    // the USM6 wire spellings are non-underscore vendor tags, and
    // 5.5.1 requires user-defined tags to begin with an underscore.
    // Both spellings are recognized on input.
    if (detail.posthumous !== undefined) {
      w.line(level, '_POTM', { value: detail.posthumous ? '1' : '0' });
    }
    if (detail.furtherResearch !== undefined) {
      w.line(level, '_SRCH', { value: detail.furtherResearch });
    }
    if (detail.notary !== undefined) {
      w.line(level, '_NOTRY', { value: detail.notary });
    }
    if (detail.automatedRecordId !== undefined) {
      // Ancestry.com Family Trees: the record-level RIN repeated under
      // the event (see EventDetail.automatedRecordId). 7.0 has no RIN.
      w.line(level, 'RIN', { value: detail.automatedRecordId });
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
  if (inline.date !== undefined) {
    // TMG: the date the note was recorded (see Note.date).
    emitDate(w, version, level + 1, 'DATE', inline.date);
  }
  if (inline.place !== undefined) {
    // TMG: the place associated with the note (see Note.place).
    emitPlace(w, version, level + 1, inline.place);
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
    if (citation.page !== undefined) {
      // The page of the description-form citation (see
      // SourceCitation.page).
      w.line(level + 1, 'PAGE', { value: citation.page.payload });
      emitExtensions(w, version, level + 2, citation.page);
    }
    if (citation.referenceNumber !== undefined) {
      // A reference number of the citation itself (see
      // SourceCitation.referenceNumber).
      w.line(level + 1, 'REFN', { value: citation.referenceNumber });
    }
    if (citation.abbreviation !== undefined) {
      // FTM: the cited source's short title (see
      // SourceCitation.abbreviation).
      w.line(level + 1, '_ABBR', { value: citation.abbreviation });
    }
    if (citation.automatedRecordId !== undefined) {
      // The citation's record id in the source system (see
      // SourceCitation.automatedRecordId); 5.5.1-only branch.
      w.line(level + 1, 'RIN', { value: citation.automatedRecordId });
    }
    if (citation.www !== undefined) {
      // The web address of the cited material (see SourceCitation.www).
      w.line(level + 1, 'WWW', { value: citation.www });
    }
    if (citation.wifePersonId !== undefined) {
      w.line(level + 1, '_WPID', { value: citation.wifePersonId });
    }
    if (citation.husbandPersonId !== undefined) {
      w.line(level + 1, '_HPID', { value: citation.husbandPersonId });
    }
    if (citation.footnote !== undefined) {
      w.line(level + 1, '_FOOT', { value: citation.footnote });
    }
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
    if (citation.assessment !== undefined) {
      // FH7: the citation assessment options (see
      // SourceCitation.assessment) — written back in the free-text
      // branch too, where the parser accepts it.
      w.line(level + 1, '_QUAY', { value: citation.assessment });
    }
    for (const metafield of citation.metafields ?? []) {
      // FH7: the source-template metafield (see
      // SourceCitation.metafields).
      w.line(level + 1, '_FIELD', { value: metafield.name });
      if (metafield.text !== undefined) {
        w.line(level + 2, 'TEXT', { value: metafield.text });
      }
    }
    for (const link of citation.links ?? []) {
      // FTM: an internet link associated with the source (see
      // SourceCitation.links).
      w.line(level + 1, '_LINK', { value: link });
    }
    if (version === '5.5.1' && citation.foundBy !== undefined) {
      // USM6: who found the source information (see
      // SourceCitation.foundBy).
      w.line(level + 1, '_RINI', { value: citation.foundBy });
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
  if (citation.referenceNumber !== undefined) {
    // A reference number of the citation itself (see
    // SourceCitation.referenceNumber).
    w.line(level + 1, 'REFN', { value: citation.referenceNumber });
  }
  if (citation.abbreviation !== undefined) {
    // FTM: the cited source's short title (see
    // SourceCitation.abbreviation).
    w.line(level + 1, '_ABBR', { value: citation.abbreviation });
  }
  if (version === '5.5.1' && citation.automatedRecordId !== undefined) {
    // The citation's record id in the source system (see
    // SourceCitation.automatedRecordId); 7.0 has no RIN.
    w.line(level + 1, 'RIN', { value: citation.automatedRecordId });
  }
  if (citation.www !== undefined) {
    // The web address of the cited material, directly under the
    // citation (see SourceCitation.www).
    w.line(level + 1, 'WWW', { value: citation.www });
  }
  if (citation.wifePersonId !== undefined) {
    // MyHeritage: the wife's person id under a marriage citation (see
    // SourceCitation.wifePersonId).
    w.line(level + 1, '_WPID', { value: citation.wifePersonId });
  }
  if (citation.husbandPersonId !== undefined) {
    // MyHeritage: the husband's person id under a marriage citation
    // (see SourceCitation.husbandPersonId).
    w.line(level + 1, '_HPID', { value: citation.husbandPersonId });
  }
  if (citation.footnote !== undefined) {
    // The footnote text of the citation (see SourceCitation.footnote).
    w.line(level + 1, '_FOOT', { value: citation.footnote });
  }
  for (const link of citation.links ?? []) {
    // FTM: an internet link associated with the source (see
    // SourceCitation.links).
    w.line(level + 1, '_LINK', { value: link });
  }
  if (citation.subsequentCitationFormat !== undefined) {
    // RootsMagic: the subsequent-citation format (report wording).
    w.line(level + 1, '_SUBQ', { value: citation.subsequentCitationFormat });
  }
  if (citation.verified === true) {
    w.line(level + 1, '_VERI', { value: 'Y' });
  }
  if (citation.confidence !== undefined) {
    // The confidence level of the citation (see
    // SourceCitation.confidence).
    w.line(level + 1, '_CONF', { value: citation.confidence });
  }
  if (citation.name !== undefined) {
    // The name of the cited source, under the citation (see
    // SourceCitation.name).
    w.line(level + 1, 'NAME', { value: citation.name });
  }
  if (citation.qualityAssessment !== undefined) {
    // The MFT7 source-quality block under the citation (see
    // SourceCitation.qualityAssessment).
    w.line(level + 1, '_QUAL');
    if (citation.qualityAssessment.source !== undefined) {
      w.line(level + 2, '_SOUR', { value: citation.qualityAssessment.source });
    }
    if (citation.qualityAssessment.information !== undefined) {
      w.line(level + 2, '_INFO', { value: citation.qualityAssessment.information });
    }
    if (citation.qualityAssessment.evidence !== undefined) {
      w.line(level + 2, '_EVID', { value: citation.qualityAssessment.evidence });
    }
    emitExtensions(w, version, level + 2, citation.qualityAssessment);
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
    // SourceCitation.foundBy); 7.0 cannot spell the tag. Written as
    // the underscore spelling `_RINI` (both spellings are recognized
    // on input).
    w.line(level + 1, '_RINI', { value: citation.foundBy });
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
    if (citation.data.www !== undefined) {
      // The web address of the cited material, under DATA (see
      // SourceCitationData.www).
      w.line(level + 2, 'WWW', { value: citation.data.www });
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
  for (const citation of link.citations ?? []) {
    // A citation under the inline media link (see
    // MultimediaLink.citations).
    emitSourceCitation(w, version, level + 1, citation);
  }
  if (link.primary === true) {
    w.line(level + 1, '_PRIM', { value: 'Y' });
  }
  if (link.scrapbook === true) {
    w.line(level + 1, '_SCBK', { value: 'Y' });
  }
  if (link.slideshow === true) {
    w.line(level + 1, '_SSHOW', { value: 'Y' });
  }
  if (link.thumbnail === true) {
    // Généatique: the thumbnail flag (see MultimediaLink.thumbnail).
    w.line(level + 1, '_THUM', { value: 'Y' });
  }
  if (link.sequence !== undefined) {
    // FH: the sequence number of the media item (see
    // MultimediaLink.sequence).
    w.line(level + 1, '_SEQ', { value: String(link.sequence) });
  }
  if (link.area !== undefined) {
    // FH: the display area (see MultimediaLink.area); the payload is
    // kept verbatim.
    w.line(level + 1, '_AREA', { value: link.area });
  }
  if (link.excludeFromDiagrams === true) {
    // FH: the media item is excluded from diagrams (see
    // MultimediaLink.excludeFromDiagrams).
    w.line(level + 1, '_EXCL', { value: 'ALL' });
  }
  if (link.caption === true) {
    // FH: the media item carries a caption (see MultimediaLink.caption).
    w.line(level + 1, '_CAPT', { value: 'Y' });
  }
  if (link.cutout === true) {
    // MyHeritage / GEDKeeper: the cutout flag (see MultimediaLink.cutout).
    w.line(level + 1, '_CUTOUT', { value: 'Y' });
  }
  if (link.primaryCutout === true) {
    w.line(level + 1, '_PRIM_CUTOUT', { value: 'Y' });
  }
  if (link.parentPhoto === true) {
    w.line(level + 1, '_PARENTPHOTO', { value: 'Y' });
  }
  if (link.personalPhoto === true) {
    w.line(level + 1, '_PERSONALPHOTO', { value: 'Y' });
  }
  if (link.parentRecordId !== undefined) {
    w.line(level + 1, '_PARENTRIN', { value: link.parentRecordId });
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
      if (link.crop.type !== undefined) {
        // The crop variant (see CropStructure.type).
        w.line(level + 2, '_TYPE', { value: link.crop.type });
      }
    }
    if (link.title !== undefined) {
      w.line(level + 1, 'TITL', { value: link.title });
    }
    if (link.crop !== undefined) {
      emitExtensions(w, version, level + 2, link.crop);
    }
  } else if (link.crop !== undefined) {
    // 5.5.1 has no standard CROP under OBJE; the Ancestry.com Family
    // Trees spelling is written back instead (the `_CROP` block with
    // `_LEFT`/`_TOP`/`_WDTH`/`_HGHT` — the offset-plus-size form the
    // parser reads into the same slots).
    w.line(level + 1, '_CROP');
    if (link.crop.left !== undefined) {
      w.line(level + 2, '_LEFT', { value: String(link.crop.left) });
    }
    if (link.crop.top !== undefined) {
      w.line(level + 2, '_TOP', { value: String(link.crop.top) });
    }
    if (link.crop.width !== undefined) {
      w.line(level + 2, '_WDTH', { value: String(link.crop.width) });
    }
    if (link.crop.height !== undefined) {
      w.line(level + 2, '_HGHT', { value: String(link.crop.height) });
    }
    if (link.crop.type !== undefined) {
      // The crop variant (see CropStructure.type).
      w.line(level + 2, '_TYPE', { value: link.crop.type });
    }
    emitExtensions(w, version, level + 2, link.crop);
  }
  emitExtensions(w, version, level + 1, link);
}

export function emitExtension(w: Writer, version: Version, level: number, ext: ExtensionStructure, top = true): void {
  // An iterative depth-first walk: deeply nested extension trees must
  // not blow the JS stack (see parseExtension).
  interface Frame {
    ext: ExtensionStructure;
    level: number;
    top: boolean;
  }
  const stack: Frame[] = [{ ext, level, top }];
  while (stack.length > 0) {
    const frame = stack.pop() as Frame;
    const current = frame.ext;
    if (frame.top && !current.tag.startsWith('_')) {
      // A non-underscore vendor extension accepted on input (see
      // parsing/vendor-tags.ts) is not spelled by either target grammar:
      // 7.0 §1.5 extension tags must be underscore-prefixed (extTag),
      // and 5.5.1 reserves the underscore prefix for user-defined tags
      // the same way. It is dropped on export in both versions. Nested
      // children are exempt: their meaning is defined by the containing
      // extension, which may use standard tags (GEDCOM 7.0 §1.5).
      continue;
    }
    const payload = current.payload === undefined ? undefined : current.payload;
    // The cross-reference identifier: GEDCOM 7.0 §1.3 forbids one on a
    // substructure ("A substructure or pseudo-structure must not have a
    // cross-reference identifier"), so 7.0 output carries it only at
    // record level (level 0); 5.5.1 files in the wild carry xrefs on
    // vendor substructures, and the lenient 5.5.1 writer keeps them
    // verbatim (see ExtensionStructure.xref).
    const xref = version === '7.0' && frame.level > 0 ? undefined : current.xref;
    w.line(frame.level, current.tag, {
      xref,
      value: payload,
      ...(current.payloadKind === 'pointer' ? { pointer: true } : {}),
    });
    for (let i = current.children.length - 1; i >= 0; i--) {
      stack.push({ ext: current.children[i] as ExtensionStructure, level: frame.level + 1, top: false });
    }
  }
}

export function emitExtensions(w: Writer, version: Version, level: number, structure: GedcomStructureBase): void {
  for (const ext of structure.extensions ?? []) {
    emitExtension(w, version, level, ext, undefined);
  }
}

// -- Value spellings ---------------------------------------------------------

