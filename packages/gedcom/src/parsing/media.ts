/**
 * Parser section: Multimedia records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import type {
  AncestryClone,
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
  parseYNFlag,
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
    '_NOTA': (child) => {
      // Family Historian spells the note attached to a media record
      // `_NOTA` (the FHUG "GEDCOM Extension List":
      // https://www.fhug.org.uk/kb/topic/gedcom-files/) — a full note
      // structure in the same slot the record notes carry. Parsed as
      // the standard NOTE shape.
      (rec.notes ??= []).push(parseNoteStructure({ ...child, tag: 'NOTE' }, ctx));
    },
    '_TEXT': (child) => {
      // The ged4web exports write the media object's comment text
      // with the TEXT tag under the OBJE record — the same slot the
      // FH `_NOTE` carries (see MultimediaRecord.mediaNote).
      rec.mediaNote = reqText(child);
    },
    TEXT: (child) => {
      // The standard spelling of the media comment text.
      rec.mediaNote = reqText(child);
    },
    '_CREA': (child) => {
      // Ancestry.com Family Trees: the date the media object was
      // created (see MultimediaRecord.createdAt).
      rec.createdAt = reqText(child);
    },
    '_CUTOUT': (child) => {
      // MyHeritage: the cutout flag (see MultimediaRecord.cutout).
      rec.cutout = parseYNFlag(child, '_CUTOUT');
    },
    '_PRIM_CUTOUT': (child) => {
      // MyHeritage: the primary cutout mark (see
      // MultimediaRecord.primaryCutout).
      rec.primaryCutout = parseYNFlag(child, '_PRIM_CUTOUT');
    },
    '_PARENTPHOTO': (child) => {
      // MyHeritage: the parent-photo flag (see
      // MultimediaRecord.parentPhoto).
      rec.parentPhoto = parseYNFlag(child, '_PARENTPHOTO');
    },
    '_PERSONALPHOTO': (child) => {
      // MyHeritage: the personal-photo flag (see
      // MultimediaRecord.personalPhoto).
      rec.personalPhoto = parseYNFlag(child, '_PERSONALPHOTO');
    },
    '_PARENTRIN': (child) => {
      // MyHeritage: the parent's record id (see
      // MultimediaRecord.parentRecordId).
      rec.parentRecordId = reqText(child);
    },
    AUTH: (child) => {
      // ged4web: the media author under the OBJE record (see
      // MultimediaRecord.author).
      rec.author = reqText(child);
    },
    '_OID': (child) => {
      // Ancestry.com Family Trees: the media object's identifier, a
      // UUID (see MultimediaRecord.objectId).
      rec.objectId = reqText(child);
    },
    '_USER': (child) => {
      // Ancestry.com Family Trees: the user token of the media
      // object's creator, with the `_ENCR` encrypted flag beneath
      // (see MultimediaRecord.user / userEncrypted).
      rec.user = reqText(child);
      for (const sub of child.children) {
        if (sub.tag === '_ENCR') {
          rec.userEncrypted = sub.value.kind === 'absent' || reqText(sub).trim() !== '0';
        } else {
          addExtension(rec, sub, ctx);
        }
      }
    },
    '_ORIG': (child) => {
      // Ancestry.com Family Trees: the origin of the media object —
      // `acom` (ancestry.com), `u` (user upload), `newspapers`,
      // `fold3`, … (see MultimediaRecord.origin).
      rec.origin = reqText(child);
    },
    '_ATL': (child) => {
      // Ancestry.com Family Trees: the attachment flag Y/N (see
      // MultimediaRecord.attachment).
      rec.attachment = parseYNFlag(child, '_ATL');
    },
    '_META': (child) => {
      // Ancestry.com Family Trees: the media metadata XML block (see
      // MultimediaRecord.metadata).
      rec.metadata = reqText(child);
    },
    '_DSCR': (child) => {
      // Ancestry.com Family Trees: the media object's description (see
      // MultimediaRecord.description).
      rec.description = reqText(child);
    },
    '_MSER': (child) => {
      // Ancestry.com Family Trees: the master (original) media object
      // mark, with the _LKID link id beneath (see
      // MultimediaRecord.master / masterLinkId).
      noPayload(child);
      rec.master = true;
      for (const sub of child.children) {
        if (sub.tag === '_LKID') {
          rec.masterLinkId = reqText(sub);
        } else {
          addExtension(rec, sub, ctx);
        }
      }
    },
    '_CLON': (child) => {
      // Ancestry.com Family Trees: a clone of this media object in
      // another tree/person (see AncestryClone).
      noPayload(child);
      const clone: AncestryClone = { tag: '_CLON' };
      for (const sub of child.children) {
        switch (sub.tag) {
          case '_TID':
            clone.treeId = reqText(sub);
            break;
          case '_PID':
            clone.personId = reqText(sub);
            break;
          case '_OID':
            clone.objectId = reqText(sub);
            break;
          case '_USER': {
            clone.user = reqText(sub);
            for (const inner of sub.children) {
              if (inner.tag === '_ENCR') {
                clone.userEncrypted = inner.value.kind === 'absent' || reqText(inner).trim() !== '0';
              } else {
                addExtension(clone, inner, ctx);
              }
            }
            break;
          }
          case '_DATE':
            clone.date = reqText(sub);
            break;
          default:
            addExtension(clone, sub, ctx);
        }
      }
      (rec.clones ??= []).push(clone);
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
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, child.position).filter((value) => value.toUpperCase() !== 'NONE');
    },
    CREA: (child) => {
      const created = parseCreationDateLenient(child, ctx);
      if (created === undefined) {
        addExtension(rec, child, ctx);
      } else {
        rec.creationDate = created;
      }
    },
    '_CRE': (child) => {
      // MFT7: the record creation — the structured form (a bare line
      // with the DATE child) or the free text the `_CREA` slot carries.
      if (child.value.kind === 'absent') {
        const created = parseCreationDateLenient(child, ctx);
        if (created === undefined) {
          addExtension(rec, child, ctx);
        } else {
          rec.creationDate = created;
        }
      } else {
        rec.createdAt = reqText(child);
      }
    },
    UID: (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
    },
    '_UID': (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child, ctx));
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
  // A FILE with no payload is tolerated (the full-leniency container
  // rule): Ancestry.com Family Trees writes the bare FILE line with
  // FORM/TITL substructures and no file name, and dropping the line
  // would silently drop the whole media object on export (an OBJE
  // record without files is the embedded shape the projections
  // remove). The payload stays the empty path and is written back as
  // the bare FILE line.
  const file: Omit<MediaFile, 'form'> = { payload: node.value.kind === 'text' ? reqText(node) : '' };
  let form: MediaFormatStructure | undefined;
  dispatch(
    node,
    file,
    {
      FORM: (child) => {
        if (form !== undefined) {
          // First occurrence wins (the full-leniency container rule).
          return;
        }
        form = parseMediaFormatStructure(child, ctx);
      },
      TITL: (child) => {
        file.title = reqText(child);
      },
      '_TEXT': (child) => {
        // FTM: the file's transcription text under the FILE line (the
        // embedded-media shape; see MediaFile.text).
        file.text = reqText(child);
      },
      TEXT: (child) => {
        // The standard spelling of the file's transcription text.
        file.text = reqText(child);
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
    // A FILE without FORM is tolerated (the full-leniency container
    // rule): the media type is unknown, not an error.
    return file as MediaFile;
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
      // First occurrence wins (the full-leniency container rule).
      return;
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
      '_MTYPE': (child) => {
        // Ancestry.com Family Trees: the display kind of the media
        // (see MediaFormatStructure.kind).
        format.kind = reqText(child);
      },
      '_STYPE': (child) => {
        // Ancestry.com Family Trees: the stored encoding of the file
        // (see MediaFormatStructure.storageType).
        format.storageType = reqText(child);
      },
      '_SIZE': (child) => {
        // Ancestry.com Family Trees: the file size in bytes (see
        // MediaFormatStructure.size).
        format.size = reqDigits(child);
      },
      '_WDTH': (child) => {
        // Ancestry.com Family Trees: the picture width in pixels (see
        // MediaFormatStructure.width).
        format.width = reqDigits(child);
      },
      '_HGHT': (child) => {
        // Ancestry.com Family Trees: the picture height in pixels (see
        // MediaFormatStructure.height).
        format.height = reqDigits(child);
      },
    },
    ctx,
  );
  if (medium !== undefined) {
    format.medium = medium;
  }
  return format;
}

export function parseMediaStructure(node: RawNode, ctx: Ctx): MediaStructure {
  const raw = reqText(node);
  // The lenient medium: a value outside the MEDI enum (files in the
  // wild write `TYPE image`, `TYPE story`, `MEDI Article`, …) is kept
  // as OTHER with the phrase (the full-leniency container rule —
  // nothing is dropped).
  const known = (Object.keys(MEDIA_ENUM_VALUES) as string[]).some((key) => key.toUpperCase() === raw.toUpperCase());
  const out: MediaStructure = known
    ? { payload: parseEnum(raw, MEDIA_ENUM_VALUES, node.position) }
    : { payload: 'OTHER', phrase: raw };
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
          // First occurrence wins.
          return;
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
