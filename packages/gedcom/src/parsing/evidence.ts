/**
 * Parser section: the glamberson extension family — the gedcom-evidence
 * records and links, the gedcom-tags records and links, and the shared
 * `_ATTR`/`_VALUE` attribute blocks.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the public
 * API and the README for the layout). The full rules and the sources
 * live in the model JSDoc (model/evidence-record.ts).
 */

import { dispatch, reqPtr, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import type {
  EvidenceEvent,
  EvidenceFinding,
  EvidenceRecord,
  EvidenceReference,
  OccurrenceReference,
  ResearchActivityRecord,
  ResearchConclusion,
  ResearchDocumentRecord,
  TagLink,
  TagRecord,
  VendorAttribute,
} from '../structures';
import { parseAgeStructure, parseChangeDate, parseDateStructure, parseNoteStructure } from './substructures';
import { parsePlaceStructure } from './names-places';
import { parseSourceCitation } from './sources-media';

/** Parses the `_ATTR` name/value block (gedcom-tags and gedcom-occurrences). */
export function parseVendorAttribute(node: RawNode, ctx: Ctx): VendorAttribute {
  const out: VendorAttribute = { tag: '_ATTR', payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      _VALUE: (child) => {
        out.value = reqText(child);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
    ['_VALUE'],
  );
  return out;
}

/** Parses one `_FIND` finding (under `_EVID`, `_EVEN_EVID` and `_RACT`). */
export function parseEvidenceFinding(node: RawNode, ctx: Ctx): EvidenceFinding {
  const out: EvidenceFinding = { tag: '_FIND', payload: reqText(node) };
  dispatch(
    node,
    out,
    {
      TYPE: (child) => {
        out.type = reqText(child);
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      PLAC: (child) => {
        out.place = parsePlaceStructure(child, ctx);
      },
      AGE: (child) => {
        out.age = parseAgeStructure(child, ctx);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      _EVID: (child) => {
        // The v1 activity-record form: the evidence the finding produced.
        (out.evidence ??= []).push(reqPtr(child, ctx));
      },
    },
    ctx,
    ['TYPE', 'DATE', 'PLAC', 'AGE'],
  );
  return out;
}

/** Parses the person/family-side evidence reference (the v1 `_EVID` link
 *  and the v2 `_EVREF`, both normalized to `_EVREF`). */
export function parseEvidenceReference(node: RawNode, ctx: Ctx): EvidenceReference {
  const out: EvidenceReference = { tag: '_EVREF', evidence: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      _CONF: (child) => {
        out.confidence = reqText(child);
      },
      _USED: (child) => {
        out.used = reqText(child);
      },
      _RDOC: (child) => {
        (out.documents ??= []).push(reqPtr(child, ctx));
      },
      QUAY: (child) => {
        out.quality = reqText(child);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SNOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
    ['_CONF', '_USED', '_RDOC', 'QUAY'],
  );
  return out;
}

/** Parses one `_EVEN_EVID` attached-evidence event under INDI. */
export function parseEvidenceEvent(node: RawNode, ctx: Ctx): EvidenceEvent {
  const out: EvidenceEvent = { tag: '_EVEN_EVID' };
  dispatch(
    node,
    out,
    {
      TYPE: (child) => {
        out.type = reqText(child);
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
      _FIND: (child) => {
        (out.findings ??= []).push(parseEvidenceFinding(child, ctx));
      },
      _CONF: (child) => {
        out.confidence = reqText(child);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
    ['TYPE', 'DATE', '_CONF'],
  );
  return out;
}

/** Parses a `_EVID` record (the v1/v2 union grammar). */
export function parseEvidenceRecord(node: RawNode, ctx: Ctx): EvidenceRecord {
  const out: EvidenceRecord = { tag: '_EVID', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      _TYPE: (child) => {
        out.type = reqText(child);
      },
      _DTYPE: (child) => {
        out.documentType = reqText(child);
      },
      _ID: (child) => {
        (out.identifiers ??= []).push(reqText(child));
      },
      _FIND: (child) => {
        (out.findings ??= []).push(parseEvidenceFinding(child, ctx));
      },
      _ANAL: (child) => {
        (out.analysis ??= []).push(reqText(child));
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SNOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      UID: (child) => {
        (out.uids ??= []).push(reqText(child));
      },
      _RDOC: (child) => {
        // The census-example link to a related document (in that file
        // an OBJE record); the pointer is kept verbatim.
        (out.documents ??= []).push(reqPtr(child, ctx));
      },
      CHAN: (child) => {
        out.changeDate = parseChangeDate(child, ctx);
      },
    },
    ctx,
    ['_TYPE', '_DTYPE', 'DATE', 'CHAN'],
  );
  return out;
}

/** Parses a `_RDOC` research-documentation record. */
export function parseResearchDocumentRecord(node: RawNode, ctx: Ctx): ResearchDocumentRecord {
  const out: ResearchDocumentRecord = { tag: '_RDOC', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      _TITL: (child) => {
        out.title = reqText(child);
      },
      _TEXT: (child) => {
        out.text = reqText(child);
      },
      _SUBJ: (child) => {
        (out.subjects ??= []).push(reqPtr(child, ctx));
      },
      _EVID: (child) => {
        (out.evidence ??= []).push(reqPtr(child, ctx));
      },
      _CONC: (child) => {
        const conclusion: ResearchConclusion = { tag: '_CONC' };
        dispatch(
          child,
          conclusion,
          {
            _SUBJ: (grandchild) => {
              conclusion.subject = reqPtr(grandchild, ctx);
            },
            _TEXT: (grandchild) => {
              conclusion.text = reqText(grandchild);
            },
          },
          ctx,
          ['_SUBJ', '_TEXT'],
        );
        (out.conclusions ??= []).push(conclusion);
      },
      AUTH: (child) => {
        out.author = reqText(child);
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      CHAN: (child) => {
        out.changeDate = parseChangeDate(child, ctx);
      },
    },
    ctx,
    ['_TITL', '_TEXT', 'AUTH', 'DATE', 'CHAN'],
  );
  return out;
}

/** Parses a `_RACT` research-activity record. */
export function parseResearchActivityRecord(node: RawNode, ctx: Ctx): ResearchActivityRecord {
  const out: ResearchActivityRecord = { tag: '_RACT', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      _TYPE: (child) => {
        out.type = reqText(child);
      },
      _PURP: (child) => {
        out.purpose = reqText(child);
      },
      _TARG: (child) => {
        out.target = reqText(child);
      },
      _VENU: (child) => {
        out.venue = reqText(child);
      },
      _RSLT: (child) => {
        out.result = reqText(child);
      },
      _FIND: (child) => {
        (out.findings ??= []).push(parseEvidenceFinding(child, ctx));
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      _RSRCH: (child) => {
        out.researcher = reqText(child);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      CHAN: (child) => {
        out.changeDate = parseChangeDate(child, ctx);
      },
    },
    ctx,
    ['_TYPE', '_PURP', '_TARG', '_VENU', '_RSLT', 'DATE', '_RSRCH', 'CHAN'],
  );
  return out;
}

/** Parses a `_TAG` organizational-tag record (gedcom-tags). */
export function parseTagRecord(node: RawNode, ctx: Ctx): TagRecord {
  const out: TagRecord = { tag: '_TAG', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      NAME: (child) => {
        out.name = reqText(child);
      },
      _COLOR: (child) => {
        out.color = reqText(child);
      },
      _ATTR: (child) => {
        (out.attributes ??= []).push(parseVendorAttribute(child, ctx));
      },
    },
    ctx,
    ['NAME', '_COLOR'],
  );
  return out;
}

/** Parses one `_TAG @xref@` application link under a record (gedcom-tags). */
export function parseTagLink(node: RawNode, ctx: Ctx): TagLink {
  const out: TagLink = { tag: '_TAG', target: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
    },
    ctx,
    ['DATE'],
  );
  return out;
}

/** Parses one `_OCREF` occurrence reference (INDI/FAM/event position). */
export function parseOccurrenceReference(node: RawNode, ctx: Ctx): OccurrenceReference {
  const out: OccurrenceReference = { tag: '_OCREF', occurrence: reqPtr(node, ctx) };
  dispatch(
    node,
    out,
    {
      ROLE: (child) => {
        out.role = reqText(child);
      },
      AGE: (child) => {
        out.age = parseAgeStructure(child, ctx);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
      _ATTR: (child) => {
        (out.attributes ??= []).push(parseVendorAttribute(child, ctx));
      },
    },
    ctx,
    ['ROLE', 'AGE'],
  );
  return out;
}
