/**
 * Parser section: Document.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). Every function here
 * maps a raw-tree node onto the typed model and fails with a typed
 * error naming the offending line.
 */

import {
  DOCUMENT_START,
  fail,
} from '../errors';
import type {
  GedcomVersion,
} from '../primitives';
import type {
  ExtensionRecord,
  GedcomDataset,
  GedcomRecord,
  SubmissionRecord,
  Trailer,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  noPayload,
  parseExtension,
} from './context';
import {
  parseFamilyRecord,
  parseIndividualRecord,
} from './family-individual';
import {
  parseCensusRecord,
} from './census';
import {
  parseHeader,
} from './header';
import type {
  RawNode,
} from './lines';
import {
  NON_UNDERSCORE_VENDOR_TAGS,
} from './vendor-tags';
import {
  RECORD_TAGS_70,
  resolveStandardTagByUri,
} from './schema-tags';
import {
  parseMultimediaRecord,
} from './media';
import {
  parseNoteRecord,
  parseRepositoryRecord,
  parseSharedNoteRecord,
  parseSourceRecord,
} from './sources';
import { linkPlacesByName, parsePlaceRecord } from './places';
import { parseTodoRecord } from './todo';
import { parseEventDefinitionRecord } from './event-definition';
import {
  parseSubmissionRecord,
  parseSubmitterRecord,
} from './submitters';
import type { DuplicateCandidateRecord } from '../structures';
import {
  dispatch,
  reqPtr,
  reqText,
} from './context';
import {
  parseNoteStructure,
} from './substructures';
import {
  parseSourceCitation,
} from './sources-media';

// Document
// ---------------------------------------------------------------------------

/** Collects every cross-reference identifier in the raw tree: the
 *  top-level records plus any tagged extension structure at a deeper
 *  level (GEDCOM 7.0 §1.5 permits an xref on an extension structure at
 *  any depth, and a pointer may address it). */
function collectXrefs(nodes: RawNode[]): Set<string> {
  const xrefs = new Set<string>();
  const walk = (node: RawNode): void => {
    if (node.xref !== undefined) {
      xrefs.add(node.xref);
    }
    for (const child of node.children) {
      walk(child);
    }
  };
  for (const node of nodes) {
    walk(node);
  }
  return xrefs;
}

export function parseDocument(raw: { nodes: RawNode[] }, version: GedcomVersion): GedcomDataset {
  const ctx: Ctx = {
    version,
    xrefs: collectXrefs(raw.nodes),
    synthetic: [],
    syntheticIndex: 0,
    schemaTags: new Map(),
  };
  const nodes = raw.nodes;

  if (nodes.length === 0 || nodes[0]?.tag !== 'HEAD') {
    fail('document.missing-header', 'The document must begin with a HEAD line', nodes[0]?.position ?? DOCUMENT_START);
  }
  const header = parseHeader(nodes[0] as RawNode, ctx);

  let index = 1;
  let submission: SubmissionRecord | undefined;
  if (version === '5.5.1' && nodes[index]?.tag === 'SUBN') {
    submission = parseSubmissionRecord(nodes[index] as RawNode, ctx);
    index++;
  }

  const records: GedcomRecord[] = [];
  let trailer: Trailer | undefined;
  for (; index < nodes.length; index++) {
    const node = nodes[index] as RawNode;
    if (node.tag === 'TRLR') {
      noPayload(node);
      if (node.children.length > 0) {
        fail('structure.unexpected-payload', 'The TRLR line must not have substructures', (node.children[0] as RawNode).position);
      }
      if (node.xref !== undefined) {
        fail('line.xref-on-substructure', 'The TRLR pseudo-structure must not have a cross-reference identifier', node.position);
      }
      trailer = { tag: 'TRLR' };
      if (index !== nodes.length - 1) {
        fail('document.trailer-not-last', 'The TRLR line must be the last line of the document', node.position);
      }
      continue;
    }
    records.push(parseRecord(node, ctx));
  }
  if (trailer === undefined) {
    fail('document.missing-trailer', 'The document must end with a TRLR line', DOCUMENT_START);
  }

  linkPlacesByName(records, ctx);

  records.push(...ctx.synthetic);
  return {
    header,
    ...(submission === undefined ? {} : { submission }),
    records,
    trailer,
  };
}

