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
import {
  emitNoteStructure,
  emitSourceCitation,
} from './structures';
import {
  medi551,
  mediaType,
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

export function emitPlace(w: Writer, version: Version, level: number, place: PlaceStructure): void {
  w.line(level, 'PLAC', { value: place.payload.join(', ') });
  if (place.form !== undefined) {
    w.line(level + 1, 'FORM', { value: place.form.join(', ') });
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

