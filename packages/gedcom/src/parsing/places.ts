/**
 * Parser section: the vendor master-place records and their links.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The three wire dialects
 * (`_PLAC`, `_LOC`, `_PLAC_DEFN`) normalize into one PlaceRecord; the
 * full rules live in the PlaceRecord JSDoc.
 */

import { fail } from '../errors';
import { dispatch, req, reqPtr, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import { parseMapCoordinates } from './names-places';
import { parseMultimediaLink, parseSourceCitation } from './sources-media';
import {
  parseChangeDate,
  parseNoteStructure,
  parseReferenceIdentifier,
  parseUniqueIdentifier,
} from './substructures';
import type {
  GedcomRecord,
  PlaceRecord,
  PlaceStructure,
} from '../structures';

/** Parses a `_PLAC`, `_LOC` or `_PLAC_DEFN` record into a PlaceRecord. */
export function parsePlaceRecord(node: RawNode, ctx: Ctx): PlaceRecord {
  let payload: string;
  if (node.tag === '_PLAC') {
    payload = reqText(node);
  } else {
    if (node.value.kind !== 'absent') {
      fail('structure.unexpected-payload', `The ${node.tag} line must not have a payload`, node.position);
    }
    // 5.5EL keeps the name in a NAME child; Legacy in a PLAC child.
    payload = reqText(req(node, node.tag === '_LOC' ? 'NAME' : 'PLAC'));
  }
  const out: PlaceRecord = { tag: '_PLAC', payload, ...(node.xref === undefined ? {} : { xref: node.xref }) };
  const handlers: Record<string, (child: RawNode) => void> = {
    ABBR: (child) => {
      out.abbreviation = reqText(child);
    },
    MAP: (child) => {
      out.map = parseMapCoordinates(child, ctx);
    },
    NOTE: (child) => {
      (out.notes ??= []).push(parseNoteStructure(child, ctx));
    },
    SOUR: (child) => {
      (out.citations ??= []).push(parseSourceCitation(child, ctx));
    },
    OBJE: (child) => {
      (out.media ??= []).push(parseMultimediaLink(child, ctx));
    },
    '_LOC': (child) => {
      out.parent = reqPtr(child, ctx);
    },
    REFN: (child) => {
      (out.identifiers ??= []).push(parseReferenceIdentifier(child, ctx));
    },
    '_UID': (child) => {
      (out.identifiers ??= []).push(parseUniqueIdentifier(child));
    },
    CHAN: (child) => {
      out.changeDate = parseChangeDate(child, ctx);
    },
  };
  if (node.tag === '_LOC') {
    // The required NAME child was consumed above.
    handlers['NAME'] = () => undefined;
  }
  if (node.tag === '_PLAC_DEFN') {
    // The required PLAC child was consumed above.
    handlers['PLAC'] = () => undefined;
  }
  dispatch(node, out, handlers, ctx, ['ABBR', 'MAP', 'CHAN']);
  return out;
}

/**
 * Collects every PlaceStructure reachable from the given root (the
 * model is a plain object graph, so the walk is structural).
 */
export function collectPlaces(root: unknown): PlaceStructure[] {
  const out: PlaceStructure[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
      return;
    }
    if (value === null || typeof value !== 'object') {
      return;
    }
    const obj = value as Record<string, unknown>;
    if (obj['tag'] === 'PLAC' && Array.isArray(obj['payload'])) {
      out.push(value as PlaceStructure);
    }
    for (const key of Object.keys(obj)) {
      walk(obj[key]);
    }
  };
  walk(root);
  return out;
}

/**
 * Materializes the name-based links between events and place records:
 * a place whose text equals a card's payload gets its `location` set to
 * the card (cards without an xref receive a synthesized one). Explicit
 * `_LOC` pointers are already typed by the place parser; unmatched or
 * ambiguous names stay unlinked (no errors).
 */
export function linkPlacesByName(records: GedcomRecord[], ctx: Ctx): void {
  const cards = new Map<string, PlaceRecord>();
  for (const record of records) {
    if (record.tag === '_PLAC') {
      const card = record as PlaceRecord;
      if (!cards.has(card.payload)) {
        cards.set(card.payload, card);
      }
    }
  }
  if (cards.size === 0) {
    return;
  }
  for (const place of collectPlaces(records)) {
    if (place.location !== undefined) {
      continue;
    }
    const card = cards.get(place.payload.join(', '));
    if (card === undefined) {
      continue;
    }
    if (card.xref === undefined) {
      let xref: string;
      do {
        xref = `@_SYNP${ctx.syntheticIndex}@`;
        ctx.syntheticIndex++;
      } while (ctx.xrefs.has(xref));
      ctx.xrefs.add(xref);
      card.xref = xref;
    }
    place.location = card.xref;
  }
}
