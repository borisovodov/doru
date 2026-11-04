/**
 * Parser section: the GenoPro entity records.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the genopro-entity model JSDoc.
 */

import { dispatch, noPayload, reqPtr, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import { parseDateStructure, parseNoteStructure } from './substructures';
import { parsePlaceStructure } from './names-places';
import { parseSourceCitation } from './sources-media';
import type {
  ContactRecord,
  EducationRecord,
  GenoProEntity,
  MarriageRecord,
  OccupationRecord,
  TwinRecord,
} from '../structures';

/** The shared GenoPro entity fields (place, dates, notes, citations). */
function entityHandlers(out: GenoProEntity, ctx: Ctx): Record<string, (child: RawNode) => void> {
  return {
    PLAC: (child) => {
      out.place = parsePlaceStructure(child, ctx);
    },
    DATESTART: (child) => {
      out.dateStart = parseDateStructure(child, ctx);
    },
    DATEEND: (child) => {
      out.dateEnd = parseDateStructure(child, ctx);
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOURCE: (child) => {
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    },
  };
}

/** Parses a GenoPro `Occupation` record into an OccupationRecord. */
export function parseOccupationRecord(node: RawNode, ctx: Ctx): OccupationRecord {
  noPayload(node);
  const out: OccupationRecord = { tag: 'Occupation', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      ...entityHandlers(out, ctx),
      COMPANY: (child) => {
        out.company = reqText(child);
      },
      INDUSTRY: (child) => {
        out.industry = reqText(child);
      },
      TITL: (child) => {
        out.title = reqText(child);
      },
      DURATION: (child) => {
        out.duration = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

/** Parses a GenoPro `Education` record into an EducationRecord. */
export function parseEducationRecord(node: RawNode, ctx: Ctx): EducationRecord {
  noPayload(node);
  const out: EducationRecord = { tag: 'Education', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      ...entityHandlers(out, ctx),
      INSTITUTION: (child) => {
        out.institution = reqText(child);
      },
    },
    ctx,
  );
  return out;
}

/** Parses a GenoPro `Contact` record into a ContactRecord. */
export function parseContactRecord(node: RawNode, ctx: Ctx): ContactRecord {
  noPayload(node);
  const out: ContactRecord = { tag: 'Contact', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(node, out, entityHandlers(out, ctx), ctx);
  return out;
}

/** Parses a GenoPro `Marriage` record into a MarriageRecord. */
export function parseMarriageRecord(node: RawNode, ctx: Ctx): MarriageRecord {
  noPayload(node);
  const out: MarriageRecord = { tag: 'Marriage', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      ...entityHandlers(out, ctx),
      TYPE: (child) => {
        out.type = reqText(child);
      },
      DATE: (child) => {
        out.date = parseDateStructure(child, ctx);
      },
    },
    ctx,
  );
  return out;
}

/** Parses a GenoPro `Twin` record into a TwinRecord. */
export function parseTwinRecord(node: RawNode, ctx: Ctx): TwinRecord {
  noPayload(node);
  const out: TwinRecord = { tag: 'Twin', ...(node.xref === undefined ? {} : { xref: node.xref }) };
  dispatch(
    node,
    out,
    {
      TWINLINK: (child) => {
        out.kind = reqText(child);
      },
      FAMILY: (child) => {
        // Kept verbatim, unresolved (see TwinRecord.family).
        out.family = child.value.kind === 'pointer' ? child.value.pointer : reqText(child);
      },
    },
    ctx,
  );
  return out;
}

/** The GenoPro entity record parsers, by record tag. */
export const GENOPRO_RECORD_PARSERS: Record<string, (node: RawNode, ctx: Ctx) => unknown> = {
  Occupation: parseOccupationRecord,
  Education: parseEducationRecord,
  Contact: parseContactRecord,
  Marriage: parseMarriageRecord,
  Twin: parseTwinRecord,
};

/** The INDI container tags of the GenoPro entities, mapped to their
 *  record kinds. */
export const GENOPRO_CONTAINERS: Record<string, string> = {
  OCCUPATIONS: 'Occupation',
  EDUCATIONS: 'Education',
  CONTACTS: 'Contact',
  UNIONS: 'Marriage',
  TWINS: 'Twin',
};

/** A GenoPro container line under INDI: `1 OCCUPATIONS @occu…@` —
 *  the pointer to the entity record, resolved. */
export function parseGenoproContainer(node: RawNode, ctx: Ctx): string {
  return reqPtr(node, ctx);
}
