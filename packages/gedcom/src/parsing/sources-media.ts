/**
 * Parser section: Sources and media links.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  EVENT_ATTRIBUTE_ENUM_VALUES,
  QUALITY_ENUM_VALUES,
} from '../enumerations';
import type {
  EventAttributeEnum,
} from '../enumerations';
import {
  fail,
} from '../errors';
import type {
  CallNumberStructure,
  CropStructure,
  MediaFile,
  MultimediaLink,
  MultimediaRecord,
  PageStructure,
  SourceCitation,
  SourceCitationData,
  SourceCitationEvent,
  SourceMetafieldStructure,
  SourceRepositoryCitation,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  noPayload,
  optPtr,
  reqDigits,
  reqPtr,
  reqText,
  resolvePtr,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parseMediaFile,
  parseMediaStructure,
} from './media';
import {
  parseEvidenceTemplate,
  parseSourceText,
} from './sources';
import {
  parseDateStructure,
  parseNoteStructure,
  parseRole,
} from './substructures';
import {
  parseEnum,
} from './types';

// Sources and media links
// ---------------------------------------------------------------------------

/**
 * Parses a PAGE structure: the location payload plus the relocated
 * `_SOUR` citations (registry: _SOUR.yaml — the standard SOUR tag moved
 * under PAGE, with the same payload and substructures as
 * SOURCE_CITATION). Other `_` tags under PAGE stay generic extensions
 * of the page structure, so their position is preserved too.
 */
