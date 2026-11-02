/**
 * Parser section: Multimedia records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import type {
  MediaFile,
  MediaFileTranslation,
  MediaFormatStructure,
  MediaStructure,
  MultimediaRecord,
} from '../structures';
import {
  MEDIA_ENUM_VALUES,
  RESTRICTION_ENUM_VALUES,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  Ctx,
} from './context';
import {
  addExtension,
  dispatch,
  noPayload,
  parseImportReference,
  reqDigits,
  reqPtr,
  reqText,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parseSourceCitation,
  parseVendorFlag,
} from './sources-media';
import {
  parseChangeDate,
  parseCreationDateLenient,
  parseDateStructure,
  parseExternalIdentifier,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';
import {
  parseEnum,
  parseListEnum,
  parseMediaFormat,
} from './types';

export function parseMultimediaRecord(node: RawNode, ctx: Ctx): MultimediaRecord {
  noPayload(node);
  const rec: MultimediaRecord = { tag: 'OBJE', files: [], ...(node.xref === undefined ? {} : { xref: node.xref }) };
  let fileSize: number | undefined;
  let album: string | undefined;
  let photoRecordId: string | undefined;
  const handlers: Record<string, (child: RawNode) => void> = {
    FILE: (child) => {
      rec.files.push(parseMediaFile(child, ctx));
    },
    '_FILESIZE': (child) => {
      // Family Tree Builder / MyHeritage: the media file size (see
      // MediaFile.fileSize).
      fileSize = reqDigits(child);
    },
    '_ALBUM': (child) => {
      // Family Tree Builder / MyHeritage: the album XREF (see
      // MediaFile.album; the wire form is xref-shaped, kept verbatim
      // and unresolved — real exports dangle).
      album = child.value.kind === 'pointer' ? child.value.pointer : reqText(child);
    },
    '_PHOTO_RIN': (child) => {
      // Family Tree Builder / MyHeritage: the photo's record id (see
      // MediaFile.recordId).
      photoRecordId = reqText(child);
    },
    '_DATE': (child) => {
      rec.date = parseDateStructure(child, ctx);
    },
    '_PLAC': (child) => {
      // Ancestry.com Family Trees writes the place of the media object
      // with the standard PLAC tag (see MultimediaRecord.place); the
      // underscore spelling is accepted into the same slot.
      rec.place = reqText(child);
    },
    '_PRIM': (child) => {
      // Legacy/AQ/FO/PAF: the record-level "preferred media" mark (see
      // MultimediaRecord.primary).
      rec.primary = parseVendorFlag(child, '_PRIM');
    },
    '_SCBK': (child) => {
      // Legacy/AQ: the record-level scrapbook mark (see
      // MultimediaRecord.scrapbook).
      rec.scrapbook = parseVendorFlag(child, '_SCBK');
    },
    '_SSHOW': (child) => {
      // AQ/PAF: the record-level slide-show mark (see
      // MultimediaRecord.slideshow).
      rec.slideshow = parseVendorFlag(child, '_SSHOW');
    },
    '_TYPE': (child) => {
      rec.objectType = reqText(child);
    },
    '_SOUND': (child) => {
      rec.soundFile = reqText(child);
    },
    '_KEYS': (child) => {
      // FH: the media object's keywords (see MultimediaRecord.keywords).
      rec.keywords = reqText(child);
    },
    '_FILE': (child) => {
      // FH: the path of the media file (see MultimediaRecord.filePath).
      rec.filePath = reqText(child);
    },
    '_NOTE': (child) => {
      // FH: a media note (see MultimediaRecord.mediaNote).
      rec.mediaNote = reqText(child);
    },
    '_CREA': (child) => {
      // Ancestry.com Family Trees: the date the media object was
      // created (see MultimediaRecord.createdAt).
      rec.createdAt = reqText(child);
    },
    '_SUBM': (child) => {
      // GDO: a pointer to the submitter record of this media object
      // (see MultimediaRecord.submitters).
      (rec.submitters ??= []).push(reqPtr(child, ctx));
    },
    '_IMPF': (child) => {
      // GDO: the import-file reference (see
      // MultimediaRecord.importReference).
      rec.importReference = parseImportReference(child, ctx);
    },
    NOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (rec.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    CHAN: (child) => {
      rec.changeDate = parseChangeDate(child, ctx);
    },
    REFN: (child) => {
      (rec.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
    RESN: (child) => {
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, child.position);
    },
    CREA: (child) => {
      const created = parseCreationDateLenient(child, ctx);
      if (created === undefined) {
        addExtension(rec, child, ctx);
      } else {
        rec.creationDate = created;
      }
    },
    UID: (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    },
    '_UID': (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    },
    EXID: (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    },
    // The 7.0 MULTIMEDIA_RECORD carries <<NOTE_STRUCTURE>> {0:M}
    // (GEDCOM 7.0 §3.2.2); accepted in any file.
    SNOTE: (child) => {
      (rec.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    RIN: (child) => {
      rec.automatedRecordId = reqText(child);
    },
    DATE: (child) => {
      // Ancestry.com Family Trees: the date of the media object,
      // written with the standard DATE tag under the OBJE record (the
      // webtrees per-vendor custom-tag registry, Ancestry.php:
      // https://github.com/fisharebest/webtrees/blob/main/app/CustomTags/Ancestry.php).
      // Same slot as `_DATE` (see MultimediaRecord.date); written back
      // as `_DATE`.
      rec.date = parseDateStructure(child, ctx);
    },
    PLAC: (child) => {
      // Ancestry.com Family Trees: the place of the media object, the
      // standard tag under the OBJE record (same source as DATE; see
      // MultimediaRecord.place). Written back as `_PLAC`.
      rec.place = reqText(child);
    },
    FORM: (child) => {
      // Généatique writes the format and title at OBJE-record level
      // (the webtrees per-vendor custom-tag registry, Geneatique.php) —
      // the GEDCOM 5.5 embedded-multimedia record shape, whose BLOB was
      // removed in 5.5.1. Kept as a record extension on input so 5.5
      // files still import; dropped on export (neither target grammar
      // has the embedded shape), and a record with no FILE at all is
      // dropped entirely by the projections (see serialize/prepare.ts).
      addExtension(rec, child, ctx);
    },
    TITL: (child) => {
      // Généatique; same convention as FORM (see above).
      addExtension(rec, child, ctx);
    },
    BLOB: (child) => {
      // The GEDCOM 5.5 embedded object (5.5.1 removed the BLOB form);
      // same convention as FORM (see above): kept on input, dropped on
      // export.
      addExtension(rec, child, ctx);
    },
    WWW: (child) => {
      // Généatique writes a web address under the OBJE record (the
      // webtrees per-vendor custom-tag registry, Geneatique.php).
      addExtension(rec, child, ctx);
    },
  };
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ['RESN', 'CHAN', 'CREA', 'RIN'],
  );
  if (rec.files.length === 0 && !(rec.extensions ?? []).some((ext) => ext.tag === 'FORM' || ext.tag === 'BLOB')) {
    // A 5.5-style embedded record (FORM/TITL/BLOB kept as extensions)
    // has no FILE substructure.
    fail('structure.missing-required', 'A multimedia record requires at least one FILE substructure', node.position);
  }
  if (fileSize !== undefined) {
    (rec.files[0] as MediaFile).fileSize = fileSize;
  }
  if (album !== undefined) {
    (rec.files[0] as MediaFile).album = album;
  }
  if (photoRecordId !== undefined) {
    (rec.files[0] as MediaFile).recordId = photoRecordId;
  }
  return rec;
}

export function parseMediaFile(node: RawNode, ctx: Ctx): MediaFile {
  const file: Omit<MediaFile, 'form'> = { payload: reqText(node) };
  let form: MediaFormatStructure | undefined;
  dispatch(
    node,
    file,
    {
      FORM: (child) => {
        if (form !== undefined) {
          fail('structure.cardinality', 'At most one FORM is allowed under FILE', child.position);
        }
        form = parseMediaFormatStructure(child, ctx);
      },
      TITL: (child) => {
        file.title = reqText(child);
      },
      _CTYP: (child) => {
        // Ahnenblatt: the content type of the picture (person, group,
        // place, signature, tombstone, document, heirloom; see
        // MediaFile.contentType).
        file.contentType = reqText(child);
      },
      _ALTPATH: (child) => {
        // Ahnenblatt: an alternative or relative file path without the
        // file name (see MediaFile.alternatePath).
        file.alternatePath = reqText(child);
      },
      TRAN: (child) => {
        (file.translations ??= []).push(parseMediaFileTranslation(child, ctx));
      },
    },
    ctx,
  );
  if (form === undefined) {
    fail('structure.missing-required', 'The FILE structure requires a FORM substructure', node.position);
  }
  return { ...file, form };
}

export function parseMediaFormatStructure(node: RawNode, ctx: Ctx): MediaFormatStructure {
  const format: MediaFormatStructure = {
    payload: parseMediaFormat(reqText(node)),
  };
  let medium: MediaStructure | undefined;
  const setMedium = (child: RawNode): void => {
    if (medium !== undefined) {
      fail('structure.cardinality', 'At most one of TYPE and MEDI is allowed under FORM', child.position);
    }
    // The medium grammar: the 7.0 MEDI enum (with OTHER and the
    // PHRASE child) plus the 5.5.1 TYPE/MEDI spellings of the
    // SOURCE_MEDIA_TYPE set (a subset of the 7.0 set) — both spellings
    // and both value sets are accepted in any file.
    medium = parseMediaStructure(child, ctx);
  };
  dispatch(
    node,
    format,
    {
      TYPE: setMedium,
      MEDI: setMedium,
    },
    ctx,
  );
  if (medium !== undefined) {
    format.medium = medium;
  }
  return format;
}

export function parseMediaStructure(node: RawNode, ctx: Ctx): MediaStructure {
  const out: MediaStructure = { payload: parseEnum(reqText(node), MEDIA_ENUM_VALUES, node.position) };
  dispatch(
    node,
    out,
    {
      PHRASE: (child) => {
        out.phrase = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

export function parseMediaFileTranslation(node: RawNode, ctx: Ctx): MediaFileTranslation {
  const out: Omit<MediaFileTranslation, 'form'> = { payload: reqText(node) };
  let form: MediaFormatStructure | undefined;
  dispatch(
    node,
    out,
    {
      FORM: (child) => {
        if (form !== undefined) {
          fail('structure.cardinality', 'At most one FORM is allowed under TRAN', child.position);
        }
        form = parseMediaFormatStructure(child, ctx);
      },
    },
    ctx,
  );
  if (form === undefined) {
    fail('structure.missing-required', 'The TRAN structure requires a FORM substructure', node.position);
  }
  return { ...out, form };
}
