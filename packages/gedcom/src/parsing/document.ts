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
  parseHeader,
} from './header';
import type {
  RawNode,
} from './lines';
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
import {
  parseSubmissionRecord,
  parseSubmitterRecord,
} from './submitters';

// Document
// ---------------------------------------------------------------------------

export function parseDocument(raw: { nodes: RawNode[] }, version: '7.0' | '5.5.1'): GedcomDataset {
  const ctx: Ctx = {
    version,
    xrefs: new Set(raw.nodes.map((node) => node.xref).filter((xref): xref is string => xref !== undefined)),
    synthetic: [],
    syntheticIndex: 0,
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
    if (trailer !== undefined) {
      fail('document.trailer-not-last', 'The TRLR line must be the last line of the document', node.position);
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
      if (ctx.version !== '5.5.1') {
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
    case '_LOC':
    case '_PLAC_DEFN':
      return parsePlaceRecord(node, ctx);
    default:
      if (node.tag.startsWith('_')) {
        return parseExtension(node) as ExtensionRecord;
      }
      fail('structure.unknown-tag', `Unknown record tag ${node.tag}`, node.position);
  }
}

// ---------------------------------------------------------------------------