export function parsePageStructure(node: RawNode, ctx: Ctx): PageStructure {
  const out: PageStructure = { tag: 'PAGE', payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      _SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

/** Parses an FH source-template metafield under a citation
 *  (`_FIELD <name>` with a `TEXT <value>` child; see
 *  SourceMetafieldStructure). */
function parseSourceMetafield(node: RawNode, ctx: Ctx): SourceMetafieldStructure {
  const out: SourceMetafieldStructure = { tag: '_FIELD', name: reqText(node) };
  dispatch(
    node,
    out,
    {
      TEXT: (child) => {
        out.text = reqText(child);
      },
    },
    ctx,
    ['TEXT'],
  );
  return out;
}

export function parseSourceCitation(node: RawNode, ctx: Ctx): SourceCitation {
  // Both payload forms parse: the 7.0 pointer form and the 5.5.1 free-text
  // description form are both accepted in any file (the payload shape
  // selects the form, not the declared version).
  if (node.value.kind === 'pointer') {
    const out: SourceCitation = { tag: 'SOUR', source: resolvePtr(node.value.pointer, ctx, node) };
    dispatch(
      node,
      out,
      {
        PAGE: (child) => {
          out.page = parsePageStructure(child, ctx);
        },
        DATA: (child) => {
          out.data = parseSourceCitationData(child, ctx);
        },
        EVEN: (child) => {
          out.event = parseSourceCitationEvent(child, ctx);
        },
        QUAY: (child) => {
          out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, child.position);
        },
        OBJE: (child) => {
          (out.media ??= []).push(parseMultimediaLink(child, ctx));
        },
        NOTE: (child) => {
          (out.notes ??= []).push(parseNoteStructure(child, ctx));
        },
        SNOTE: (child) => {
          // The 7.0 SOURCE_CITATION carries <<NOTE_STRUCTURE>> {0:M}
          // (GEDCOM 7.0 §3.2.3); accepted in any file.
          (out.notes ??= []).push(parseNoteStructure(child, ctx));
        },
        '_APID': (child) => {
          (out.ancestryPointers ??= []).push(reqText(child));
        },
        '_CREF': (child) => {
          out.reference = reqText(child);
        },
        '_SUBQ': (child) => {
          // RootsMagic: the subsequent-citation format (report wording).
          out.subsequentCitationFormat = reqText(child);
        },
        '_VERI': (child) => {
          out.verified = parsePrivacyFlag(child, '_VERI');
        },
        '_QUAY': (child) => {
          // FH7: the citation assessment options (see
          // SourceCitation.assessment).
          out.assessment = reqText(child);
        },
        '_FIELD': (child) => {
          (out.metafields ??= []).push(parseSourceMetafield(child, ctx));
        },
        '_SUBM': (child) => {
          // GDO: a pointer to the submitter record of this citation
          // (see SourceCitation.submitter).
          out.submitter = reqPtr(child, ctx);
        },
        '_TMPLT': (child) => {
          // RootsMagic: the Evidence Explained source template of the
          // citation — its actual write position (the record-level
          // `_TMPLT` is the other; see SourceCitation.template).
          out.template = parseEvidenceTemplate(child, ctx);
        },
        '_LINK': (child) => {
          // FTM: an internet link associated with the source (see
          // SourceCitation.links).
          (out.links ??= []).push(reqText(child));
        },
        'RINI': (child) => {
          // USM6: who found the source information (see
          // SourceCitation.foundBy).
          out.foundBy = reqText(child);
        },
        '_RINI': (child) => {
          // The underscore write-back spelling of the USM6 RINI (the
          // USM6 wire spelling is non-underscore; see
          // SourceCitation.foundBy for the export rule).
          out.foundBy = reqText(child);
        },
        'TEXT': (child) => {
          // Généatique writes the citation text with the standard TEXT
          // tag directly under the SOUR pointer (the webtrees per-vendor
          // custom-tag registry, Geneatique.php); the 5.5.1 grammar
          // places it under DATA. It normalizes into the same
          // data.texts slot the free-text SOUR form uses.
          out.data ??= {};
          (out.data.texts ??= []).push(parseSourceText(child, ctx));
        },
        'DATE': (child) => {
          // Legacy Family Tree writes the citation date directly under
          // the SOUR pointer (the canonical Legacy custom-tags sample,
          // `3 DATE 29 Sep 2016`); the 5.5.1 grammar places it under
          // DATA. It normalizes into the same data.date slot, with the
          // at-most-one rule of the standard position.
          out.data ??= {};
          if (out.data.date !== undefined) {
            fail('structure.cardinality', 'At most one DATE is allowed in a source citation', child.position);
          }
          out.data.date = parseDateStructure(child, ctx);
        },
      },
      ctx,
      ['PAGE', 'DATA', 'EVEN', 'QUAY'],
    );
    return out;
  }
  if (node.value.kind === 'absent') {
    fail('structure.missing-payload', 'The SOUR line requires a pointer or a source description', node.position);
  }
  const out: SourceCitation = { tag: 'SOUR', source: '@VOID@', description: node.value.text };
  dispatch(
    node,
    out,
    {
      TEXT: (child) => {
        out.data ??= {};
        (out.data.texts ??= []).push(parseSourceText(child, ctx));
      },
      QUAY: (child) => {
        out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, child.position);
      },
      OBJE: (child) => {
        (out.media ??= []).push(parseMultimediaLink(child, ctx));
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      '_QUAY': (child) => {
        // FH7: the citation assessment options (see
        // SourceCitation.assessment).
        out.assessment = reqText(child);
      },
      '_FIELD': (child) => {
        (out.metafields ??= []).push(parseSourceMetafield(child, ctx));
      },
      '_SUBM': (child) => {
        // GDO: a pointer to the submitter record of this citation
        // (see SourceCitation.submitter).
        out.submitter = reqPtr(child, ctx);
      },
      '_LINK': (child) => {
        // FTM: an internet link associated with the source (see
        // SourceCitation.links).
        (out.links ??= []).push(reqText(child));
      },
      'RINI': (child) => {
        // USM6: who found the source information (see
        // SourceCitation.foundBy).
        out.foundBy = reqText(child);
      },
      '_RINI': (child) => {
        // The underscore write-back spelling of the USM6 RINI.
        out.foundBy = reqText(child);
      },
    },
    ctx,
    ['QUAY'],
  );
  return out;
}

export function parseSourceCitationData(node: RawNode, ctx: Ctx): SourceCitationData {
  noPayload(node);
  const out: SourceCitationData = {};
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      TEXT: (child) => {
        (out.texts ??= []).push(parseSourceText(child, ctx));
      },
    },
    ctx,
  );
  return out;
}

