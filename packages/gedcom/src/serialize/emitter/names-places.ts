/**
 * Serializer section: names, places and media files.
 *
 * Part of the serializer split; see serialize.ts for the public API.
 * These functions are projections: see the README's Serialization
 * section for what is translated and what is dropped.
 */

import type {
  MediaFile,
  MediaFormatStructure,
  MediaStructure,
  NameTypeStructure,
  PersonalNamePieces,
  PersonalNameStructure,
  PlaceRecord,
  PlaceStructure,
} from '../../structures';
import {
  formatName551,
  formatName70,
} from '../format';
import {
  LANGUAGE_TO_METHOD_551,
  METHOD_TO_LANGUAGE_70,
} from '../tables';
import type {
  Version,
} from '../writer';
import {
  Writer,
} from '../writer';
import { commonRecordFields } from './document';
import {
  emitDate,
  emitEventDetail,
  emitExtensions,
  emitNoteStructure,
  emitSourceCitation,
} from './structures';
import {
  medi551,
  mediaType,
  ptr,
} from './values';

export function emitMediaFile(w: Writer, version: Version, level: number, file: MediaFile): void {
  if (version === '5.5.1' && mediaType(w, version, file.form.payload) === undefined) {
    // 5.5.1 can only name the seven fixed formats; a file whose format
    // cannot be named is dropped together with its substructures.
    return;
  }
  w.line(level, 'FILE', { value: file.payload });
  emitMediaFormat(w, version, level + 1, file.form);
  if (file.title !== undefined) {
    w.line(level + 1, 'TITL', { value: file.title });
  }
  if (file.contentType !== undefined) {
    // Ahnenblatt: the content type of the picture (see
    // MediaFile.contentType). Written back under the FILE line in both
    // versions.
    w.line(level + 1, '_CTYP', { value: file.contentType });
  }
  if (version === '7.0') {
    for (const translation of file.translations ?? []) {
      w.line(level + 1, 'TRAN', { value: translation.payload });
      emitMediaFormat(w, version, level + 2, translation.form);
    }
  }
}

export function emitMediaFormat(w: Writer, version: Version, level: number, format: MediaFormatStructure): void {
  const value = mediaType(w, version, format.payload);
  if (value === undefined) {
    return;
  }
  w.line(level, 'FORM', { value });
  if (format.medium !== undefined) {
    if (version === '7.0') {
      emitMedia(w, version, level + 1, format.medium);
    } else {
      const medium = medi551(w, version, format.medium.payload);
      if (medium !== undefined) {
        w.line(level + 1, 'TYPE', { value: medium });
      }
    }
  }
}

export function emitMedia(w: Writer, _version: Version, level: number, medium: MediaStructure): void {
  w.line(level, 'MEDI', { value: medium.payload });
  if (medium.phrase !== undefined) {
    w.line(level + 1, 'PHRASE', { value: medium.phrase });
  }
}

