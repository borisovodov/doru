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
import { emitEvidenceReference } from './evidence';
import { formatName551, formatName70 } from '../format';
import { LANGUAGE_TO_METHOD_551, METHOD_TO_LANGUAGE_70, NAME_TYPE_TO_551 } from '../tables';
import type { Version } from '../writer';
import { Writer } from '../writer';
import { commonRecordFields } from './document';
import {
  emitDate,
  emitDateExact,
  emitEventDetail,
  emitExtensions,
  emitMultimediaLink,
  emitNoteStructure,
  emitSourceCitation,
} from './structures';
import { medi551, mediaType, ptr } from './values';

export function emitMediaFile(w: Writer, version: Version, level: number, file: MediaFile): void {
  if (file.form === undefined) {
    // A FILE without FORM (the full-leniency container rule): written
    // back without the FORM line.
    w.line(level, 'FILE', { value: file.payload });
    if (file.title !== undefined) {
      w.line(level + 1, 'TITL', { value: file.title });
    }
    if (file.text !== undefined) {
      // FTM: the file's transcription text (see MediaFile.text).
      w.line(level + 1, '_TEXT', { value: file.text });
    }
    if (file.date !== undefined) {
      // FTM: the file's modification timestamp (see MediaFile.date).
      w.line(level + 1, '_DATE', { value: file.date });
    }
    emitExtensions(w, version, level + 1, file);
    return;
  }
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
  if (file.text !== undefined) {
    // FTM: the file's transcription text (see MediaFile.text).
    w.line(level + 1, '_TEXT', { value: file.text });
  }
  if (file.date !== undefined) {
    // FTM: the file's modification timestamp (see MediaFile.date).
    w.line(level + 1, '_DATE', { value: file.date });
  }
  if (file.contentType !== undefined) {
    // Ahnenblatt: the content type of the picture (see
    // MediaFile.contentType). Written back under the FILE line in both
    // versions.
    w.line(level + 1, '_CTYP', { value: file.contentType });
  }
  if (file.alternatePath !== undefined) {
    // Ahnenblatt: an alternative or relative file path without the
    // file name (see MediaFile.alternatePath).
    w.line(level + 1, '_ALTPATH', { value: file.alternatePath });
  }
  if (file.fileSize !== undefined) {
    // Family Tree Builder / MyHeritage: the media file size (see
    // MediaFile.fileSize). The vendor writes it beside the FILE line,
    // not under it, so it is emitted at the FILE's own level.
    w.line(level, '_FILESIZE', { value: String(file.fileSize) });
  }
  if (file.album !== undefined) {
    // Family Tree Builder / MyHeritage: the album XREF (see
    // MediaFile.album); written beside the FILE line (the vendor
    // position). The xref-shaped wire form is emitted verbatim (a
    // pointer) so it round-trips unchanged.
    w.line(level, '_ALBUM', { value: file.album, pointer: /^@[^@]+@$/.test(file.album) });
  }
  if (file.recordId !== undefined) {
    // Family Tree Builder / MyHeritage: the photo's record id (see
    // MediaFile.recordId); written beside the FILE line (the vendor
    // position).
    w.line(level, '_PHOTO_RIN', { value: file.recordId });
  }
  if (version === '7.0') {
    for (const translation of file.translations ?? []) {
      w.line(level + 1, 'TRAN', { value: translation.payload });
      emitMediaFormat(w, version, level + 2, translation.form);
      emitExtensions(w, version, level + 2, translation);
    }
  }
  emitExtensions(w, version, level + 1, file);
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
      } else if (format.medium.phrase !== undefined) {
        // 5.5.1 cannot spell OTHER; the phrase is the vendor's own
        // value (`TYPE image`), written back so nothing is lost.
        w.line(level + 1, 'TYPE', { value: format.medium.phrase });
      }
    }
  }
  if (format.kind !== undefined) {
    // Ancestry.com Family Trees: the display kind of the media (see
    // MediaFormatStructure.kind).
    w.line(level + 1, '_MTYPE', { value: format.kind });
  }
  if (format.storageType !== undefined) {
    // Ancestry.com Family Trees: the stored encoding of the file (see
    // MediaFormatStructure.storageType).
    w.line(level + 1, '_STYPE', { value: format.storageType });
  }
  if (format.size !== undefined) {
    // Ancestry.com Family Trees: the file size in bytes (see
    // MediaFormatStructure.size).
    w.line(level + 1, '_SIZE', { value: String(format.size) });
  }
  if (format.width !== undefined) {
    // Ancestry.com Family Trees: the picture width in pixels (see
    // MediaFormatStructure.width).
    w.line(level + 1, '_WDTH', { value: String(format.width) });
  }
  if (format.height !== undefined) {
    // Ancestry.com Family Trees: the picture height in pixels (see
    // MediaFormatStructure.height).
    w.line(level + 1, '_HGHT', { value: String(format.height) });
  }
  emitExtensions(w, version, level + 1, format);
}