export function parseSourceCitationEvent(node: RawNode, ctx: Ctx): SourceCitationEvent {
  const raw = reqText(node);
  const out: SourceCitationEvent = {};
  // Both value forms parse: a known tag, a 7.0 extension value (`_…`), or a
  // user-supplied descriptor, "classified in the category of other"
  // (5.5.1 `EVENT_TYPE_CITED_FROM` p.49). The known tags and the
  // extension values go to `payload`, anything else to `userDefined`
  // verbatim.
  if (raw.startsWith('_')) {
    out.payload = raw as EventAttributeEnum;
  } else {
    const key = Object.keys(EVENT_ATTRIBUTE_ENUM_VALUES).find(
      (value) => value.toLowerCase() === raw.toLowerCase(),
    );
    if (key !== undefined) {
      out.payload = key as EventAttributeEnum;
    } else {
      out.userDefined = raw;
    }
  }
  const handlers: Record<string, (child: RawNode) => void> = {
    ROLE: (child) => {
      out.role = parseRole(child, ctx);
    },
    // The 7.0 PHRASE child under the event; accepted
    // it in any file.
    PHRASE: (child) => {
      out.phrase = reqText(child);
    },
  };
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseSourceRepositoryCitation(node: RawNode, ctx: Ctx): SourceRepositoryCitation {
  const pointer = optPtr(node, ctx);
  const out: SourceRepositoryCitation = { tag: 'REPO', repository: pointer ?? '@VOID@' };
  const handlers: Record<string, (child: RawNode) => void> = {
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    CALN: (child) => {
      (out.callNumbers ??= []).push(parseCallNumber(child, ctx));
    },
    // The 7.0 SOURCE_REPOSITORY_CITATION carries <<NOTE_STRUCTURE>>
    // {0:M} (GEDCOM 7.0 §3.2.3); accepted in any file.
    SNOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
  };
  dispatch(node, out, handlers, ctx);
  return out;
}

export function parseCallNumber(node: RawNode, ctx: Ctx): CallNumberStructure {
  const out: CallNumberStructure = { payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      MEDI: (child) => {
        out.medium = parseMediaStructure(child, ctx);
      },
    },
    ctx,
  );
  return out;
}

/** The Family Historian media-link display attributes (see
 *  MultimediaLink.sequence / area / excludeFromDiagrams / caption):
 *  `_SEQ` {0:1} a sequence number, `_AREA` {0:1} the display area
 *  (kept verbatim), `_EXCL` {0:1} and `_CAPT` {0:1} presence flags.
 *  Registered into the OBJE-pointer handlers of both versions. */
function fhMediaLinkHandlers(
  out: MultimediaLink,
): Record<string, (child: RawNode) => void> {
  return {
    '_SEQ': (child) => {
      out.sequence = reqDigits(child);
    },
    '_AREA': (child) => {
      out.area = reqText(child);
    },
    '_EXCL': (child) => {
      out.excludeFromDiagrams = parseFhPresenceFlag(child, '_EXCL');
    },
    '_CAPT': (child) => {
      out.caption = parseFhPresenceFlag(child, '_CAPT');
    },
  };
}

/** The Family Historian presence flags whose documented value is a
 *  bare tag or an explicit marker (`_EXCL ALL`, `_CAPT Y`; see the
 *  FHUG "GEDCOM Extension List"): an absent value, `Y`, `YES` or the
 *  `ALL` spelling marks the flag set; `N`/`NO` clears it. */
