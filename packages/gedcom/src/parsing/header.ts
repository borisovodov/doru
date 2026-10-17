/**
 * Parser section: Header.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import { fail } from '../errors';
import {
  type Corporation,
  type Gedcom,
  type Header,
  type HeaderPlace,
  type HeaderSource,
  type HeaderSourceData,
  type Schema,
  type TagDefinitionStructure,
} from '../structures';
import {
  dispatch,
  noPayload,
  one,
  req,
  reqPtr,
  reqText,
  type Ctx,
} from './context';
import { type RawNode } from './lines';
import {
  parseAddressStructure,
  parseDateExactStructure,
  parseNoteStructure,
} from './substructures';
import {
  parseLanguage551,
  parseListText,
  parseTagDefinition,
} from './types';

// Header
// ---------------------------------------------------------------------------

export function parseHeader(node: RawNode, ctx: Ctx): Header {
  noPayload(node);
  if (node.xref !== undefined) {
    fail('line.xref-on-substructure', 'The HEAD pseudo-structure must not have a cross-reference identifier', node.position);
  }
  const header: Header = { tag: 'HEAD', gedcom: null as unknown as Gedcom };
  dispatch(
    node,
    header,
    {
      GEDC: (child) => {
        if (header.gedcom !== (null as unknown as Gedcom)) {
          fail('structure.cardinality', 'At most one GEDC is allowed in the header', child.position);
        }
        header.gedcom = parseGedc(child, ctx);
      },
      ...(ctx.version === '7.0'
        ? {
            SCHMA: (child) => {
              header.schema = parseSchema(child, ctx);
            },
          }
        : {}),
      SOUR: (child) => {
        header.source = parseHeaderSource(child, ctx);
      },
      DEST: (child) => {
        header.destination = reqText(child);
      },
      DATE: (child) => {
        header.date = parseDateExactStructure(child, ctx, ctx.version === '7.0');
      },
      SUBM: (child) => {
        header.submitter = reqPtr(child, ctx);
      },
      ...(ctx.version === '5.5.1'
        ? {
            SUBN: (child) => {
              header.submission = reqPtr(child, ctx);
            },
            FILE: (child) => {
              header.fileName = reqText(child);
            },
          }
        : {}),
      COPR: (child) => {
        header.copyright = reqText(child);
      },
      LANG: (child) => {
        header.language = parseLanguage(child, ctx);
      },
      PLAC: (child) => {
        header.place = parseHeaderPlace(child, ctx);
      },
      NOTE: (child) => {
        header.note = parseNoteStructure(child, ctx);
      },
      ...(ctx.version === '5.5.1'
        ? {
            CHAR: (child) => {
              parseCharacterSetStructure(child);
            },
          }
        : {}),
    },
    ctx,
    ['SCHMA', 'SOUR', 'DEST', 'DATE', 'SUBM', 'SUBN', 'FILE', 'COPR', 'LANG', 'PLAC', 'NOTE', 'CHAR'],
  );
  if (header.gedcom === (null as unknown as Gedcom)) {
    fail('structure.missing-required', 'The header requires a GEDC substructure', node.position);
  }
  if (ctx.version === '5.5.1') {
    if (header.source === undefined) {
      fail('structure.missing-required', 'The 5.5.1 header requires a SOUR substructure', node.position);
    }
    if (header.submitter === undefined) {
      fail('structure.missing-required', 'The 5.5.1 header requires a SUBM substructure', node.position);
    }
  }
  return header;
}

export function parseGedc(node: RawNode, ctx: Ctx): Gedcom {
  noPayload(node);
  const gedcom: Gedcom = { version: reqText(req(node, 'VERS')) };
  // The version gate comes first: a 5.5.1 GEDC parsed as 7.0 must fail
  // with `document.wrong-version` (not with a FORM-related error), so
  // that the unified `parse` can fall back to the 5.5.1 parser.
  if (ctx.version === '7.0') {
    if (!/^7\./.test(gedcom.version)) {
      fail('document.wrong-version', `GEDC.VERS "${gedcom.version}" is not a GEDCOM 7.x version`, node.position);
    }
  } else if (/^7\./.test(gedcom.version)) {
    fail('document.wrong-version', `GEDC.VERS "${gedcom.version}" is not a GEDCOM 5.x version`, node.position);
  }
  const formNode = one(node, 'FORM');
  if (ctx.version === '5.5.1') {
    if (formNode === undefined) {
      fail('structure.missing-required', 'The 5.5.1 GEDC structure requires a FORM substructure', node.position);
    }
    const form = reqText(formNode);
    if (form.toUpperCase() !== 'LINEAGE-LINKED') {
      fail('enum.invalid-value', `Unknown GEDCOM form "${form}"; expected LINEAGE-LINKED`, formNode.position);
    }
    gedcom.form = form;
  } else if (formNode !== undefined) {
    fail('structure.unknown-tag', 'The FORM tag is not allowed under GEDC in GEDCOM 7.0', formNode.position);
  }
  dispatch(node, gedcom, { VERS: () => undefined, FORM: () => undefined }, ctx);
  return gedcom;
}

export function parseSchema(node: RawNode, ctx: Ctx): Schema {
  noPayload(node);
  const schema: Schema = { tagDefinitions: [] };
  dispatch(
    node,
    schema,
    {
      TAG: (child) => {
        schema.tagDefinitions.push(parseTagDefinitionStructure(child));
      },
    },
    ctx,
  );
  return schema;
}

export function parseTagDefinitionStructure(node: RawNode): TagDefinitionStructure {
  if (node.children.length > 0) {
    fail('structure.unexpected-payload', 'A TAG definition must not have substructures', (node.children[0] as RawNode).position);
  }
  return { payload: parseTagDefinition(reqText(node), node.position) };
}

export function parseHeaderSource(node: RawNode, ctx: Ctx): HeaderSource {
  const source: HeaderSource = { payload: reqText(node) };
  if (ctx.version === '5.5.1' && /\s/.test(source.payload)) {
    fail('enum.invalid-value', 'The 5.5.1 APPROVED_SYSTEM_ID must not contain spaces (use underscores)', node.position);
  }
  dispatch(
    node,
    source,
    {
      VERS: (child) => {
        source.version = reqText(child);
      },
      NAME: (child) => {
        source.name = reqText(child);
      },
      CORP: (child) => {
        source.corporation = parseCorporation(child, ctx);
      },
      DATA: (child) => {
        source.data = parseHeaderSourceData(child, ctx);
      },
    },
    ctx,
  );
  return source;
}

export function parseCorporation(node: RawNode, ctx: Ctx): Corporation {
  const corp: Corporation = { payload: reqText(node) };
  dispatch(
    node,
    corp,
    {
      ADDR: (child) => {
        corp.address = parseAddressStructure(child, ctx);
      },
      PHON: (child) => {
        (corp.phone ??= []).push(reqText(child));
      },
      EMAIL: (child) => {
        (corp.email ??= []).push(reqText(child));
      },
      FAX: (child) => {
        (corp.fax ??= []).push(reqText(child));
      },
      WWW: (child) => {
        (corp.www ??= []).push(reqText(child));
      },
    },
    ctx,
  );
  return corp;
}

export function parseHeaderSourceData(node: RawNode, ctx: Ctx): HeaderSourceData {
  const data: HeaderSourceData = { payload: reqText(node) };
  dispatch(
    node,
    data,
    {
      DATE: (child) => {
        data.date = parseDateExactStructure(child, ctx, ctx.version === '7.0');
      },
      COPR: (child) => {
        data.copyright = reqText(child);
      },
    },
    ctx,
  );
  return data;
}

export function parseHeaderPlace(node: RawNode, ctx: Ctx): HeaderPlace {
  noPayload(node);
  const place: HeaderPlace = { form: parseListText(reqText(req(node, 'FORM'))) };
  dispatch(node, place, { FORM: () => undefined }, ctx);
  return place;
}

/** Validates the 5.5.1 CHAR line; the declared value selects the
 * decoder (checked earlier by the charset detection) and is not stored
 * in the model. CHAR.VERS is accepted and discarded. */
export function parseCharacterSetStructure(node: RawNode): void {
  const text = reqText(node);
  const upper = text.toUpperCase();
  if (upper !== 'ANSEL' && upper !== 'ASCII' && upper !== 'UTF-8' && upper !== 'UNICODE') {
    fail('charset.invalid', `Unknown character set "${text}"; expected ANSEL, UTF-8, UNICODE, or ASCII`, node.position);
  }
  dispatch(
    node,
    { },
    { VERS: () => undefined },
    { version: '5.5.1', xrefs: new Set(), synthetic: [], syntheticIndex: 0 },
  );
}

export function parseLanguage(node: RawNode, ctx: Ctx): string {
  const text = reqText(node);
  if (ctx.version === '5.5.1') {
    return parseLanguage551(text, node.position);
  }
  return text;
}

// ---------------------------------------------------------------------------
