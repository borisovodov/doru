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
import {
  fail,
} from '../errors';
import type {
  CallNumberStructure,
  CropStructure,
  MediaFile,
  MultimediaLink,
  MultimediaRecord,
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

export function parseSourceCitation(node: RawNode, ctx: Ctx): SourceCitation {
  if (ctx.version === '7.0') {
    const out: SourceCitation = { tag: 'SOUR', source: reqPtr(node, ctx) };
    dispatch(
      node,
      out,
      {
        PAGE: (child) => {
          out.page = reqText(child);
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
          out.page = reqText(child);
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
  const out: SourceCitationEvent = {
    payload: parseEnum(reqText(node), EVENT_ATTRIBUTE_ENUM_VALUES, ctx.version, node.position),
  };
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
  dispatch(
    node,
    out,
    {
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      CALN: (child) => {
        (out.callNumbers ??= []).push(parseCallNumber(child, ctx));
      },
    },
    ctx,
  );
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
          out.primary = parsePrimFlag(child);
        },
      },
      ctx,
      ['_PRIM'],
    );
    return out;
  }
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', 'The 5.5.1 OBJE line takes a pointer or nothing', node.position);
  }
  const record: MultimediaRecord = { tag: 'OBJE', files: [] };
  let title: string | undefined;
  let primary: boolean | undefined;
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
        primary = parsePrimFlag(child);
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
  return { tag: 'OBJE', object: xref, ...(primary === undefined ? {} : { primary }) };
}

/** Parses the `_PRIM` Y/N flag. */
function parsePrimFlag(node: RawNode): boolean {
  const text = reqText(node);
  if (text === 'Y') {
    return true;
  }
  if (text === 'N') {
    return false;
  }
  fail('enum.invalid-value', `The _PRIM value must be Y or N, not "${text}"`, node.position);
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