export function parseFhPresenceFlag(node: RawNode, tag: string): boolean {
  if (node.value.kind === 'absent') {
    return true;
  }
  const text = reqText(node).toUpperCase();
  if (text === 'Y' || text === 'YES' || text === 'ALL') {
    return true;
  }
  if (text === 'N' || text === 'NO') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be a yes/no flag, not "${text}"`, node.position);
}

export function parseMultimediaLink(node: RawNode, ctx: Ctx): MultimediaLink {
  // Both forms parse: the pointer form (with the 7.0 CROP/TITL
  // children) and the 5.5.1 inline form (synthesized into a record)
  // are both accepted in any file — the payload shape selects the
  // form, not the declared version.
  if (node.value.kind === 'pointer') {
    const out: MultimediaLink = { tag: 'OBJE', object: resolvePtr(node.value.pointer, ctx, node) };
    dispatch(
      node,
      out,
      {
        CROP: (child) => {
          out.crop = parseCrop(child, ctx);
        },
        TITL: (child) => {
          out.title = reqText(child);
        },
        '_PRIM': (child) => {
          out.primary = parseYNFlag(child, '_PRIM');
        },
        '_SCBK': (child) => {
          out.scrapbook = parseYNFlag(child, '_SCBK');
        },
        '_SSHOW': (child) => {
          out.slideshow = parseYNFlag(child, '_SSHOW');
        },
        '_THUM': (child) => {
          // Généatique: the thumbnail flag (see MultimediaLink.thumbnail).
          out.thumbnail = parseYNFlag(child, '_THUM');
        },
        ...fhMediaLinkHandlers(out),
      },
      ctx,
    );
    return out;
  }
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', 'The OBJE line takes a pointer or nothing', node.position);
  }
  const record: MultimediaRecord = { tag: 'OBJE', files: [] };
  let title: string | undefined;
  let primary: boolean | undefined;
  let scrapbook: boolean | undefined;
  let slideshow: boolean | undefined;
  let thumbnail: boolean | undefined;
  let fileSize: number | undefined;
  let album: string | undefined;
  let photoRecordId: string | undefined;
  // Legacy Family Tree writes the format directly under the inline
  // OBJE (`2 FORM jpg` beside `2 FILE …`); the 5.5.1 inline grammar
  // places it under FILE. It is injected into each FILE that lacks its
  // own FORM before parsing (the canonical Legacy custom-tags sample).
  const linkForm = node.children.find((child) => child.tag === 'FORM');
  dispatch(
    node,
    record,
    {
      FORM: () => undefined,
      FILE: (child) => {
        const hasOwnForm = child.children.some((grandchild) => grandchild.tag === 'FORM');
        const fileNode = linkForm !== undefined && !hasOwnForm
          ? { ...child, children: [linkForm, ...child.children] }
          : child;
        record.files.push(parseMediaFile(fileNode, ctx));
      },
      TITL: (child) => {
        title = reqText(child);
      },
      NOTE: (child) => {
        // The 5.5.1 inline MULTIMEDIA_LINK grammar (GEDCOM 5.5.1 §2
        // p.37) carries NOTE {0:M} at the link level; the note lands
        // on the synthesized multimedia record, which is written back
        // as a record on export.
        (record.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      '_PRIM': (child) => {
        primary = parseYNFlag(child, '_PRIM');
      },
      '_SCBK': (child) => {
        scrapbook = parseYNFlag(child, '_SCBK');
      },
      '_SSHOW': (child) => {
        slideshow = parseYNFlag(child, '_SSHOW');
      },
      '_THUM': (child) => {
        // Généatique: the thumbnail flag (see MultimediaLink.thumbnail).
        thumbnail = parseYNFlag(child, '_THUM');
      },
      '_TYPE': (child) => {
        record.objectType = reqText(child);
      },
      '_SOUND': (child) => {
        record.soundFile = reqText(child);
      },
      '_KEYS': (child) => {
        // FH: the media object's keywords (see MultimediaRecord.keywords).
        record.keywords = reqText(child);
      },
      '_FILE': (child) => {
        // FH: the path of the media file (see MultimediaRecord.filePath).
        record.filePath = reqText(child);
      },
      '_NOTE': (child) => {
        // FH: a media note (see MultimediaRecord.mediaNote).
        record.mediaNote = reqText(child);
      },
      '_CREA': (child) => {
        // Ancestry.com Family Trees: the date the media object was
        // created (see MultimediaRecord.createdAt).
        record.createdAt = reqText(child);
      },
      '_DATE': (child) => {
        record.date = parseDateStructure(child, ctx);
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
    },
    ctx,
  );
  if (record.files.length === 0) {
    fail('structure.missing-required', 'An inline OBJE requires at least one FILE substructure', node.position);
  }
  if (title !== undefined) {
    (record.files[0] as MediaFile).title = title;
  }
  if (fileSize !== undefined) {
    (record.files[0] as MediaFile).fileSize = fileSize;
  }
  if (album !== undefined) {
    (record.files[0] as MediaFile).album = album;
  }
  if (photoRecordId !== undefined) {
    (record.files[0] as MediaFile).recordId = photoRecordId;
  }
  // Synthesize a multimedia record (the GEDCOM 7.0 normalization).
  let xref: string;
  do {
    xref = `@_SYNO${ctx.syntheticIndex}@`;
    ctx.syntheticIndex++;
  } while (ctx.xrefs.has(xref));
  ctx.xrefs.add(xref);
  // The synthesized record must carry its identifier: the serializers
  // write the record and the pointer link verbatim, and the 5.5.1
  // projection strips links whose target is missing.
  record.xref = xref;
  ctx.synthetic.push(record);
  return {
    tag: 'OBJE',
    object: xref,
    ...(primary === undefined ? {} : { primary }),
    ...(scrapbook === undefined ? {} : { scrapbook }),
    ...(slideshow === undefined ? {} : { slideshow }),
    ...(thumbnail === undefined ? {} : { thumbnail }),
  };
}

/**
 * Parses a presence-style privacy flag (`_PRIV`): an absent value or `Y`
 * marks the flag set, `N` clears it. Used where the flag has no standard
 * slot (addresses) and where it projects onto RESN (event details).
 */
export function parsePrivacyFlag(node: RawNode, tag: string): boolean {
  if (node.value.kind === 'absent') {
    return true;
  }
  const text = reqText(node);
  if (text === 'Y') {
    return true;
  }
  if (text === 'N') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be Y or N, not "${text}"`, node.position);
}