export function emitMedia(w: Writer, version: Version, level: number, medium: MediaStructure): void {
  if (version === '5.5.1') {
    // 5.5.1 spells the SOURCE_MEDIA_TYPE lowercase (GEDCOM 5.5.1 §2
    // p.61–62) and has no PHRASE under MEDI; OTHER has no 5.5.1
    // spelling. The 7.0 forms (uppercase, OTHER, the PHRASE
    // substructure) are dropped — the MEDI line itself disappears for
    // OTHER (see medi551).
    const value = medi551(w, version, medium.payload);
    if (value === undefined) {
      return;
    }
    w.line(level, 'MEDI', { value });
    emitExtensions(w, version, level + 1, medium);
    return;
  }
  w.line(level, 'MEDI', { value: medium.payload });
  if (medium.phrase !== undefined) {
    w.line(level + 1, 'PHRASE', { value: medium.phrase });
  }
  emitExtensions(w, version, level + 1, medium);
}

export function emitPersonalName(
  w: Writer,
  version: Version,
  level: number,
  name: PersonalNameStructure,
  tag: 'NAME' | '_NAM' = 'NAME',
): void {
  w.line(level, tag, { value: version === '7.0' ? formatName70(name.payload) : formatName551(name.payload) });
  if (name.type !== undefined) {
    emitNameType(w, version, level + 1, name.type);
  }
  emitNamePieces(w, version, level + 1, name.pieces);
  if (name.callName !== undefined) {
    w.line(level + 1, '_RUFNAME', { value: name.callName });
  }
  if (name.nameAsRecorded !== undefined) {
    // OFB-Werkstatt: the name in the church book's spelling (see
    // PersonalNameStructure.nameAsRecorded).
    w.line(level + 1, '_KB_NAME', { value: name.nameAsRecorded });
  }
  if (name.shortName !== undefined) {
    // Brother's Keeper 6: the short name (see
    // PersonalNameStructure.shortName).
    w.line(level + 1, '_SHON', { value: name.shortName });
  }
  if (name.date !== undefined) {
    // TMG: a date associated with the name (see
    // PersonalNameStructure.date).
    emitDate(w, version, level + 1, '_DATE', name.date);
  }
  for (const alias of name.aliases ?? []) {
    // PRO-GEN: an alias of the name, as pure text (see
    // PersonalNameStructure.aliases).
    w.line(level + 1, '_ALIA', { value: alias });
  }
  for (const link of name.aliasLinks ?? []) {
    // TMG: an alias written with the standard ALIA spelling, with its
    // citations (see PersonalNameStructure.aliasLinks).
    w.line(level + 1, 'ALIA', { value: link.value });
    for (const citation of link.citations ?? []) {
      emitSourceCitation(w, version, level + 2, citation);
    }
    emitExtensions(w, version, level + 2, link);
  }
  if (name.title !== undefined) {
    // A title carried by the name itself (see
    // PersonalNameStructure.title).
    w.line(level + 1, 'TITL', { value: name.title });
  }
  if (name.marriedName !== undefined) {
    // The married name (see PersonalNameStructure.marriedName).
    w.line(level + 1, '_MARNM', { value: name.marriedName });
  }
  if (name.primary === true) {
    // Legacy: the primary name mark (see
    // PersonalNameStructure.primary).
    w.line(level + 1, '_PRIM', { value: 'Y' });
  }
  if (name.middleName !== undefined) {
    // ged4web: the middle name under NAME (see
    // PersonalNameStructure.middleName).
    w.line(level + 1, '_MIDN', { value: name.middleName });
  }
  if (name.patronymic !== undefined) {
    // The patronymic under NAME (see
    // PersonalNameStructure.patronymic).
    w.line(level + 1, '_PATN', { value: name.patronymic });
  }
  if (name.creationDate !== undefined) {
    // MFT7: the name entry's creation date (see
    // PersonalNameStructure.creationDate).
    w.line(level + 1, version === '7.0' ? 'CREA' : '_CRE');
    emitDateExact(w, version, level + 2, 'DATE', name.creationDate.date, name.creationDate.date.time);
    emitExtensions(w, version, level + 2, name.creationDate);
  }
  for (const aka of name.alsoKnownAs ?? []) {
    // An "also known as" name variant (see
    // PersonalNameStructure.alsoKnownAs).
    w.line(level + 1, '_AKA', { value: aka });
  }
  if (name.givenNameUsed !== undefined) {
    // FH: the given name used (see PersonalNameStructure.givenNameUsed).
    w.line(level + 1, '_USED', { value: name.givenNameUsed });
  }
  if (name.hebrewName !== undefined) {
    // phpGedView: the name in Hebrew script (see
    // PersonalNameStructure.hebrewName).
    w.line(level + 1, '_HEB', { value: name.hebrewName });
  }
  if (version === '5.5.1') {
    // The USM6/MFT7 name extras; 7.0 cannot spell the non-underscore
    // tags, and the underscore forms are likewise dropped there (see
    // PersonalNameStructure.surnameVariants / furtherGivenNames).
    if (name.surnameVariants !== undefined) {
      // USM6: the surname variants. Written as the underscore spelling
      // `_NAME_` (the USM6 wire spelling `NAME_` is non-underscore;
      // both spellings are recognized on input).
      w.line(level + 1, '_NAME_', { value: name.surnameVariants });
    }
    if (name.furtherGivenNames !== undefined) {
      // MFT7: the second and further given names; written as the
      // underscore spelling `_SECG` (both spellings are recognized on
      // input).
      w.line(level + 1, '_SECG', { value: name.furtherGivenNames });
    }
  }
  for (const link of name.censusLinks ?? []) {
    ptr(w, version, level + 1, '_CENR', link);
  }
  for (const evidence of name.evidence ?? []) {
    // The gedcom-evidence references of the name (see
    // PersonalNameStructure.evidence).
    emitEvidenceReference(w, version, level + 1, evidence);
  }
  for (const apid of name.ancestryPointers ?? []) {
    w.line(level + 1, '_APID', { value: apid });
  }
  for (const link of name.media ?? []) {
    // TMG: exhibits attached to the name (see
    // PersonalNameStructure.media); written back as the standard
    // multimedia-link OBJE pointer.
    emitMultimediaLink(w, version, level + 1, link);
  }
  if (version === '7.0') {
    // The 5.5.1 phonetic/romanized variations become TRANs where the
    // method names a known language; unknown methods are dropped.
    for (const variation of name.phonetic ?? []) {
      const language = variation.type !== undefined ? METHOD_TO_LANGUAGE_70.get(variation.type) : undefined;
      if (language === undefined) {
        continue;
      }
      w.line(level + 1, 'TRAN', { value: formatName70(variation.payload) });
      w.line(level + 2, 'LANG', { value: language });
      emitNamePieces(w, version, level + 2, variation.pieces);
    }
    for (const variation of name.romanized ?? []) {
      const language = variation.type !== undefined ? METHOD_TO_LANGUAGE_70.get(variation.type) : undefined;
      if (language === undefined) {
        continue;
      }
      w.line(level + 1, 'TRAN', { value: formatName70(variation.payload) });
      w.line(level + 2, 'LANG', { value: language });
      emitNamePieces(w, version, level + 2, variation.pieces);
    }
    for (const translation of name.translations ?? []) {
      if (translation.language === undefined) {
        continue;
      }
      w.line(level + 1, 'TRAN', { value: formatName70(translation.payload) });
      w.line(level + 2, 'LANG', { value: translation.language });
      emitNamePieces(w, version, level + 2, translation.pieces);
    }
  } else {
    // The 7.0 TRANs become FONE/ROMN where the language names a known
    // method; unknown languages are dropped.
    for (const translation of name.translations ?? []) {
      if (translation.language === undefined) {
        continue;
      }
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
      for (const note of variation.notes ?? []) {
        emitNoteStructure(w, version, level + 2, note);
      }
      for (const citation of variation.citations ?? []) {
        emitSourceCitation(w, version, level + 2, citation);
      }
    }
    for (const variation of name.romanized ?? []) {
      w.line(level + 1, 'ROMN', { value: formatName551(variation.payload) });
      w.line(level + 2, 'TYPE', { value: variation.type });
      emitNamePieces(w, version, level + 2, variation.pieces);
      for (const note of variation.notes ?? []) {
        emitNoteStructure(w, version, level + 2, note);
      }
      for (const citation of variation.citations ?? []) {
        emitSourceCitation(w, version, level + 2, citation);
      }
    }
  }
  // The name's notes and citations live at the name level in both
  // versions (the parser types them into the same slots; the 5.5.1
  // writer additionally emits the pieces-level notes kept by older
  // model data, see emitNamePieces).
  for (const note of name.notes ?? []) {
    emitNoteStructure(w, version, level + 1, note);
  }
  for (const citation of name.citations ?? []) {
    emitSourceCitation(w, version, level + 1, citation);
  }
  emitExtensions(w, version, level + 1, name);
}

