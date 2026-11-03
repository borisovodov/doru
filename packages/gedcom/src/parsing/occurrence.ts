/**
 * Parser section: the occurrence record of the glamberson
 * gedcom-occurrences extension.
 *
 * Part of the strict GEDCOM assembler (see assemble.ts for the
 * public API and the README for the layout). The full rules live in
 * the OccurrenceRecord JSDoc.
 */

import { dispatch, noPayload, reqPtr, reqText } from './context';
import type { Ctx } from './context';
import type { RawNode } from './lines';
import type { OccurrenceParticipant, OccurrenceRecord } from '../structures';
import { parseAgeStructure, parseDateStructure, parseNoteStructure } from './substructures';
import { parsePlaceStructure } from './names-places';
import { parseSourceCitation } from './sources-media';

/** Parses a `_OCUR` record into an OccurrenceRecord. */
export function parseOccurrenceRecord(node: RawNode, ctx: Ctx): OccurrenceRecord {
  noPayload(node);
  const out: OccurrenceRecord = { tag: '_OCUR', ...(node.xref === undefined ? {} : { xref: node.xref }) };
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
      _PART: (child) => {
        const participant: OccurrenceParticipant = { tag: '_PART', individual: reqPtr(child, ctx) };
        dispatch(
          child,
          participant,
          {
            ROLE: (grandchild) => {
              participant.role = reqText(grandchild);
            },
            AGE: (grandchild) => {
              participant.age = parseAgeStructure(grandchild, ctx);
            },
            NOTE: (grandchild) => {
              (participant.notes ??= []).push(parseNoteStructure(grandchild, ctx));
            },
          },
          ctx,
          ['ROLE', 'AGE'],
        );
        (out.participants ??= []).push(participant);
      },
      NOTE: (child) => {
        (out.notes ??= []).push(parseNoteStructure(child, ctx));
      },
      SOUR: (child) => {
        (out.citations ??= []).push(parseSourceCitation(child, ctx));
      },
    },
    ctx,
    ['TYPE', 'DATE', 'PLAC'],
  );
  return out;
}
