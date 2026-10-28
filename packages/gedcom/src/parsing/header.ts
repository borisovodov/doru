/**
 * Parser section: Header.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  fail,
} from '../errors';
import type {
  Corporation,
  FtmSchemaBlock,
  FtmSchemaEntry,
  Gedcom,
  Header,
  HeaderPlace,
  HeaderSource,
  HeaderSourceData,
  Schema,
  TagDefinitionStructure,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  dispatch,
  noPayload,
  one,
  req,
  reqPtr,
  reqText,
} from './context';
import type {
  RawNode,
} from './lines';
import {
  parseAddressStructure,
  parseDateExactStructure,
  parseNoteStructure,
} from './substructures';
import {
  normalizeCharset551,
} from './decode';
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
  const header: Omit<Header, 'gedcom'> = { tag: 'HEAD' };
  let gedcom: Gedcom | undefined;
  // HEAD.NOTE {0:1} — GEDCOM 7.0 §3.2.1 gives the header one
  // NOTE_STRUCTURE, so the inline NOTE and the SNOTE pointer forms are
  // mutually exclusive; 5.5.1 only knows the inline form.
  const setNote = (child: RawNode): void => {
    if (header.note !== undefined) {
      fail('structure.cardinality', 'At most one note structure is allowed in the header', child.position);
    }
    header.note = parseNoteStructure(child, ctx);
  };
  dispatch(
    node,
    header,
    {
      GEDC: (child) => {
        if (gedcom !== undefined) {
          fail('structure.cardinality', 'At most one GEDC is allowed in the header', child.position);
        }
        gedcom = parseGedc(child, ctx);
      },
      ...(ctx.version === '7.0'
        ? {
            SCHMA: (child) => {
              header.schema = parseSchema(child, ctx);
            },
            SNOTE: (child) => {
              // The 7.0 HEAD carries <<NOTE_STRUCTURE>> {0:1}; 5.5.1
              // stays strict.
              setNote(child);
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
        // GEDCOM 5.5.1 §2 Record Structures (p.23) allows a TIME under
        // HEAD.DATE (TRANSMISSION_DATE), like 7.0's HEAD-DATE.
        header.date = parseDateExactStructure(child, ctx, true);
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
        setNote(child);
      },
      ...(ctx.version === '5.5.1'
        ? {
            CHAR: (child) => {
              parseCharacterSetStructure(child, ctx);
            },
            SCHEMA: (child) => {
              if (header.schema53 !== undefined) {
                fail('structure.cardinality', 'At most one SCHEMA is allowed in the header', child.position);
              }
              header.schema53 = parseSchema53(child, ctx);
            },
            _SCHEMA: (child) => {
              // The Family Tree Maker spelling of the same block.
              if (header.schema53 !== undefined) {
                fail('structure.cardinality', 'At most one SCHEMA is allowed in the header', child.position);
              }
              header.schema53 = parseSchema53(child, ctx);
            },
          }
        : {}),
    },
    ctx,
    ['SCHMA', 'SOUR', 'DEST', 'DATE', 'SUBM', 'SUBN', 'FILE', 'COPR', 'LANG', 'PLAC', 'NOTE', 'CHAR', 'SCHEMA'],
  );
  if (gedcom === undefined) {
    fail('structure.missing-required', 'The header requires a GEDC substructure', node.position);
  }
  if (ctx.version === '5.5.1') {
    if (header.source === undefined) {
      fail('structure.missing-required', 'The 5.5.1 header requires a SOUR substructure', node.position);
    }
    // The 5.5.1 spec also requires the HEAD.SUBM pointer, but it is not
    // enforced: GEDCOM 5.5.5 deprecated it in favour of the submitter
    // record after the header, and real 5.5.5 files omit it — they
    // parse under these rules. The 5.5.1 serializer still synthesizes
    // a SUBM when writing.
  }
  return { ...header, gedcom };
}

export function parseGedc(node: RawNode, ctx: Ctx): Gedcom {
  noPayload(node);
  const gedcom: Gedcom = { version: reqText(req(node, 'VERS')) };
  // The version gate comes first: a 5.x GEDC parsed as 7.0 must fail
  // with `document.wrong-version` (not with a FORM-related error), so
  // that the unified `parse` can fall back to the 5.x parser.
  if (ctx.version === '7.0') {
    if (!/^7\./.test(gedcom.version)) {
      fail('document.wrong-version', `GEDC.VERS "${gedcom.version}" is not a GEDCOM 7.x version`, node.position);
    }
  } else if (/^7\./.test(gedcom.version)) {
    fail('document.wrong-version', `GEDC.VERS "${gedcom.version}" is not a GEDCOM 5.x version`, node.position);
  } else if (!/^5\.5(\.\d+)?$/.test(gedcom.version)) {
    // The 5.x parser reads the 5.5 lineage — 5.5 (1996), 5.5.1 and
    // 5.5.5 (whose vocabulary additions are accepted in any 5.x file).
    // Older versions (3.0, 4.0, 5.0) and the superseded drafts (5.3,
    // 5.4) have incompatible grammars and are rejected here with an
    // explicit error instead of failing mid-file with
    // `structure.unknown-tag` errors.
    fail('document.wrong-version', `GEDC.VERS "${gedcom.version}" is not a supported GEDCOM version (5.5, 5.5.1 or 5.5.5)`, node.position);
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
    // GEDCOM 5.5.5 added GEDC.FORM.VERS (a version number for the
    // GEDCOM form, distinct from GEDC.VERS; 5.5.5 §1 p.49–50). The
    // package does not store it — the writers emit 5.5.1 and 7.0,
    // neither of which has the slot — so the line is accepted and
    // discarded (its cardinality is still checked).
    one(formNode, 'VERS');
    dispatch(formNode, { }, { VERS: () => undefined }, ctx);
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
  // Fill the document's tag→URI map (see Ctx.schemaTags): the date
  // parser resolves documented extension calendars and months through
  // it (GEDCOM 7.0 §2.14).
  for (const definition of schema.tagDefinitions) {
    ctx.schemaTags.set(definition.payload.tag, definition.payload.uri);
  }
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
    fail('enum.invalid-value', `The ${ctx.version} APPROVED_SYSTEM_ID must not contain spaces (use underscores)`, node.position);
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

/* Validates the 5.5.1 CHAR line; the declared value selects the
 * decoder (checked earlier by the charset detection) and is not stored
 * in the model. CHAR.VERS is accepted and discarded. */