export function emitPersonalName(w: Writer, version: Version, level: number, name: PersonalNameStructure): void {
  w.line(level, 'NAME', { value: version === '7.0' ? formatName70(name.payload) : formatName551(name.payload) });
  if (name.type !== undefined) {
    emitNameType(w, version, level + 1, name.type);
  }
  emitNamePieces(w, version, level + 1, name.pieces);
  if (name.callName !== undefined) {
    w.line(level + 1, '_RUFNAME', { value: name.callName });
  }
  if (name.givenNameUsed !== undefined) {
    // FH: the given name used (see PersonalNameStructure.givenNameUsed).
    w.line(level + 1, '_USED', { value: name.givenNameUsed });
  }
  if (version === '5.5.1') {
    // The USM6/MFT7 name extras; 7.0 cannot spell the non-underscore tags.
    if (name.surnameVariants !== undefined) {
      w.line(level + 1, 'NAME_', { value: name.surnameVariants });
    }
    if (name.furtherGivenNames !== undefined) {
      w.line(level + 1, 'SECG', { value: name.furtherGivenNames });
    }
  }
  for (const link of name.censusLinks ?? []) {
    ptr(w, version, level + 1, '_CENR', link);
  }
  for (const apid of name.ancestryPointers ?? []) {
    w.line(level + 1, '_APID', { value: apid });
  }
  if (version === '7.0') {
    // The 5.5.1 phonetic/romanized variations become TRANs where the
    // method names a known language; unknown methods are dropped.
    for (const variation of name.phonetic ?? []) {
      const language = METHOD_TO_LANGUAGE_70.get(variation.type);
      if (language === undefined) {
        continue;
      }
      w.line(level + 1, 'TRAN', { value: formatName70(variation.payload) });
      w.line(level + 2, 'LANG', { value: language });
      emitNamePieces(w, version, level + 2, variation.pieces);
    }
    for (const variation of name.romanized ?? []) {
      const language = METHOD_TO_LANGUAGE_70.get(variation.type);
      if (language === undefined) {
        continue;
      }
      w.line(level + 1, 'TRAN', { value: formatName70(variation.payload) });
      w.line(level + 2, 'LANG', { value: language });
      emitNamePieces(w, version, level + 2, variation.pieces);
    }
    for (const translation of name.translations ?? []) {
      w.line(level + 1, 'TRAN', { value: formatName70(translation.payload) });
      w.line(level + 2, 'LANG', { value: translation.language });
      emitNamePieces(w, version, level + 2, translation.pieces);
    }
    for (const note of name.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
    for (const citation of name.citations ?? []) {
      emitSourceCitation(w, version, level + 1, citation);
    }
  } else {
    // The 7.0 TRANs become FONE/ROMN where the language names a known
    // method; unknown languages are dropped.
    for (const translation of name.translations ?? []) {
      const method = LANGUAGE_TO_METHOD_551.get(translation.language.toLowerCase());
      if (method === undefined) {
        continue;
      }
      const tag = method === 'kana' || method === 'hangul' ? 'FONE' : 'ROMN';
      w.line(level + 1, tag, { value: formatName551(translation.payload) });
      w.line(level + 2, 'TYPE', { value: method });
      emitNamePieces(w, version, level + 2, translation.pieces);
    }
    for (const variation of name.phonetic ?? []) {
      w.line(level + 1, 'FONE', { value: formatName551(variation.payload) });
      w.line(level + 2, 'TYPE', { value: variation.type });
      emitNamePieces(w, version, level + 2, variation.pieces);
    }
    for (const variation of name.romanized ?? []) {
      w.line(level + 1, 'ROMN', { value: formatName551(variation.payload) });
      w.line(level + 2, 'TYPE', { value: variation.type });
      emitNamePieces(w, version, level + 2, variation.pieces);
    }
  }
  emitExtensions(w, version, level + 1, name);
}

export function emitNameType(w: Writer, version: Version, level: number, type: NameTypeStructure): void {
  if (version === '7.0') {
    w.line(level, 'TYPE', { value: type.payload });
    if (type.phrase !== undefined) {
      w.line(level + 1, 'PHRASE', { value: type.phrase });
    }
    return;
  }
  // 5.5.1: the known set in lowercase, or the phrase as the user-defined
  // value. OTHER and PROFESSIONAL have no 5.5.1 spelling.
  const known: Record<string, string> = { AKA: 'aka', BIRTH: 'birth', IMMIGRANT: 'immigrant', MAIDEN: 'maiden', MARRIED: 'married' };
  const spelled = known[type.payload];
  if (spelled !== undefined) {
    w.line(level, 'TYPE', { value: spelled });
    return;
  }
  if (type.phrase !== undefined) {
    // OTHER and PROFESSIONAL have no 5.5.1 spelling; the phrase becomes
    // the user-defined value.
    w.line(level, 'TYPE', { value: type.phrase });
  }
  // Without a phrase the value cannot be spelled; dropped.
}

export function emitNamePieces(w: Writer, version: Version, level: number, pieces: PersonalNamePieces | undefined): void {
  if (pieces === undefined) {
    return;
  }
  const emit = (tag: string, values: string[] | undefined): void => {
    if (values === undefined) {
      return;
    }
    if (version === '7.0') {
      for (const value of values) {
        w.line(level, tag, { value });
      }
    } else {
      w.line(level, tag, { value: values.join(', ') });
    }
  };
  emit('NPFX', pieces.namePrefixes);
  emit('GIVN', pieces.givenNames);
  emit('NICK', pieces.nicknames);
  emit('SPFX', pieces.surnamePrefixes);
  emit('SURN', pieces.surnames);
  emit('NSFX', pieces.nameSuffixes);
  // 5.5.1 allows NOTE/SOUR under the name pieces; 7.0 does not.
  if (version === '5.5.1') {
    for (const note of pieces.notes ?? []) {
      emitNoteStructure(w, version, level, note);
    }
    for (const citation of pieces.citations ?? []) {
      emitSourceCitation(w, version, level, citation);
    }
  }
}

export function emitPlaceRecord(w: Writer, version: Version, record: PlaceRecord): void {
  // Reached for the GEDCOM-L cards kept by the 5.5.1 projection and —
  // since the 7.0 projection preserves every card — for every vendor
  // place record on 7.0 output (GEDCOM 7.0 §1.5 allows extension
  // records).
  w.line(0, '_LOC', { xref: record.xref });
  if (record.names === undefined || record.names.length === 0) {
    // A card parsed from the payload dialects (_PLAC/_PLAC_DEFN) has
    // no NAME children; the _LOC spelling carries the name in a NAME
    // child.
    if (record.payload !== '') {
      w.line(1, 'NAME', { value: record.payload });
    }
  }
  for (const name of record.names ?? []) {
    w.line(1, 'NAME', { value: name.name });
    if (name.date !== undefined) {
      emitDate(w, version, 2, 'DATE', name.date);
    }
    for (const abbr of name.abbreviations ?? []) {
      w.line(2, 'ABBR', { value: abbr.abbreviation });
      if (abbr.type !== undefined) {
        w.line(3, 'TYPE', { value: abbr.type });
      }
    }
    if (name.language !== undefined) {
      w.line(2, 'LANG', { value: name.language });
    }
    for (const citation of name.citations ?? []) {
      emitSourceCitation(w, version, 2, citation);
    }
  }
  for (const type of record.types ?? []) {
    w.line(1, 'TYPE', { value: type.type });
    if (type.govTypeId !== undefined) {
      w.line(2, '_GOVTYPE', { value: type.govTypeId });
    }
    if (type.date !== undefined) {
      emitDate(w, version, 2, 'DATE', type.date);
    }
    for (const citation of type.citations ?? []) {
      emitSourceCitation(w, version, 2, citation);
    }
  }
  if (record.govId !== undefined) {
    w.line(1, '_GOV', { value: record.govId });
  }
  for (const postal of record.postalCodes ?? []) {
    w.line(1, '_POST', { value: postal.code });
    if (postal.date !== undefined) {
      emitDate(w, version, 2, 'DATE', postal.date);
    }
    for (const citation of postal.citations ?? []) {
      emitSourceCitation(w, version, 2, citation);
    }
  }
  for (const aidn of record.administrativeIds ?? []) {
    w.line(1, '_AIDN', { value: aidn.identifier });
    w.line(2, 'TYPE', { value: aidn.type });
    if (aidn.date !== undefined) {
      emitDate(w, version, 2, 'DATE', aidn.date);
    }
    for (const citation of aidn.citations ?? []) {
      emitSourceCitation(w, version, 2, citation);
    }
  }
  for (const dmgd of record.demographicData ?? []) {
    w.line(1, '_DMGD', { value: dmgd.data });
    w.line(2, 'TYPE', { value: dmgd.type });
    if (dmgd.date !== undefined) {
      emitDate(w, version, 2, 'DATE', dmgd.date);
    }
    for (const citation of dmgd.citations ?? []) {
      emitSourceCitation(w, version, 2, citation);
    }
  }
  if (record.maidenhead !== undefined) {
    w.line(1, '_MAIDENHEAD', { value: record.maidenhead });
  }
  if (record.abbreviation !== undefined) {
    // Legacy _PLAC_DEFN: the card abbreviation (see
    // PlaceRecord.abbreviation). Written back under the _LOC record.
    w.line(1, 'ABBR', { value: record.abbreviation });
  }
  if (record.preposition !== undefined) {
    // Legacy: the location preposition of the place card (see
    // PlaceRecord.preposition).
    w.line(1, '_PREP', { value: record.preposition });
  }
  if (record.denomination !== undefined) {
    w.line(1, 'RELI', { value: record.denomination });
  }
  for (const event of record.events ?? []) {
    w.line(1, 'EVEN', { value: event.payload });
    if (event.detail !== undefined) {
      emitEventDetail(w, version, 2, event.detail);
    }
  }
  for (const parent of record.parents ?? []) {
    ptr(w, version, 1, '_LOC', parent.parent);
    if (parent.type !== undefined) {
      w.line(2, 'TYPE', { value: parent.type });
    }
    if (parent.date !== undefined) {
      emitDate(w, version, 2, 'DATE', parent.date);
    }
    for (const citation of parent.citations ?? []) {
      emitSourceCitation(w, version, 2, citation);
    }
  }
  if (record.map !== undefined) {
    w.line(1, 'MAP');
    w.line(2, 'LATI', { value: `${record.map.latitude.direction}${record.map.latitude.degrees}` });
    w.line(2, 'LONG', { value: `${record.map.longitude.direction}${record.map.longitude.degrees}` });
  }
  commonRecordFields(w, version, record, 1);
}

export function emitPlace(w: Writer, version: Version, level: number, place: PlaceStructure, tag: 'PLAC' | '_PLAC' = 'PLAC'): void {
  w.line(level, tag, { value: place.payload.join(', ') });
  if (place.form !== undefined) {
    w.line(level + 1, 'FORM', { value: place.form.join(', ') });
  }
  if (place.verified === true) {
    w.line(level + 1, '_VERI', { value: 'Y' });
  }
  if (place.govId !== undefined) {
    w.line(level + 1, '_GOV', { value: place.govId });
  }
  for (const postal of place.postalCodes ?? []) {
    w.line(level + 1, '_POST', { value: postal.code });
    if (postal.date !== undefined) {
      emitDate(w, version, level + 2, 'DATE', postal.date);
    }
    for (const citation of postal.citations ?? []) {
      emitSourceCitation(w, version, level + 2, citation);
    }
  }
  if (place.maidenhead !== undefined) {
    w.line(level + 1, '_MAIDENHEAD', { value: place.maidenhead });
  }
  if (place.location !== undefined) {
    // The GEDCOM-L card survived the prepare projection; the pointer
    // is kept.
    ptr(w, version, level + 1, '_LOC', place.location);
  }
  if (version === '7.0') {
    if (place.language !== undefined) {
      w.line(level + 1, 'LANG', { value: place.language });
    }
    for (const translation of place.translations ?? []) {
      w.line(level + 1, 'TRAN', { value: translation.payload.join(', ') });
      w.line(level + 2, 'LANG', { value: translation.language });
    }
    for (const externalId of place.externalIds ?? []) {
      w.line(level + 1, 'EXID', { value: externalId.payload });
      if (externalId.type !== undefined) {
        w.line(level + 2, 'TYPE', { value: externalId.type });
      }
    }
    for (const variation of place.phonetic ?? []) {
      const language = METHOD_TO_LANGUAGE_70.get(variation.type);
      if (language === undefined) {
        continue;
      }
      w.line(level + 1, 'TRAN', { value: variation.payload.join(', ') });
      w.line(level + 2, 'LANG', { value: language });
    }
    for (const variation of place.romanized ?? []) {
      const language = METHOD_TO_LANGUAGE_70.get(variation.type);
      if (language === undefined) {
        continue;
      }
      w.line(level + 1, 'TRAN', { value: variation.payload.join(', ') });
      w.line(level + 2, 'LANG', { value: language });
    }
    for (const note of place.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
  } else {
    // 5.5.1 has no LANG/EXID on PLAC; dropped. The 7.0 TRANs become
    // FONE/ROMN where the language names a known method.
    for (const translation of place.translations ?? []) {
      const method = LANGUAGE_TO_METHOD_551.get(translation.language.toLowerCase());
      if (method === undefined) {
        continue;
      }
      const tag = method === 'kana' || method === 'hangul' ? 'FONE' : 'ROMN';
      w.line(level + 1, tag, { value: translation.payload.join(', ') });
      w.line(level + 2, 'TYPE', { value: method });
    }
    for (const variation of place.phonetic ?? []) {
      w.line(level + 1, 'FONE', { value: variation.payload.join(', ') });
      w.line(level + 2, 'TYPE', { value: variation.type });
    }
    for (const variation of place.romanized ?? []) {
      w.line(level + 1, 'ROMN', { value: variation.payload.join(', ') });
      w.line(level + 2, 'TYPE', { value: variation.type });
    }
    for (const note of place.notes ?? []) {
      emitNoteStructure(w, version, level + 1, note);
    }
  }
  if (place.map !== undefined) {
    w.line(level + 1, 'MAP');
    w.line(level + 2, 'LATI', { value: `${place.map.latitude.direction}${place.map.latitude.degrees}` });
    w.line(level + 2, 'LONG', { value: `${place.map.longitude.direction}${place.map.longitude.degrees}` });
  }
}