/** Parses a vendor Y/N flag (`_PRIM`, `_SCBK`, `_SSHOW`, …). */
export function parseYNFlag(node: RawNode, tag: string): boolean {
  const text = reqText(node);
  if (text === 'Y') {
    return true;
  }
  if (text === 'N') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be Y or N, not "${text}"`, node.position);
}

/**
 * Parses a presence-style vendor flag with the wider value spellings the
 * catalogs document (`Y` and `YES` both occur, e.g. Legacy's `_ITALIC Y`
 * versus `_LIST1 YES` in its "Custom GEDCOM Tags" help): an absent value,
 * `Y` or `YES` marks the flag set, `N`/`NO` clears it. Used for the
 * report-formatting flags without a standard slot.
 */
export function parseVendorFlag(node: RawNode, tag: string): boolean {
  if (node.value.kind === 'absent') {
    return true;
  }
  const text = reqText(node).toUpperCase();
  if (text === 'Y' || text === 'YES') {
    return true;
  }
  if (text === 'N' || text === 'NO') {
    return false;
  }
  fail('enum.invalid-value', `The ${tag} value must be Y, YES, N or NO, not "${text}"`, node.position);
}

/**
 * Parses a USM6 (Der Stammbaum ≤ V6) yes/no flag (`SIGN`, `POTM`): the
 * wire value is undocumented (the GenWiki "GEDCOM/_Nutzerdef-Tag"
 * article's "Tabelle 2" describes the value set only as "[ja/nein]"),
 * so an absent value or the usual positive spellings (`Y`, `YES`, `J`,
 * `JA`, `1`) mark the flag set and the negative ones (`N`, `NO`,
 * `NEIN`, `0`) clear it.
 */
export function parseUsmFlag(node: RawNode, tag: string): boolean {
  const flag = parseUsmFlagLenient(node, tag);
  if (flag === undefined) {
    fail('enum.invalid-value', `The ${tag} value must be a yes/no flag, not "${reqText(node)}"`, node.position);
  }
  return flag;
}

/**
 * The lenient twin of parseUsmFlag: returns undefined when the payload
 * is not one of the flag spellings, so the caller can keep the line as
 * a generic extension instead of failing the import. Used where two
 * vendors give the same tag different meanings (USM6's `SIGN` can-sign
 * flag versus Heredis' `SIGN` signature — see IndividualRecord.canSign).
 */
export function parseUsmFlagLenient(node: RawNode, tag: string): boolean | undefined {
  void tag;
  if (node.value.kind === 'absent') {
    return true;
  }
  if (node.value.kind !== 'text') {
    return undefined;
  }
  const text = node.value.text.toUpperCase();
  if (text === 'Y' || text === 'YES' || text === 'J' || text === 'JA' || text === '1') {
    return true;
  }
  if (text === 'N' || text === 'NO' || text === 'NEIN' || text === '0') {
    return false;
  }
  return undefined;
}

/**
 * Parses the USM6 `SURE` certainty marker under an INDI or FAM NCHI:
 * `1` marks the given child count certain, `0` clears the mark (the
 * GenWiki example is "SURE 1").
 */
export function parseSureFlag(node: RawNode): boolean {
  const text = reqText(node);
  if (text === '1') {
    return true;
  }
  if (text === '0') {
    return false;
  }
  fail('enum.invalid-value', `The SURE value must be 1 or 0, not "${text}"`, node.position);
}

/**
 * Parses one of the USM6 digit codes (BTYP, MTYP, UTYP): the accepted
 * digits are the documented value set of the tag, and the returned
 * literal is one of them (the meanings live in the model types).
 */
export function parseUsmCode<T extends string>(node: RawNode, tag: string, allowed: readonly T[]): T {
  const text = reqText(node);
  if (!allowed.includes(text as T)) {
    fail('enum.invalid-value', `The ${tag} value must be one of ${allowed.join(', ')}, not "${text}"`, node.position);
  }
  return text as T;
}

export function parseCrop(node: RawNode, ctx: Ctx): CropStructure {
  noPayload(node);
  const out: CropStructure = {};
  dispatch(
    node,
    out,
    {
      TOP: (child) => {
        out.top = reqDigits(child);
      },
      LEFT: (child) => {
        out.left = reqDigits(child);
      },
      HEIGHT: (child) => {
        out.height = reqDigits(child);
      },
      WIDTH: (child) => {
        out.width = reqDigits(child);
      },
    },
    ctx,
  );
  return out;
}

// ---------------------------------------------------------------------------