export function emitNameType(w: Writer, version: Version, level: number, type: NameTypeStructure): void {
  if (version === '7.0') {
    w.line(level, 'TYPE', { value: type.payload });
    if (type.phrase !== undefined) {
      w.line(level + 1, 'PHRASE', { value: type.phrase });
    }
    emitExtensions(w, version, level + 1, type);
    return;
  }
  // 5.5.1: the known set in lowercase, or the phrase as the user-defined
  // value. OTHER and PROFESSIONAL have no 5.5.1 spelling.
  const spelled = NAME_TYPE_TO_551[type.payload];
  if (spelled !== undefined) {
    w.line(level, 'TYPE', { value: spelled });
    emitExtensions(w, version, level + 1, type);
    return;
  }
  if (type.phrase !== undefined) {
    // OTHER and PROFESSIONAL have no 5.5.1 spelling; the phrase becomes
    // the user-defined value.
    w.line(level, 'TYPE', { value: type.phrase });
  }
  // Without a phrase the value cannot be spelled; dropped.
  emitExtensions(w, version, level + 1, type);
}

export function emitNamePieces(
  w: Writer,
  version: Version,
  level: number,
  pieces: PersonalNamePieces | undefined,
): void {
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
      emitExtensions(w, version, 3, abbr);
    }
    if (name.addition !== undefined) {
      // GEDCOM 5.5EL NAME.NAMC (see PlaceNameStructure.addition).
      w.line(2, 'NAMC', { value: name.addition });
    }
    if (name.language !== undefined) {
      w.line(2, 'LANG', { value: name.language });
    }
    for (const citation of name.citations ?? []) {
      emitSourceCitation(w, version, 2, citation);
    }
    emitExtensions(w, version, 2, name);
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
    emitExtensions(w, version, 2, type);
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
    emitExtensions(w, version, 2, postal);
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
    emitExtensions(w, version, 2, aidn);
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
    emitExtensions(w, version, 2, dmgd);
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
  if (record.form !== undefined) {
    // GEDKeeper: the display form of the place name (see
    // PlaceRecord.form).
    w.line(1, 'FORM', { value: record.form });
  }
  if (record.automatedRecordId !== undefined) {
    // GEDKeeper: the record id of the place (see
    // PlaceRecord.automatedRecordId).
    w.line(1, 'RIN', { value: record.automatedRecordId });
  }
  if (record.geditcomId !== undefined) {
    // GEDitCOM II: the record's id (see PlaceRecord.geditcomId).
    w.line(1, '_GCID', { value: record.geditcomId });
  }
  if (record.denomination !== undefined) {
    w.line(1, 'RELI', { value: record.denomination });
  }
  for (const event of record.events ?? []) {
    w.line(1, 'EVEN', { value: event.payload });
    if (event.detail !== undefined) {
      if (event.detail.type !== undefined) {
        // GEDCOM 5.5.1 §2 p.32 EVENT_DETAIL TYPE (see EventDetail.type):
        // the event descriptor of the place event.
        w.line(2, 'TYPE', { value: event.detail.type });
      }
      emitEventDetail(w, version, 2, event.detail);
    }
    emitExtensions(w, version, 2, event);
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
    emitExtensions(w, version, 2, parent);
  }
  if (record.map !== undefined) {
    w.line(1, 'MAP');
    w.line(2, 'LATI', { value: `${record.map.latitude.direction}${record.map.latitude.degrees}` });
    w.line(2, 'LONG', { value: `${record.map.longitude.direction}${record.map.longitude.degrees}` });
  }
  for (const elMap of record.elMaps ?? []) {
    // The GEDCOM 5.5EL coordinate form (see PlaceRecord.elMaps): the
    // payload carries the coordinates, the TYPE names the system.
    w.line(1, 'MAP', { value: elMap.payload });
    w.line(2, 'TYPE', { value: elMap.type });
    emitExtensions(w, version, 2, elMap);
  }
  commonRecordFields(w, version, record, 1);
}

