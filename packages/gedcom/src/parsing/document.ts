/**
 * Parser section: Document.
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
  GedcomError,
} from '../errors';
import type {
  ExtensionRecord,
  GedcomDataset,
  GedcomRecord,
  Header,
  SubmissionRecord,
  SubmitterRecord,
  Trailer,
} from '../structures';
import type {
  Ctx,
} from './context';
import {
  noPayload,
  parseExtension,
  tolerate,
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
  RECORD_TAGS_70,
  resolveStandardTagByUri,
} from './schema-tags';
import {
  GEDCOM_555_TAG_ALIASES,
} from './gedcom-555';
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
import { parseGroupRecord } from './group';
import { parseTreeCategoryRecord, parseTreeTagRecord } from './tree-tags';
import { parseTitleRecord } from './title-record';
import {
  parseContactRecord,
  parseEducationRecord,
  parseMarriageRecord,
  parseOccupationRecord,
  parseTwinRecord,
} from './genopro';
import { parseOccurrenceRecord } from './occurrence';
import {
  parseEvidenceRecord,
  parseResearchActivityRecord,
  parseResearchDocumentRecord,
  parseTagRecord,
} from './evidence';
import {
  parseSubmissionRecord,
  parseSubmitterRecord,
} from './submitters';
import type { DuplicateCandidateRecord } from '../structures';
import type { PublishedSiteRecord } from '../structures';
import {
  parsePrivacyFlag,
} from './sources-media';
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
  // An iterative depth-first walk: a hand-made file can nest
  // thousands of levels (the vscode-gedcom "numbered list" fixture
  // nests 9000), and a recursive walk would blow the JS stack (the
  // same reason parseExtension builds iteratively).
  const stack: RawNode[] = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop() as RawNode;
    if (node.xref !== undefined) {
      xrefs.add(node.xref);
    }
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      stack.push(node.children[i] as RawNode);
    }
  }
  return xrefs;
}

export function parseDocument(raw: { nodes: RawNode[] }, errors?: GedcomError[]): GedcomDataset {
  const ctx: Ctx = {
    xrefs: collectXrefs(raw.nodes),
    synthetic: [],
    syntheticIndex: 0,
    schemaTags: new Map(),
    schema53Labels: new Map(),
    ...(errors === undefined ? {} : { errors }),
  };
  const nodes = raw.nodes;

  // The HEAD record may appear anywhere in the record stream: files in
  // the wild start with a NOTE or straight into records, with the real
  // HEAD following (a document with no HEAD at all gets the
  // synthesized empty header — the full-leniency container rule;
  // parseHeader completes its GEDC). The first HEAD node in the stream
  // is parsed as the header; a later duplicate stays a generic record.
  const headerIndex = nodes.findIndex(
    (node) => node.tag === 'HEAD' || GEDCOM_555_TAG_ALIASES[node.tag] === 'HEAD',
  );
  let header: Header = { tag: 'HEAD', gedcom: { version: '5.5.1' } };
  if (headerIndex !== -1) {
    try {
      header = parseHeader(nodes[headerIndex] as RawNode, ctx);
    } catch (error) {
      if (!tolerate(ctx, error)) {
        throw error;
      }
      // Tolerant mode: an unparseable header becomes the synthesized
      // empty one.
    }
  }

  let index = 0;
  let submission: SubmissionRecord | undefined;
  // The SUBN record must immediately follow the header (GEDCOM 5.5.1
  // §2 p.23); accepted in any file. With the header mid-stream, the
  // SUBN right after it counts.
  const submissionIndex = headerIndex === -1 ? 0 : headerIndex + 1;
  if (nodes[submissionIndex]?.tag === 'SUBN') {
    try {
      submission = parseSubmissionRecord(nodes[submissionIndex] as RawNode, ctx);
    } catch (error) {
      if (!tolerate(ctx, error)) {
        throw error;
      }
    }
  }

  const records: GedcomRecord[] = [];
  let trailer: Trailer | undefined;
  for (; index < nodes.length; index++) {
    if (index === headerIndex) {
      // The node already parsed as the header.
      continue;
    }
    if (index === submissionIndex && submission !== undefined) {
      // The node already parsed as the submission record.
      continue;
    }
    const node = nodes[index] as RawNode;
    if (node.tag === 'HEAD') {
      // A duplicate HEAD block mid-stream (the FamilyEcho CS555
      // exercise files repeat the header per section) is skipped: its
      // content is the already-parsed header's.
      continue;
    }
    try {
      if (node.tag === 'TRLR') {
        noPayload(node);
        if (node.children.length > 0) {
          fail('structure.unexpected-payload', 'The TRLR line must not have substructures', (node.children[0] as RawNode).position);
        }
        if (node.xref !== undefined) {
          fail('line.xref-on-substructure', 'The TRLR pseudo-structure must not have a cross-reference identifier', node.position);
        }
        // The TRLR is tolerated anywhere (the full-leniency container
        // rule): the records after it still parse.
        trailer = { tag: 'TRLR' };
        continue;
      }
      records.push(parseRecord(node, ctx));
    } catch (error) {
      if (!tolerate(ctx, error)) {
        throw error;
      }
    }
  }
  if (trailer === undefined) {
    // A missing TRLR is tolerated (the full-leniency container rule).
    trailer = { tag: 'TRLR' };
  }

  // A SUBM record without a NAME carries no genealogy data: some
  // exporters emit bookkeeping-only records (GEDKeeper writes a SUBM
  // with just a _UID and a CHAN). Drop the record right here in the
  // parser so no consumer ever sees an empty submitter; a header or
  // submission pointer at a dropped record is reset too (a dangling
  // pointer would serialize back).
  const droppedSubmitters = new Set<string>();
  for (let recordIndex = records.length - 1; recordIndex >= 0; recordIndex--) {
    const record = records[recordIndex];
    if (record === undefined || record.tag !== 'SUBM') {
      continue;
    }
    const name = (record as SubmitterRecord).name;
    if (typeof name !== 'string' || name.trim() !== '') {
      // An extension SUBM (no typed name) or a named submitter stays.
      continue;
    }
    records.splice(recordIndex, 1);
    if (record.xref !== undefined) {
      droppedSubmitters.add(record.xref);
    }
  }
  if (header.submitter !== undefined && droppedSubmitters.has(header.submitter)) {
    delete header.submitter;
  }
  if (submission?.submitter !== undefined && droppedSubmitters.has(submission.submitter)) {
    delete submission.submitter;
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
  try {
    return parseRecordStrict(node, ctx);
  } catch (error) {
    if (tolerate(ctx, error)) {
      // Tolerant mode: the record's error is recorded and the record
      // is preserved verbatim as a generic extension record.
      return parseExtension(node, ctx) as ExtensionRecord;
    }
    throw error;
  }
}

function parseRecordStrict(node: RawNode, ctx: Ctx): GedcomRecord {
  // The GEDCOM 5.5.5 draft's full-word record spellings (HEADER for
  // HEAD, INDIVIDUAL for INDI, TRAILER for TRLR — the published 5.5.5
  // sample and the FamilySearch gedcom5-conversion test resources;
  // see parsing/gedcom-555.ts) parse as the standard record.
  const recordAlias = GEDCOM_555_TAG_ALIASES[node.tag];
  if (recordAlias !== undefined) {
    node = { ...node, tag: recordAlias };
  }
  if (node.tag.startsWith('_')) {
    // A SCHMA-documented record alias (`_USER → g7:record-SUBM`, …)
    // parses as the standard record — standard-first (see
    // parsing/schema-tags.ts). A tag declared with several URIs
    // (GEDCOM 7.0 §1.5.1) resolves to the standard record named by the
    // one URI that names a standard record type; several or none keep
    // the extension meaning. The resolution applies
    // in every file.
    let recordTag: string | undefined;
    for (const uri of ctx.schemaTags.get(node.tag) ?? []) {
      const standard = resolveStandardTagByUri(uri);
      if (standard === undefined || !RECORD_TAGS_70.has(standard)) {
        continue;
      }
      if (recordTag !== undefined && recordTag !== standard) {
        recordTag = undefined;
        break;
      }
      recordTag = standard;
    }
    if (recordTag !== undefined) {
      node = { ...node, tag: recordTag };
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
      return parseSharedNoteRecord(node, ctx);
    case 'NOTE':
      return parseNoteRecord(node, ctx);
    case 'SOUR':
      return parseSourceRecord(node, ctx);
    case 'SUBM':
      return parseSubmitterRecord(node, ctx);
    case 'SUBN':
      // The ordering rule (the SUBN right after the header, GEDCOM
      // 5.5.1 §2 p.23) is serialization pedantry: a SUBN anywhere in
      // the stream parses as the submission record — the
      // header-adjacent one binds the dataset slot, the others stay
      // records (real files place SUBN after the SUBM record).
      return parseSubmissionRecord(node, ctx);
    case '_PLAC':
    case '_PLACE':
    case '_LOC':
    case '_PLAC_DEFN':
    case '_PLC':
      if (node.tag === '_LOC' && !node.children.some((child) => child.tag === 'NAME')) {
        // A `_LOC` record without a NAME child is not the GEDCOM-L
        // place record — that dialect requires the NAME. It is an
        // extension record whose contents the extension defines
        // (the FamilySearch 7.0 test files exercise this form), so it
        // is preserved verbatim instead of failing the import.
        return parseExtension(node, ctx) as ExtensionRecord;
      }
      return parsePlaceRecord(node, ctx);
    case '_CENR':
      return parseCensusRecord(node, ctx);
    case '_TODO':
    case '_TASK':
      // The My Family Tree `_TASK` spelling normalizes into the
      // Legacy to-do record (see TodoRecord).
      return parseTodoRecord(node, ctx);
    case '_EVENT_DEFN':
    case '_EVDEF':
      // The GEDCOM 5.5.5 draft / RootsMagic `_EVDEF` spelling
      // normalizes into the Legacy event-definition record (see
      // EventDefinitionRecord).
      return parseEventDefinitionRecord(node, ctx);
    case '_ALIA':
      return parseDuplicateCandidateRecord(node, ctx);
    case '_PUBLISH':
      return parsePublishedSiteRecord(node, ctx);
    case '_GRP':
      return parseGroupRecord(node, ctx);
    case '_OCUR':
      return parseOccurrenceRecord(node, ctx);
    case '_EVID':
      return parseEvidenceRecord(node, ctx);
    case '_RDOC':
      return parseResearchDocumentRecord(node, ctx);
    case '_RACT':
      return parseResearchActivityRecord(node, ctx);
    case '_TAG':
      return parseTagRecord(node, ctx);
    case '_MTTAG':
      return parseTreeTagRecord(node, ctx);
    case '_MTCAT':
      return parseTreeCategoryRecord(node, ctx);
    case 'Occupation':
      return parseOccupationRecord(node, ctx) as unknown as GedcomRecord;
    case 'Education':
      return parseEducationRecord(node, ctx) as unknown as GedcomRecord;
    case 'Contact':
      return parseContactRecord(node, ctx) as unknown as GedcomRecord;
    case 'Marriage':
      return parseMarriageRecord(node, ctx) as unknown as GedcomRecord;
    case 'Twin':
      return parseTwinRecord(node, ctx) as unknown as GedcomRecord;
    case 'TITL':
      return parseTitleRecord(node, ctx) as unknown as GedcomRecord;
    default:
      // Full leniency (see the README's Known strict decisions): any
      // record tag the typed grammar has no slot for — an underscore
      // extension tag, a non-underscore vendor tag, or an unknown
      // spelling — parses as a generic ExtensionRecord, preserved
      // verbatim. Unknown record tags are never rejected by spelling.
      return parseExtension(node, ctx) as ExtensionRecord;
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

/**
 * Parses the MyHeritage `_PUBLISH` record (see PublishedSiteRecord):
 * the site a tree was published to, with the `_SITEADDRESS`,
 * `_SITENAME`, `_SITEID`, `_USERNAME` members and the `_DISABLED`
 * flag. The wire shape comes from real MyHeritage exports; not part of
 * any GEDCOM version.
 */
function parsePublishedSiteRecord(node: RawNode, ctx: Ctx): PublishedSiteRecord {
  noPayload(node);
  const rec: PublishedSiteRecord = {
    tag: '_PUBLISH',
    ...(node.xref === undefined ? {} : { xref: node.xref }),
  };
  dispatch(
    node,
    rec,
    {
      _SITEADDRESS: (child) => {
        rec.siteAddress = reqText(child);
      },
      _SITENAME: (child) => {
        rec.siteName = reqText(child);
      },
      _SITEID: (child) => {
        rec.siteId = reqText(child);
      },
      _USERNAME: (child) => {
        rec.username = reqText(child);
      },
      _DISABLED: (child) => {
        rec.disabled = parsePrivacyFlag(child, '_DISABLED');
      },
    },
    ctx,
    ['_SITEADDRESS', '_SITENAME', '_SITEID', '_USERNAME', '_DISABLED'],
  );
  return rec;
}

// ---------------------------------------------------------------------------