export function parseRecord(node: RawNode, ctx: Ctx): GedcomRecord {
  if (ctx.version === '7.0' && node.tag.startsWith('_')) {
    // A SCHMA-documented record alias (`_USER → g7:record-SUBM`, …)
    // parses as the standard record — standard-first (see
    // parsing/schema-tags.ts). A documented tag whose URI names no
    // standard record keeps its extension meaning and stays generic.
    const standard = resolveStandardTagByUri(ctx.schemaTags.get(node.tag));
    if (standard !== undefined && RECORD_TAGS_70.has(standard)) {
      node = { ...node, tag: standard };
    }
  }
  switch (node.tag) {
    case 'FAM':
      return parseFamilyRecord(node, ctx);
    case 'INDI':
      return parseIndividualRecord(node, ctx);
    case 'OBJE':
      return parseMultimediaRecord(node, ctx);
    case 'REPO':
      return parseRepositoryRecord(node, ctx);
    case 'SNOTE':
      if (ctx.version !== '7.0') {
        fail('structure.unknown-tag', 'The SNOTE record does not exist in GEDCOM 5.5.1', node.position);
      }
      return parseSharedNoteRecord(node, ctx);
    case 'NOTE':
      if (ctx.version === '7.0') {
        fail('structure.unknown-tag', 'The NOTE record does not exist in GEDCOM 7.0 (use SNOTE)', node.position);
      }
      return parseNoteRecord(node, ctx);
    case 'SOUR':
      return parseSourceRecord(node, ctx);
    case 'SUBM':
      return parseSubmitterRecord(node, ctx);
    case 'SUBN':
      fail('structure.unknown-tag', 'The SUBN record must immediately follow the header', node.position);
    case '_PLAC':
    case '_PLACE':
    case '_LOC':
    case '_PLAC_DEFN':
      if (node.tag === '_LOC' && !node.children.some((child) => child.tag === 'NAME')) {
        // A `_LOC` record without a NAME child is not the GEDCOM-L
        // place record — that dialect requires the NAME. It is an
        // extension record whose contents the extension defines
        // (the FamilySearch 7.0 test files exercise this form), so it
        // is preserved verbatim instead of failing the import.
        return parseExtension(node) as ExtensionRecord;
      }
      return parsePlaceRecord(node, ctx);
    case '_CENR':
      return parseCensusRecord(node, ctx);
    case '_TODO':
      return parseTodoRecord(node, ctx);
    case '_EVENT_DEFN':
      return parseEventDefinitionRecord(node, ctx);
    case '_ALIA':
      return parseDuplicateCandidateRecord(node, ctx);
    default:
      if (node.tag.startsWith('_')) {
        return parseExtension(node) as ExtensionRecord;
      }
      if (ctx.version === '5.5.1' && NON_UNDERSCORE_VENDOR_TAGS.has(node.tag)) {
        // The non-underscore vendor tags of 5.x (see vendor-tags.ts):
        // accepted at record level as generic extension records where the
        // standard grammar has no slot for them. 7.0 input stays strict.
        return parseExtension(node) as ExtensionRecord;
      }
      fail('structure.unknown-tag', `Unknown record tag ${node.tag}`, node.position);
  }
}

/**
 * Parses the GDO `_ALIA` duplicate-candidate record (see
 * DuplicateCandidateRecord): a record for a possible duplicate of an
 * individual, with the `_CPT` caption, the `_INDI` pointer, the
 * `_QUAY` assessment, the `_STAT` status, and the NOTE/SOUR
 * substructures (the GenWiki "GEDCOM/_Nutzerdef-Tag" table:
 * https://wiki.genealogy.net/GEDCOM/_Nutzerdef-Tag).
 */
function parseDuplicateCandidateRecord(node: RawNode, ctx: Ctx): DuplicateCandidateRecord {
  noPayload(node);
  const rec: DuplicateCandidateRecord = {
    tag: '_ALIA',
    ...(node.xref === undefined ? {} : { xref: node.xref }),
  };
  dispatch(
    node,
    rec,
    {
      _CPT: (child) => {
        rec.caption = reqText(child);
      },
      _INDI: (child) => {
        rec.individual = reqPtr(child, ctx);
      },
      _QUAY: (child) => {
        // The assessment value set is undocumented; kept verbatim.
        rec.assessment = reqText(child);
      },
      _STAT: (child) => {
        // The status value set is undocumented; kept verbatim.
        rec.status = reqText(child);
      },
      NOTE: (child) => {
        (rec.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SOUR: (child) => {
        (rec.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
    ['_CPT', '_INDI', '_QUAY', '_STAT'],
  );
  return rec;
}

// ---------------------------------------------------------------------------