export function emitPlace(
  w: Writer,
  version: Version,
  level: number,
  place: PlaceStructure,
  tag: 'PLAC' | '_PLAC' = 'PLAC',
): void {
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
  for (const alternative of place.alternativeNames ?? []) {
    // GenPlus: an alternative place name (see
    // PlaceStructure.alternativeNames).
    w.line(level + 1, '_AON', { value: alternative });
  }
  for (const postal of place.postalCodes ?? []) {
    w.line(level + 1, '_POST', { value: postal.code });
    if (postal.date !== undefined) {
      emitDate(w, version, level + 2, 'DATE', postal.date);
    }
    for (const citation of postal.citations ?? []) {
      emitSourceCitation(w, version, level + 2, citation);
    }
    emitExtensions(w, version, level + 2, postal);
  }
  if (place.maidenhead !== undefined) {
    w.line(level + 1, '_MAIDENHEAD', { value: place.maidenhead });
  }
  if (place.hebrewName !== undefined) {
    // phpGedView: the place name in Hebrew script (see
    // PlaceStructure.hebrewName).
    w.line(level + 1, '_HEB', { value: place.hebrewName });
  }
  if (place.placeId !== undefined) {
    // The Swarm family-tree packs: the place's id (see
    // PlaceStructure.placeId).
    w.line(level + 1, '_PID', { value: place.placeId });
  }
  if (place.familioId !== undefined) {
    // Familio: the place's identifier on familio.org (see
    // PlaceStructure.familioId).
    w.line(level + 1, '_FAMILIO_GUID', { value: place.familioId });
  }
  if (place.placeCard !== undefined) {
    // GenoPro: a pointer to the place's card record (see
    // PlaceStructure.placeCard) — kept verbatim, unresolved.
    w.line(level + 1, '_XREF', { value: place.placeCard, pointer: place.placeCard.startsWith('@') });
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
      const language = variation.type !== undefined ? METHOD_TO_LANGUAGE_70.get(variation.type) : undefined;
      if (language === undefined) {
        continue;
      }
      w.line(level + 1, 'TRAN', { value: variation.payload.join(', ') });
      w.line(level + 2, 'LANG', { value: language });
    }
    for (const variation of place.romanized ?? []) {
      const language = variation.type !== undefined ? METHOD_TO_LANGUAGE_70.get(variation.type) : undefined;
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
      if (translation.language === undefined) {
        continue;
      }
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
  for (const citation of place.citations ?? []) {
    // TMG: citations attached to the PLAC line (see
    // PlaceStructure.citations).
    emitSourceCitation(w, version, level + 1, citation);
  }
  emitExtensions(w, version, level + 1, place);
}