export function parseCharacterSetStructure(node: RawNode, ctx: Ctx): void {
  const text = reqText(node);
  if (normalizeCharset551(text) === undefined) {
    fail('charset.invalid', `Unknown character set "${text}"; expected ANSEL, UTF-8, UNICODE, ASCII, CP1252, CP850, or MACINTOSH`, node.position);
  }
  dispatch(
    node,
    { },
    { VERS: () => undefined },
    ctx,
  );
}

/**
 * Parses the GEDCOM 5.3 SCHEMA block: context chains of tags ending in
 * the declared user tag, with LABL/DEFN/ISA leaves beneath it (GEDCOM
 * 5.3 `USER_TAG_SCHEMA`, p.25–26 of the Tamura Jones PDF). The context
 * tags carry no payloads; the leaves are payload texts and have no
 * substructures of their own.
 */
export function parseSchema53(node: RawNode, ctx: Ctx): FtmSchemaBlock {
  noPayload(node);
  const out: FtmSchemaBlock = { tag: 'SCHEMA', entries: [] };
  for (const child of node.children) {
    collectSchemaEntry(child, [], out.entries, ctx);
  }
  return out;
}

/** Walks one branch of the SCHEMA tree, collecting the declaration leaves. */
function collectSchemaEntry(node: RawNode, context: string[], entries: FtmSchemaEntry[], ctx: Ctx): void {
  if (node.tag === 'LABL' || node.tag === 'DEFN' || node.tag === 'ISA') {
    if (node.children.length > 0) {
      fail('structure.unknown-tag', `The tag ${(node.children[0] as RawNode).tag} is not allowed under ${node.tag}`, (node.children[0] as RawNode).position);
    }
    const key = context.join('/');
    let entry = entries[entries.length - 1];
    if (entry === undefined || entry.context.join('/') !== key) {
      entry = { context: [...context] };
      entries.push(entry);
    }
    if (node.tag === 'LABL') {
      if (entry.label !== undefined) {
        fail('structure.cardinality', 'At most one LABL is allowed under a declared tag', node.position);
      }
      entry.label = reqText(node);
    } else if (node.tag === 'DEFN') {
      if (entry.definition !== undefined) {
        fail('structure.cardinality', 'At most one DEFN is allowed under a declared tag', node.position);
      }
      entry.definition = reqText(node);
    } else {
      if (entry.parent !== undefined) {
        fail('structure.cardinality', 'At most one ISA is allowed under a declared tag', node.position);
      }
      entry.parent = reqText(node);
    }
    return;
  }
  if (node.value.kind !== 'absent') {
    fail('structure.unexpected-payload', `The SCHEMA context tag ${node.tag} must not carry a value`, node.position);
  }
  for (const child of node.children) {
    collectSchemaEntry(child, [...context, node.tag], entries, ctx);
  }
}

export function parseLanguage(node: RawNode, ctx: Ctx): string {
  const text = reqText(node);
  if (ctx.version === '5.5.1') {
    return parseLanguage551(text, node.position);
  }
  return text;
}

// ---------------------------------------------------------------------------
