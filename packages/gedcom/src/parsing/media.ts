/**
 * Parser section: Multimedia records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import type {
  MediaEnum,
} from '../enumerations';
import {
  MEDIA_ENUM_VALUES,
  RESTRICTION_ENUM_VALUES,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  MediaFile,
  MediaFileTranslation,
  MediaFormatStructure,
  MediaStructure,
  MultimediaRecord,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  noPayload,
  reqText,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parseSourceCitation,
} from './sources-media';
import {
  parseChangeDate,
  parseCreationDate,
  parseDateStructure,
  parseExternalIdentifier,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';
import {
  parseEnum,
  parseListEnum,
  parseMediaFormat551,
} from './types';

export function parseMultimediaRecord(node: RawNode, ctx: Ctx): MultimediaRecord {
  noPayload(node);
  const rec: MultimediaRecord = { tag: 'OBJE', files: [], ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    FILE: (child) => {
      rec.files.push(parseMediaFile(child, ctx));
    },
    '_DATE': (child) => {
      rec.date = parseDateStructure(child, ctx);
    },
    '_TYPE': (child) => {
      rec.objectType = reqText(child);
    },
    '_SOUND': (child) => {
      rec.soundFile = reqText(child);
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
  };
  if (ctx.version === '7.0') {
    handlers["RESN"] = (child) => {
      rec.restriction = parseListEnum(reqText(child), RESTRICTION_ENUM_VALUES, '7.0', child.position);
    };
    handlers["CREA"] = (child) => {
      rec.creationDate = parseCreationDate(child, ctx);
    };
    handlers["UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["_UID"] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["EXID"] = (child) => {
      (rec.identifiers ??= []).push(parseExternalIdentifier(child, ctx));
    };
  } else {
    handlers['_UID'] = (child) => {
      (rec.identifiers ??= []).push(parseUniqueIdentifier(child));
    };
    handlers["RIN"] = (child) => {
      rec.automatedRecordId = reqText(child);
    };
  }
  dispatch(
    node,
    rec,
    handlers,
    ctx,
    ctx.version === '7.0' ? ['RESN', 'CHAN', 'CREA'] : ['CHAN', 'RIN'],
  );
  if (rec.files.length === 0) {
    fail('structure.missing-required', 'A multimedia record requires at least one FILE substructure', node.position);
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
      ...(ctx.version === '7.0'
        ? {
            TRAN: (child) => {
              (file.translations ??= []).push(parseMediaFileTranslation(child, ctx));
            },
          }
        : {}),
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
    payload: ctx.version === '7.0' ? reqText(node) : parseMediaFormat551(reqText(node), node.position),
  };
  let medium: MediaStructure | undefined;
  const setMedium = (child: RawNode): void => {
    if (medium !== undefined) {
      fail('structure.cardinality', 'At most one of TYPE and MEDI is allowed under FORM', child.position);
    }
    medium = parseMediaType551(child);
  };
  dispatch(
    node,
    format,
    {
      ...(ctx.version === '7.0'
        ? {
            MEDI: (child) => {
              format.medium = parseMediaStructure(child, ctx);
            },
          }
        : {
            // The 5.5.1 specification disagrees with itself: the
            // MULTIMEDIA_RECORD grammar (p.26) spells the medium TYPE,
            // the inline MULTIMEDIA_LINK grammar (p.37) spells it MEDI.
            // Both name the same SOURCE_MEDIA_TYPE and both are
            // accepted (see Known strict decisions in the README).
            TYPE: setMedium,
            MEDI: setMedium,
          }),
    },
    ctx,
  );
  if (medium !== undefined) {
    format.medium = medium;
  }
  return format;
}

export function parseMediaStructure(node: RawNode, ctx: Ctx): MediaStructure {
  const out: MediaStructure = { payload: parseEnum(reqText(node), MEDIA_ENUM_VALUES, ctx.version, node.position) };
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

/** The 5.5.1 SOURCE_MEDIA_TYPE set (the 7.0 MEDI set without OTHER). */
export const MEDIA_551: Record<string, string> = {
  AUDIO: 'audio', BOOK: 'book', CARD: 'card', ELECTRONIC: 'electronic', FICHE: 'fiche',
  FILM: 'film', MAGAZINE: 'magazine', MANUSCRIPT: 'manuscript', MAP: 'map', NEWSPAPER: 'newspaper',
  PHOTO: 'photo', TOMBSTONE: 'tombstone', VIDEO: 'video',
};

export function parseMediaType551(node: RawNode): MediaStructure {
  const out: MediaStructure = {
    payload: parseEnum(reqText(node), MEDIA_551, '5.5.1', node.position) as MediaEnum,
  };
  if (node.children.length > 0) {
    fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under TYPE`, (node.children[0] as RawNode).position);
  }
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
