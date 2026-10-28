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

export function parseSourceCitation(node: RawNode, ctx: Ctx): SourceCitation {
  if (ctx.version === '7.0') {
    const out: SourceCitation = { tag: 'SOUR', source: reqPtr(node, ctx) };
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
          out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, '7.0', child.position);
        },
        OBJE: (child) => {
          (out.media ??= []).push(parseMultimediaLink(child, ctx));
        },
        NOTE: (child) => {
          (out.notes ??= []).push(parseNoteStructure(child, ctx));
        },
        SNOTE: (child) => {
          // The 7.0 SOURCE_CITATION carries <<NOTE_STRUCTURE>> {0:M}
          // (GEDCOM 7.0 §3.2.3); 5.5.1 stays strict.
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
      },
      ctx,
      ['PAGE', 'DATA', 'EVEN', 'QUAY'],
    );
    return out;
  }
  // 5.5.1: pointer form or free-text description form.
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
          out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, '5.5.1', child.position);
        },
        OBJE: (child) => {
          (out.media ??= []).push(parseMultimediaLink(child, ctx));
        },
        NOTE: (child) => {
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
      },
      ctx,
      ['PAGE', 'DATA', 'EVEN', 'QUAY'],
    );
    return out;
  }
  if (node.value.kind === 'absent') {
    fail('structure.missing-payload', 'The 5.5.1 SOUR line requires a pointer or a source description', node.position);
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
        out.quality = parseEnum(reqText(child), QUALITY_ENUM_VALUES, '5.5.1', child.position);
      },
      OBJE: (child) => {
        (out.media ??= []).push(parseMultimediaLink(child, ctx));
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
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
  if (ctx.version === '7.0') {
    out.payload = parseEnum(raw, EVENT_ATTRIBUTE_ENUM_VALUES, '7.0', node.position);
  } else {
    // 5.5.1 `EVENT_TYPE_CITED_FROM` (p.49): a known tag or a
    // user-supplied descriptor, "classified in the category of other".
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
  };
  if (ctx.version === '7.0') {
    handlers["PHRASE"] = (child) => {
      out.phrase = reqText(child);
    };
  }
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
  };
  if (ctx.version === '7.0') {
    // The 7.0 SOURCE_REPOSITORY_CITATION carries <<NOTE_STRUCTURE>>
    // {0:M} (GEDCOM 7.0 §3.2.3); 5.5.1 stays strict.
    handlers['SNOTE'] = (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    };
  }
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

export function parseMultimediaLink(node: RawNode, ctx: Ctx): MultimediaLink {
  if (ctx.version === '7.0') {
    const out: MultimediaLink = { tag: 'OBJE', object: reqPtr(node, ctx) };
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
      },
      ctx,
    );
    return out;
  }
  // 5.5.1: pointer form, or inline form (synthesized into a record).
  if (node.value.kind === 'pointer') {
    const out: MultimediaLink = { tag: 'OBJE', object: resolvePtr(node.value.pointer, ctx, node) };
    dispatch(
      node,
      out,
      {
        '_PRIM': (child) => {
          out.primary = parseYNFlag(child, '_PRIM');
        },
        '_SCBK': (child) => {
          out.scrapbook = parseYNFlag(child, '_SCBK');
        },
        '_SSHOW': (child) => {
          out.slideshow = parseYNFlag(child, '_SSHOW');
        },
      },
      ctx,
      ['_PRIM', '_SCBK', '_SSHOW'],
    );
    return out;
  }
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', 'The 5.5.1 OBJE line takes a pointer or nothing', node.position);
  }
  const record: MultimediaRecord = { tag: 'OBJE', files: [] };
  let title: string | undefined;
  let primary: boolean | undefined;
  let scrapbook: boolean | undefined;
  let slideshow: boolean | undefined;
  dispatch(
    node,
    record,
    {
      FILE: (child) => {
        record.files.push(parseMediaFile(child, ctx));
      },
      TITL: (child) => {
        title = reqText(child);
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
      '_TYPE': (child) => {
        record.objectType = reqText(child);
      },
      '_SOUND': (child) => {
        record.soundFile = reqText(child);
      },
      '_DATE': (child) => {
        record.date = parseDateStructure(child, ctx);
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
  // Synthesize a multimedia record (the GEDCOM 7.0 normalization).
  let xref: string;
  do {
    xref = `@_SYNO${ctx.syntheticIndex}@`;
    ctx.syntheticIndex++;
  } while (ctx.xrefs.has(xref));
  ctx.xrefs.add(xref);
  ctx.synthetic.push(record);
  return {
    tag: 'OBJE',
    object: xref,
    ...(primary === undefined ? {} : { primary }),
    ...(scrapbook === undefined ? {} : { scrapbook }),
    ...(slideshow === undefined ? {} : { slideshow }),
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
